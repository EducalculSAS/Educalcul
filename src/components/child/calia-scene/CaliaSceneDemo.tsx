"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, Mic, MicOff, Send, Pencil, GripVertical, Keyboard, Brush, Lock } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassButton from "@/components/ui/GlassButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import DrawingCanvas from "@/components/DrawingCanvas";
import { useSubscription } from "@/lib/useSubscription";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { compileCourseBlock } from "@/lib/ai/compiler";
import { useAITutor } from "@/contexts/AITutorContext";
import { playListeningCue, playModeProfCue } from "@/lib/audioCues";
import { DEFAULT_CALIA_VOICE, isCaliaVoice, type CaliaVoiceId } from "@/lib/caliaVoices";
import { getMyProfile } from "@/lib/updateMyProfile";

const HIGHLIGHT_CLASS = "calia-scene-highlight";
const OUTLINE_SELECTORS: Record<"heading" | "paragraph" | "figure", string> = {
  heading: "h3, h4",
  paragraph: "p",
  figure: ".course-figure",
};

type OutlineKind = "heading" | "paragraph" | "figure";
interface OutlineItem { kind: OutlineKind; index: number; preview: string; el: HTMLElement }

interface TurnAction {
  kind: "highlight" | "scroll_to" | "point_at" | "board_write" | "board_clear" | "ask_student_to_write" | "next_lesson";
  targetKind: OutlineKind | null;
  targetIndex: number | null;
  latex: string | null;
  label: string | null;
}
interface TurnResult { say: string; action: TurnAction | null }
interface HistoryMsg { role: "user" | "assistant"; content: string }
interface CaliaCourseContext {
  courseTitle: string;
  level?: string | null;
  lessons: { title: string; current: boolean; exercises: { question: string; hint?: string | null; answer: string }[] }[];
}



/**
 * Découpe une réplique de Calia en morceaux à synthétiser séparément.
 *
 * Azure ne rend le son qu'une fois la synthèse de TOUT le texte envoyé bien
 * avancée : une réplique de trois phrases mettait ~1,5 à 2 s, contre ~0,5 s
 * pour sa première phrase seule. En synthétisant phrase par phrase, la voix
 * démarre dès la première. Les morceaux trop courts (« Bravo ! ») sont
 * rattachés au suivant : une phrase isolée de deux mots sonne haché.
 */
function splitForSpeech(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+(?=\S)/);
  const chunks: string[] = [];
  let pending = "";
  for (const sentence of sentences) {
    pending = pending ? `${pending} ${sentence}` : sentence;
    if (pending.length >= 20) {
      chunks.push(pending);
      pending = "";
    }
  }
  if (pending) {
    if (chunks.length) chunks[chunks.length - 1] += ` ${pending}`;
    else chunks.push(pending);
  }
  // La route plafonne chaque synthèse à 400 caractères.
  return chunks.flatMap((c) => (c.length <= 400 ? [c] : c.match(/.{1,400}(\s|$)/g) ?? [c]));
}

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

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pickFrenchVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() || [];
  return voices.find((v) => v.lang.toLowerCase().startsWith("fr")) || voices[0] || null;
}

