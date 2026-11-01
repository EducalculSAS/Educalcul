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
import { errMessage } from "@/lib/safeError";

const HIGHLIGHT_CLASS = "calia-scene-highlight";
// Élève silencieux : Calia continue le cours après SILENCE_MS, et la séance se met en pause après MAX_SILENT_TURNS relances sans réponse.
const SILENCE_MS = 5000;
const MAX_SILENT_TURNS = 5;
const OUTLINE_SELECTORS: Record<OutlineKind, string> = {
  heading: "h3, h4",
  // Un encadré (définition, remarque) est UNE étape du cours, pas un paragraphe par ligne.
  paragraph: "p, .course-definition, blockquote.course-callout",
  figure: ".course-figure",
  exercise: "[data-mini-exercise]",
  // Cibles fines : Calia pointe la formule, la ligne du tableau ou l'élément de
  // liste dont elle parle plutôt que tout le bloc qui les contient.
  formula: ".katex-display",
  item: "li",
  row: "tr",
};
// Plafond par type : le plan de la leçon envoyé à chaque tour reste court.
const OUTLINE_MAX_PER_KIND = 30;
const OUTLINE_PREVIEW_CHARS: Record<OutlineKind, number> = {
  heading: 160, paragraph: 500, figure: 500, exercise: 500, formula: 160, item: 240, row: 200,
};

type OutlineKind = "heading" | "paragraph" | "figure" | "exercise" | "formula" | "item" | "row";
interface OutlineItem { kind: OutlineKind; index: number; preview: string; el: HTMLElement; visible: boolean }

