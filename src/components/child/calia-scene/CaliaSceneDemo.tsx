"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Wand2, X, Mic, MicOff, Loader2, Send } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { getMyProfile } from "@/lib/updateMyProfile";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { compileCourseBlock } from "@/lib/ai/compiler";
import { useAITutor } from "@/contexts/AITutorContext";
import { playListeningCue, playModeProfCue } from "@/lib/audioCues";

const HIGHLIGHT_CLASS = "calia-scene-highlight";
const OUTLINE_SELECTORS: Record<"heading" | "paragraph" | "figure", string> = {
  heading: "h3, h4",
  paragraph: "p",
  figure: ".course-figure",
};

type OutlineKind = "heading" | "paragraph" | "figure";
interface OutlineItem { kind: OutlineKind; index: number; preview: string; el: HTMLElement }

interface TurnAction {
  kind: "highlight" | "scroll_to" | "point_at" | "board_write";
  targetKind: OutlineKind | null;
  targetIndex: number | null;
  latex: string | null;
}
interface TurnResult { say: string; action: TurnAction | null }
interface HistoryMsg { role: "user" | "assistant"; content: string }

function buildOutline(root: HTMLElement | null): OutlineItem[] {
  if (!root) return [];
  const items: OutlineItem[] = [];
  (Object.keys(OUTLINE_SELECTORS) as OutlineKind[]).forEach((kind) => {
    const els = root.querySelectorAll<HTMLElement>(OUTLINE_SELECTORS[kind]);
    els.forEach((el, index) => {
      const preview = (el.textContent || "").trim().slice(0, 140);
      if (preview) items.push({ kind, index, preview, el });
    });
  });
  return items;
}

function pickFrenchVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() || [];
  return voices.find((v) => v.lang.toLowerCase().startsWith("fr")) || voices[0] || null;
}

