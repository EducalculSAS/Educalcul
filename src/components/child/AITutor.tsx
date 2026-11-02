"use client";

import type { Loose } from "@/types/loose";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAITutor } from "@/contexts/AITutorContext";
import { Send, X, Minus, RotateCcw, Lock, ArrowRight, Mic, MicOff, Camera, Loader2 } from "lucide-react";
import Image from "next/image";
import { useSubscription, aiRemaining } from "@/lib/useSubscription";
import { renderLatexInHTML, renderUserText } from "@/lib/katexLoader";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { subscribeMathKeyboardVisibility } from "@/lib/mathKeyboardVisibility";
import { playListeningCue } from "@/lib/audioCues";

interface Message {
  role: "user" | "assistant";
  content: string;
  /** Message local (erreur, limite atteinte) : affiché, jamais renvoyé à l'IA. */
  local?: boolean;
}

const WELCOME_DEFAULT: Message = {
  role: "assistant",
  content: "Salut ! Comment puis-je t'aider ?",
};

// Mode support (page /child/support) : mêmes mots que le bot support parent.
const WELCOME_SUPPORT: Message = {
  role: "assistant",
  content: "Bonjour ! Je suis **Calia**, votre assistante d'aide rapide. Posez-moi votre question ou choisissez un sujet ci-dessous.",
};

const SUPPORT_QUICK_SUGGESTIONS = ["Mot de passe oublié", "Gérer mon abonnement", "Ajouter un enfant", "Signaler un bug"];
const DEFAULT_QUICK_SUGGESTIONS = ["Je ne comprends pas", "Donne-moi un indice"];


