"use client";

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { useAITutor } from "@/contexts/AITutorContext";
import { Send, X, Minus, RotateCcw, Lock, ArrowRight } from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { useSubscription, canUseAI, aiRemaining } from "@/lib/useSubscription";
import { renderLatexInHTML } from "@/lib/katexLoader";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_DEFAULT: Message = {
  role: "assistant",
  content: "Salut ! Comment puis-je t'aider ?",
};

// Mode support (page /child/support) : mêmes mots que le bot support parent.
const WELCOME_SUPPORT: Message = {
  role: "assistant",
  content: "Bonjour ! Je suis **Epsi**, votre assistante d'aide rapide. Posez-moi votre question ou choisissez un sujet ci-dessous.",
};

const SUPPORT_QUICK_SUGGESTIONS = ["Mot de passe oublié", "Gérer mon abonnement", "Ajouter un enfant", "Signaler un bug"];
const DEFAULT_QUICK_SUGGESTIONS = ["Je ne comprends pas", "Donne-moi un indice"];


function renderContent(text: string) {
  // 1. Convertir les backticks contenant du LaTeX en délimiteurs $...$
  //    ex: `\frac{1}{2}` → $\frac{1}{2}$
  let processed = text.replace(/`(\\[^`]+)`/g, (_, math) => `$${math}$`);
  // 2. Pré-rendre tout le LaTeX
  const withLatex = renderLatexInHTML(processed);
  // 3. Gras markdown
  // Pas de couleur forcée : la bulle assistante a un fond sombre, et
  // "--greek-blue" (bleu marine, pensé pour du texte sur fond clair) y devient
  // quasi illisible. Le gras hérite donc la couleur du message.
  const withBold = withLatex.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-black">$1</strong>');
  return <span dangerouslySetInnerHTML={{ __html: withBold }} />;
}

/** Messages élève : même rendu LaTeX que les réponses de l'IA (utile quand
 * l'élève cite un passage du cours via "sélectionner + expliquer", qui
 * contient des $...$), mais sans jamais interpréter le reste du message comme
 * du HTML. On découpe donc le texte en segments $...$/$$...$$ (rendus en
 * KaTeX) et segments de texte brut (échappés) — échapper AVANT de repérer les
 * formules casserait celles contenant "<"/">" (ex. $a<0$), puisque ces
 * caractères font partie de la source LaTeX à faire lire à KaTeX. */
function renderUserContent(text: string) {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\r\n]+?\$)/g);
  const html = parts
    .map((part) => (/^\$/.test(part) ? renderLatexInHTML(part) : escapeHtml(part)))
    .join("");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function AITutor() {
  const { pageContext } = useAITutor();
  const sub = useSubscription();
  const isSupportMode = pageContext.page === "support";
  const WELCOME = isSupportMode ? WELCOME_SUPPORT : WELCOME_DEFAULT;

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [authId, setAuthId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthId(data.user?.id ?? null));
  }, []);

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
  }, [getContextKey]);

  // Load saved messages when exercise changes
  useEffect(() => {
    let cancelled = false;
    loadMessages().then((loaded) => { if (!cancelled) setMessages(loaded); });
    return () => { cancelled = true; };
  }, [loadMessages]);

  // Render math après chaque nouveau message

  // Listen for "explain this passage" requests dispatched by CourseViewer.
  useEffect(() => {
    const onAskAI = async (e: Event) => {
      const message = (e as CustomEvent).detail?.message;
      if (!message) return;

      // Use refs to read the latest state without re-subscribing the listener.
      const currentMessages = messagesRef.current;
      const currentContext = pageContextRef.current;
      const currentContextKey = getContextKeyRef.current();

      const userMsg: Message = { role: "user", content: message };
      const newMessages = [...currentMessages, userMsg];
      setMessages(newMessages);

      setOpen(true);
      setMinimized(false);
      setLoading(true);

      try {
        const res = await fetch("/api/child/ai-tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages.slice(-10), context: currentContext, contextKey: currentContextKey }),
        });
        const data = await res.json();
        const finalMessages = [
          ...newMessages,
          { role: "assistant" as const, content: data.message || "Je suis là ! Réessaie." },
        ];
        setMessages(finalMessages as any);
      } catch (error) {
        console.error("Error sending AI message:", error);
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener("educalcul:ai-question", onAskAI);
    return () => window.removeEventListener("educalcul:ai-question", onAskAI);
  }, []);

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


  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/child/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authId ? { "x-user-auth-id": authId } : {}) },
        body: JSON.stringify({ messages: history.slice(-10), context: pageContext, contextKey: getContextKey() }),
      });

      const data = await res.json();

      // Blocked by subscription
      if (res.status === 403 && data.blocked) {
        const newMessages = [...history, { role: "assistant" as const, content: `${data.reason}` }];
        setMessages(newMessages);
        setLoading(false);
        return;
      }

      const newMessages = [
        ...history,
        { role: "assistant" as const, content: data.message || "Je suis là ! Réessaie." },
      ];
      setMessages(newMessages as any);
    } catch (error) {
      console.error("❌ Fetch error:", error);
      const newMessages = [
        ...history,
        { role: "assistant" as const, content: "Oups, je n'ai pas pu répondre. Essaie encore !" },
      ];
      setMessages(newMessages as any);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, pageContext, getContextKey, authId]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const contextLabel =
    pageContext.courseTitle ||
    pageContext.exerciseTitle ||
    pageContext.quizTitle;

  return (
    <>
      {/* ── Floating button ── */}
      <button
        ref={floatBtnRef}
        onClick={() => { setOpen((v) => !v); setMinimized(false); setHasOpened(true); }}
        aria-label="Ouvrir Epsi"
        className={`fixed bottom-[88px] right-4 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 select-none group
          ${open ? "scale-90" : "hover:scale-110 hover:-translate-y-1"}
          ${!isSupportMode && !hasOpened && !sub.loading && sub.features.ai_access !== "none" ? "animate-bounce-slow" : ""}
        `}
        style={{ background: "#0d1829", border: "1.5px solid rgba(197,161,72,0.45)" }}
      >
        {!isSupportMode && !hasOpened && !sub.loading && sub.features.ai_access !== "none" && (
          <span className="absolute inset-0 rounded-full border-2 border-[var(--greek-gold)] animate-ping opacity-60" />
        )}
        {!isSupportMode && !sub.loading && sub.features.ai_access === "limited" && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--greek-gold)] rounded-full text-[10px] font-black text-[var(--greek-blue)] flex items-center justify-center shadow">
            {aiRemaining(sub)}
          </span>
        )}
        {!isSupportMode && !sub.loading && sub.features.ai_access === "none" && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow">
            <Lock className="w-3 h-3 text-white" />
          </span>
        )}
        {open ? (
          <X className="w-6 h-6" style={{ color: "rgba(240,237,232,0.8)" }} />
        ) : (
          <>
            <Image src="/logoAI.png" alt="EpsiAI" width={30} height={30} className="object-contain" />
          </>
        )}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div
          ref={chatPanelRef}
          className={`fixed bottom-[164px] right-4 z-50 w-[calc(100vw-2rem)] md:w-[350px] max-w-[calc(100vw-1.5rem)]
            rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-[height] duration-300 animate-chat-open
            ${minimized ? "h-[60px]" : "h-[500px]"}
          `}
          style={{ background: "#0d1829", border: "1px solid rgba(197,161,72,0.25)" }}
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(197,161,72,0.15)", background: "rgba(255,255,255,0.03)" }}>
            <Image src="/logoAI.png" alt="Epsi" width={28} height={28} className="object-contain flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-[family-name:var(--font-display)] font-bold text-sm" style={{ color: "var(--greek-gold)" }}>Epsi</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{isSupportMode ? "Assistante IA" : "Tutrice IA · Maths"}</p>
            </div>
            <button onClick={() => { setMessages([WELCOME]); deleteServerHistory(); }}
              className="p-1.5 rounded-lg transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              title="Nouvelle conversation">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setMinimized(v => !v)}
              className="p-1.5 rounded-lg transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <Minus className="w-3.5 h-3.5" />
            </button>
            <GlassCloseButton
              variant="dark"
              size="sm"
              onClick={() => { setOpen(false); setMinimized(false); }}
            />
          </div>

          {!minimized && (
            <>
              {/* ── Context chip ── */}
              {contextLabel && (
                <div className="px-3 pt-2.5 shrink-0">
                  <div className="flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(197,161,72,0.15)" }}>
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
                    <div className="max-w-[82%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                      style={msg.role === "assistant"
                        ? { background: "rgba(255,255,255,0.07)", color: "rgba(240,237,232,0.85)", borderBottomLeftRadius: 4 }
                        : { background: "var(--greek-gold)", color: "#fff", borderBottomRightRadius: 4 }}>
                      {/* Un message élève passe par renderUserContent, qui échappe
                          d'abord le HTML avant de rendre le LaTeX — donc pas de
                          surface XSS, mais un passage cité en $...$ (ex. via
                          "sélectionner + expliquer") s'affiche bien en formule. */}
                      {msg.role === "assistant" ? renderContent(msg.content) : renderUserContent(msg.content)}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2">
                    <Image src="/logoAI.png" alt="" width={20} height={20} className="object-contain flex-shrink-0" />
                    <div className="px-3.5 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <span className="flex gap-1 items-center h-3.5">
                        {[0, 1, 2].map(j => <span key={j} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "rgba(197,161,72,0.7)", animationDelay: `${j * 150}ms` }} />)}
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
                    <button key={s}
                      onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="text-[10px] font-black px-3 py-1.5 rounded-full transition-all"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(197,161,72,0.2)", color: "rgba(197,161,72,0.8)" }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Input or upgrade — le mode support reste accessible à tous ── */}
              {!isSupportMode && sub.features.ai_access === "none" ? (
                <div className="px-3 pb-3 pt-2 shrink-0" style={{ borderTop: "1px solid rgba(197,161,72,0.15)" }}>
                  <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(197,161,72,0.07)", border: "1px solid rgba(197,161,72,0.2)" }}>
                    <Lock className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--greek-gold)" }} />
                    <p className="text-sm font-bold mb-1" style={{ color: "rgba(240,237,232,0.9)" }}>Plan requis</p>
                    <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>L'IA est disponible à partir du plan Premium.</p>
                    <GlassButton href="/parent/subscription" variant="gold" size="sm">
                      Voir les abonnements <ArrowRight className="w-3 h-3" />
                    </GlassButton>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-3 shrink-0 flex gap-2" style={{ borderTop: "1px solid rgba(197,161,72,0.15)" }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Pose ta question…"
                    rows={1}
                    className="flex-1 rounded-xl px-3.5 py-2 text-sm outline-none resize-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(197,161,72,0.15)", color: "rgba(240,237,232,0.85)", minHeight: "36px", maxHeight: "80px" }}
                  />
                  <button onClick={sendMessage} disabled={!input.trim() || loading}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 self-end transition-all hover:-translate-y-0.5 disabled:opacity-40"
                    style={{ background: "var(--greek-gold)" }}>
                    <Send className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
