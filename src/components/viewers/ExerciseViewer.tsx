"use client";

import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
  Trophy,
  Brain,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Pencil,
  Keyboard,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Page, Block } from "@/components/admin/ExerciseBuilder";
import { supabase } from "@/lib/supabaseClient";
import { useAITutor } from "@/contexts/AITutorContext";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { renderMathGraphPlaceholders, enhanceMathGraphs } from "@/lib/mathGraph";
import MathInput, { MathInputHandle, subscribeMathKeyboardVisibility } from "@/components/MathInput";
import DrawingCanvas from "@/components/DrawingCanvas";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import "katex/dist/katex.min.css";

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

/** Zone commentaire + édition de réponse affichée sous une question, en revue
 * admin uniquement (`adminMode` fourni par le parent). Composant local pour
 * ne pas alourdir l'état déjà volumineux d'ExerciseViewer — gère juste ses
 * deux champs (textarea) et délègue la sauvegarde au parent. */
export function AdminAttemptControls({
  itemKey,
  currentAnswer,
  existingComment,
  existingEditedAnswer,
  adminMode,
}: {
  itemKey: string;
  currentAnswer: any;
  existingComment?: string;
  existingEditedAnswer?: any;
  adminMode: { onComment: (key: string, text: string) => void; onEditAnswer: (key: string, value: any) => void; saving?: boolean };
}) {
  const [comment, setComment] = useState(existingComment || "");
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(() =>
    JSON.stringify(existingEditedAnswer !== undefined ? existingEditedAnswer : currentAnswer, null, 2)
  );

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-purple-200 space-y-2">
      <div className="flex items-center gap-2">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Laisser un commentaire pour l'élève sur cette question..."
          className="flex-1 text-xs border border-purple-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-300"
          rows={2}
        />
        <GlassButton size="sm" variant="outline" onClick={() => adminMode.onComment(itemKey, comment)} disabled={adminMode.saving}>
          Enregistrer
        </GlassButton>
      </div>
      {!editing ? (
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-purple-600 hover:underline">
          Modifier la réponse enregistrée
        </button>
      ) : (
        <div className="space-y-1.5">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full text-xs font-mono border border-purple-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-300"
            rows={2}
          />
          <div className="flex gap-2">
            <GlassButton
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  adminMode.onEditAnswer(itemKey, JSON.parse(editValue));
                  setEditing(false);
                } catch {
                  // JSON invalide — on laisse le champ ouvert pour correction.
                }
              }}
              disabled={adminMode.saving}
            >
              Enregistrer la correction
            </GlassButton>
            <GlassButton size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}

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
    courses?: { title?: string; subject?: string; level?: string } | null;
    min_score_percent?: number | null;
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
  initialProgress?: {
    answers?: Record<string, any>;
    submittedBlocks?: string[];
    results?: Record<string, boolean>;
    aiFeedback?: Record<string, string>;
    revealed?: Record<string, any>;
    score?: number;
    blockModes?: Record<string, "text" | "draw">;
    /** Commentaire/réponse corrigée laissés par un admin sur cette tentative
     * (revue admin — voir /admin/users/attempt-review) : affichés en lecture
     * même hors mode admin, pour que l'élève les voie sur SA propre page de
     * correction. */
    adminComments?: Record<string, string>;
    adminEditedAnswers?: Record<string, any>;
  } | null;
  /** Présent uniquement sur l'écran de revue admin (reviewMode est aussi vrai
   * dans ce cas) : ajoute, sous chaque question déjà affichée en lecture
   * seule, un champ de commentaire et un bouton pour corriger la réponse
   * enregistrée de l'élève. Purement additif — sans ce prop, reviewMode se
   * comporte exactement comme avant (écran élève). */
  adminMode?: {
    onComment: (blockId: string, text: string) => void;
    onEditAnswer: (blockId: string, value: any) => void;
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
  initialProgress,
  adminMode,
}: ExerciseViewerProps) {
  const pages = exercise.content_json || [];
  const { pageContext, setPageContext } = useAITutor();

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

  // Position/réponses/score : plus de repli localStorage — tout vient du
  // serveur (effet "Charge la progression..." plus bas), avec un bref flash
  // à l'état vide le temps du premier chargement.
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<string, any>>(() => (reviewMode ? initialProgress?.answers : undefined) || {});
  const mathfieldRefs = useRef<Record<string, MathInputHandle | null>>({});
  const [submittedBlocks, setSubmittedBlocks] = useState<Set<string>>(
    () => new Set((reviewMode ? initialProgress?.submittedBlocks : undefined) || [])
  );
  const [loadingBlocks, setLoadingBlocks] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, boolean>>(() => (reviewMode ? initialProgress?.results : undefined) || {});
  const [aiFeedback, setAiFeedback] = useState<Record<string, string>>(() => (reviewMode ? initialProgress?.aiFeedback : undefined) || {});
  // Réponse correcte, révélée par le serveur uniquement après soumission de
  // chaque bloc — jamais présente dans le contenu initial envoyé à l'élève.
  const [revealed, setRevealed] = useState<Record<string, any>>(() => (reviewMode ? initialProgress?.revealed : undefined) || {});
  const [score, setScore] = useState(() => (reviewMode ? initialProgress?.score : undefined) || 0);
  const [exerciseCompleted, setExerciseCompleted] = useState(() => (reviewMode ? true : false));
  const [showReview, setShowReview] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [blockModes, setBlockModes] = useState<Record<string, "text" | "draw">>(() => (reviewMode ? initialProgress?.blockModes : undefined) || {});
  const [adminComments] = useState<Record<string, string>>(() => initialProgress?.adminComments || {});
  const [adminEditedAnswers] = useState<Record<string, any>>(() => initialProgress?.adminEditedAnswers || {});
  // Rempli par l'effet de chargement serveur ci-dessous.
  const accumulatedSecondsRef = useRef(0);

  // Charge la progression depuis la base de données (survit à une déconnexion / changement d'appareil)
  const userIdRef = useRef<string | null>(null);
  const progressLoadedFromDbRef = useRef(false);
  useEffect(() => {
    if (reviewMode) return;
    if (!exercise.id || exercise.id === "preview") return;
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
            const pageCount = (exercise.content_json?.length || 0);
            setCurrentPageIndex(Math.min(p.currentPageIndex, Math.max(0, pageCount - 1)));
          }
          if (openCorrection) {
            setExerciseCompleted(false);
            setShowReview(true);
            setCurrentPageIndex(0);
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
    if (!exercise.id || exercise.id === "preview") return;
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
              currentPageIndex,
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
  }, [answers, submittedBlocks, results, aiFeedback, revealed, score, exerciseCompleted, blockModes, currentPageIndex, exercise.id]);

  const currentPage = pages[currentPageIndex];
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Session timer — accumulé en base via progress_json.timeSpent (voir plus
  // haut), plus de localStorage.
  const sessionStartRef = useRef<number>(Date.now());
  const getAccumulatedSeconds = () => {
    if (!exercise.id || exercise.id === "preview") return 0;
    return accumulatedSecondsRef.current;
  };
  const saveTimeSpent = () => {
    if (!exercise.id || exercise.id === "preview") return;
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const total = getAccumulatedSeconds() + elapsed;
    accumulatedSecondsRef.current = total;
    sessionStartRef.current = Date.now();
    return total;
  };
  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => { saveTimeSpent(); };
  }, []);

  // Initialize AI Tutor context when viewer mounts
  useEffect(() => {
    if (!exercise.title) return;

    // Extract content from all blocks (same function as in [id]/page.tsx)
    const extractContent = (contentJson: any): string => {
      if (!contentJson || !Array.isArray(contentJson)) {
        return "";
      }

      const allContent: string[] = [];

      contentJson.forEach((page: any) => {
        if (page.blocks && Array.isArray(page.blocks)) {
          page.blocks.forEach((block: any) => {
            if (block.content) allContent.push(block.content);
            if (block.text) allContent.push(block.text);
            if (block.question) allContent.push(block.question);
            if (block.prompt) allContent.push(block.prompt);

            if (block.options && Array.isArray(block.options)) {
              block.options.forEach((opt: any) => {
                if (opt.text) allContent.push(`- ${opt.text}`);
                if (opt.label) allContent.push(`- ${opt.label}`);
              });
            }

            if (block.type === "true_false" && block.statement) {
              allContent.push(block.statement);
            }

            if (block.type === "text_input" && block.label) {
              allContent.push(block.label);
            }

            if (block.type === "image") {
              if (block.alt) allContent.push(`[Image: ${block.alt}]`);
              if (block.caption) allContent.push(block.caption);
            }
          });
        }
      });

      return allContent.filter((c) => c && c.length > 0).join("\n");
    };

    let questionText = extractContent(exercise.content_json);

    // Fallback to description
    if (!questionText && exercise.description) {
      questionText = exercise.description;
    }

    const newContext = {
      page: "exercise_detail",
      exerciseTitle: exercise.title,
      exerciseQuestion: questionText.slice(0, 1000),
      exerciseDifficulty: exercise.difficulty_level || exercise.level || "moyen",
      exerciseType: exercise.type || "standard",
      courseTitle: exercise.courses?.title,
      courseSubject: exercise.courses?.subject || "Mathématiques",
      courseLevel: exercise.courses?.level || exercise.level,
    };

    setPageContext(newContext as any);
  }, [exercise.id, exercise.title, setPageContext]);

  // Update AI Tutor context with current student answers
  useEffect(() => {
    const answerSummary = Object.entries(answers)
      .map(([blockId, answer]) => {
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
  }, [answers, setPageContext]);

  // Dynamic progress tracking
  const saveProgress = async (status: 'in_progress' | 'completed', currentScore: number, scorePercent?: number, passed?: boolean) => {
    const isPreview = exercise.id === undefined || exercise.id === "preview";
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
  }, [currentPageIndex]);

  // Scroll back to top when changing page
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentPageIndex]);

  // Rend les graphiques interactifs après affichage de la page
  useEffect(() => {
    const t = setTimeout(() => enhanceMathGraphs(document.body), 200);
    return () => clearTimeout(t);
  }, [currentPageIndex, contentVisible]);

  const handleBlockAnswerChange = (blockId: string, value: any) => {
    if (submittedBlocks.has(blockId)) return;
    setAnswers((prev) => ({ ...prev, [blockId]: value }));
  };

  const validateAllAnswers = async () => {
    setIsValidating(true);
    let totalScore = 0;
    const newResults: Record<string, boolean> = {};
    const newAiFeedback: Record<string, string> = {};
    const newRevealed: Record<string, any> = {};
    const newSubmitted = new Set<string>();
    const exerciseId = exercise.id || "preview";

    for (const page of pages) {
      for (const block of page.blocks) {
        if (["text", "image"].includes(block.type)) continue;

        // "Mise en ordre" : si l'élève n'a jamais touché aux flèches, son
        // "answer" implicite est l'ordre mélangé affiché à l'écran — pas
        // une absence de réponse.
        const answer =
          answers[block.id] ??
          (block.type === "ordering" ? shuffledOrderingItems[block.id] : undefined);
        let isCorrect = false;
        let points = block.points || 0;

        if (answer === undefined || answer === null) {
          newResults[block.id] = false;
          newSubmitted.add(block.id);
          continue;
        }

        // La correction se fait toujours côté serveur (à partir des données
        // enregistrées en base) : le client ne connaît jamais la réponse
        // correcte avant d'avoir soumis la sienne.
        try {
          const res = await fetch(`/api/child/exercises/${exerciseId}/grade`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              block_id: block.id,
              answer: answer,
              // Uniquement utilisés en mode "preview" (aperçu admin, contenu
              // pas encore enregistré) — ignorés par le serveur sinon.
              question: block.content,
              correctAnswer: block.correctAnswer,
              explanation: block.explanation,
              level: exercise.level || "6eme",
              points: block.points,
            }),
          });
          const data = await res.json();
          isCorrect = !!data.is_correct;
          if (data.feedback) {
            newAiFeedback[block.id] = data.feedback;
          }
          if (data.reveal) {
            newRevealed[block.id] = data.reveal;
          }
          if (data.score !== undefined) {
            points = data.score;
          }
        } catch (e) {
          console.error(e);
          newAiFeedback[block.id] = "Erreur de correction, réessaie.";
        }

        newResults[block.id] = isCorrect;
        newSubmitted.add(block.id);
        if (isCorrect) {
          totalScore += points;
        }
      }
    }

    setResults(newResults);
    setAiFeedback(newAiFeedback);
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
    const thr = exercise.min_score_percent || 0;
    const didPass = thr > 0 ? pct >= thr : true;
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
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
      const container = document.getElementById("exercise-content-container");
      if (container) container.scrollTop = 0;
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
      const container = document.getElementById("exercise-content-container");
      if (container) container.scrollTop = 0;
    }
  };

  const handleRestart = () => {
    setCurrentPageIndex(0);
    setAnswers({});
    setSubmittedBlocks(new Set());
    setScore(0);
    setExerciseCompleted(false);
    setShowReview(false);
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
    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 100;
    const timeTotal = getAccumulatedSeconds();
    const mins = Math.floor(timeTotal / 60);
    const isPreview = exercise.id === undefined || exercise.id === "preview";
    const threshold = exercise.min_score_percent || 0;
    const passed = threshold > 0 ? percentage >= threshold : true;

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-[var(--greek-cream)]">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="bg-white rounded-[20px] shadow-lg border-2 border-[rgba(197,161,72,0.25)] overflow-hidden">
            {/* Thumbnail header */}
            <div className={`relative h-64 md:h-80 overflow-hidden flex items-center justify-center ${passed ? "bg-[var(--greek-cream)]" : "bg-red-50"}`}>
              <Brain className="w-24 h-24 text-[var(--greek-blue)] opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                <div className="p-8 text-white w-full">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-full mb-3 shadow-md ${passed ? "bg-[var(--greek-gold)] text-[var(--greek-blue)]" : "bg-red-500 text-white"}`}>
                    {passed ? <><Trophy className="w-3.5 h-3.5" /> Exercice réussi !</> : <><XCircle className="w-3.5 h-3.5" /> Score insuffisant</>}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2">{exercise.title}</h1>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Left */}
                <div className="flex-grow">
                  <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-[var(--greek-gold)]" />
                    Félicitations !
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    Tu as terminé cet exercice. Consulte ta correction ci-dessous ou enchaîne avec le quiz !
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: `${score}/${totalPoints}`, sub: "points obtenus" },
                      { value: mins > 0 ? `${mins} min` : "< 1 min", sub: "temps passé" },
                      { value: `${percentage}%`, sub: "réussite" },
                    ].map((s, i) => (
                      <div key={s.sub} className={`rounded-xl p-4 text-center border ${i === 2 ? (passed ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300") : "bg-[var(--greek-cream)] border-[rgba(197,161,72,0.25)]"}`}>
                        <p className={`text-xl font-bold font-[family-name:var(--font-display)] ${i === 2 ? (passed ? "text-green-600" : "text-red-600") : "text-[var(--greek-blue)]"}`}>{s.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                      </div>
                    ))}
                  </div>
                  {typeof bestScorePercent === "number" && bestScorePercent > percentage && (
                    <p className="mt-3 text-sm text-[var(--greek-blue)] font-bold">
                      Ton meilleur score reste {bestScorePercent}%
                    </p>
                  )}
                  {threshold > 0 && (
                    <div className={`mt-4 flex items-center gap-2 text-sm font-bold px-4 py-3 rounded-xl ${passed ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                      {passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {passed ? `Seuil atteint (${threshold}% requis)` : `Seuil non atteint — ${threshold}% requis, tu as eu ${percentage}%`}
                    </div>
                  )}
                </div>

                {/* Right CTA */}
                <div className="w-full md:w-80 flex-shrink-0">
                  <div className="bg-[var(--greek-cream)] rounded-xl p-6 border border-[rgba(197,161,72,0.25)] sticky top-24 space-y-3">
                    <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 text-center">Et maintenant ?</h3>
                    <GlassButton
                      onClick={() => {
                        setExerciseCompleted(false);
                        setShowReview(true);
                        setCurrentPageIndex(0);
                      }}
                      variant="navy"
                      fullWidth
                      className="font-bold text-base"
                    >
                      Voir la correction
                    </GlassButton>
                    <GlassButton href="/child/quiz" variant="navy" fullWidth className="font-bold text-base">
                      Aller aux quiz
                    </GlassButton>
                    <GlassButton href="/child/exercises" variant="outline" fullWidth className="font-bold text-base">
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
      <div className="bg-[var(--greek-cream)] border-b border-[var(--greek-gold)] px-6 py-4 flex items-center gap-3 justify-between shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <GlassIconButton icon={ArrowLeft} onClick={() => { saveTimeSpent(); onBack(); }} color="navy" size="sm" aria-label="Retour" />
          )}
          <h3 className="font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)]">
            {exercise.title}
          </h3>
        </div>
        <div className="text-sm font-medium text-[var(--greek-blue)] bg-[var(--greek-blue)]/10 border border-[var(--greek-gold)] px-3 py-1 rounded-full">
          Page {currentPageIndex + 1} / {pages.length}
        </div>
      </div>

      {/* Content */}
      <div
        id="exercise-content-container"
        ref={mainScrollRef}
        className={`flex-1 overflow-y-auto p-4 md:p-8 bg-white/50 transition-opacity duration-200 ${contentVisible ? "opacity-100" : "opacity-0"}`}
      >
        <div
          className="max-w-3xl mx-auto space-y-8 pb-20 transition-[padding-bottom] duration-200"
          style={mathKeyboardOpen ? { paddingBottom: "380px" } : undefined}
        >
          {currentPage.title && (
            <h2 className="text-2xl font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] mb-6 text-center">
              {currentPage.title}
            </h2>
          )}

          {currentPage.blocks.map((block) => {
            const isSubmitted = reviewMode || submittedBlocks.has(block.id);
            const answer = answers[block.id];

            // Determine correctness for feedback
            const isCorrect = isSubmitted ? results[block.id] ?? false : false;

            return (
              <div
                key={block.id}
                className="bg-[var(--greek-cream)]/30 p-6 border border-[var(--greek-gold)]"
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-lg text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                    {block.title}
                  </h4>
                  {block.points && (
                    <span className="text-xs font-bold bg-[var(--greek-gold)]/20 text-[var(--greek-bronze)] border border-[rgba(197,161,72,0.25)] px-2 py-1 rounded-full">
                      {block.points} pts
                    </span>
                  )}
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

                {/* Interactive Elements */}
                <div className="mt-4">
                  {block.type === "text_input" && (
                    <div className="flex flex-col gap-2" data-exercise-answer-block>
                      {/* Mode Toggle */}
                      <div className="flex justify-end mb-1">
                        <GlassSegmentedControl
                          size="sm"
                          options={[
                            {
                              id: "text",
                              label: (
                                <span className="flex items-center gap-1">
                                  <Keyboard className="w-3 h-3" /> Clavier
                                </span>
                              ),
                            },
                            {
                              id: "draw",
                              label: (
                                <span className="flex items-center gap-1">
                                  <Pencil className="w-3 h-3" /> Dessin
                                </span>
                              ),
                            },
                          ]}
                          value={blockModes[block.id] || "text"}
                          onChange={(mode) =>
                            setBlockModes((prev) => ({
                              ...prev,
                              [block.id]: mode as "text" | "draw",
                            }))
                          }
                        />
                      </div>

                      {blockModes[block.id] === "draw" ? (
                        <DrawingCanvas
                          disabled={isSubmitted}
                          initialData={answer}
                          onChange={(data) =>
                            handleBlockAnswerChange(block.id, data)
                          }
                        />
                      ) : (
                        <>
                          {(() => {
                            const currentVal =
                              answers[block.id] &&
                              !answers[block.id].startsWith("data:image")
                                ? answers[block.id]
                                : "";
                            return (
                              <div className="relative">
                                <MathInput
                                  ref={(el) => {
                                    mathfieldRefs.current[block.id] = el;
                                  }}
                                  value={currentVal}
                                  disabled={isSubmitted}
                                  onChange={(latex) =>
                                    handleBlockAnswerChange(block.id, latex)
                                  }
                                  className={`w-full min-h-[60px] border rounded-lg focus-within:ring-2 focus-within:ring-[var(--greek-blue)] text-lg ${
                                    isSubmitted
                                      ? isCorrect
                                        ? "border-green-500 bg-green-50"
                                        : "border-red-500 bg-red-50"
                                      : "border-gray-300 focus-within:border-[var(--greek-blue)]"
                                  }`}
                                  placeholder="Tapez votre réponse"
                                  ariaLabel={block.title || "Réponse mathématique"}
                                  level={exercise.level}
                                />
                                {exercise.grading_type === "ai" && !isSubmitted && (
                                  <div
                                    className="absolute right-3 bottom-3 text-[var(--greek-blue)]/50 pointer-events-none"
                                    title="Correction par IA"
                                  >
                                    <Sparkles className="w-5 h-5" />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}

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
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${btnClass}`}
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
                                    (a: string) => a !== option
                                  )
                                : [...currentSelected, option];
                              handleBlockAnswerChange(block.id, newSelected);
                            }}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${btnClass}`}
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

                  {block.type === "fill_in_the_blank" && (
                    <div className="text-lg leading-loose text-gray-800">
                      {(() => {
                        const parts = (block.content || "").split(/(\{\{\d+\}\})/g);
                        const blankAnswers: string[] = Array.isArray(answer) ? answer : [];
                        let blankIdx = -1;
                        return parts.map((part, i) => {
                          const m = part.match(/^\{\{(\d+)\}\}$/);
                          if (m) {
                            blankIdx++;
                            const idx = blankIdx;
                            const val = blankAnswers[idx] || "";
                            const expected = revealed[block.id]?.blanks?.[idx];
                            let cls = "border-gray-300 focus:border-[var(--greek-blue)]";
                            if (isSubmitted && expected !== undefined) {
                              const alts = String(expected).split("|").map((s: string) => s.trim().toLowerCase());
                              const ok = alts.includes(String(val).trim().toLowerCase());
                              cls = ok
                                ? "border-green-500 bg-green-50 text-green-700"
                                : "border-red-500 bg-red-50 text-red-700";
                            }
                            return (
                              <input
                                key={i}
                                type="text"
                                disabled={isSubmitted}
                                value={val}
                                onChange={(e) => {
                                  const next = [...blankAnswers];
                                  next[idx] = e.target.value;
                                  handleBlockAnswerChange(block.id, next);
                                }}
                                className={`inline-block mx-1 w-28 text-center border-b-2 bg-transparent focus:outline-none px-1 ${cls}`}
                              />
                            );
                          }
                          return (
                            <span
                              key={i}
                              dangerouslySetInnerHTML={{ __html: renderLatexInHTML(part) }}
                            />
                          );
                        });
                      })()}
                    </div>
                  )}

                  {block.type === "matching" && (
                    <div className="space-y-2">
                      {(block.pairs || []).map((pair, i) => {
                        const selected: string[] = Array.isArray(answer) ? answer : [];
                        const val = selected[i] || "";
                        let cls = "border-gray-300";
                        if (isSubmitted) {
                          const correctRight = revealed[block.id]?.pairs?.[i]?.right;
                          cls = val === correctRight ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50";
                        }
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span
                              className="flex-1 text-sm font-medium text-gray-700"
                              dangerouslySetInnerHTML={{
                                __html: renderLatexInHTML(pair.left),
                              }}
                            />
                            <ArrowRight size={14} className="text-gray-300 shrink-0" />
                            <select
                              disabled={isSubmitted}
                              value={val}
                              onChange={(e) => {
                                const next = [...selected];
                                next[i] = e.target.value;
                                handleBlockAnswerChange(block.id, next);
                              }}
                              className={`flex-1 border-2 rounded-lg text-sm p-2 bg-white focus:outline-none ${cls}`}
                            >
                              <option value="">Choisir...</option>
                              {(shuffledRightOptions[block.id] || []).map((opt, j) => (
                                <option key={j} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {block.type === "ordering" && (
                    <div className="space-y-2">
                      {(() => {
                        const current: string[] =
                          Array.isArray(answer) && answer.length
                            ? answer
                            : shuffledOrderingItems[block.id] || block.items || [];
                        return current.map((item, i) => {
                          const correctItem = revealed[block.id]?.items?.[i];
                          let cls = "border-gray-200 bg-white";
                          if (isSubmitted) {
                            cls = item === correctItem ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50";
                          }
                          return (
                            <div key={item + i} className={`flex items-center gap-2 p-2.5 border-2 rounded-lg ${cls}`}>
                              <span className="text-xs font-bold text-gray-400 w-5">{i + 1}.</span>
                              <span
                                className="flex-1 text-sm text-gray-700"
                                dangerouslySetInnerHTML={{
                                  __html: renderLatexInHTML(item),
                                }}
                              />
                              <GlassIconButton
                                icon={ArrowUp}
                                disabled={isSubmitted || i === 0}
                                onClick={() => {
                                  const next = [...current];
                                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                                  handleBlockAnswerChange(block.id, next);
                                }}
                                color="navy"
                                size="sm"
                                aria-label="Monter"
                              />
                              <GlassIconButton
                                icon={ArrowDown}
                                disabled={isSubmitted || i === current.length - 1}
                                onClick={() => {
                                  const next = [...current];
                                  [next[i], next[i + 1]] = [next[i + 1], next[i]];
                                  handleBlockAnswerChange(block.id, next);
                                }}
                                color="navy"
                                size="sm"
                                aria-label="Descendre"
                              />
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  {block.type === "coding" && (
                    <div className="relative">
                      <textarea
                        disabled={isSubmitted}
                        value={typeof answer === "string" ? answer : ""}
                        onChange={(e) => handleBlockAnswerChange(block.id, e.target.value)}
                        className={`w-full min-h-[140px] font-mono text-sm border rounded-lg p-3 focus:outline-none ${
                          isSubmitted
                            ? isCorrect
                              ? "border-green-500 bg-green-50"
                              : "border-red-500 bg-red-50"
                            : "border-gray-300 focus:border-[var(--greek-blue)]"
                        }`}
                        placeholder="Écris ton algorithme / code ici..."
                        spellCheck={false}
                      />
                      {exercise.grading_type === "ai" && !isSubmitted && (
                        <div
                          className="absolute right-3 bottom-3 text-[var(--greek-blue)]/50 pointer-events-none"
                          title="Correction par IA"
                        >
                          <Sparkles className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Feedback after global validation */}
                {isSubmitted && (
                  <div className="mt-4 pt-4 border-t border-[rgba(197,161,72,0.25)] flex flex-col gap-3">
                    <div
                      className={`text-sm font-bold flex items-center gap-2 ${
                        isCorrect ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircle className="w-4 h-4" /> Correct ! (+
                          {block.points} pts)
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" /> Incorrect
                        </>
                      )}
                    </div>

                    {aiFeedback[block.id] && (
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-blue-800 text-sm flex gap-3">
                        <Sparkles className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
                        <div>
                          <span className="font-bold text-blue-700 block mb-1">
                            Feedback IA :
                          </span>
                          <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(aiFeedback[block.id]) }} />
                        </div>
                      </div>
                    )}

                    {adminEditedAnswers[block.id] !== undefined && (
                      <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-purple-800 text-xs">
                        <span className="font-bold block mb-0.5">Réponse corrigée par l'admin :</span>
                        {typeof adminEditedAnswers[block.id] === "string" ? adminEditedAnswers[block.id] : JSON.stringify(adminEditedAnswers[block.id])}
                      </div>
                    )}
                    {adminComments[block.id] && (
                      <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-purple-800 text-xs">
                        <span className="font-bold block mb-0.5">Commentaire de l'admin :</span>
                        {adminComments[block.id]}
                      </div>
                    )}
                    {adminMode && (
                      <AdminAttemptControls
                        itemKey={block.id}
                        currentAnswer={answer}
                        existingComment={adminComments[block.id]}
                        existingEditedAnswer={adminEditedAnswers[block.id]}
                        adminMode={adminMode}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="bg-[var(--greek-cream)] border-t border-[var(--greek-gold)] p-4 flex justify-between shrink-0">
        <GlassButton
          onClick={handlePrevPage}
          disabled={currentPageIndex === 0}
          variant="ghost"
          style={currentPageIndex === 0 ? { opacity: 0 } : undefined}
        >
          <ArrowLeft className="w-4 h-4" /> Précédent
        </GlassButton>

        {reviewMode ? (
          <GlassButton
            onClick={handleNextPage}
            disabled={currentPageIndex >= pages.length - 1}
            variant="navy"
          >
            Suivant <ArrowRight className="w-4 h-4" />
          </GlassButton>
        ) : (
        <GlassButton
          onClick={
            showReview
              ? currentPageIndex < pages.length - 1
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
                    const thr = exercise.min_score_percent || 0;
                    const didPass = thr > 0 ? pct >= thr : true;
                    saveProgress('completed', score, pct, didPass);
                  }
              : currentPageIndex < pages.length - 1
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
            currentPageIndex < pages.length - 1 ? (
              <>
                Suivant <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                {openCorrection ? "Fermer" : "Terminer l'exercice"} <CheckCircle className="w-4 h-4" />
              </>
            )
          ) : currentPageIndex < pages.length - 1 ? (
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
