"use client";
/* eslint-disable @next/next/no-img-element -- images à adresse libre ou data: saisies par l'admin (miniatures, aperçus, énoncés) : next/image ne peut pas les optimiser */

import { answerList, type AnswerMap, type AnswerValue } from "@/types/answers";
import { extractExerciseContent } from "@/lib/exerciseContextText";
import AnswerFeedback from "@/components/viewers/AnswerFeedback";
import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowRight, ArrowLeft, CheckCircle, XCircle, RotateCcw, Trophy, Brain, Loader2, Lock, Lightbulb } from "lucide-react";
import { Page, type Block } from "@/components/admin/ExerciseBuilder";
import FigureInputs from "@/components/viewers/FigureInputs";
import SlotHtml, { tokenizeSlots } from "@/components/viewers/SlotHtml";
import { supabase } from "@/lib/supabaseClient";
import { useAITutor } from "@/contexts/AITutorContext";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { renderMathGraphPlaceholders, enhanceMathGraphs } from "@/lib/mathGraph";
import { MathInputHandle, subscribeMathKeyboardVisibility } from "@/components/MathInput";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import "katex/dist/katex.min.css";
import { passThreshold } from "@/lib/scorePercent";
import { blockMaxPoints, itemTotal } from "@/lib/exerciseScoring";
import { fetchMiniComment } from "@/lib/miniComment";
import ReadAloudButton from "@/components/ReadAloudButton";
import { AdminAttemptControls } from "@/components/viewers/blocks/AdminAttemptControls";
import type { InlineTextState } from "@/components/viewers/blocks/inlineText";
import { OrderingDragList, MatchingDragList, CategorizeDragList, NumberLinePoint } from "@/components/viewers/ExerciseDragLists";

import AdminReviewPanel from "@/components/viewers/blocks/AdminReviewPanel";
import ImpossibleSearchAnswer from "@/components/viewers/blocks/ImpossibleSearchAnswer";
import CodingAnswer from "@/components/viewers/blocks/CodingAnswer";
import ClickErrorAnswer from "@/components/viewers/blocks/ClickErrorAnswer";
import TextInputAnswer from "@/components/viewers/blocks/TextInputAnswer";
export { AdminAttemptControls };
/** Aperçu admin ou séance « à revoir » : rien n'est enregistré comme tentative de cet exercice. */
const isVirtualExercise = (id?: string | null) => !id || id === "preview" || id === "review";

// Mélange déterministe (seedé par une chaîne) pour que l'ordre affiché aux
// élèves (association / mise en ordre) reste stable entre deux rendus tant
// que l'exercice n'a pas changé, sans avoir à le persister séparément.
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}




/** Ce que le serveur dévoile d'un bloc une fois la réponse soumise (bonne réponse, trous, paires, ordre, catégories). */
/** Correction d'un bloc renvoyée par /api/child/exercises/[id]/grade (ou par la route d'aperçu admin). */
interface ExerciseGradeResult {
  block_id?: string;
  unavailable?: boolean;
  is_correct?: boolean;
  feedback?: string;
  comment_token?: string;
  reveal?: RevealInfo;
  score?: number;
}

export type RevealInfo = Pick<Block, "correctAnswer" | "blanks" | "pairs" | "items" | "categoryItems">;

interface ExerciseViewerProps {
  exercise: {
    id?: string;
    title: string;
    description?: string | null;
    content_json: Page[] | null;
    grading_type?: "auto" | "ai" | "manual";
    level?: string;
    type?: string;
    difficulty_level?: string;
    course_id?: string | number | null;
    courses?: { title?: string; subject?: string; level?: string } | null;
    min_score_percent?: number | null;
    max_attempts?: number | null;
    time_limit_minutes?: number | null;
  };
  onComplete?: (score: number, totalPoints: number) => void;
  onBack?: () => void;
  reviewMode?: boolean;
  /** Force le démarrage d'une nouvelle tentative (ignore la progression précédemment terminée) */
  forceNewAttempt?: boolean;
  /** Meilleur score (%) déjà obtenu lors de tentatives précédentes */
  bestScorePercent?: number;
  /** Ouvre directement la correction (revue détaillée) au lieu de l'écran de fin */
  openCorrection?: boolean;
  /** « Refaire l'exercice » depuis l'écran de fin : repart de zéro, la fin de cette nouvelle partie compte comme un essai de plus. */
  onRestart?: () => void;
  /** Plus d'essai disponible (limite de tentatives de l'exercice atteinte) : le bouton « Refaire » est grisé. */
  restartBlocked?: boolean;
  initialProgress?: {
    answers?: AnswerMap;
    submittedBlocks?: string[];
    results?: Record<string, boolean>;
    aiFeedback?: Record<string, string>;
    revealed?: Record<string, RevealInfo>;
    score?: number;
    blockModes?: Record<string, "text" | "draw">;
    /** Commentaire/réponse corrigée laissés par un admin sur cette tentative
     * (revue admin — voir /admin/users/attempt-review) : affichés en lecture
     * même hors mode admin, pour que l'élève les voie sur SA propre page de
     * correction. */
    adminComments?: Record<string, string>;
    adminEditedAnswers?: AnswerMap;
  } | null;
  /** Présent uniquement sur l'écran de revue admin (reviewMode est aussi vrai
   * dans ce cas) : ajoute, sous chaque question déjà affichée en lecture
   * seule, un champ de commentaire et un bouton pour corriger la réponse
   * enregistrée de l'élève. Purement additif — sans ce prop, reviewMode se
   * comporte exactement comme avant (écran élève). */
  adminMode?: {
    onComment: (blockId: string, text: string) => void;
    onEditAnswer: (blockId: string, value: AnswerValue) => void;
    /** Correction manuelle : compter la réponse juste ou fausse (exercices). */
    onVerdict?: (blockId: string, correct: boolean) => void;
    saving?: boolean;
  };
}

