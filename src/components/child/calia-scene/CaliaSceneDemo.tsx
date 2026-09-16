"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, Mic, MicOff, Send } from "lucide-react";
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
  const shouldListenRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const volumeAudioCtxRef = useRef<AudioContext | null>(null);
  const volumeRafRef = useRef<number>(0);
  const clusterRef = useRef<HTMLDivElement | null>(null);
  const [clusterOffset, setClusterOffset] = useState({ x: 0, y: 0 });

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

  const stopVolumeMonitor = () => {
    cancelAnimationFrame(volumeRafRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    volumeAudioCtxRef.current?.close().catch(() => {});
    volumeAudioCtxRef.current = null;
  };

  const stop = () => {
    sessionActiveRef.current = false;
    shouldListenRef.current = false;
    stopVolumeMonitor();
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

  // Voix naturelle (Azure Speech via /api/calia/tts). Passe par fetch() (pas
  // un <audio src> direct) : l'auth de ce site attache le Bearer token aux
  // appels fetch() vers /api/* via un patch de window.fetch
  // (supabaseClient.ts) — un <audio>/<img> n'a aucun moyen d'envoyer un
  // header custom, donc pointer l'element directement sur l'URL renvoyait
  // toujours 401 et retombait en silence sur la voix du navigateur (bug
  // trouve en re-testant : chaque appel faisait 401 en ~15ms, jamais
  // atteint Azure). Retombe sur la synthese du navigateur uniquement si
  // Azure echoue vraiment (console.warn pour verifier facilement).
  const speak = async (text: string) => {
    audioRef.current?.pause();
    audioRef.current = null;
    try {
      const res = await fetch(`/api/calia/tts?text=${encodeURIComponent(text)}`);
      if (!res.ok) throw new Error(`tts-failed-${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); speakBrowserFallback(text); };
      await audio.play();
    } catch (err) {
      console.warn("[Calia] voix Azure indisponible, repli navigateur.", err);
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

  // Fait glisser l'avatar (bulle + Calia + micro) depuis son coin habituel
  // jusqu'a cote de l'element pointe, puis le fait revenir a sa place des que
  // point_at n'est plus l'action en cours (executeAction reinitialise
  // pointerRect a null au debut de chaque tour) — un seul `transform`
  // anime dans les deux sens, pas de va-et-vient entre proprietes CSS
  // differentes.
  useEffect(() => {
    const el = clusterRef.current;
    if (!el) return;
    if (!pointerRect) {
      setClusterOffset({ x: 0, y: 0 });
      return;
    }
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const restingLeft = window.innerWidth - 16 - w;
    const restingTop = window.innerHeight - 88 - h;

    let targetLeft = pointerRect.right + 16;
    if (targetLeft + w > window.innerWidth - 8) targetLeft = pointerRect.left - w - 16;
    targetLeft = Math.max(8, Math.min(targetLeft, window.innerWidth - w - 8));

    let targetTop = pointerRect.top + pointerRect.height / 2 - h / 2;
    targetTop = Math.max(8, Math.min(targetTop, window.innerHeight - h - 8));

    setClusterOffset({ x: targetLeft - restingLeft, y: targetTop - restingTop });
  }, [pointerRect]);

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
      // La session a pu etre fermee (bouton "arreter") pendant l'attente de
      // la reponse — Calia ne doit pas se mettre a parler toute seule apres
      // avoir ete coupee.
      if (!sessionActiveRef.current) return;
      const result = data as TurnResult;
      historyRef.current = [...historyRef.current, { role: "assistant", content: result.say }];
      setSayText(result.say);
      executeAction(result.action);
      speak(result.say);
    } catch (err: any) {
      if (sessionActiveRef.current) setError(err?.message || "Une erreur est survenue.");
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

  // Barge-in par volume : coupe la voix de Calia des qu'un son fort arrive
  // sur le micro, independamment de la reconnaissance vocale (qui a un
  // temps de latence avant de produire le moindre texte — attendre du texte
  // rendait l'interruption trop lente/peu fiable).
  const VOLUME_BARGE_IN_THRESHOLD = 35; // 0-255, a affiner selon retours reels
  const startVolumeMonitor = (stream: MediaStream) => {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    volumeAudioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      if (avg > VOLUME_BARGE_IN_THRESHOLD && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setSpeaking(false);
      }
      volumeRafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const startListening = async () => {
    if (!speechSupported || loading || speaking) return;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(speechErrorMessage("not-allowed"));
      return;
    }
    micStreamRef.current = stream;
    startVolumeMonitor(stream);
    playListeningCue();
    shouldListenRef.current = true;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
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
      const code = e?.error;
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
        shouldListenRef.current = false;
        setError(speechErrorMessage(code));
      } else if (code && code !== "no-speech" && code !== "aborted") {
        setError(speechErrorMessage(code));
      }
    };
    // Chrome coupe parfois la reconnaissance meme en `continuous` (silence
    // prolonge, hoquet reseau) — on la relance automatiquement tant que
    // l'eleve n'a pas explicitement appuye sur "arreter d'ecouter".
    recognition.onend = () => {
      setListening(false);
      if (shouldListenRef.current) {
        try { recognition.start(); } catch { /* deja demarree ou instance perimee */ }
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError(speechErrorMessage("default"));
    }
  };

  const stopListening = () => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop?.();
    stopVolumeMonitor();
    setListening(false);
  };

  const start = () => {
    sessionActiveRef.current = true;
    playModeProfCue();
    setIsRunning(true);
    setClasseActive(true);
    historyRef.current = [];
    startListening();
    sendTurn("(le cours commence, ouvre la séance)");
  };

  useEffect(() => () => { recognitionRef.current?.abort?.(); window.speechSynthesis?.cancel(); stopVolumeMonitor(); clearHighlight(); }, []);

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

      {/* Mini variante de l'avatar Calia (meme recette que le cluster bas-
          droite : cercle navy + logo + liseré) plutot qu'une icone
          generique — identifie immediatement "lancer Calia" au survol. */}
      <button
        type="button"
        onClick={isRunning ? stop : start}
        aria-label={isRunning ? "Arrêter Calia en classe" : "Lancer Calia en classe (admin)"}
        className="relative w-9 h-9 rounded-full flex items-center justify-center shadow-sm transition-transform hover:scale-105 active:scale-95 flex-shrink-0"
        style={{ background: "var(--greek-blue)", border: `2px solid ${isRunning ? "#ef4444" : "var(--greek-gold)"}` }}
      >
        <Image src="/logoAI.png" alt="Calia" width={18} height={18} className="object-contain" />
      </button>

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
          <div
            ref={clusterRef}
            className="fixed bottom-[88px] right-4 z-[70] flex flex-col items-end gap-3 max-w-[calc(100vw-2rem)]"
            style={{ transform: `translate(${clusterOffset.x}px, ${clusterOffset.y}px)`, transition: "transform 0.6s ease" }}
          >
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
                    <span className="flex gap-1 items-center">
                      {[0, 1, 2].map((j) => (
                        <span key={j} className="w-1.5 h-1.5 rounded-full animate-typing-dot" style={{ background: "var(--greek-gold)", animationDelay: `${j * 150}ms` }} />
                      ))}
                    </span>
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
                  icon={listening ? Mic : MicOff}
                  color={listening ? "red" : "gold"}
                  aria-label={listening ? "Arrêter d'écouter" : "Parler à Calia"}
                  onClick={listening ? stopListening : startListening}
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
