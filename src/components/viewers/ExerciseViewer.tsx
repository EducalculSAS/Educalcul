"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { Page, Block } from "@/components/admin/ExerciseBuilder";
import { supabase } from "@/lib/supabaseClient";
import { useAITutor } from "@/contexts/AITutorContext";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { renderMathGraphPlaceholders, enhanceMathGraphs } from "@/lib/mathGraph";
import MathInput, { MathInputHandle } from "@/components/MathInput";
import DrawingCanvas from "@/components/DrawingCanvas";
import "katex/dist/katex.min.css";

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
    score?: number;
    blockModes?: Record<string, "text" | "draw">;
  } | null;
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
}: ExerciseViewerProps) {
  const pages = exercise.content_json || [];
  const { pageContext, setPageContext } = useAITutor();

  // Nouvelle tentative : on efface la progression locale précédente
  useEffect(() => {
    if (!forceNewAttempt || typeof window === "undefined" || !exercise.id) return;
    localStorage.removeItem(`exercise-${exercise.id}-progress`);
    localStorage.removeItem(`exercise-${exercise.id}-page`);
    setExerciseCompleted(false);
    setAnswers({});
    setSubmittedBlocks(new Set());
    setResults({});
    setAiFeedback({});
    setScore(0);
    setBlockModes({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Initialize currentPageIndex from localStorage or default to 0
  const [currentPageIndex, setCurrentPageIndexState] = useState(() => {
    if (typeof window === "undefined") return 0;
    if (!exercise.id || forceNewAttempt) return 0;
    try {
      const saved = localStorage.getItem(`exercise-${exercise.id}-page`);
      const pageCount = (exercise.content_json?.length || 0);
      const index = saved ? Math.min(parseInt(saved, 10), pageCount - 1) : 0;
      console.log(`[ExerciseViewer] Loading page index for ${exercise.id}:`, {
        saved,
        pageCount,
        loadedIndex: index,
      });
      return index;
    } catch (e) {
      console.error("Failed to load page index:", e);
      return 0;
    }
  });

  // Wrapper to save page index to localStorage
  const setCurrentPageIndex = (newIndex: number | ((prev: number) => number)) => {
    setCurrentPageIndexState((prev) => {
      const index = typeof newIndex === "function" ? newIndex(prev) : newIndex;
      if (exercise.id) {
        try {
          localStorage.setItem(`exercise-${exercise.id}-page`, index.toString());
          console.log(`[ExerciseViewer] Saved page index: exercise=${exercise.id}, page=${index}`);
        } catch (e) {
          console.error("Failed to save page index:", e);
        }
      } else {
        console.warn("[ExerciseViewer] No exercise.id available");
      }
      return index;
    });
  };
  // Charge la progression sauvegardée (réponses, soumissions, score, feedback...)
  const loadProgress = (): {
    answers: Record<string, any>;
    submittedBlocks: string[];
    results: Record<string, boolean>;
    aiFeedback: Record<string, string>;
    score: number;
    exerciseCompleted: boolean;
    blockModes: Record<string, "text" | "draw">;
  } | null => {
    if (typeof window === "undefined" || !exercise.id || forceNewAttempt) return null;
    try {
      const saved = localStorage.getItem(`exercise-${exercise.id}-progress`);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to load exercise progress:", e);
      return null;
    }
  };

  const [answers, setAnswers] = useState<Record<string, any>>(
    () => (reviewMode ? initialProgress?.answers : loadProgress()?.answers) || {}
  );
  const mathfieldRefs = useRef<Record<string, MathInputHandle | null>>({});
  const [submittedBlocks, setSubmittedBlocks] = useState<Set<string>>(
    () => new Set((reviewMode ? initialProgress?.submittedBlocks : loadProgress()?.submittedBlocks) || [])
  );
  const [loadingBlocks, setLoadingBlocks] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, boolean>>(
    () => (reviewMode ? initialProgress?.results : loadProgress()?.results) || {}
  );
  const [aiFeedback, setAiFeedback] = useState<Record<string, string>>(
    () => (reviewMode ? initialProgress?.aiFeedback : loadProgress()?.aiFeedback) || {}
  );
  const [score, setScore] = useState(() => (reviewMode ? initialProgress?.score : loadProgress()?.score) || 0);
  const [exerciseCompleted, setExerciseCompleted] = useState(
    () => (reviewMode ? true : loadProgress()?.exerciseCompleted) || false
  );
  const [showReview, setShowReview] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [blockModes, setBlockModes] = useState<Record<string, "text" | "draw">>(
    () => (reviewMode ? initialProgress?.blockModes : loadProgress()?.blockModes) || {}
  );

  // Sauvegarde la progression à chaque changement pour permettre de reprendre l'exercice
  useEffect(() => {
    if (reviewMode) return;
    if (typeof window === "undefined" || !exercise.id || exercise.id === "preview") return;
    try {
      localStorage.setItem(
        `exercise-${exercise.id}-progress`,
        JSON.stringify({
          answers,
          submittedBlocks: Array.from(submittedBlocks),
          results,
          aiFeedback,
          score,
          exerciseCompleted,
          blockModes,
        })
      );
    } catch (e) {
      console.error("Failed to save exercise progress:", e);
    }
  }, [answers, submittedBlocks, results, aiFeedback, score, exerciseCompleted, blockModes, exercise.id]);

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
          setScore(p.score || 0);
          setExerciseCompleted(p.exerciseCompleted || data?.status === "completed" || false);
          setBlockModes(p.blockModes || {});
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

  // Sauvegarde la progression en base de données (debounced)
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
              score,
              exerciseCompleted,
              blockModes,
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
  }, [answers, submittedBlocks, results, aiFeedback, score, exerciseCompleted, blockModes, exercise.id]);

  const currentPage = pages[currentPageIndex];
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Session timer
  const sessionStartRef = useRef<number>(Date.now());
  const getAccumulatedSeconds = () => {
    if (!exercise.id || exercise.id === "preview") return 0;
    return parseInt(localStorage.getItem(`ex-${exercise.id}-time`) || "0");
  };
  const saveTimeSpent = () => {
    if (!exercise.id || exercise.id === "preview") return;
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const total = getAccumulatedSeconds() + elapsed;
    localStorage.setItem(`ex-${exercise.id}-time`, String(total));
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

    console.log("✅ AI Tutor context initialized in ExerciseViewer:", {
      title: exercise.title,
      hasQuestion: !!questionText,
      questionLength: questionText?.length || 0,
      type: exercise.type,
      fullContext: newContext,
    });
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
    const newSubmitted = new Set<string>();

    for (const page of pages) {
      for (const block of page.blocks) {
        if (["text", "image"].includes(block.type)) continue;

        const answer = answers[block.id];
        let isCorrect = false;
        let points = block.points || 0;

        if (answer === undefined || answer === null) {
          newResults[block.id] = false;
          newSubmitted.add(block.id);
          continue;
        }

        if (block.type === "text_input" || exercise.grading_type === "ai") {
          try {
            const exerciseId = exercise.id || "preview";
            const res = await fetch(`/api/child/exercises/${exerciseId}/grade`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                block_id: block.id,
                answer: answer,
                question: block.content,
                correctAnswer: block.correctAnswer,
                explanation: block.explanation,
                level: exercise.level || "6eme", // Passing level for tailored feedback
                points: block.points,
              }),
            });
            const data = await res.json();
            isCorrect = data.is_correct;
            if (data.feedback) {
              newAiFeedback[block.id] = data.feedback;
            }
            if (data.score !== undefined) {
              points = data.score;
            }
          } catch (e) {
            console.error(e);
            isCorrect =
              String(answer).toLowerCase().trim() ===
              String(block.correctAnswer).toLowerCase().trim();
          }
        } else {
          if (block.type === "multiple_choice") {
            const correct = Array.isArray(block.correctAnswer)
              ? block.correctAnswer
              : [block.correctAnswer];
            const selected = Array.isArray(answer) ? answer : [answer];
            isCorrect =
              correct.length === selected.length &&
              correct.every((a: any) => selected.includes(a));
          } else if (["single_choice", "true_false"].includes(block.type)) {
            isCorrect = answer === block.correctAnswer;
          }
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
    // Save pass/fail to localStorage
    if (exercise.id && exercise.id !== "preview") {
      localStorage.setItem(`ex-${exercise.id}-status`, passed ? "passed" : "failed");
      localStorage.setItem(`ex-${exercise.id}-score`, String(percentage));
    }

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
                    <button
                      onClick={() => {
                        setExerciseCompleted(false);
                        setShowReview(true);
                        setCurrentPageIndex(0);
                      }}
                      className="w-full btn-primary-greek py-4 text-base shadow-lg flex items-center justify-center transform hover:scale-105 transition-all"
                    >
                      Voir la correction
                    </button>
                    <Link
                      href="/child/quiz"
                      className="w-full flex items-center justify-center py-4 rounded-xl font-bold text-base bg-[var(--greek-blue)] text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
                    >
                      Aller aux quiz
                    </Link>
                    <Link
                      href="/child/exercises"
                      className="w-full flex items-center justify-center py-4 rounded-xl font-bold text-base bg-[var(--greek-bronze)] text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
                    >
                      Retour aux exercices
                    </Link>
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
            <button
              onClick={() => { saveTimeSpent(); onBack(); }}
              className="p-1.5 rounded-lg text-[var(--greek-blue)] flex-shrink-0 transition-transform duration-150 hover:scale-110 active:scale-95"
              title="Retour"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
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
        <div className="max-w-3xl mx-auto space-y-8 pb-20">
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

                {block.content && (
                  <div
                    className="prose max-w-none mb-6 text-gray-600 prose-headings:text-[var(--greek-blue)] prose-a:text-[var(--greek-blue)]"
                    dangerouslySetInnerHTML={{ __html: renderLatexInHTML(renderMathGraphPlaceholders(block.content || "")) }}
                  />
                )}

                {/* Interactive Elements */}
                <div className="mt-4">
                  {block.type === "text_input" && (
                    <div className="flex flex-col gap-2">
                      {/* Mode Toggle */}
                      <div className="flex justify-end gap-2 mb-1">
                        <button
                          onClick={() =>
                            setBlockModes((prev) => ({
                              ...prev,
                              [block.id]: "text",
                            }))
                          }
                          className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-bold transition-colors ${
                            (blockModes[block.id] || "text") === "text"
                              ? "bg-[var(--greek-blue)] text-white shadow-sm"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                          title="Mode Clavier"
                        >
                          <Keyboard className="w-3 h-3" /> Clavier
                        </button>
                        <button
                          onClick={() =>
                            setBlockModes((prev) => ({
                              ...prev,
                              [block.id]: "draw",
                            }))
                          }
                          className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-bold transition-colors ${
                            blockModes[block.id] === "draw"
                              ? "bg-[var(--greek-blue)] text-white shadow-sm"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                          title="Mode Dessin"
                        >
                          <Pencil className="w-3 h-3" /> Dessin
                        </button>
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
                          if (option === block.correctAnswer)
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
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {block.type === "multiple_choice" && (
                    <div className="space-y-2">
                      {block.options?.map((option, idx) => {
                        const currentSelected = Array.isArray(answer)
                          ? answer
                          : [];
                        const isSelected = currentSelected.includes(option);

                        let btnClass =
                          "border-gray-200 hover:bg-[var(--greek-gold)]/10";
                        if (isSubmitted) {
                          const correctArr = Array.isArray(block.correctAnswer)
                            ? block.correctAnswer
                            : [block.correctAnswer];
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
                            {option}
                          </button>
                        );
                      })}
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

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="bg-[var(--greek-cream)] border-t border-[var(--greek-gold)] p-4 flex justify-between shrink-0">
        <button
          onClick={handlePrevPage}
          disabled={currentPageIndex === 0}
          className={`px-4 py-2 text-[var(--greek-bronze)] font-medium hover:bg-[var(--greek-gold)]/10 rounded-lg flex items-center gap-2 transition-colors ${
            currentPageIndex === 0 ? "opacity-0 pointer-events-none" : ""
          }`}
        >
          <ArrowLeft className="w-4 h-4" /> Précédent
        </button>

        {reviewMode ? (
          <button
            onClick={handleNextPage}
            disabled={currentPageIndex >= pages.length - 1}
            className="btn-primary-greek px-6 py-2 flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
          >
            Suivant <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
        <button
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
          className="btn-primary-greek px-6 py-2 flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
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
        </button>
        )}
      </div>
    </div>
  );
}