interface TurnAction {
  atSentence?: number;
  kind: "highlight" | "scroll_to" | "point_at" | "board_write" | "board_clear" | "ask_student_to_write" | "next_lesson" | "prev_lesson" | "goto_lesson";
  targetKind: OutlineKind | null;
  targetIndex: number | null;
  latex: string | null;
  label: string | null;
}
interface TurnResult { say: string; actions?: TurnAction[]; action?: TurnAction | null }
interface HistoryMsg { role: "user" | "assistant"; content: string }
interface CaliaCourseContext {
  courseId?: number | string | null;
  courseTitle: string;
  level?: string | null;
  lessons: { title: string; current: boolean; summary?: string; exercises: { question: string; hint?: string | null; answer: string }[] }[];
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

/** Signature stable d'une figure (même contenu = même description réutilisée). */
function figureSignature(el: HTMLElement): string {
  const html = el.innerHTML;
  let h = 0;
  for (let i = 0; i < html.length; i++) h = (Math.imul(31, h) + html.charCodeAt(i)) | 0;
  return `${html.length}:${h}`;
}

/** Ce qu'on peut lire d'une figure sans vision : légende, titre/desc du SVG, alt, textes. */
function figureTextHints(el: HTMLElement): string {
  const parts = [
    el.querySelector("figcaption")?.textContent,
    el.querySelector("svg > title")?.textContent,
    el.querySelector("svg > desc")?.textContent,
    el.querySelector("svg")?.getAttribute("aria-label"),
    el.querySelector("img")?.getAttribute("alt"),
  ];
  return parts.map((p) => (p || "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" | ");
}

function inViewport(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.bottom > 80 && r.top < window.innerHeight - 40 && r.right > 0 && r.left < window.innerWidth;
}

/**
 * Texte lisible d'un élément du cours. KaTeX écrit chaque formule trois fois dans le DOM (rendu visuel, MathML et
 * source TeX) : `textContent` donnait « x2x2x^2 ». On remplace chaque formule par sa source TeX entre `$…$`, que
 * Calia sait dire à voix haute.
 */
function readableText(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".katex-display, .katex").forEach((k) => {
    if (!clone.contains(k)) return; // formule déjà remplacée avec son bloc d'affichage
    const tex = k.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
    k.replaceWith(document.createTextNode(tex ? ` $${tex}$ ` : " "));
  });
  clone.querySelectorAll("script, style, button, .course-definition-badge, [aria-hidden='true']").forEach((n) => n.remove());
  // textContent recolle les blocs (« À retenirUn polynôme ») : une espace après chaque bloc les sépare.
  clone.querySelectorAll("p, li, div, tr, td, th, br, h3, h4, blockquote, figcaption").forEach((n) => n.append(" "));
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
}

// Unités du « fil du cours » : ce que Calia explique, dans l'ordre de lecture.
const SCRIPT_CONTAINERS: OutlineKind[] = ["paragraph", "figure", "exercise", "item", "row"];
const SCRIPT_CHARS = 900;
interface ScriptUnit { kind: OutlineKind; index: number; text: string; visible: boolean; el: HTMLElement }

/**
 * La leçon affichée, DANS L'ORDRE DE LECTURE (titre, paragraphe, formule, figure…), sans doublon : un élément contenu
 * dans un autre (un paragraphe dans un mini-exercice, une formule dans un paragraphe) n'est pas une étape à part.
 * Avant, le plan était envoyé trié par TYPE (tous les titres, puis tous les paragraphes…) : Calia ne pouvait pas
 * suivre le cours dans l'ordre.
 */
function buildScript(items: OutlineItem[]): ScriptUnit[] {
  const containers = items.filter((o) => SCRIPT_CONTAINERS.includes(o.kind));
  return items
    .filter((o) => !containers.some((c) => c !== o && c.el !== o.el && c.el.contains(o.el)))
    .sort((a, b) => (a.el === b.el ? 0 : a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((o) => ({
      kind: o.kind,
      index: o.index,
      el: o.el,
      visible: o.visible,
      // Les figures gardent leur description (vision) ; le reste est relu en texte propre.
      text: o.kind === "figure" ? o.preview : readableText(o.el).slice(0, SCRIPT_CHARS),
    }))
    .filter((u) => u.text);
}

function buildOutline(root: HTMLElement | null, figureDescs?: Map<string, string>): OutlineItem[] {
  if (!root) return [];
  const items: OutlineItem[] = [];
  (Object.keys(OUTLINE_SELECTORS) as OutlineKind[]).forEach((kind) => {
    const els = root.querySelectorAll<HTMLElement>(OUTLINE_SELECTORS[kind]);
    let kept = 0;
    els.forEach((el, index) => {
      // Élément invisible (masqué, replié, vide) : jamais proposé à Calia —
      // elle pointait sinon des zones vides.
      if (!el.offsetParent || el.getBoundingClientRect().height < 4) return;
      if (kept >= OUTLINE_MAX_PER_KIND) return;
      const text = readableText(el).slice(0, OUTLINE_PREVIEW_CHARS[kind]);
      let preview = text;
      if (kind === "figure") {
        // Vision : description de l'image (modèle de vision) + légende, même sans texte dans la figure.
        const seen = figureDescs?.get(figureSignature(el));
        preview = [seen ? `Image : ${seen}` : "", figureTextHints(el), text].filter(Boolean).join(" | ").slice(0, 700)
          || "Image sans texte (description en cours)";
      }
      if (!preview) return;
      kept += 1;
      items.push({ kind, index, preview, el, visible: inViewport(el) });
    });
  });
  return items;
}

/** Retire les codes internes (« [point_at#1] », noms de gestes) que le modèle recopie parfois dans sa parole. */
function cleanSpokenText(text: string): string {
  return text
    .replace(/\[[^\]\n]{0,40}#\d+\]/g, " ")
    .replace(/\b(?:point_at|highlight|scroll_to|board_write|board_clear|next_lesson|prev_lesson|goto_lesson|ask_student_to_write)\b(?:#\d+)?/gi, " ")
    .replace(/\b(?:heading|paragraph|figure|exercise|formula|item|row)#\d+\b/gi, " ")
    .replace(/[*`]+/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Convertit une figure du cours en image (JPEG base64) pour le modèle de vision.
 * SVG : styles calculés recopiés en ligne (les classes CSS du site ne s'appliquent
 * pas dans une image SVG isolée). <img> de même origine : dessinée telle quelle.
 * Renvoie null si la figure n'est pas convertible (figure interactive en HTML).
 */
async function figureToDataUrl(el: HTMLElement): Promise<string | null> {
  try {
    const svg = el.querySelector("svg");
    const img = el.querySelector("img");
    const source = svg ?? img;
    if (!source) return null;
    const rect = source.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return null;
    const width = Math.min(720, Math.max(240, Math.round(rect.width)));
    const height = Math.max(40, Math.round((rect.height * width) / rect.width));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    let image: HTMLImageElement;
    if (svg) {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      const srcNodes = [svg, ...Array.from(svg.querySelectorAll("*"))];
      const dstNodes = [clone, ...Array.from(clone.querySelectorAll("*"))];
      const props = ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "font-size", "font-family", "font-weight", "text-anchor"];
      srcNodes.forEach((node, i) => {
        const dst = dstNodes[i] as SVGElement | undefined;
        if (!dst) return;
        const cs = getComputedStyle(node);
        dst.setAttribute("style", `${dst.getAttribute("style") || ""};${props.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";")}`);
      });
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${Math.round(rect.width)} ${Math.round(rect.height)}`);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
      image = new window.Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("svg"));
        image.src = url;
      }).finally(() => URL.revokeObjectURL(url));
    } else {
      image = img as HTMLImageElement;
      if (!image.complete || !image.naturalWidth) return null;
    }
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    // Image d'une autre origine (canvas « teinté ») ou SVG illisible : pas de description par vision.
    return null;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}


export default function CaliaSceneDemo({
  contentRef,
  courseContext,
  onAdvanceLesson,
  onPrevLesson,
  onGoToLesson,
}: {
  contentRef: RefObject<HTMLDivElement | null>;
  courseContext?: CaliaCourseContext;
  /** Fait reellement avancer l'affichage a la lecon suivante — sans ca,
   * Calia peut seulement PARLER de la suite du cours (via courseContext),
   * jamais y faire passer l'eleve. */
  onAdvanceLesson?: () => void;
  /** Leçon précédente / leçon n° (1 = première du cours) : Calia « tourne les pages ». */
  onPrevLesson?: () => void;
  onGoToLesson?: (lessonNumber: number) => void;
}) {
  // "Calia en classe" est un argument de vente du plan Family — reservee
  // aux comptes (ou enfants d'un parent) dont l'abonnement inclut
  // calia_classe (voir hasCaliaClasseAccess.ts / subscription_plans.features).
  const sub = useSubscription();
  const caliaClasseAllowed = sub.features.calia_classe;
  const { setClasseActive } = useAITutor();

  const [isRunning, setIsRunning] = useState(false);
  // Séance mise en pause faute de réponse : l'historique est conservé, on peut reprendre.
  const [paused, setPaused] = useState(false);
  // Nombre de relances automatiques de Calia depuis la dernière parole de l'élève.
  const silentTurnsRef = useRef(0);
  // Une synthèse vocale est en cours de préparation ou de lecture (le temps entre
  // la réponse du serveur et le premier son ne doit pas compter comme un silence).
  const [voiceBusy, setVoiceBusy] = useState(false);
  const activeSpeaksRef = useRef(0);
  // Vision : descriptions des figures de la leçon (modèle de vision), et ce que Calia
  // pointe en ce moment, pour qu'elle sache où elle en est et le retrouve après une pause.
  const figureDescsRef = useRef(new Map<string, string>());
  const figurePendingRef = useRef(new Set<string>());
  const pointingRef = useRef<{ kind: OutlineKind; index: number; preview: string; el: HTMLElement } | null>(null);
  // Fil du cours : numéro de la prochaine étape de la leçon affichée à expliquer (voir buildScript).
  const cursorRef = useRef<{ lesson: number; pos: number }>({ lesson: -1, pos: 0 });
  const [mounted, setMounted] = useState(false);
  const [sayText, setSayText] = useState<string | null>(null);
  // Transcription mot à mot, calée sur la voix : nombre de « mots » affichés
  // (null = tout le texte). Une formule $…$ compte pour un seul mot.
  const [shownWords, setShownWords] = useState<number | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sayTokensRef = useRef<string[]>([]);
  // Copie en état des mots de la réplique : l'affichage ne lit pas une ref.
  const [sayTokens, setSayTokens] = useState<string[]>([]);
  // Élément que Calia montre : le point et l'avatar le SUIVENT (défilement,
  // redimensionnement) au lieu de rester figés à l'ancienne position.
  const [pointerEl, setPointerEl] = useState<HTMLElement | null>(null);
  // Gestes de la réplique en cours, déclenchés quand la transcription atteint
  // leur phrase (Calia se déplace en parlant).
  const pendingActionsRef = useRef<{ at: number; action: TurnAction }[]>([]);
  const showSay = (text: string) => {
    const tokens = text.match(/\$[^$]*\$\S*\s*|\S+\s*/g) ?? [];
    sayTokensRef.current = tokens;
    setSayTokens(tokens);
    setShownWords(0); // rien avant que la voix démarre
    setSayText(text);
  };
  const stopReveal = () => {
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    revealTimerRef.current = null;
  };
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

  const stop = (keepHistory = false) => {
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
    stopReveal();
    setShownWords(null);
    pendingActionsRef.current = [];
    setPointerEl(null);
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
    setVoiceBusy(false);
    activeSpeaksRef.current = 0;
    if (!keepHistory) {
      historyRef.current = [];
      pointingRef.current = null;
      setPaused(false);
    }
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

  const playBlob = (blob: Blob, gen: number, onStart?: (durationMs: number) => void) =>
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
      // Le texte commence à défiler au lancement de la lecture, soit juste
      // avant le son, à la vitesse réelle de la phrase.
      player.onloadedmetadata = () => onStart?.(Number.isFinite(player.duration) ? player.duration * 1000 : 0);
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
    activeSpeaksRef.current += 1;
    setVoiceBusy(true);
    try {
      await speakInner(text);
    } finally {
      activeSpeaksRef.current = Math.max(0, activeSpeaksRef.current - 1);
      if (activeSpeaksRef.current === 0) setVoiceBusy(false);
    }
  };

  const speakInner = async (text: string) => {
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

    const total = sayTokensRef.current.length;
    const totalLen = chunks.reduce((n, c) => n + c.length, 0) || 1;
    let cumLen = 0;
    for (let i = 0; i < chunks.length; i++) {
      const from = Math.round((total * cumLen) / totalLen);
      cumLen += chunks[i].length;
      const to = i === chunks.length - 1 ? total : Math.round((total * cumLen) / totalLen);
      let blob: Blob;
      try {
        blob = await synth[i];
      } catch (err) {
        if (gen !== speechGenRef.current) return;
        // Pas de voix du navigateur : on s'arrête là, et seul ce qui a
        // réellement été dit reste affiché.
        console.warn("[Calia] voix Azure indisponible.", err);
        stopReveal();
        setSpeaking(false);
        return;
      }
      if (gen !== speechGenRef.current) return;
      const ok = await playBlob(blob, gen, (durationMs) => {
        stopReveal();
        const n = Math.max(1, to - from);
        const step = Math.max(40, (durationMs || n * 300) / n);
        let shown = from;
        setShownWords(from);
        revealTimerRef.current = setInterval(() => {
          shown += 1;
          setShownWords(Math.min(shown, to));
          if (shown >= to) stopReveal();
        }, step);
      });
      stopReveal();
      // Coupée (l'élève reprend la parole, arrêt) : le texte s'arrête où la voix s'est arrêtée.
      if (!ok) return;
      setShownWords(to);
    }
    if (gen === speechGenRef.current) { setSpeaking(false); setShownWords(null); }
  };

  /** Vision : fait décrire chaque figure de la leçon affichée (une seule fois par figure, sans bloquer le tour). */
  const prefetchFigureDescriptions = () => {
    const root = contentRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(OUTLINE_SELECTORS.figure).forEach((el) => {
      const sig = figureSignature(el);
      if (figureDescsRef.current.has(sig) || figurePendingRef.current.has(sig)) return;
      figurePendingRef.current.add(sig);
      void (async () => {
        try {
          const imageDataUrl = await figureToDataUrl(el);
          if (!imageDataUrl) {
            figureDescsRef.current.set(sig, ""); // figure non convertible : on ne réessaie pas
            return;
          }
          const res = await fetch("/api/calia/describe-figure", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageDataUrl, caption: figureTextHints(el) }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && typeof data.description === "string") figureDescsRef.current.set(sig, data.description);
        } catch {
          /* la description est un plus : sans elle, Calia garde la légende et le texte de la figure */
        } finally {
          figurePendingRef.current.delete(sig);
        }
      })();
    });
  };

  const showElement = (el: HTMLElement) => {
    clearHighlight();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add(HIGHLIGHT_CLASS);
    highlightedElRef.current = el;
    setPointerEl(el);
  };

  const executeAction = (action: TurnAction | null) => {
    if (!action) return;

    if (action.kind === "board_clear") {
      setBoardLines([]);
      return;
    }
    if (action.kind === "ask_student_to_write") {
      setBoardWriteOpen(true);
      return;
    }
    if (action.kind === "next_lesson" || action.kind === "prev_lesson" || action.kind === "goto_lesson") {
      clearHighlight();
      setPointerEl(null);
      pointingRef.current = null;
      if (action.kind === "next_lesson") onAdvanceLesson?.();
      else if (action.kind === "prev_lesson") onPrevLesson?.();
      else if (action.targetIndex !== null) onGoToLesson?.(action.targetIndex);
      // La nouvelle leçon s'affiche : on fait décrire ses figures dès qu'elles sont là.
      window.setTimeout(prefetchFigureDescriptions, 1500);
      return;
    }
    if (action.kind === "board_write") {
      if (!action.latex) return;
      const html = renderLatexInHTML(compileCourseBlock({ type: "display_math", latex: action.latex }, [], new Set()));
      setBoardLines((lines) => [...lines, action.label ? `<p class="calia-board-label">${escapeHtml(action.label)}</p>${html}` : html]);
      return;
    }

    // highlight / scroll_to / point_at : l'élément est toujours MONTRÉ en
    // entier (défilement, cadre, point et Calia à côté).
    if (!action.targetKind || action.targetIndex === null) return;
    const target = buildOutline(contentRef.current, figureDescsRef.current).find((o) => o.kind === action.targetKind && o.index === action.targetIndex);
    if (target) {
      showElement(target.el);
      pointingRef.current = { kind: target.kind, index: target.index, preview: target.preview, el: target.el };
    }
  };

  /** Déclenche les gestes dont la phrase est atteinte (tous à la fin). */
  const runDueActions = (reached: number) => {
    const due = pendingActionsRef.current.filter((p) => p.at <= reached);
    if (!due.length) return;
    pendingActionsRef.current = pendingActionsRef.current.filter((p) => p.at > reached);
    due.forEach((p) => executeAction(p.action));
  };
  useEffect(() => {
    runDueActions(shownWords ?? Number.POSITIVE_INFINITY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownWords]);

  // Le point suit l'élément montré (défilement doux, redimensionnement).
  useEffect(() => {
    if (!pointerEl) {
      setPointerRect(null);
      return;
    }
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPointerRect(pointerEl.getBoundingClientRect()));
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const tick = setInterval(update, 250); // défilement « smooth » en cours
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(tick);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [pointerEl]);

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

  const sendTurn = async (studentMessage: string, auto = false) => {
    // `auto` : relance de Calia faute de réponse. Toute parole de l'élève remet le compteur à zéro.
    silentTurnsRef.current = auto ? silentTurnsRef.current + 1 : 0;
    setLoading(true);
    setError(null);
    setInterim("");
    historyRef.current = [...historyRef.current, { role: "user", content: studentMessage }];
    try {
      // Vision des figures : lance les descriptions manquantes (sans attendre : elles servent aux tours suivants).
      prefetchFigureDescriptions();
      const outline = buildOutline(contentRef.current, figureDescsRef.current);
      // Fil du cours : la leçon dans l'ordre de lecture + l'étape à expliquer maintenant (remise à zéro à chaque nouvelle leçon).
      const script = buildScript(outline);
      const lessonKey = courseContext?.lessons.findIndex((l) => l.current) ?? -1;
      if (cursorRef.current.lesson !== lessonKey) cursorRef.current = { lesson: lessonKey, pos: 0 };
      const cursor = Math.min(cursorRef.current.pos, script.length);
      const inScript = new Set(script.map((u) => `${u.kind}#${u.index}`));
      // Où Calia en est : ce qu'elle pointait au dernier tour, et si c'est encore à l'écran
      // (l'élève a pu faire défiler). Reste vrai après une pause ou un retour.
      const pointing = pointingRef.current && pointingRef.current.el.isConnected ? pointingRef.current : null;
      const screen = {
        pointingAt: pointing ? { kind: pointing.kind, index: pointing.index, preview: pointing.preview.slice(0, 160) } : null,
        pointerVisible: pointing ? inViewport(pointing.el) : null,
        scrollY: Math.round(window.scrollY),
      };
      const res = await fetch("/api/calia/classe-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screen,
          lessonScript: script.map(({ kind, index, text, visible }) => ({ kind, index, text, visible })),
          cursor,
          // Cibles fines (formule, ligne de tableau, élément de liste) qui ne sont pas une étape à part.
          lessonOutline: outline
            .filter((o) => !inScript.has(`${o.kind}#${o.index}`))
            .map(({ kind, index, preview, visible }) => ({ kind, index, preview: preview.slice(0, 120), visible })),
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
      const result = { ...data, say: cleanSpokenText(data.say) || data.say } as TurnResult;
      historyRef.current = [...historyRef.current, { role: "assistant", content: result.say }];
      showSay(result.say);
      // Chaque geste attend le début de sa phrase dans la transcription.
      const tokens = sayTokensRef.current;
      const sentenceStarts = [0];
      tokens.forEach((t, i) => { if (/[.!?]\s*$/.test(t) && i + 1 < tokens.length) sentenceStarts.push(i + 1); });
      const actions = Array.isArray(result.actions) ? result.actions : result.action ? [result.action] : [];
      clearHighlight();
      setPointerEl(null);
      const SHOW = new Set(["point_at", "highlight", "scroll_to"]);
      const shownAt = new Set<number>();
      pendingActionsRef.current = actions.slice(0, 5)
        .map((action) => ({
          at: sentenceStarts[Math.min(Math.max(0, action.atSentence ?? 0), sentenceStarts.length - 1)],
          action,
        }))
        // Un seul élément montré par phrase (sinon saut instantané de l'un à l'autre).
        .filter(({ at, action }) => {
          if (!SHOW.has(action.kind)) return true;
          if (shownAt.has(at)) return false;
          shownAt.add(at);
          return true;
        });
      // L'étape en cours avance quand Calia montre l'étape suivante (ou, sur une relance sans réponse, d'office :
      // le cours ne reste jamais bloqué sur le même passage).
      let reached = -1;
      for (const action of actions) {
        if (!SHOW.has(action.kind) || !action.targetKind || action.targetIndex === null) continue;
        const el = outline.find((o) => o.kind === action.targetKind && o.index === action.targetIndex)?.el;
        const unit = el ? script.findIndex((u) => u.el === el || u.el.contains(el)) : -1;
        reached = Math.max(reached, unit);
      }
      // Une simple annonce (« on va voir la définition ») n'a rien expliqué : l'étape reste à faire.
      const explained = result.say.length >= 110 || script[reached]?.kind === "heading";
      if (reached >= cursor && explained) cursorRef.current.pos = reached + 1;
      else if (auto && reached < 0) cursorRef.current.pos = Math.min(cursor + 1, script.length);
      runDueActions(0);
      speak(result.say);
    } catch (err: unknown) {
      if (sessionActiveRef.current) setError(errMessage(err) || "Une erreur est survenue.");
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
      sendTurn("(L'eleve a dessine une reponse au tableau, la lecture automatique a echoue, demande-lui de la decrire a l'oral)");
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

  // Séance mise en pause faute de réponse : tout est arrêté (micro, voix), mais
  // l'historique de la conversation est gardé pour pouvoir reprendre. Le mini
  // rapport part quand même, la mémoire de l'élève retient ce qui a été vu.
  const pauseForInactivity = () => {
    stop(true);
    setPaused(true);
  };

  const begin = (opening: string, fresh: boolean) => {
    void loadVoice();
    // Vision : les figures de la leçon sont décrites dès l'ouverture de la séance.
    prefetchFigureDescriptions();
    // Préchauffe la route vocale (auth + jeton Azure en cache) pendant que
    // l'élève parle : la première réplique n'a plus à payer ce démarrage.
    void fetch("/api/calia/tts?warm=1").catch(() => {});
    // Débloque le lecteur audio pendant le geste de l'élève (iPhone).
    getPlayer();
    sessionActiveRef.current = true;
    playModeProfCue();
    setIsRunning(true);
    setClasseActive(true);
    if (fresh) {
      historyRef.current = [];
      cursorRef.current = { lesson: -1, pos: 0 };
    }
    silentTurnsRef.current = 0;
    setPaused(false);
    startListening();
    sendTurn(opening);
  };
  const start = () => begin("(le cours commence, ouvre la séance)", true);
  const resume = () =>
    begin("(l'eleve revient apres une pause de la seance : reprends calmement ou vous en etiez, en rappelant en une phrase ce dont vous parliez)", false);

  // Si l'élève ne dit rien, Calia ne reste pas muette : elle continue le cours.
  // Après MAX_SILENT_TURNS relances sans aucune réponse, la séance se met en pause.
  useEffect(() => {
    if (!isRunning || speaking || voiceBusy || loading || interim || error) return;
    if (boardWriteOpen || boardDraft.trim() || textFallback.trim()) return;
    if (historyRef.current.length === 0) return;
    const id = setTimeout(() => {
      if (!sessionActiveRef.current) return;
      if (silentTurnsRef.current >= MAX_SILENT_TURNS) {
        pauseForInactivity();
        return;
      }
      void sendTurn("(l'eleve n'a rien dit depuis un moment : continue le cours sans l'attendre, passe a la suite)", true);
    }, SILENCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, speaking, voiceBusy, loading, interim, error, boardWriteOpen, boardDraft, textFallback]);

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
        title="Calia en classe, l'IA qui enseigne à l'oral, réservée au plan Family"
        aria-label="Calia en classe verrouillée, passer au plan Family"
        className="liquid-glass-btn calia-glass calia-glass-ring backdrop-blur-[32px] backdrop-saturate-[1.4] relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ opacity: 0.7 }}
      >
        <Image src="/logoAI.png" alt="Calia" width={18} height={18} className="object-contain" />
        <span
          className="calia-glass-gold absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
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
          outline-offset: 6px;
          border-radius: 10px;
          background: rgba(197, 161, 72, 0.12);
          box-shadow: 0 0 0 10px rgba(197, 161, 72, 0.12), 0 8px 30px rgba(197, 161, 72, 0.25);
          transition: background 0.4s ease, box-shadow 0.4s ease, outline-color 0.4s ease;
          animation: calia-frame-in 0.45s ease;
        }
        @keyframes calia-frame-in {
          from { outline-color: transparent; box-shadow: 0 0 0 0 rgba(197, 161, 72, 0); }
        }
        .calia-word {
          display: inline;
          animation: calia-word-in 0.32s ease both;
        }
        @keyframes calia-word-in {
          from { opacity: 0; filter: blur(3px); }
          to { opacity: 1; filter: blur(0); }
        }
        .calia-alive {
          animation: calia-float 3.2s ease-in-out infinite;
        }
        @keyframes calia-float {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -5px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .calia-word, .calia-alive, .${HIGHLIGHT_CLASS} { animation: none; }
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
          generique, identifie immediatement "lancer Calia" au survol. */}
      <button
        type="button"
        onClick={isRunning ? () => stop() : paused ? resume : start}
        aria-label={isRunning ? "Arrêter Calia en classe" : paused ? "Reprendre Calia en classe (séance en pause)" : "Lancer Calia en classe"}
        title={paused ? "Séance en pause faute de réponse. Clique pour reprendre là où vous en étiez." : undefined}
        className={`liquid-glass-btn calia-glass calia-glass-ring backdrop-blur-[32px] backdrop-saturate-[1.4] relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${paused ? "animate-pulse" : ""}`}
        style={isRunning ? { borderColor: "rgba(239,68,68,0.95)" } : undefined}
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
                left: pointerRect.left - 22,
                top: pointerRect.top + Math.min(pointerRect.height / 2, 24) - 8,
                transition: "left 0.35s ease, top 0.35s ease",
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
            className="fixed bottom-[112px] md:bottom-[88px] right-4 z-[70] flex flex-col items-end gap-3 max-w-[calc(100vw-2rem)]"
            style={{ transform: `translate(${clusterOffset.x}px, ${clusterOffset.y}px)`, transition: "transform 0.9s cubic-bezier(0.34, 1.3, 0.64, 1)" }}
          >
            {(sayText || error) && (
              <div
                className={`${error ? "" : "calia-glass backdrop-blur-[32px] backdrop-saturate-[1.4]"} rounded-2xl rounded-br-sm px-4 py-2.5 text-sm max-w-[min(18rem,calc(100vw-2rem))] max-h-[32vh] overflow-y-auto`}
                style={error ? { background: "rgba(254,242,242,0.85)", color: "#b91c1c", border: "1px solid rgba(254,202,202,0.9)", boxShadow: "0 10px 28px rgba(185,28,28,0.15)", backdropFilter: "blur(24px) saturate(1.3)" } : { color: "#fff" }}
              >
                {error ? error : <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(sayText || "") }} style={shownWords === null ? undefined : { display: "none" }} />}
                {!error && shownWords !== null && sayTokens.slice(0, shownWords).map((t, i) => (
                  <span key={i} className="calia-word" dangerouslySetInnerHTML={{ __html: renderLatexInHTML(t) }} />
                ))}
              </div>
            )}
            {interim && (
              <div className="calia-glass backdrop-blur-[32px] backdrop-saturate-[1.4] rounded-2xl px-4 py-2 text-sm italic max-w-[min(18rem,calc(100vw-2rem))]" style={{ color: "rgba(240,237,232,0.85)" }}>
                {interim}…
              </div>
            )}

            <div className="flex items-center gap-2">
              <div
                className="relative shrink-0 calia-alive"
                style={{
                  animation: speaking ? "calia-speak-pulse 0.6s ease-in-out infinite" : undefined,
                  transition: "transform 0.3s ease",
                }}
              >
                <div
                  className="calia-glass calia-glass-ring backdrop-blur-[32px] backdrop-saturate-[1.4] w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center"
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
                  onClick={() => stop()}
                  aria-label="Fermer Calia en classe"
                  className="calia-glass backdrop-blur-xl absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white"
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
              <div className="calia-glass-light backdrop-blur-[32px] backdrop-saturate-[1.4] flex items-center gap-2 rounded-full pl-4 pr-1.5 py-1.5 max-w-full">
                <input
                  value={textFallback}
                  onChange={(e) => setTextFallback(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitTextFallback()}
                  placeholder="Ton navigateur ne supporte pas la voix, écris ici"
                  className="text-sm outline-none bg-transparent w-44 sm:w-56 min-w-0"
                  disabled={loading}
                />
                <GlassIconButton icon={Send} color="navy" size="sm" aria-label="Envoyer" onClick={submitTextFallback} disabled={loading} />
              </div>
            )}
          </div>

          {(boardLines.length > 0 || boardWriteOpen) && (
            <div
              className="fixed z-[65] top-16 left-2 right-2 md:top-20 md:right-4 md:left-auto md:w-80"
              style={{ transform: `translate(${boardOffset.x}px, ${boardOffset.y}px)` }}
            >
            <div className="calia-glass calia-glass-board backdrop-blur-[32px] backdrop-saturate-[1.4] rounded-3xl overflow-hidden">
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
            </div>
          )}
        </>,
        document.body
      )}
    </>
  );
}