export default function ExerciseViewer({
  exercise,
  onComplete,
  onBack,
  reviewMode,
  forceNewAttempt,
  bestScorePercent,
  openCorrection,
  onRestart,
  restartBlocked,
  initialProgress,
  adminMode,
}: ExerciseViewerProps) {
  // Un point par élément pour les associations / catégories / trous (voir lib/exerciseScoring).
  const pages = useMemo(
    () =>
      (exercise.content_json || []).map((page) => ({
        ...page,
        blocks: (page.blocks || []).map((b) => (itemTotal(b) > 1 ? { ...b, points: blockMaxPoints(b) } : b)),
      })) as Page[],
    [exercise.content_json],
  );
  const { pageContext, setPageContext } = useAITutor();

  // Une page = une question : le contenu est authored/généré avec plusieurs
  // blocs-question regroupés dans une seule Page (voir compiler.ts), donc on
  // aplatit tous les blocs et on les redécoupe côté client en un écran par
  // question, avec la consigne (blocs "text"/"image" en tête) sur son propre
  // écran — sur deux si elle est longue. Purement présentationnel : la
  // correction (validateAllAnswers) continue d'itérer `pages`/blocs bruts.
  const screens = useMemo(() => {
    // Un écran par PAGE authorée, pas par bloc : une page à un seul bloc est
    // une question indépendante (un écran) ; une page à plusieurs blocs est
    // un groupe de "questions liées" sur le même thème, affichées ENSEMBLE
    // sur le même écran (voir contexte du plan — l'ancien comportement
    // aplatissait tous les blocs de toutes les pages et en refaisait un écran
    // par bloc, ce qui séparait les questions liées une par une malgré leur
    // regroupement en base).
    return pages.filter((p) => p.blocks.length > 0).map((p) => ({ blocks: p.blocks, layout: p.layout, sequential: p.sequential === true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  // Affichage mélangé (stable) des blocs "association" (choix de droite) et
  // "mise en ordre" (éléments à réordonner), calculé une fois par exercice.
  // Les valeurs déjà mélangées (matchingOptions/shuffledItems) viennent de
  // l'API quand la réponse correcte a été retirée (élève, avant soumission).
  // pairs/items complets ne sont présents qu'en contexte admin (builder/aperçu).
  const shuffledRightOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    pages.forEach((p) =>
      p.blocks.forEach((b) => {
        if (b.type === "matching") {
          if (b.pairs && b.pairs.every((pr) => pr.right !== undefined)) {
            map[b.id] = seededShuffle(b.pairs.map((pr) => pr.right), b.id);
          } else if (b.matchingOptions) {
            map[b.id] = b.matchingOptions;
          }
        }
      })
    );
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  const shuffledOrderingItems = useMemo(() => {
    const map: Record<string, string[]> = {};
    pages.forEach((p) =>
      p.blocks.forEach((b) => {
        if (b.type === "ordering") {
          if (b.items) {
            map[b.id] = seededShuffle(b.items, b.id);
          } else if (b.shuffledItems) {
            map[b.id] = b.shuffledItems;
          }
        }
      })
    );
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  const shuffledCategorizeItems = useMemo(() => {
    const map: Record<string, { originalIndex: number; text: string }[]> = {};
    pages.forEach((p) =>
      p.blocks.forEach((b) => {
        if (b.type === "categorize" && b.categoryItems) {
          const indices = b.categoryItems.map((_, i) => i);
          const shuffledIndices = seededShuffle(indices, b.id);
          map[b.id] = shuffledIndices.map((originalIndex) => ({
            originalIndex,
            text: b.categoryItems![originalIndex].text,
          }));
        }
      })
    );
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  // Position/réponses/score : plus de repli localStorage — tout vient du
  // serveur (effet "Charge la progression..." plus bas), avec un bref flash
  // à l'état vide le temps du premier chargement.
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
  // Coups de pouce déjà demandés, par question.
  const [hintsShown, setHintsShown] = useState<Record<string, number>>({});

  const [answers, setAnswers] = useState<AnswerMap>(() => (reviewMode ? initialProgress?.answers : undefined) || {});
  const mathfieldRefs = useRef<Record<string, MathInputHandle | null>>({});
  const [submittedBlocks, setSubmittedBlocks] = useState<Set<string>>(
    () => new Set((reviewMode ? initialProgress?.submittedBlocks : undefined) || [])
  );
  const [results, setResults] = useState<Record<string, boolean>>(() => (reviewMode ? initialProgress?.results : undefined) || {});
  const [aiFeedback, setAiFeedback] = useState<Record<string, string>>(() => (reviewMode ? initialProgress?.aiFeedback : undefined) || {});
  // Réponse correcte, révélée par le serveur uniquement après soumission de
  // chaque bloc — jamais présente dans le contenu initial envoyé à l'élève.
  const [revealed, setRevealed] = useState<Record<string, RevealInfo>>(() => (reviewMode ? initialProgress?.revealed : undefined) || {});
  const [score, setScore] = useState(() => (reviewMode ? initialProgress?.score : undefined) || 0);
  const [exerciseCompleted, setExerciseCompleted] = useState(() => (reviewMode ? true : false));
  const [showReview, setShowReview] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);


  // Correction immédiate des blocs "text_input" (même style que les
  // mini-exercices de cours) : vérifier tout de suite, réessayer, et
  // proposer la réponse après 2 échecs plutôt que de laisser retenter à
  // l'infini. Une fois résolu (correct ou révélé), la validation finale de
  // la page réutilise ce verdict au lieu de rappeler l'IA.
  const [inlineText, setInlineText] = useState<Record<string, InlineTextState>>({});

  const verifyTextBlock = async (block: Block) => {
    const studentAnswer = answers[block.id];
    if (!studentAnswer) return;
    const current = inlineText[block.id];
    const attemptsSoFar = current?.attempts || 0;
    setInlineText((prev) => ({ ...prev, [block.id]: { attempts: attemptsSoFar, status: "grading" } }));
    try {
      const exerciseId = exercise.id || "preview";
      const res = await fetch(`/api/child/exercises/${exerciseId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_id: block.id,
          block,
          grading_type: exercise.grading_type,
          answer: studentAnswer,
          question: block.content,
          correctAnswer: block.correctAnswer,
          explanation: block.explanation,
          level: exercise.level || "6eme",
          points: block.points,
        }),
      });
      const data = await res.json();
      if (data.unavailable) {
        setInlineText((prev) => ({
          ...prev,
          [block.id]: { attempts: attemptsSoFar, status: "unavailable", feedback: data.feedback },
        }));
        return;
      }
      if (data.is_correct) {
        setInlineText((prev) => ({
          ...prev,
          [block.id]: {
            attempts: attemptsSoFar + 1,
            status: "correct",
            feedback: data.feedback,
            resolvedScore: data.score,
            resolvedCorrect: true,
          },
        }));
      } else {
        const attempts = attemptsSoFar + 1;
        if (attempts >= 2) {
          // 2 échecs d'affilée : on propose directement la réponse plutôt
          // que de laisser l'élève retenter indéfiniment. La bonne réponse
          // vient de data.reveal (le client n'a jamais correctAnswer avant
          // d'avoir soumis — voir le commentaire dans la route de grading).
          setInlineText((prev) => ({
            ...prev,
            [block.id]: {
              attempts,
              status: "revealed",
              feedback: data.feedback,
              resolvedScore: 0,
              resolvedCorrect: false,
              revealedAnswer:
                typeof data.reveal?.correctAnswer === "string" ? data.reveal.correctAnswer : undefined,
            },
          }));
        } else {
          setInlineText((prev) => ({
            ...prev,
            [block.id]: { attempts, status: "wrong", feedback: data.feedback },
          }));
        }
        // Verdict et réponse de base déjà affichés : le mini commentaire de l'IA arrive juste après, quand il y en a un.
        void fetchMiniComment(data.comment_token).then((comment) => {
          if (!comment) return;
          setInlineText((prev) => {
            const cur = prev[block.id];
            return cur && cur.attempts === attempts && (cur.status === "wrong" || cur.status === "revealed") ? { ...prev, [block.id]: { ...cur, feedback: comment } } : prev;
          });
        });
      }
    } catch {
      setInlineText((prev) => ({
        ...prev,
        [block.id]: { attempts: attemptsSoFar, status: "unavailable", feedback: "Correction indisponible, réessaie." },
      }));
    }
  };
  const [blockModes, setBlockModes] = useState<Record<string, "text" | "draw">>(() => (reviewMode ? initialProgress?.blockModes : undefined) || {});

  // Nouvelle tentative : rien à effacer localement (plus de localStorage) —
  // le prochain chargement serveur ne trouvera simplement pas de progression
  // pour cette tentative.
  useEffect(() => {
    if (!forceNewAttempt) return;
    setExerciseCompleted(false);
    setAnswers({});
    setSubmittedBlocks(new Set());
    setResults({});
    setAiFeedback({});
    setRevealed({});
    setScore(0);
    setBlockModes({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [adminComments] = useState<Record<string, string>>(() => initialProgress?.adminComments || {});
  const [adminEditedAnswers] = useState<AnswerMap>(() => initialProgress?.adminEditedAnswers || {});
  // Rempli par l'effet de chargement serveur ci-dessous.
  const accumulatedSecondsRef = useRef(0);

  // Charge la progression depuis la base de données (survit à une déconnexion / changement d'appareil)
  const userIdRef = useRef<string | null>(null);
  const progressLoadedFromDbRef = useRef(false);
  useEffect(() => {
    if (reviewMode) return;
    if (isVirtualExercise(exercise.id)) return;
    if (forceNewAttempt) {
      // Nouvelle tentative : on ne restaure pas l'état d'une session précédente
      progressLoadedFromDbRef.current = true;
      return;
    }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      userIdRef.current = session.user.id;

      try {
        const res = await fetch(`/api/child/exercises/${exercise.id}/progress?userId=${session.user.id}`);
        const data = await res.json();
        const p = data?.progress;
        if (p) {
          setAnswers(p.answers || {});
          setSubmittedBlocks(new Set(p.submittedBlocks || []));
          setResults(p.results || {});
          setAiFeedback(p.aiFeedback || {});
          setRevealed(p.revealed || {});
          setScore(p.score || 0);
          setExerciseCompleted(p.exerciseCompleted || data?.status === "completed" || false);
          setBlockModes(p.blockModes || {});
          accumulatedSecondsRef.current = p.timeSpent || 0;
          if (typeof p.currentPageIndex === "number") {
            setCurrentScreenIndex(Math.min(p.currentPageIndex, Math.max(0, screens.length - 1)));
          }
          if (openCorrection) {
            setExerciseCompleted(false);
            setShowReview(true);
            setCurrentScreenIndex(0);
          }
        } else if (data?.status === "completed") {
          // Le statut "completed" a été enregistré (via /api/child/activities) mais le
          // progress_json détaillé n'a jamais été persisté (ex: navigation rapide après
          // la fin de l'exercice). On marque quand même l'exercice comme terminé.
          setExerciseCompleted(true);
        }
      } catch (e) {
        console.error("Failed to load exercise progress from DB:", e);
      } finally {
        progressLoadedFromDbRef.current = true;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  // Sauvegarde la progression en base de données (debounced) — seule
  // persistance désormais (plus d'écriture localStorage en parallèle).
  const saveProgressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (reviewMode) return;
    if (isVirtualExercise(exercise.id)) return;
    if (!progressLoadedFromDbRef.current) return; // évite d'écraser avant le chargement initial
    if (saveProgressTimeoutRef.current) clearTimeout(saveProgressTimeoutRef.current);

    const doSave = async () => {
      const userId = userIdRef.current;
      if (!userId) return;
      try {
        await fetch(`/api/child/exercises/${exercise.id}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            progress: {
              answers,
              submittedBlocks: Array.from(submittedBlocks),
              results,
              aiFeedback,
              revealed,
              score,
              exerciseCompleted,
              blockModes,
              currentPageIndex: currentScreenIndex,
              timeSpent: accumulatedSecondsRef.current,
            },
          }),
        });
      } catch (e) {
        console.error("Failed to save exercise progress to DB:", e);
      }
    };

    // Sauvegarde immédiate (non debounced) quand l'exercice vient d'être terminé,
    // pour ne pas perdre l'état "terminé" si l'utilisateur quitte la page tout de suite.
    if (exerciseCompleted) {
      doSave();
      return;
    }

    saveProgressTimeoutRef.current = setTimeout(doSave, 1000);
    return () => {
      if (saveProgressTimeoutRef.current) clearTimeout(saveProgressTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées : l'effet ne doit se relancer que sur son déclencheur
  }, [answers, submittedBlocks, results, aiFeedback, revealed, score, exerciseCompleted, blockModes, currentScreenIndex, exercise.id]);

  const currentScreen = screens[currentScreenIndex];
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Session timer — accumulé en base via progress_json.timeSpent (voir plus
  // haut), plus de localStorage.
  const sessionStartRef = useRef<number>(0); // posé au montage (voir l'effet plus bas)
  const getAccumulatedSeconds = () => {
    if (isVirtualExercise(exercise.id)) return 0;
    return accumulatedSecondsRef.current;
  };
  const saveTimeSpent = () => {
    if (isVirtualExercise(exercise.id)) return;
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const total = getAccumulatedSeconds() + elapsed;
    accumulatedSecondsRef.current = total;
    sessionStartRef.current = Date.now();
    return total;
  };
  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => { saveTimeSpent(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées : l'effet ne doit se relancer que sur son déclencheur
  }, []);
  // Durée affichée sur l'écran de fin : figée au moment où l'exercice se termine (l'affichage ne lit pas de ref).
  const [timeTotal, setTimeTotal] = useState(0);
  useEffect(() => {
    if (exerciseCompleted) setTimeTotal(getAccumulatedSeconds());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la fin de l'exercice déclenche la mesure
  }, [exerciseCompleted]);

  // Initialize AI Tutor context when viewer mounts
  useEffect(() => {
    if (!exercise.title) return;

    let questionText = extractExerciseContent(exercise.content_json);

    // Fallback to description
    if (!questionText && exercise.description) {
      questionText = exercise.description;
    }

    const newContext = {
      page: "exercise_detail" as const,
      exerciseTitle: exercise.title,
      exerciseQuestion: questionText.slice(0, 1000),
      exerciseDifficulty: exercise.difficulty_level || exercise.level || "moyen",
      exerciseType: exercise.type || "standard",
      courseTitle: exercise.courses?.title,
      courseSubject: exercise.courses?.subject || "Mathématiques",
      courseLevel: exercise.courses?.level || exercise.level,
    };

    setPageContext(newContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées : l'effet ne doit se relancer que sur son déclencheur
  }, [exercise.id, exercise.title, setPageContext]);

  // Update AI Tutor context with current student answers
  useEffect(() => {
    const answerSummary = Object.entries(answers)
      .map(([, answer]) => {
        if (typeof answer === "string" && answer.length > 0) {
          return answer;
        } else if (Array.isArray(answer) && answer.length > 0) {
          return answer.join(", ");
        }
        return null;
      })
      .filter((a): a is string => a !== null)
      .join(" | ");

    if (answerSummary) {
      setPageContext({
        ...pageContext,
        userAnswer: answerSummary.slice(0, 500), // Limit to 500 chars for API
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées : l'effet ne doit se relancer que sur son déclencheur
  }, [answers, setPageContext]);

  // Dynamic progress tracking
  const saveProgress = async (status: 'in_progress' | 'completed', currentScore: number, scorePercent?: number, passed?: boolean) => {
    const isPreview = isVirtualExercise(exercise.id);
    if (isPreview) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    let totalPoints = 0;
    pages.forEach((p) => p.blocks.forEach((b) => (totalPoints += b.points || 0)));

    try {
      await fetch("/api/child/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "exercise",
          userId: session.user.id,
          itemId: exercise.id,
          score: currentScore,
          totalPoints,
          status,
          scorePercent,
          passed,
        })
      });
    } catch (e) {
      console.error("Failed to save progress", e);
    }
  };

  // Track initial start
  useEffect(() => {
    saveProgress('in_progress', 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées : l'effet ne doit se relancer que sur son déclencheur
  }, []);



  // Tant qu'un clavier mathématique est ouvert, on ajoute de la place en bas
  // du contenu défilable — sinon une question tout en bas de la page n'a
  // nulle part où défiler pour dégager son champ de réponse au-dessus du
  // clavier fixe (même fix que CourseViewer, voir son commentaire).
  const [mathKeyboardOpen, setMathKeyboardOpen] = useState(false);
  useEffect(() => subscribeMathKeyboardVisibility(setMathKeyboardOpen), []);

  // Visibility control to prevent flicker
  const [contentVisible, setContentVisible] = useState(false);
  useEffect(() => {
    setContentVisible(false);
    const timer = setTimeout(() => setContentVisible(true), 150);
    return () => clearTimeout(timer);
  }, [currentScreenIndex]);

  // Scroll back to top when changing page
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentScreenIndex]);

  // Rend les graphiques interactifs après affichage de la page
  useEffect(() => {
    const t = setTimeout(() => enhanceMathGraphs(document.body), 200);
    return () => clearTimeout(t);
  }, [currentScreenIndex, contentVisible]);

  const handleBlockAnswerChange = (blockId: string, value: AnswerValue) => {
    if (submittedBlocks.has(blockId)) return;
    const inlineStatus = inlineText[blockId]?.status;
    if (inlineStatus === "correct" || inlineStatus === "revealed") return;
    setAnswers((prev) => ({ ...prev, [blockId]: value }));
  };

  const validateAllAnswers = async () => {
    setIsValidating(true);
    setGradingError(null);
    let totalScore = 0;
    const newResults: Record<string, boolean> = {};
    const newAiFeedback: Record<string, string> = {};
    const newCommentTokens: Record<string, string> = {};
    const newRevealed: Record<string, RevealInfo> = {};
    const newSubmitted = new Set<string>();
    const exerciseId = exercise.id || "preview";

    // Toute la copie part en UNE requête (corrigée en parallèle côté
    // serveur) — avant, chaque question attendait la précédente.
    const toGrade: { block: (typeof pages)[number]["blocks"][number]; answer: unknown }[] = [];
    for (const page of pages) {
      for (const block of page.blocks) {
        if (["text", "image"].includes(block.type)) continue;
        const answer = answers[block.id];
        const points = block.points || 0;

        if (answer === undefined || answer === null) {
          newResults[block.id] = false;
          newSubmitted.add(block.id);
          continue;
        }

        // Déjà vérifié en direct via le bouton "Vérifier" du bloc
        // (text_input) : on réutilise ce verdict plutôt que de rappeler
        // l'IA une seconde fois pour la même réponse.
        const inlineResult = inlineText[block.id];
        if (block.type === "text_input" && inlineResult?.resolvedCorrect !== undefined) {
          newResults[block.id] = inlineResult.resolvedCorrect;
          newAiFeedback[block.id] = inlineResult.feedback || "";
          if (inlineResult.revealedAnswer) {
            newRevealed[block.id] = { correctAnswer: inlineResult.revealedAnswer };
          }
          newSubmitted.add(block.id);
          if (inlineResult.resolvedCorrect) totalScore += inlineResult.resolvedScore ?? points;
          continue;
        }
        toGrade.push({ block, answer });
      }
    }

    // Correction manuelle : aucune note automatique, les réponses sont simplement enregistrées (l'enseignant les corrige ensuite).
    if (exercise.grading_type === "manual") {
      toGrade.splice(0).forEach(({ block }) => {
        newResults[block.id] = false;
        newSubmitted.add(block.id);
      });
    }

    if (toGrade.length > 0) {
      // La correction se fait toujours côté serveur (à partir des données
      // enregistrées en base) : le client ne connaît jamais la réponse
      // correcte avant d'avoir soumis la sienne.
      try {
        const preview = exerciseId === "preview";
        const results = await Promise.all(
          preview
            // Aperçu admin : l'énoncé part avec chaque question (pas en base).
            ? toGrade.map(({ block, answer }) =>
                fetch(`/api/child/exercises/preview/grade`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ block_id: block.id, block, grading_type: exercise.grading_type, answer, question: block.content, correctAnswer: block.correctAnswer, explanation: block.explanation, level: exercise.level || "6eme", points: block.points }),
                }).then((r) => r.json()).then((d) => ({ ...d, block_id: block.id })),
              )
            : [
                fetch(`/api/child/exercises/${exerciseId}/grade`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ items: toGrade.map(({ block, answer }) => ({ block_id: block.id, answer })) }),
                }).then(async (r) => {
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error || "Correction indisponible, réessaie.");
                  return d.results as ExerciseGradeResult[];
                }),
              ],
        ).then((out) => (preview ? out : out[0]) as ExerciseGradeResult[]);

        const byBlock = new Map(results.map((r) => [r.block_id, r]));
        if (results.some((r) => r?.unavailable)) {
          // Panne d'infra, pas une vraie tentative : rien n'est enregistré,
          // l'élève peut resoumettre à l'identique.
          setIsValidating(false);
          setGradingError(results.find((r) => r?.unavailable)?.feedback || "Correction indisponible, réessaie.");
          return;
        }
        for (const { block } of toGrade) {
          const data: ExerciseGradeResult = byBlock.get(block.id) || {};
          const isCorrect = !!data.is_correct;
          if (data.feedback) newAiFeedback[block.id] = data.feedback;
          if (data.comment_token) newCommentTokens[block.id] = data.comment_token;
          if (data.reveal) newRevealed[block.id] = data.reveal;
          newResults[block.id] = isCorrect;
          newSubmitted.add(block.id);
          // Crédit partiel : une association bien placée sur trois rapporte son point même si le bloc n'est pas parfait.
          if (data.score !== undefined) totalScore += data.score;
          else if (isCorrect) totalScore += block.points || 0;
        }
      } catch (e) {
        console.error(e);
        setIsValidating(false);
        setGradingError((e as Error).message || "Correction indisponible, réessaie.");
        return;
      }
    }

    setResults(newResults);
    setAiFeedback(newAiFeedback);
    // Mini commentaires de l'IA sur les erreurs : ils s'ajoutent à la correction dès qu'ils arrivent.
    Object.entries(newCommentTokens).forEach(([blockId, token]) => {
      void fetchMiniComment(token).then((comment) => {
        if (comment) setAiFeedback((prev) => ({ ...prev, [blockId]: comment }));
      });
    });
    setRevealed(newRevealed);
    setSubmittedBlocks(newSubmitted);
    setScore(totalScore);
    setIsValidating(false);
    setExerciseCompleted(true);
    
    // Save completed progress dynamically (pass threshold computed post-state-set)
    const tp = (() => { let t = 0; pages.forEach(p => p.blocks.forEach(b => (t += b.points || 0))); return t; })();
    let pct: number;
    if (tp > 0) {
      pct = Math.round((totalScore / tp) * 100);
    } else {
      // Aucun block n'a de points définis : se baser sur le ratio de bonnes réponses
      // pour éviter d'afficher 100% par défaut quel que soit le résultat.
      const gradableCount = Object.keys(newResults).length;
      const correctCount = Object.values(newResults).filter(Boolean).length;
      pct = gradableCount > 0 ? Math.round((correctCount / gradableCount) * 100) : 100;
    }
    const didPass = pct >= passThreshold(exercise.min_score_percent);
    saveProgress('completed', totalScore, pct, didPass);
    
    // Legacy onComplete for the parent
    if (onComplete) {
      // Calculate total points
      let totalPoints = 0;
      pages.forEach((p) =>
        p.blocks.forEach((b) => (totalPoints += b.points || 0))
      );
      onComplete(totalScore, totalPoints);
    }
  };

  const handleNextPage = () => {
    if (currentScreenIndex < screens.length - 1) {
      setCurrentScreenIndex(currentScreenIndex + 1);
      const container = document.getElementById("exercise-content-container");
      if (container) container.scrollTop = 0;
    }
  };

  const handlePrevPage = () => {
    if (currentScreenIndex > 0) {
      setCurrentScreenIndex(currentScreenIndex - 1);
      const container = document.getElementById("exercise-content-container");
      if (container) container.scrollTop = 0;
    }
  };

  if (!pages.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p>Cet exercice ne contient aucun contenu pour le moment.</p>
      </div>
    );
  }

  if (exerciseCompleted && !reviewMode) {
    let totalPoints = 0;
    pages.forEach((p) => p.blocks.forEach((b) => (totalPoints += b.points || 0)));
    const gradable = Object.keys(results).length;
    const percentage = totalPoints > 0
      ? Math.round((score / totalPoints) * 100)
      : gradable > 0 ? Math.round((Object.values(results).filter(Boolean).length / gradable) * 100) : 100;
    const mins = Math.floor(timeTotal / 60);
    const isPreview = isVirtualExercise(exercise.id);
    const threshold = passThreshold(exercise.min_score_percent);
    const manual = exercise.grading_type === "manual";
    const passed = manual || percentage >= threshold;
    const answeredCount = submittedBlocks.size || Object.keys(results).length;

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-[var(--greek-cream)]">
        <div className="container mx-auto px-3 py-4 md:px-4 md:py-6 max-w-5xl">
          <div className="bg-white rounded-[20px] shadow-lg border-2 border-[rgba(197,161,72,0.25)] overflow-hidden">
            {/* Thumbnail header */}
            <div className={`relative h-64 md:h-80 overflow-hidden flex items-center justify-center ${passed ? "bg-[var(--greek-cream)]" : "bg-red-50"}`}>
              <Brain className="w-24 h-24 text-[var(--greek-blue)] opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                <div className="p-5 md:p-8 text-white w-full">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-full mb-3 shadow-md ${passed ? "bg-[var(--greek-gold)] text-[var(--greek-blue)]" : "bg-red-500 text-white"}`}>
                    {manual ? <><CheckCircle className="w-3.5 h-3.5" /> Copie envoyée</> : passed ? <><Trophy className="w-3.5 h-3.5" /> Exercice réussi !</> : <><XCircle className="w-3.5 h-3.5" /> Score insuffisant</>}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2">{exercise.title}</h1>
                </div>
              </div>
            </div>

            <div className="p-5 md:p-8">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                {/* Left */}
                <div className="flex-grow">
                  <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-[var(--greek-gold)]" />
                    {manual ? "Merci !" : "Félicitations !"}
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    {manual
                      ? "Tes réponses sont enregistrées. Ton professeur va les corriger : tu verras ta note dès que ce sera fait."
                      : <>Tu as terminé cet exercice. Consulte ta correction{onRestart && !restartBlocked ? " ou retente-le pour améliorer ton score" : ""} !</>}
                  </p>
                  <div className={`grid gap-3 ${manual ? "grid-cols-2" : "grid-cols-3"}`}>
                    {(manual
                      ? [
                          { value: `${answeredCount}`, sub: "questions envoyées" },
                          { value: mins > 0 ? `${mins} min` : "< 1 min", sub: "temps passé" },
                        ]
                      : [
                          { value: `${score}/${totalPoints}`, sub: "points obtenus" },
                          { value: mins > 0 ? `${mins} min` : "< 1 min", sub: "temps passé" },
                          { value: `${percentage}%`, sub: "réussite" },
                        ]
                    ).map((s, i) => (
                      <div key={s.sub} className={`rounded-xl p-4 text-center border ${i === 2 ? (passed ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300") : "bg-[var(--greek-cream)] border-[rgba(197,161,72,0.25)]"}`}>
                        <p className={`text-xl font-bold font-[family-name:var(--font-display)] ${i === 2 ? (passed ? "text-green-600" : "text-red-600") : "text-[var(--greek-blue)]"}`}>{s.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                      </div>
                    ))}
                  </div>
                  {!manual && typeof bestScorePercent === "number" && bestScorePercent > percentage && (
                    <p className="mt-3 text-sm text-[var(--greek-blue)] font-bold">
                      Ton meilleur score reste {bestScorePercent}%
                    </p>
                  )}
                  {!manual && threshold > 0 && (
                    <div className={`mt-4 flex items-center gap-2 text-sm font-bold px-4 py-3 rounded-xl ${passed ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                      {passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {passed ? `Seuil atteint (${threshold}% requis)` : `Seuil non atteint : ${threshold}% requis, tu as eu ${percentage}%`}
                    </div>
                  )}
                </div>

                {/* Right CTA */}
                <div className="w-full md:w-80 flex-shrink-0">
                  <div className="bg-[var(--greek-cream)] rounded-xl p-6 border border-[rgba(197,161,72,0.25)] sticky top-24 space-y-3">
                    <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 text-center">Et maintenant ?</h3>
                    {!manual && (
                      <GlassButton
                        onClick={() => {
                          setExerciseCompleted(false);
                          setShowReview(true);
                          setCurrentScreenIndex(0);
                        }}
                        variant="navy"
                        fullWidth
                        className="font-bold text-base"
                      >
                        Voir la correction
                      </GlassButton>
                    )}
                    {onRestart && !isPreview && !restartBlocked && (
                      <>
                        <GlassButton onClick={onRestart} variant="navy" fullWidth className="font-bold text-base">
                          <RotateCcw className="w-4 h-4" /> Refaire l&apos;exercice
                        </GlassButton>
                        {!!exercise.max_attempts && (
                          <p className="text-xs text-gray-500 text-center -mt-1">Un nouvel essai sera compté.</p>
                        )}
                      </>
                    )}
                    {onRestart && !isPreview && restartBlocked && (
                      <p className="text-xs text-gray-500 text-center">Tu as utilisé tous tes essais pour cet exercice.</p>
                    )}
                    <GlassButton href={exercise.course_id ? `/child/exercises?course=${exercise.course_id}` : "/child/exercises"} variant="outline" fullWidth className="font-bold text-base">
                      Retour aux exercices
                    </GlassButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden border border-[var(--greek-gold)]">
      {/* Header */}
      <div className="bg-[var(--greek-cream)] border-b border-[var(--greek-gold)] px-4 py-3 md:px-6 md:py-4 flex items-center gap-3 justify-between shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <GlassIconButton icon={ArrowLeft} onClick={() => { saveTimeSpent(); onBack(); }} color="navy" size="sm" aria-label="Retour" />
          )}
          <h3 className="font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)]">
            {exercise.title}
          </h3>
        </div>
        <div className="text-sm font-medium text-[var(--greek-blue)] bg-[var(--greek-blue)]/10 border border-[var(--greek-gold)] px-3 py-1 rounded-full">
          {/* "questions liées" (voir plan) sont les seules à produire plusieurs
              écrans de question, "Étape" communique mieux l'enchaînement que
              "Page" dans ce cas, sans rien changer au fonctionnement. */}
          {screens.length > 1 ? "Étape" : "Page"} {currentScreenIndex + 1} / {screens.length}
        </div>
      </div>

      {/* Content */}
      <div
        id="exercise-content-container"
        ref={mainScrollRef}
        className={`flex-1 overflow-y-auto p-3 md:p-5 bg-white/50 transition-opacity duration-200 ${contentVisible ? "opacity-100" : "opacity-0"}`}
      >
        <div
          className={`${currentScreen.layout === "problem" ? "max-w-6xl" : "max-w-4xl"} mx-auto space-y-8 pb-20 transition-[padding-bottom] duration-200`}
          style={mathKeyboardOpen ? { paddingBottom: "380px" } : undefined}
        >
          {(() => {
          const isContext = (b: (typeof currentScreen.blocks)[number]) => b.type === "text" || b.type === "image";
          const questionBlocks = currentScreen.blocks.filter((b) => !isContext(b));
          const hasAnswer = (b: (typeof currentScreen.blocks)[number]) => {
            const a = answers[b.id];
            if (Array.isArray(a)) return a.some((v) => v !== "" && v !== null && v !== undefined);
            return a !== undefined && a !== null && String(a).trim() !== "";
          };
          const renderBlock = (block: (typeof currentScreen.blocks)[number]) => {
            // Questions débloquées une par une : tant que la précédente n'a pas reçu de réponse, celle-ci reste fermée.
            const questionIndex = questionBlocks.indexOf(block);
            const previousQuestion = questionIndex > 0 ? questionBlocks[questionIndex - 1] : undefined;
            const locked =
              currentScreen.sequential &&
              !reviewMode &&
              previousQuestion !== undefined &&
              !(submittedBlocks.has(previousQuestion.id) || hasAnswer(previousQuestion) || inlineText[previousQuestion.id]?.status === "correct" || inlineText[previousQuestion.id]?.status === "revealed");
            if (locked) {
              return (
                <div key={block.id} className="rounded-2xl border border-dashed border-[var(--greek-gold)] bg-[var(--greek-cream)]/30 px-5 py-4 flex items-center gap-3 text-sm text-gray-500">
                  <Lock className="w-4 h-4 text-[var(--greek-gold)] shrink-0" />
                  <span>
                    <span className="font-semibold text-[var(--greek-blue)]">{block.title || "Question suivante"}</span> : réponds d&apos;abord à la question précédente.
                  </span>
                </div>
              );
            }
            const isSubmitted = reviewMode || submittedBlocks.has(block.id);
            const answer = answers[block.id];
            const inline = inlineText[block.id];
            const inlineResolved = inline?.status === "correct" || inline?.status === "revealed";

            // Determine correctness for feedback
            const isCorrect = isSubmitted ? results[block.id] ?? false : false;

            return (
              <div
                key={block.id}
                className="bg-[var(--greek-cream)]/30 rounded-2xl overflow-hidden p-4 md:p-6 border border-[var(--greek-gold)]"
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-lg text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                    {block.title}
                  </h4>
                  <div className="flex items-center gap-2 shrink-0">
                    {block.type !== "image" && (block.content || block.title) && (
                      <ReadAloudButton
                        text={`${block.content || block.title || ""}${block.options?.length && block.type !== "fill_in_the_blank" ? `. ${block.options.map((o, i) => `Choix ${i + 1} : ${o}`).join(". ")}` : ""}`}
                      />
                    )}
                    {block.points && (
                      <span className="text-xs font-bold bg-[var(--greek-gold)]/20 text-[var(--greek-bronze)] border border-[rgba(197,161,72,0.25)] px-2 py-1 rounded-full">
                        {block.points} pts
                      </span>
                    )}
                  </div>
                </div>

                {block.content && block.type === "image" && (
                  <div className="mb-6">
                    {block.mediaType === "video" ? (
                      <video src={block.content} controls className="max-h-96 rounded-lg border bg-black" />
                    ) : block.mediaType === "audio" ? (
                      <audio src={block.content} controls className="w-full max-w-md" />
                    ) : (
                      <img src={block.content} alt={block.title || ""} className="max-h-96 object-contain rounded-lg border bg-gray-50" />
                    )}
                  </div>
                )}

                {block.content && block.type !== "fill_in_the_blank" && block.type !== "image" && (
                  <div
                    className="prose max-w-none mb-6 text-gray-600 prose-headings:text-[var(--greek-blue)] prose-a:text-[var(--greek-blue)]"
                    dangerouslySetInnerHTML={{ __html: renderLatexInHTML(renderMathGraphPlaceholders(block.content || "")) }}
                  />
                )}

                {block.hints && block.hints.length > 0 && !isSubmitted && (
                  <div className="mb-4 space-y-2">
                    {block.hints.slice(0, hintsShown[block.id] ?? 0).map((hint, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-[rgba(197,161,72,0.4)] bg-[var(--greek-cream)] px-3 py-2 text-sm text-[var(--greek-bronze)]">
                        <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-[var(--greek-gold)]" />
                        <div dangerouslySetInnerHTML={{ __html: renderLatexInHTML(hint) }} />
                      </div>
                    ))}
                    {(hintsShown[block.id] ?? 0) < block.hints.length && (
                      <GlassButton
                        onClick={() => setHintsShown((prev) => ({ ...prev, [block.id]: (prev[block.id] ?? 0) + 1 }))}
                        variant="outline"
                        size="sm"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        {(hintsShown[block.id] ?? 0) === 0 ? "Un coup de pouce ?" : "Encore un coup de pouce"} ({hintsShown[block.id] ?? 0}/{block.hints.length})
                      </GlassButton>
                    )}
                  </div>
                )}

                {/* Interactive Elements */}
                <div className="mt-4">
                  {block.type === "text_input" && <TextInputAnswer blockModes={blockModes} block={block} setBlockModes={setBlockModes} isSubmitted={isSubmitted} inlineResolved={inlineResolved} answer={answer} handleBlockAnswerChange={handleBlockAnswerChange} answers={answers} mathfieldRefs={mathfieldRefs} isCorrect={isCorrect} inline={inline} exercise={exercise} verifyTextBlock={verifyTextBlock} />}

                  {(block.type === "single_choice" ||
                    block.type === "true_false") && (
                    <div className="space-y-2">
                      {block.options?.map((option, idx) => {
                        const isSelected = answer === option;
                        let btnClass =
                          "border-gray-200 hover:bg-[var(--greek-gold)]/10";

                        if (isSubmitted) {
                          if (option === revealed[block.id]?.correctAnswer)
                            btnClass =
                              "bg-green-50 border-green-500 text-green-700";
                          else if (isSelected)
                            btnClass = "bg-red-50 border-red-500 text-red-700";
                        } else if (isSelected) {
                          btnClass =
                            "bg-[var(--greek-blue)]/10 border-[var(--greek-blue)] text-[var(--greek-blue)] font-medium shadow-sm";
                        }

                        return (
                          <button
                            key={idx}
                            disabled={isSubmitted}
                            onClick={() =>
                              handleBlockAnswerChange(block.id, option)
                            }
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${btnClass}`}
                          >
                            <span
                              dangerouslySetInnerHTML={{
                                __html: renderLatexInHTML(option),
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(block.type === "multiple_choice" || block.type === "qcm") && (
                    <div className="space-y-2">
                      {block.options?.map((option, idx) => {
                        const currentSelected = Array.isArray(answer)
                          ? answer
                          : [];
                        const isSelected = currentSelected.includes(option);

                        let btnClass =
                          "border-gray-200 hover:bg-[var(--greek-gold)]/10";
                        if (isSubmitted) {
                          const revealedAnswer = revealed[block.id]?.correctAnswer;
                          const correctArr = Array.isArray(revealedAnswer)
                            ? revealedAnswer
                            : revealedAnswer !== undefined
                            ? [revealedAnswer]
                            : [];
                          if (correctArr.includes(option))
                            btnClass =
                              "bg-green-50 border-green-500 text-green-700";
                          else if (isSelected)
                            btnClass = "bg-red-50 border-red-500 text-red-700";
                        } else if (isSelected) {
                          btnClass =
                            "bg-[var(--greek-blue)]/10 border-[var(--greek-blue)] text-[var(--greek-blue)] font-medium shadow-sm";
                        }

                        return (
                          <button
                            key={idx}
                            disabled={isSubmitted}
                            onClick={() => {
                              if (isSubmitted) return;
                              const newSelected = isSelected
                                ? currentSelected.filter(
                                    (a) => a !== option
                                  )
                                : [...currentSelected, option];
                              handleBlockAnswerChange(block.id, newSelected);
                            }}
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${btnClass}`}
                          >
                            <span
                              dangerouslySetInnerHTML={{
                                __html: renderLatexInHTML(option),
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {block.type === "fill_in_the_blank" && block.figureSpec && (
                    <div className="text-gray-800">
                      {block.content && (
                        <div className="prose max-w-none mb-2" dangerouslySetInnerHTML={{ __html: renderLatexInHTML(block.content) }} />
                      )}
                      <FigureInputs
                        spec={block.figureSpec}
                        values={answerList(answer) as string[]}
                        disabled={!!isSubmitted}
                        expected={revealed[block.id]?.blanks}
                        submitted={!!isSubmitted}
                        onChange={(next) => handleBlockAnswerChange(block.id, next)}
                      />
                    </div>
                  )}

                  {block.type === "fill_in_the_blank" && !block.figureSpec && (
                    <div className="text-lg leading-loose text-gray-800">
                      {/* Chaque trou est un champ posé à sa place : dans la phrase, dans une case de tableau ou DANS la figure. */}
                      <SlotHtml
                        html={renderLatexInHTML(tokenizeSlots(block.content || ""))}
                        values={answerList(answer) as string[]}
                        disabled={!!isSubmitted}
                        expected={revealed[block.id]?.blanks}
                        submitted={!!isSubmitted}
                        onChange={(next) => handleBlockAnswerChange(block.id, next)}
                      />
                    </div>
                  )}

                  {block.type === "matching" && (
                    <MatchingDragList
                      lefts={(block.pairs || []).map((p) => p.left)}
                      shuffledRights={shuffledRightOptions[block.id] || []}
                      savedAnswer={Array.isArray(answer) && answer.length ? (answer as string[]) : undefined}
                      disabled={!!isSubmitted}
                      onChange={(next) => handleBlockAnswerChange(block.id, next)}
                      getItemClass={(right, i) => {
                        if (!isSubmitted) return "border-gray-200 bg-white";
                        const correctRight = revealed[block.id]?.pairs?.[i]?.right;
                        return right === correctRight ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50";
                      }}
                    />
                  )}

                  {block.type === "ordering" && (
                    <OrderingDragList
                      shuffledItems={shuffledOrderingItems[block.id] || block.items || []}
                      savedAnswer={Array.isArray(answer) && answer.length ? (answer as string[]) : undefined}
                      disabled={!!isSubmitted}
                      onChange={(next) => handleBlockAnswerChange(block.id, next)}
                      getItemClass={(item, i) => {
                        if (!isSubmitted) return "border-gray-200 bg-white";
                        const correctItem = revealed[block.id]?.items?.[i];
                        return item === correctItem ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50";
                      }}
                    />
                  )}

                  {block.type === "categorize" && (
                    <CategorizeDragList
                      displayItems={shuffledCategorizeItems[block.id] || (block.categoryItems || []).map((it, i) => ({ originalIndex: i, text: it.text }))}
                      categories={block.categories || []}
                      savedAnswer={Array.isArray(answer) && answer.length ? (answer as string[]) : undefined}
                      disabled={!!isSubmitted}
                      onChange={(next) => handleBlockAnswerChange(block.id, next)}
                      getItemClass={(originalIndex) => {
                        if (!isSubmitted) return "border-gray-200 bg-white";
                        const correctCategory = revealed[block.id]?.categoryItems?.[originalIndex]?.category;
                        const given = Array.isArray(answer) ? answer[originalIndex] : undefined;
                        return given === correctCategory ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50";
                      }}
                    />
                  )}

                  {block.type === "number_line_point" && (
                    <NumberLinePoint
                      min={block.numberLineMin ?? 0}
                      max={block.numberLineMax ?? 10}
                      step={block.numberLineStep || 1}
                      disabled={!!isSubmitted}
                      savedValue={typeof answer === "number" ? answer : undefined}
                      onChange={(v) => handleBlockAnswerChange(block.id, v)}
                      correctness={
                        isSubmitted
                          ? {
                              correct: !!results[block.id],
                              correctValue: parseFloat(String(revealed[block.id]?.correctAnswer ?? answer)),
                            }
                          : null
                      }
                    />
                  )}

                  {block.type === "click_error" && <ClickErrorAnswer block={block} answer={answer} isSubmitted={isSubmitted} revealed={revealed} handleBlockAnswerChange={handleBlockAnswerChange} />}

                  {block.type === "coding" && <CodingAnswer isSubmitted={isSubmitted} answer={answer} handleBlockAnswerChange={handleBlockAnswerChange} block={block} isCorrect={isCorrect} exercise={exercise} />}

                  {block.type === "impossible_search" && <ImpossibleSearchAnswer isSubmitted={isSubmitted} answer={answer} handleBlockAnswerChange={handleBlockAnswerChange} block={block} isCorrect={isCorrect} exercise={exercise} />}
                </div>

                {/* Feedback after global validation */}
                {isSubmitted && (
                  <div className="mt-4 pt-4 border-t border-[rgba(197,161,72,0.25)] flex flex-col gap-3">
                    <AnswerFeedback
                      kind={isCorrect ? "correct" : "wrong"}
                      feedback={aiFeedback[block.id]}
                      points={isCorrect ? block.points : undefined}
                      correctAnswer={!isCorrect && typeof revealed[block.id]?.correctAnswer === "string" && ["text_input", "impossible_search"].includes(block.type) ? (revealed[block.id].correctAnswer as string) : undefined}
                    />

                    {adminEditedAnswers[block.id] !== undefined && (
                      <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-purple-800 text-xs">
                        <span className="font-bold block mb-0.5">Réponse corrigée par l&apos;admin :</span>
                        {typeof adminEditedAnswers[block.id] === "string" ? adminEditedAnswers[block.id] : JSON.stringify(adminEditedAnswers[block.id])}
                      </div>
                    )}
                    {adminComments[block.id] && (
                      <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-purple-800 text-xs">
                        <span className="font-bold block mb-0.5">Commentaire de l&apos;admin :</span>
                        {adminComments[block.id]}
                      </div>
                    )}
                    {adminMode && <AdminReviewPanel block={block} answer={answer} adminComments={adminComments} adminEditedAnswers={adminEditedAnswers} adminMode={adminMode} />}
                  </div>
                )}
              </div>
            );
          };
          if (currentScreen.layout !== "problem") return currentScreen.blocks.map(renderBlock);
          // Problème guidé : l'énoncé commun (texte, figure) reste visible à côté des questions.
          const contextBlocks = currentScreen.blocks.filter((b, i) => isContext(b) && currentScreen.blocks.slice(0, i).every(isContext));
          const stepBlocks = currentScreen.blocks.filter((b) => !contextBlocks.includes(b));
          return (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start">
              <div className="space-y-6 lg:sticky lg:top-2">{contextBlocks.map(renderBlock)}</div>
              <div className="space-y-6">{stepBlocks.map(renderBlock)}</div>
            </div>
          );
          })()}
        </div>
      </div>

      {gradingError && (
        <div
          className="mx-4 mb-3 p-3 rounded-xl flex items-start gap-2 shrink-0"
          style={{ background: "#fffbeb", color: "#92400e" }}
        >
          <Loader2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            <span className="font-semibold">Correction indisponible.</span>{" "}
            {gradingError} Tes réponses sont conservées, tu peux revalider.
          </p>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="bg-[var(--greek-cream)] border-t border-[var(--greek-gold)] p-4 flex justify-between shrink-0">
        <GlassButton
          onClick={handlePrevPage}
          disabled={currentScreenIndex === 0}
          variant="ghost"
          style={currentScreenIndex === 0 ? { opacity: 0 } : undefined}
        >
          <ArrowLeft className="w-4 h-4" /> Précédent
        </GlassButton>

        {reviewMode ? (
          <GlassButton
            onClick={handleNextPage}
            disabled={currentScreenIndex >= screens.length - 1}
            variant="navy"
          >
            Suivant <ArrowRight className="w-4 h-4" />
          </GlassButton>
        ) : (
        <GlassButton
          onClick={
            showReview
              ? currentScreenIndex < screens.length - 1
                ? handleNextPage
                : openCorrection
                ? onBack || (() => {})
                : () => {
                    setShowReview(false);
                    setExerciseCompleted(true);
                    const tp = (() => { let t = 0; pages.forEach(p => p.blocks.forEach(b => (t += b.points || 0))); return t; })();
                    let pct: number;
                    if (tp > 0) {
                      pct = Math.round((score / tp) * 100);
                    } else {
                      const gradableCount = Object.keys(results).length;
                      const correctCount = Object.values(results).filter(Boolean).length;
                      pct = gradableCount > 0 ? Math.round((correctCount / gradableCount) * 100) : 100;
                    }
                    const didPass = pct >= passThreshold(exercise.min_score_percent);
                    saveProgress('completed', score, pct, didPass);
                  }
              : currentScreenIndex < screens.length - 1
              ? handleNextPage
              : validateAllAnswers
          }
          disabled={isValidating}
          variant="navy"
        >
          {isValidating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Validation...
            </>
          ) : showReview ? (
            currentScreenIndex < screens.length - 1 ? (
              <>
                Suivant <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                {openCorrection ? "Fermer" : "Terminer l'exercice"} <CheckCircle className="w-4 h-4" />
              </>
            )
          ) : currentScreenIndex < screens.length - 1 ? (
            <>
              Suivant <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              Valider et Terminer <CheckCircle className="w-4 h-4" />
            </>
          )}
        </GlassButton>
        )}
      </div>
    </div>
  );
}