function renderContent(text: string) {
  // 1. Convertir les backticks contenant du LaTeX en délimiteurs $...$
  //    ex: `\frac{1}{2}` → $\frac{1}{2}$
  const processed = text.replace(/`(\\[^`]+)`/g, (_, math) => `$${math}$`);
  // 2. Pré-rendre tout le LaTeX
  const withLatex = renderLatexInHTML(processed);
  // 3. Gras markdown
  // Pas de couleur forcée : la bulle assistante a un fond sombre, et
  // "--greek-blue" (bleu marine, pensé pour du texte sur fond clair) y devient
  // quasi illisible. Le gras hérite donc la couleur du message.
  const withBold = withLatex.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-black">$1</strong>');
  return <span dangerouslySetInnerHTML={{ __html: withBold }} />;
}

/** Messages élève : même rendu que le forum (texte échappé, formules $…$
 * rendues) — utile quand l'élève cite un passage du cours qui contient des
 * formules. */
function renderUserContent(text: string) {
  return <span dangerouslySetInnerHTML={{ __html: renderUserText(text) }} />;
}

export default function AITutor() {
  const { pageContext, classeActive } = useAITutor();
  const sub = useSubscription();
  const isSupportMode = pageContext.page === "support";
  const WELCOME = isSupportMode ? WELCOME_SUPPORT : WELCOME_DEFAULT;

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  // Le clavier mathématique personnalisé (CustomMathKeyboard) occupe tout le
  // bas de l'écran par-dessus la bulle : on l'efface le temps qu'il est
  // ouvert plutôt que de la laisser flotter dessus ou à moitié cachée.
  const [mathKeyboardOpen, setMathKeyboardOpen] = useState(false);

  // Aide aux devoirs : l'élève photographie son exercice, Calia l'aide à le résoudre lui-même (jamais la réponse).
  const [homework, setHomework] = useState<string | null>(null);
  const homeworkRef = useRef<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dictée vocale (push-to-talk) : transcrit dans le champ texte, ne
  // valide/envoie jamais toute seule — l'élève relit et clique Envoyer.
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<Loose>(null);
  const dictationBaseRef = useRef("");

  useEffect(() => {
    const SR = (window as Loose).SpeechRecognition || (window as Loose).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  useEffect(() => subscribeMathKeyboardVisibility(setMathKeyboardOpen), []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!open) return;
      if (
        chatPanelRef.current?.contains(e.target as Node) ||
        floatBtnRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const floatBtnRef = useRef<HTMLButtonElement>(null);
  
  // Refs to store latest state for event listeners
  const messagesRef = useRef<Message[]>([WELCOME]);
  const pageContextRef = useRef(pageContext);
  const getContextKeyRef = useRef<() => string>(() => "default");

  // Get unique key for this exercise/course/quiz
  const getContextKey = useCallback(() => {
    if (pageContext.exerciseTitle) return `exercise-${pageContext.exerciseTitle}`;
    if (pageContext.courseTitle) return `course-${pageContext.courseTitle}`;
    if (pageContext.quizTitle) return `quiz-${pageContext.quizTitle}`;
    if (isSupportMode) return "support";
    return "default";
  }, [pageContext.exerciseTitle, pageContext.courseTitle, pageContext.quizTitle, isSupportMode]);

  // Mini rapport de fin de session (memoire pedagogique partagee avec "Calia
  // en classe") — un seul appel a la fermeture/reinitialisation, pas a
  // chaque message (latence). `summarizedCountRef` evite de renvoyer deux
  // fois le meme echange si l'eleve ouvre/ferme le chat sans rien dire de
  // nouveau entre-temps. Jamais en mode support (rien de pedagogique a y
  // apprendre).
  const summarizedCountRef = useRef(0);
  const maybeSendSessionSummary = useCallback(() => {
    if (isSupportMode) return;
    const current = messagesRef.current;
    if (current.length - summarizedCountRef.current < 4) return;
    const toSummarize = current.slice(summarizedCountRef.current);
    summarizedCountRef.current = current.length;
    fetch("/api/calia/session-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: toSummarize.map((m) => ({ role: m.role, content: m.content })) }),
    }).catch(() => {});
  }, [isSupportMode]);

  // Historique persisté côté serveur (voir /api/child/ai-tutor/messages) —
  // plus de localStorage : conversation potentiellement sensible d'un enfant,
  // qui doit pouvoir être gérée/supprimée (RGPD), pas juste traîner sur
  // l'appareil sans contrôle possible.
  const deleteServerHistory = useCallback(async () => {
    try {
      await fetch(`/api/child/ai-tutor/messages?contextKey=${encodeURIComponent(getContextKey())}`, { method: "DELETE" });
    } catch {
      // best-effort
    }
  }, [getContextKey]);

  // Update refs whenever state changes
  useEffect(() => {
    messagesRef.current = messages;
    pageContextRef.current = pageContext;
    getContextKeyRef.current = getContextKey;
  }, [messages, pageContext, getContextKey]);

  const loadMessages = useCallback(async (): Promise<Message[]> => {
    try {
      const res = await fetch(`/api/child/ai-tutor/messages?contextKey=${encodeURIComponent(getContextKey())}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length > 0) return data.messages;
      }
    } catch (e) {
      console.error("Failed to load chat:", e);
    }
    return [WELCOME];
  // eslint-disable-next-line react-hooks/exhaustive-deps -- texte d'accueil constant
  }, [getContextKey]);

  // Historique chargé seulement une fois le chat ouvert (puis à chaque
  // changement de contexte) : avant, deux requêtes partaient sur chaque page,
  // même si l'élève n'ouvrait jamais Calia.
  useEffect(() => {
    if (!hasOpened) return;
    let cancelled = false;
    loadMessages().then((loaded) => { if (!cancelled && !loadingRef.current) setMessages(loaded); });
    return () => { cancelled = true; };
  }, [loadMessages, hasOpened]);

  // Render math après chaque nouveau message

  // Un seul chemin d'envoi, pour la saisie comme pour « Demander à Calia »
  // (CourseViewer) : mêmes vérifications, mêmes messages d'erreur. Les
  // messages locaux (erreurs, limites) ne repartent jamais vers l'IA.
  const loadingRef = useRef(false);
  const ask = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || loadingRef.current) return;
    loadingRef.current = true;
    const history = [...messagesRef.current, { role: "user" as const, content }];
    messagesRef.current = history;
    setMessages(history);
    setOpen(true);
    setMinimized(false);
    setLoading(true);
    const reply = (m: Message) => {
      const next = [...history, m];
      messagesRef.current = next;
      setMessages(next);
    };
    try {
      const res = await fetch("/api/child/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.filter((m) => !m.local).slice(-10).map(({ role, content }) => ({ role, content })),
          context: homeworkRef.current ? { ...pageContextRef.current, page: "homework", homeworkStatement: homeworkRef.current } : pageContextRef.current,
          contextKey: homeworkRef.current ? "homework" : getContextKeyRef.current(),
          stream: true,
        }),
      });
      // Réponse en flux : le texte s'affiche au fur et à mesure (premier mot en une fraction de seconde).
      if (res.ok && res.body && (res.headers.get("content-type") || "").startsWith("text/plain")) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
            const next = [...history, { role: "assistant" as const, content: text }];
            messagesRef.current = next;
            setMessages(next);
            setLoading(false); // les points d'attente laissent place au texte
          }
        } catch {
          /* flux coupé : on garde ce qui est déjà arrivé */
        }
        text += decoder.decode();
        if (text.trim()) {
          const next = [...history, { role: "assistant" as const, content: text }];
          messagesRef.current = next;
          setMessages(next);
          if (pageContextRef.current.page !== "support") sub.refresh();
        } else {
          reply({ role: "assistant", local: true, content: "Calia n'a pas pu répondre. Réessaie." });
        }
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.message) {
        reply({ role: "assistant", content: data.message });
        if (pageContextRef.current.page !== "support") sub.refresh();
      } else {
        reply({ role: "assistant", local: true, content: data.reason || data.error || "Calia n'a pas pu répondre. Réessaie." });
      }
    } catch {
      reply({ role: "assistant", local: true, content: "Connexion perdue : vérifie ta connexion internet puis réessaie." });
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // « Demander à Calia » depuis un passage surligné du cours.
  useEffect(() => {
    const onAskAI = (e: Event) => {
      const message = (e as CustomEvent).detail?.message;
      if (message) void ask(message);
    };
    window.addEventListener("educalcul:ai-question", onAskAI);
    return () => window.removeEventListener("educalcul:ai-question", onAskAI);
  }, [ask]);

  useEffect(() => {
    if (open && !minimized) {
      // Force scroll after a delay to ensure DOM is updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [messages, open, minimized]);

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, minimized]);


  /** Réduit la photo (grand côté 1600 px, JPEG) avant l'envoi : plus rapide, et la lecture n'y perd rien. */
  const shrinkPhoto = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Photo illisible."));
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Cette image ne peut pas être lue."));
      };
      img.src = url;
    });

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || photoBusy || loadingRef.current) return;
    setOpen(true);
    setPhotoBusy(true);
    const localReply = (content: string) => {
      const next = [...messagesRef.current, { role: "assistant" as const, local: true, content }];
      messagesRef.current = next;
      setMessages(next);
    };
    try {
      const image = await shrinkPhoto(file);
      const res = await fetch("/api/child/homework-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.statement) {
        localReply(data.error || "Je n'ai pas réussi à lire la photo. Essaie avec plus de lumière, bien à plat et en gros plan.");
        return;
      }
      homeworkRef.current = data.statement;
      setHomework(data.statement);
      await ask(`Voici mon exercice, pris en photo :\n${data.statement}\n\nAide-moi à le faire moi-même, sans me donner la réponse.`);
    } catch (err) {
      localReply(err instanceof Error ? err.message : "Je n'ai pas réussi à lire la photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const leaveHomework = () => {
    homeworkRef.current = null;
    setHomework(null);
  };

  const sendMessage = useCallback(() => {
    if (!input.trim() || loading) return;
    const text = input;
    setInput("");
    void ask(text);
  }, [input, loading, ask]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const micErrorMessage = (code: string): string => {
    switch (code) {
      case "not-allowed":
      case "service-not-allowed":
        return "Micro bloqué pour ce site. Autorise-le dans les paramètres du navigateur, puis recharge la page.";
      case "audio-capture":
        return "Aucun micro détecté sur cet appareil.";
      case "network":
        return "La dictée vocale nécessite une connexion internet.";
      default:
        return "La dictée vocale a échoué. Réessaie ou écris ta question.";
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    setListening(false);
  };

  const startListening = async () => {
    if (!speechSupported || listening) return;
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setMicError(micErrorMessage("not-allowed"));
      return;
    }
    playListeningCue();
    const SR = (window as Loose).SpeechRecognition || (window as Loose).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    dictationBaseRef.current = input;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (e: Loose) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += chunk;
        else interimText += chunk;
      }
      const base = dictationBaseRef.current;
      const dictated = (finalText + interimText).trim();
      setInput(dictated ? (base ? `${base} ${dictated}` : dictated) : base);
      if (finalText.trim()) dictationBaseRef.current = base ? `${base} ${finalText.trim()}` : finalText.trim();
    };
    recognition.onerror = (e: Loose) => {
      setListening(false);
      if (e?.error && e.error !== "no-speech" && e.error !== "aborted") setMicError(micErrorMessage(e.error));
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setMicError(micErrorMessage("default"));
    }
  };

  useEffect(() => () => { recognitionRef.current?.abort?.(); }, []);

  const contextLabel =
    pageContext.courseTitle ||
    pageContext.exerciseTitle ||
    pageContext.quizTitle;

  // Une session "Calia en classe" est active : elle occupe déjà l'emplacement
  // bas-droite avec son propre avatar — pas de second Calia à l'écran.
  if (classeActive) return null;

  return (
    <>
      {/* ── Floating button ── */}
      {/* Le déplacement / grossissement va sur ce <span>, le verre (flou) sur le bouton : Safari coupe le flou d'un élément dont le
          transform change. Sur téléphone la bulle est plus petite et plus haute, pour ne pas couvrir « Suivant » / « Valider » (barres du bas). */}
      <span
        className={`fixed bottom-[112px] md:bottom-[88px] right-4 z-50 transition-all duration-300 group
          ${open ? "scale-90" : "hover:scale-110 hover:-translate-y-1"}
          ${!isSupportMode && !hasOpened && !sub.loading && sub.features.ai_access !== "none" ? "animate-bounce-slow" : ""}
          ${mathKeyboardOpen ? "opacity-0 scale-75 pointer-events-none" : ""}
        `}
      >
      <button
        ref={floatBtnRef}
        onClick={() => { setOpen((v) => !v); setMinimized(false); setHasOpened(true); }}
        aria-label="Ouvrir Calia"
        className="liquid-glass-btn calia-glass calia-glass-ring backdrop-blur-[32px] backdrop-saturate-[1.4] relative w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center select-none"
      >
        {!isSupportMode && !hasOpened && !sub.loading && sub.features.ai_access !== "none" && (
          <span className="absolute inset-0 rounded-full border-2 border-[var(--greek-gold)] animate-ping opacity-60 pointer-events-none" />
        )}
        {!isSupportMode && !sub.loading && sub.features.ai_access === "limited" && !open && (
          <span className="calia-glass-gold absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-black text-[var(--greek-blue)] flex items-center justify-center">
            {aiRemaining(sub)}
          </span>
        )}
        {!isSupportMode && !sub.loading && sub.features.ai_access === "none" && !open && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center border border-white/40" style={{ background: "linear-gradient(180deg, rgba(248,113,113,0.95), rgba(220,38,38,0.95))" }}>
            <Lock className="w-3 h-3 text-white" />
          </span>
        )}
        {open ? (
          <X className="w-6 h-6" style={{ color: "rgba(240,237,232,0.8)" }} />
        ) : (
          <>
            <Image src="/logoAI.png" alt="Calia" width={30} height={30} className="object-contain w-6 h-6 md:w-[30px] md:h-[30px]" />
          </>
        )}
      </button>
      </span>

      {/* ── Chat panel ── */}
      {open && !mathKeyboardOpen && (
        <div
          ref={chatPanelRef}
          className={`calia-glass backdrop-blur-[32px] backdrop-saturate-[1.4] fixed bottom-[176px] md:bottom-[164px] right-4 z-50 w-[calc(100vw-2rem)] md:w-[350px] max-w-[calc(100vw-1.5rem)]
            rounded-3xl flex flex-col overflow-hidden transition-[height] duration-300 animate-chat-open
            ${minimized ? "h-[60px]" : "h-[min(500px,calc(100dvh-196px))] md:h-[min(500px,calc(100dvh-184px))]"}
          `}
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
            <Image src="/logoAI.png" alt="Calia" width={28} height={28} className="object-contain flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-[family-name:var(--font-display)] font-bold text-sm" style={{ color: "var(--greek-gold)" }}>Calia</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>{isSupportMode ? "Assistante IA" : "Tutrice IA · Maths"}</p>
            </div>
            {speechSupported && (
              <GlassIconButton
                icon={listening ? Mic : MicOff}
                onClick={listening ? stopListening : startListening}
                color={listening ? "red" : "white"}
                size="sm"
                aria-label={listening ? "Arrêter la dictée" : "Dicter ma question"}
              />
            )}
            <GlassIconButton
              icon={RotateCcw}
              onClick={() => { maybeSendSessionSummary(); summarizedCountRef.current = 0; leaveHomework(); setMessages([WELCOME]); deleteServerHistory(); }}
              color="white"
              size="sm"
              aria-label="Nouvelle conversation"
            />
            <GlassIconButton
              icon={Minus}
              onClick={() => setMinimized(v => !v)}
              color="white"
              size="sm"
              aria-label="Réduire la conversation"
            />
            <GlassCloseButton
              variant="dark"
              size="sm"
              onClick={() => { maybeSendSessionSummary(); setOpen(false); setMinimized(false); }}
            />
          </div>

          {!minimized && (
            <>
              {micError && (
                <div className="mx-3 mt-2.5 px-3 py-2 rounded-xl text-xs shrink-0" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                  {micError}
                </div>
              )}

              {/* ── Context chip ── */}
              {contextLabel && (
                <div className="px-3 pt-2.5 shrink-0">
                  <div className="calia-glass-soft flex items-center gap-2 rounded-xl px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest truncate" style={{ color: "rgba(197,161,72,0.8)" }}>
                      {contextLabel}
                    </span>
                  </div>
                </div>
              )}

              {/* ── Messages ── */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5 min-h-0"
                style={{ scrollbarWidth: "none" }}
              >
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                    {msg.role === "assistant" && (
                      <Image src="/logoAI.png" alt="" width={20} height={20} className="object-contain flex-shrink-0 mt-1" />
                    )}
                    <div className={`max-w-[82%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.local ? "" : msg.role === "assistant" ? "calia-glass-soft" : "calia-glass-gold"}`}
                      style={msg.local
                        ? { background: "rgba(239,68,68,0.14)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)", borderBottomLeftRadius: 4 }
                        : msg.role === "assistant"
                        ? { color: "rgba(240,237,232,0.9)", borderBottomLeftRadius: 4 }
                        : { color: "var(--greek-blue)", borderBottomRightRadius: 4 }}>
                      {/* Un message élève passe par renderUserContent, qui échappe
                          d'abord le HTML avant de rendre le LaTeX, donc pas de
                          surface XSS, mais un passage cité en $...$ (ex. via
                          "sélectionner + expliquer") s'affiche bien en formule. */}
                      {msg.role === "assistant" ? renderContent(msg.content) : renderUserContent(msg.content)}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2">
                    <Image src="/logoAI.png" alt="" width={20} height={20} className="object-contain flex-shrink-0" />
                    <div className="calia-glass-soft px-3.5 py-2.5 rounded-2xl">
                      <span className="flex gap-1 items-center h-3.5">
                        {[0, 1, 2].map(j => <span key={j} className="w-1.5 h-1.5 rounded-full animate-typing-dot" style={{ background: "rgba(197,161,72,0.7)", animationDelay: `${j * 150}ms` }} />)}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ── Quick suggestions ── */}
              {messages.length <= 2 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
                  {(isSupportMode ? SUPPORT_QUICK_SUGGESTIONS : DEFAULT_QUICK_SUGGESTIONS).map((s) => (
                    <GlassButton key={s}
                      onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                      variant="light" size="sm" className="text-[10px]">
                      {s}
                    </GlassButton>
                  ))}
                </div>
              )}

              {/* ── Input or upgrade — le mode support reste accessible à tous ── */}
              {!isSupportMode && sub.features.ai_access === "none" ? (
                <div className="px-3 pb-3 pt-2 shrink-0" style={{ borderTop: "1px solid rgba(197,161,72,0.15)" }}>
                  <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(197,161,72,0.07)", border: "1px solid rgba(197,161,72,0.2)" }}>
                    <Lock className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--greek-gold)" }} />
                    <p className="text-sm font-bold mb-1" style={{ color: "rgba(240,237,232,0.9)" }}>Plan requis</p>
                    <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>L&apos;IA est disponible à partir du plan Premium.</p>
                    <GlassButton href="/parent/subscription" variant="gold" size="sm">
                      Voir les abonnements <ArrowRight className="w-3 h-3" />
                    </GlassButton>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-3 shrink-0 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                  {homework && (
                    <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[11px]" style={{ background: "rgba(197,161,72,0.12)", color: "rgba(240,237,232,0.85)" }}>
                      <span className="truncate">Devoir en photo : Calia te guide sans donner la réponse</span>
                      <button type="button" onClick={leaveHomework} className="shrink-0 underline opacity-80 hover:opacity-100">Quitter</button>
                    </div>
                  )}
                  <div className="flex gap-2">
                  {!isSupportMode && (
                    <>
                      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                      <GlassIconButton
                        icon={photoBusy ? Loader2 : Camera}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={photoBusy || loading}
                        color="white"
                        size="md"
                        className={`self-end ${photoBusy ? "animate-pulse" : ""}`}
                        aria-label="Photographier mon exercice"
                      />
                    </>
                  )}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Pose ta question…"
                    rows={1}
                    className="calia-glass-soft flex-1 rounded-2xl px-3.5 py-2 text-sm outline-none resize-none placeholder:text-white/55 focus:border-[rgba(222,188,104,0.65)] transition-colors"
                    style={{ color: "rgba(240,237,232,0.92)", minHeight: "36px", maxHeight: "80px" }}
                  />
                  <GlassIconButton
                    icon={Send}
                    onClick={sendMessage}
                    disabled={!input.trim() || loading}
                    color="gold"
                    size="md"
                    className="self-end"
                    aria-label="Envoyer le message"
                  />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