export default function CaliaSceneDemo({
  contentRef,
}: {
  contentRef: RefObject<HTMLDivElement | null>;
}) {
  // Gate admin-only pour l'instant — retirer cette condition (et isAdmin)
  // pour ouvrir la fonctionnalité à tous une fois le ressenti validé.
  const [isAdmin, setIsAdmin] = useState(false);
  const { setClasseActive } = useAITutor();

  const [isRunning, setIsRunning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sayText, setSayText] = useState<string | null>(null);
  const [pointerRect, setPointerRect] = useState<DOMRect | null>(null);
  const [boardLines, setBoardLines] = useState<string[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [textFallback, setTextFallback] = useState("");

  const highlightedElRef = useRef<HTMLElement | null>(null);
  const historyRef = useRef<HistoryMsg[]>([]);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    getMyProfile<{ role?: string }>().then((profile) => {
      if (profile?.role === "admin") setIsAdmin(true);
    });
  }, []);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  const clearHighlight = () => {
    highlightedElRef.current?.classList.remove(HIGHLIGHT_CLASS);
    highlightedElRef.current = null;
  };

  const stop = () => {
    recognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
    clearHighlight();
    setIsRunning(false);
    setClasseActive(false);
    setSayText(null);
    setPointerRect(null);
    setBoardLines([]);
    setListening(false);
    setSpeaking(false);
    setInterim("");
    setError(null);
    historyRef.current = [];
  };

  const speakBrowserFallback = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "fr-FR";
    const voice = pickFrenchVoice();
    if (voice) utter.voice = voice;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  // Voix naturelle open source (Kyutai Pocket-TTS via /api/calia/tts) —
  // retombe sur la synthese du navigateur si le service est indisponible
  // (cold start du Space, panne reseau...) pour ne jamais rendre Calia muette.
  const speak = async (text: string) => {
    audioRef.current?.pause();
    audioRef.current = null;
    try {
      const res = await fetch("/api/calia/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("tts-failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); speakBrowserFallback(text); };
      await audio.play();
    } catch {
      speakBrowserFallback(text);
    }
  };

  const executeAction = (action: TurnAction | null) => {
    clearHighlight();
    setPointerRect(null);
    if (!action) return;

    if (action.kind === "board_write") {
      if (!action.latex) return;
      const html = renderLatexInHTML(compileCourseBlock({ type: "display_math", latex: action.latex }, [], new Set()));
      setBoardLines((lines) => [...lines, html]);
      return;
    }

    if (!action.targetKind || action.targetIndex === null) return;
    const outline = buildOutline(contentRef.current);
    const target = outline.find((o) => o.kind === action.targetKind && o.index === action.targetIndex);
    if (!target) return;

    if (action.kind === "scroll_to") {
      target.el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (action.kind === "highlight") {
      target.el.classList.add(HIGHLIGHT_CLASS);
      highlightedElRef.current = target.el;
    } else if (action.kind === "point_at") {
      setPointerRect(target.el.getBoundingClientRect());
    }
  };

  const sendTurn = async (studentMessage: string) => {
    setLoading(true);
    setError(null);
    setInterim("");
    historyRef.current = [...historyRef.current, { role: "user", content: studentMessage }];
    try {
      const outline = buildOutline(contentRef.current);
      const res = await fetch("/api/calia/classe-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonOutline: outline.map(({ kind, index, preview }) => ({ kind, index, preview })),
          history: historyRef.current,
          studentMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur du serveur.");
      const result = data as TurnResult;
      historyRef.current = [...historyRef.current, { role: "assistant", content: result.say }];
      setSayText(result.say);
      executeAction(result.action);
      speak(result.say);
    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const speechErrorMessage = (code: string): string => {
    switch (code) {
      case "not-allowed":
      case "service-not-allowed":
        return "Micro bloqué pour ce site. Clique sur le cadenas à côté de l'URL, autorise le micro, puis recharge la page.";
      case "audio-capture":
        return "Aucun micro détecté sur cet appareil.";
      case "network":
        return "La reconnaissance vocale nécessite une connexion internet (elle passe par le service du navigateur).";
      case "no-speech":
        return "Rien entendu, réessaie.";
      default:
        return "La reconnaissance vocale a échoué. Réessaie ou utilise le clavier.";
    }
  };

  const startListening = async () => {
    if (!speechSupported || loading || speaking) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setError(speechErrorMessage("not-allowed"));
      return;
    }
    playListeningCue();
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setListening(true); setInterim(""); };
    recognition.onresult = (e: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += chunk;
        else interimText += chunk;
      }
      setInterim(interimText);
      if (finalText.trim()) sendTurn(finalText.trim());
    };
    recognition.onerror = (e: any) => {
      setListening(false);
      if (e?.error && e.error !== "no-speech" && e.error !== "aborted") setError(speechErrorMessage(e.error));
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError(speechErrorMessage("default"));
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    setListening(false);
  };

  const start = () => {
    playModeProfCue();
    setIsRunning(true);
    setClasseActive(true);
    historyRef.current = [];
    sendTurn("(le cours commence, ouvre la séance)");
  };

  useEffect(() => () => { recognitionRef.current?.abort?.(); window.speechSynthesis?.cancel(); clearHighlight(); }, []);

  const submitTextFallback = () => {
    const text = textFallback.trim();
    if (!text || loading) return;
    setTextFallback("");
    sendTurn(text);
  };

  if (!isAdmin) return null;

  return (
    <>
      <style jsx global>{`
        .${HIGHLIGHT_CLASS} {
          outline: 3px solid var(--greek-gold);
          outline-offset: 4px;
          border-radius: 6px;
          transition: outline-color 0.3s ease;
        }
        @keyframes calia-speak-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>

      <GlassIconButton
        icon={Wand2}
        color="gold"
        size="sm"
        aria-label={isRunning ? "Arrêter Calia en classe" : "Lancer Calia en classe (admin)"}
        onClick={isRunning ? stop : start}
      />

      {isRunning && mounted && createPortal(
        <>
          {/* Rendu via portal sur document.body : CourseViewer est monté à
              l'intérieur du conteneur plein écran `fixed z-50` de
              CourseDetailClient, qui contraint la pile d'empilement de tout
              descendant `position:fixed` malgré un z-index plus élevé. */}
          {pointerRect && (
            <div
              className="fixed z-[70] pointer-events-none"
              style={{
                left: pointerRect.left + pointerRect.width / 2 - 8,
                top: pointerRect.top - 10,
                transition: "left 0.5s ease, top 0.5s ease",
              }}
            >
              <div className="w-4 h-4 rounded-full animate-ping absolute" style={{ background: "var(--greek-gold)", opacity: 0.6 }} />
              <div className="w-4 h-4 rounded-full" style={{ background: "var(--greek-gold)" }} />
            </div>
          )}

          {/* Avatar + bulle — même emplacement que le bouton AITutor
              (bas-droite), masqué pendant cette session (AITutorContext). */}
          <div className="fixed bottom-[88px] right-4 z-[70] flex flex-col items-end gap-3 max-w-[calc(100vw-2rem)]">
            {(sayText || error) && (
              <div
                className="rounded-2xl rounded-br-sm px-4 py-2.5 shadow-lg text-sm max-w-[18rem]"
                style={error ? { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" } : { background: "var(--greek-blue)", color: "#fff" }}
              >
                {error || sayText}
              </div>
            )}
            {interim && (
              <div className="rounded-2xl px-4 py-2 text-sm italic max-w-[18rem]" style={{ background: "rgba(15,30,58,0.06)", color: "var(--text-muted)" }}>
                {interim}…
              </div>
            )}

            <div className="flex items-center gap-2">
              <div
                className="relative shrink-0"
                style={{
                  animation: speaking ? "calia-speak-pulse 0.6s ease-in-out infinite" : undefined,
                  transition: "transform 0.3s ease",
                }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                  style={{ background: "var(--greek-blue)", border: "2px solid var(--greek-gold)" }}
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--greek-gold)" }} />
                  ) : (
                    <Image src="/logoAI.png" alt="Calia" width={30} height={30} className="object-contain" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={stop}
                  aria-label="Fermer Calia en classe"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                  style={{ background: "var(--greek-blue)" }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {speechSupported && (
                <GlassIconButton
                  icon={listening ? MicOff : Mic}
                  color={listening ? "red" : "gold"}
                  aria-label={listening ? "Arrêter d'écouter" : "Parler à Calia"}
                  onClick={listening ? stopListening : startListening}
                  disabled={loading || speaking}
                />
              )}
            </div>

            {!speechSupported && (
              <div className="flex items-center gap-2 rounded-full pl-4 pr-1.5 py-1.5 shadow-lg" style={{ background: "#fff", border: "1px solid var(--greek-border)" }}>
                <input
                  value={textFallback}
                  onChange={(e) => setTextFallback(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitTextFallback()}
                  placeholder="Ton navigateur ne supporte pas la voix — écris ici"
                  className="text-sm outline-none bg-transparent w-56"
                  disabled={loading}
                />
                <GlassIconButton icon={Send} color="navy" size="sm" aria-label="Envoyer" onClick={submitTextFallback} disabled={loading} />
              </div>
            )}
          </div>

          {boardLines.length > 0 && (
            <div
              className="fixed z-[65] rounded-xl shadow-2xl overflow-hidden top-16 left-2 right-2 md:top-20 md:right-4 md:left-auto md:w-72"
              style={{ background: "#2a323a", border: "1px solid rgba(238,242,236,0.15)" }}
            >
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest" style={{ color: "#dcb85f", borderBottom: "1px solid rgba(238,242,236,0.1)" }}>
                Tableau
              </div>
              <div className="px-4 py-3 space-y-1.5" style={{ color: "#eef2ec" }}>
                {boardLines.map((html, i) => (
                  <div key={i} dangerouslySetInnerHTML={{ __html: html }} />
                ))}
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </>
  );
}