export default function CaliaSceneDemo({
  contentRef,
  courseContext,
  onAdvanceLesson,
}: {
  contentRef: RefObject<HTMLDivElement | null>;
  courseContext?: CaliaCourseContext;
  /** Fait reellement avancer l'affichage a la lecon suivante — sans ca,
   * Calia peut seulement PARLER de la suite du cours (via courseContext),
   * jamais y faire passer l'eleve. */
  onAdvanceLesson?: () => void;
}) {
  // "Calia en classe" est un argument de vente du plan Family — reservee
  // aux comptes (ou enfants d'un parent) dont l'abonnement inclut
  // calia_classe (voir hasCaliaClasseAccess.ts / subscription_plans.features).
  const sub = useSubscription();
  const caliaClasseAllowed = sub.features.calia_classe;
  const { setClasseActive } = useAITutor();

  const [isRunning, setIsRunning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sayText, setSayText] = useState<string | null>(null);
  const [pointerRect, setPointerRect] = useState<DOMRect | null>(null);
  const [boardLines, setBoardLines] = useState<string[]>([]);
  const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
  const [boardWriteOpen, setBoardWriteOpen] = useState(false);
  const [boardInputMode, setBoardInputMode] = useState<"text" | "draw">("text");
  const [boardDraft, setBoardDraft] = useState("");
  const [boardDrawing, setBoardDrawing] = useState<string | null>(null);
  const boardDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [textFallback, setTextFallback] = useState("");
  // La voix se règle dans le profil de l'enfant (users.calia_voice) et suit
  // donc l'enfant d'un appareil à l'autre. Elle n'est lue qu'au lancement de
  // Calia : aucune requête tant que l'élève ne la démarre pas.
  // Promesse mémorisée plutôt qu'un simple état : la première phrase de Calia
  // part souvent avant que le profil ait répondu, et serait sinon prononcée
  // avec la voix par défaut.
  const voiceRef = useRef<Promise<CaliaVoiceId> | null>(null);
  const loadVoice = (): Promise<CaliaVoiceId> => {
    voiceRef.current ??= getMyProfile<{ calia_voice?: string | null }>().then((profile) =>
      isCaliaVoice(profile?.calia_voice) ? profile.calia_voice : DEFAULT_CALIA_VOICE,
    );
    return voiceRef.current;
  };

  // Visibilite live de ce que l'eleve tape dans un mini-exercice de la
  // lecon (emis par CourseViewer/InlineMiniExercises) — meme convention que
  // educalcul:ai-question. Stocke seulement le plus recent, envoye avec
  // chaque tour pour que Calia puisse reagir a un brouillon en cours.
  const liveExerciseDraftRef = useRef<{ question: string; value: string } | null>(null);
  useEffect(() => {
    const onExerciseInput = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.question) return;
      liveExerciseDraftRef.current = { question: detail.question, value: detail.value || "" };
    };
    window.addEventListener("educalcul:exercise-input", onExerciseInput);
    return () => window.removeEventListener("educalcul:exercise-input", onExerciseInput);
  }, []);

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
    // Mini rapport de fin de session (memoire pedagogique partagee avec le
    // chatbot) — fire-and-forget, un seul appel ici (pas a chaque tour) pour
    // ne pas retoucher la latence deja optimisee. Ignore les sessions trop
    // courtes (ex: lancee puis coupee tout de suite, rien a en tirer).
    if (historyRef.current.length >= 4) {
      fetch("/api/calia/session-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: historyRef.current }),
      }).catch(() => {});
    }
    sessionActiveRef.current = false;
    shouldListenRef.current = false;
    stopVolumeMonitor();
    recognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel();
    cancelSpeech();
    clearHighlight();
    setIsRunning(false);
    setClasseActive(false);
    setSayText(null);
    setPointerRect(null);
    setBoardLines([]);
    setBoardOffset({ x: 0, y: 0 });
    setBoardWriteOpen(false);
    setBoardDraft("");
    setBoardDrawing(null);
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
  // Chaque nouvelle réplique (ou un arrêt, ou l'élève qui reprend la parole)
  // incrémente ce compteur : une file de phrases en cours sait ainsi qu'elle
  // doit s'arrêter.
  const speechGenRef = useRef(0);
  const cancelSpeech = () => {
    speechGenRef.current++;
    audioRef.current?.pause();
  };

  // Un seul lecteur audio, réutilisé pour chaque phrase : sur iPhone, un
  // lecteur déjà « débloqué » rejoue sans restriction, alors qu'en créer un
  // nouveau à chaque phrase (hors geste de l'élève) peut être refusé.
  const getPlayer = () => {
    audioRef.current ??= new Audio();
    return audioRef.current;
  };

  const playBlob = (blob: Blob, gen: number) =>
    new Promise<boolean>((resolve) => {
      const player = getPlayer();
      const url = URL.createObjectURL(blob);
      const finish = (ok: boolean) => {
        player.onended = player.onpause = player.onerror = null;
        URL.revokeObjectURL(url);
        resolve(ok && gen === speechGenRef.current);
      };
      player.onplay = () => setSpeaking(true);
      player.onended = () => finish(true);
      player.onpause = () => { if (!player.ended) finish(false); };
      player.onerror = () => finish(false);
      player.src = url;
      player.play().catch(() => finish(false));
    });

  // Voix naturelle (Azure Speech via /api/calia/tts), synthétisée PHRASE PAR
  // PHRASE : toutes les synthèses partent en même temps, la première est jouée
  // dès qu'elle arrive (~0,5 s) pendant que les suivantes se préparent. Avant,
  // la réplique entière était synthétisée puis téléchargée en bloc avant le
  // premier son : ~4 s de silence après l'affichage du texte.
  //
  // Passe par fetch() (pas un <audio src> direct) : l'auth de ce site attache
  // le Bearer token aux appels fetch() vers /api/* via un patch de
  // window.fetch (supabaseClient.ts) — un <audio> n'a aucun moyen d'envoyer
  // un header, et chaque appel faisait 401. Retombe sur la synthèse du
  // navigateur uniquement si Azure échoue vraiment.
  const speak = async (text: string) => {
    cancelSpeech();
    const gen = speechGenRef.current;
    const chunks = splitForSpeech(text);
    if (chunks.length === 0) return;

    const voice = await loadVoice().catch(() => DEFAULT_CALIA_VOICE);
    if (gen !== speechGenRef.current) return;

    const synth = chunks.map((chunk) =>
      fetch(`/api/calia/tts?text=${encodeURIComponent(chunk)}&voice=${encodeURIComponent(voice)}`).then((res) => {
        if (!res.ok) throw new Error(`tts-failed-${res.status}`);
        return res.blob();
      }),
    );
    // Une synthèse qui échoue alors que la file a déjà été annulée ne doit
    // pas remonter en erreur non gérée.
    synth.forEach((p) => p.catch(() => {}));

    for (let i = 0; i < chunks.length; i++) {
      let blob: Blob;
      try {
        blob = await synth[i];
      } catch (err) {
        if (gen !== speechGenRef.current) return;
        console.warn("[Calia] voix Azure indisponible, repli navigateur.", err);
        speakBrowserFallback(chunks.slice(i).join(" "));
        return;
      }
      if (gen !== speechGenRef.current) return;
      if (!(await playBlob(blob, gen))) return;
    }
    if (gen === speechGenRef.current) setSpeaking(false);
  };

  const executeAction = (action: TurnAction | null) => {
    clearHighlight();
    setPointerRect(null);
    if (!action) return;

    if (action.kind === "board_clear") {
      setBoardLines([]);
      return;
    }

    if (action.kind === "ask_student_to_write") {
      setBoardWriteOpen(true);
      return;
    }

    if (action.kind === "next_lesson") {
      onAdvanceLesson?.();
      return;
    }

    if (action.kind === "board_write") {
      if (!action.latex) return;
      const html = renderLatexInHTML(compileCourseBlock({ type: "display_math", latex: action.latex }, [], new Set()));
      setBoardLines((lines) => [...lines, action.label ? `<p class="calia-board-label">${escapeHtml(action.label)}</p>${html}` : html]);
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
          courseContext,
          liveExerciseDraft: liveExerciseDraftRef.current,
          history: historyRef.current,
          studentMessage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erreur du serveur.");
      if (typeof data?.say !== "string" || !data.say.trim()) throw new Error("Calia n'a pas entendu, redis-moi ta question.");
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

  // Tableau deplacable : le header sert de poignee (Pointer Events, sur le
  // meme modele que DrawingCanvas — setPointerCapture + touch-action:none),
  // applique en `transform` comme le cluster avatar, mais sans retour
  // automatique a la position d'origine : une fois deplace par l'eleve, le
  // tableau reste ou il l'a mis.
  const onBoardHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    boardDragRef.current = { startX: e.clientX, startY: e.clientY, baseX: boardOffset.x, baseY: boardOffset.y };
  };
  const onBoardHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = boardDragRef.current;
    if (!drag) return;
    setBoardOffset({ x: drag.baseX + (e.clientX - drag.startX), y: drag.baseY + (e.clientY - drag.startY) });
  };
  const onBoardHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    boardDragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // L'eleve ecrit au tableau (clavier ou dessin) — apparait comme sa propre
  // ligne (stylee differemment de celles de Calia) et part dans le tour
  // suivant pour qu'elle le verifie. Un dessin ne peut pas etre "lu" par le
  // modele (texte uniquement, pas de vision) : on le lui dit explicitement
  // plutot que de pretendre qu'elle l'a vu.
  const submitBoardWrite = async () => {
    if (boardInputMode === "text") {
      const text = boardDraft.trim();
      if (!text) return;
      const html = renderLatexInHTML(compileCourseBlock({ type: "display_math", latex: text }, [], new Set()));
      setBoardLines((lines) => [...lines, `<p class="calia-board-label calia-board-label-student">Toi</p><div class="calia-board-student">${html}</div>`]);
      setBoardDraft("");
      setBoardWriteOpen(false);
      sendTurn(`(L'eleve a ecrit au tableau : ${text})`);
      return;
    }

    if (!boardDrawing) return;
    const drawingSrc = boardDrawing;
    setBoardLines((lines) => [...lines, `<p class="calia-board-label calia-board-label-student">Toi</p><div class="calia-board-student"><img src="${drawingSrc}" alt="Réponse dessinée" style="max-width:100%;border-radius:8px;background:#fff" /></div>`]);
    setBoardDrawing(null);
    setBoardWriteOpen(false);
    // Lecture automatique du dessin (vision Mistral) avant d'envoyer le tour
    // — les modeles de vision restent imparfaits sur l'ecriture manuscrite,
    // on le rappelle explicitement a Calia dans le message plutot que de
    // presenter la lecture comme certaine.
    setLoading(true);
    try {
      const res = await fetch("/api/calia/read-drawing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: drawingSrc, context: courseContext?.courseTitle || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lecture du dessin impossible.");
      sendTurn(`(L'eleve a dessine au tableau. Lecture automatique du dessin, peut contenir des erreurs de transcription : ${data.description})`);
    } catch {
      sendTurn("(L'eleve a dessine une reponse au tableau, la lecture automatique a echoue — demande-lui de la decrire a l'oral)");
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
        // L'élève reprend la parole : on coupe la phrase en cours ET celles
        // qui attendaient leur tour.
        cancelSpeech();
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
    void loadVoice();
    // Préchauffe la route vocale (auth + jeton Azure en cache) pendant que
    // l'élève parle : la première réplique n'a plus à payer ce démarrage.
    void fetch("/api/calia/tts?warm=1").catch(() => {});
    // Débloque le lecteur audio pendant le geste de l'élève (iPhone).
    getPlayer();
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

  if (sub.loading) return null;

  if (!caliaClasseAllowed) {
    return (
      <a
        href="/parent/subscription"
        title="Calia en classe — l'IA qui enseigne à l'oral, réservée au plan Family"
        aria-label="Calia en classe verrouillée — passer au plan Family"
        className="relative w-9 h-9 rounded-full flex items-center justify-center shadow-sm transition-transform hover:scale-105 active:scale-95 flex-shrink-0"
        style={{ background: "var(--greek-blue)", border: "2px solid rgba(197,161,72,0.4)", opacity: 0.6 }}
      >
        <Image src="/logoAI.png" alt="Calia" width={18} height={18} className="object-contain" />
        <span
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: "var(--greek-gold)" }}
        >
          <Lock className="w-2.5 h-2.5" style={{ color: "var(--greek-blue)" }} />
        </span>
      </a>
    );
  }

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
        .calia-board-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #dcb85f;
          margin: 4px 0 2px;
        }
        .calia-board-label-student {
          color: #7dd3fc;
        }
        .calia-board-student {
          border-left: 3px solid #7dd3fc;
          padding-left: 8px;
          margin: 2px 0 8px;
        }
      `}</style>

      {/* Mini variante de l'avatar Calia (meme recette que le cluster bas-
          droite : cercle navy + logo + liseré) plutot qu'une icone
          generique — identifie immediatement "lancer Calia" au survol. */}
      <button
        type="button"
        onClick={isRunning ? stop : start}
        aria-label={isRunning ? "Arrêter Calia en classe" : "Lancer Calia en classe"}
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
                {error ? error : <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(sayText || "") }} />}
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

          {(boardLines.length > 0 || boardWriteOpen) && (
            <div
              className="fixed z-[65] rounded-2xl shadow-2xl overflow-hidden top-16 left-2 right-2 md:top-20 md:right-4 md:left-auto md:w-80"
              style={{
                background: "linear-gradient(160deg, #333c48, #20252c)",
                border: "1px solid rgba(238,242,236,0.15)",
                boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
                transform: `translate(${boardOffset.x}px, ${boardOffset.y}px)`,
              }}
            >
              <div
                onPointerDown={onBoardHeaderPointerDown}
                onPointerMove={onBoardHeaderPointerMove}
                onPointerUp={onBoardHeaderPointerUp}
                onPointerCancel={onBoardHeaderPointerUp}
                className="flex items-center justify-between px-3 py-1.5 select-none"
                style={{ borderBottom: "1px solid rgba(238,242,236,0.1)", touchAction: "none", cursor: "grab" }}
              >
                <div className="flex items-center gap-1.5">
                  <GripVertical className="w-3.5 h-3.5" style={{ color: "rgba(238,242,236,0.35)" }} />
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: "#dcb85f" }}>Tableau</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBoardWriteOpen((v) => !v)}
                  aria-label={boardWriteOpen ? "Fermer l'écriture" : "Écrire au tableau"}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                  style={{ color: boardWriteOpen ? "var(--greek-gold)" : "rgba(238,242,236,0.5)" }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="px-4 py-3 space-y-1.5 max-h-[40vh] overflow-y-auto" style={{ color: "#eef2ec" }}>
                {boardLines.map((html, i) => (
                  <div key={i} dangerouslySetInnerHTML={{ __html: html }} />
                ))}
              </div>

              {boardWriteOpen && (
                <div className="px-3 pb-3 pt-1 space-y-2" style={{ borderTop: "1px solid rgba(238,242,236,0.08)" }}>
                  <GlassSegmentedControl
                    size="sm"
                    value={boardInputMode}
                    onChange={(id) => setBoardInputMode(id as "text" | "draw")}
                    options={[
                      { id: "text", label: (<span className="flex items-center gap-1"><Keyboard className="w-3 h-3" /> Clavier</span>) },
                      { id: "draw", label: (<span className="flex items-center gap-1"><Brush className="w-3 h-3" /> Dessin</span>) },
                    ]}
                  />
                  {boardInputMode === "text" ? (
                    <input
                      value={boardDraft}
                      onChange={(e) => setBoardDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitBoardWrite()}
                      placeholder="ex: x^2+3x-2 ou \frac{1}{2}"
                      className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                      style={{ background: "rgba(255,255,255,0.08)", color: "#eef2ec" }}
                    />
                  ) : (
                    <DrawingCanvas onChange={setBoardDrawing} disabled={false} />
                  )}
                  <GlassButton onClick={submitBoardWrite} variant="gold" size="sm" fullWidth>
                    Envoyer au tableau
                  </GlassButton>
                </div>
              )}
            </div>
          )}
        </>,
        document.body
      )}
    </>
  );
}
