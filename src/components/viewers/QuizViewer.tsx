"use client";

import Emblem3D from "@/components/Emblem3D";
import AnswerFeedback from "@/components/viewers/AnswerFeedback";
import LoaderDots from "@/components/LoaderDots";
import { useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, Trophy, Loader2, Type, HelpCircle, Clock, AlertTriangle } from "lucide-react";
import { Question } from "@/components/admin/QuizBuilder";
import { supabase } from "@/lib/supabaseClient";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { renderMathGraphPlaceholders, enhanceMathGraphs } from "@/lib/mathGraph";
import GlassButton from "@/components/ui/GlassButton";
import { useCaliaFloor } from "@/lib/caliaFloor";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { AdminAttemptControls } from "@/components/viewers/ExerciseViewer";
import { passThreshold } from "@/lib/scorePercent";
import { fetchMiniComment } from "@/lib/miniComment";
import ReadAloudButton from "@/components/ReadAloudButton";




/** Réponse d'un élève à une question : un choix (ou « true »/« false »), une saisie, ou plusieurs choix. */
type QuizAnswer = string | string[];

/** Réponse de /api/child/quizzes/[id]/grade pour une question. */
interface QuizGradeResponse {
  unavailable?: boolean;
  error?: string;
  is_correct?: boolean;
  feedback?: string;
  comment_token?: string;
  reveal?: { correctAnswer?: string | string[]; explanation?: string };
}

export interface QuizViewerProps {
  quiz: {
    id?: string | number;
    title: string;
    description?: string | null;
    content_json: Question[] | null;
    time_limit_minutes?: number | null;
    level?: string;
    min_score_percent?: number | null;
    course_id?: string | number | null;
  };
  onComplete?: (score: number, totalPoints: number, timeSpent: number) => void;
  onBack?: () => void;
  reviewMode?: boolean;
  /** Force le démarrage d'une nouvelle tentative (ignore la progression précédemment terminée) */
  forceNewAttempt?: boolean;
  /** Meilleur score (%) déjà obtenu lors de tentatives précédentes */
  bestScorePercent?: number;
  /** Ouvre directement la correction de la dernière tentative au lieu de l'écran de fin */
  openCorrection?: boolean;
  initialProgress?: {
    answers?: Record<number, QuizAnswer>;
    questionResults?: Record<number, boolean>;
    questionFeedbacks?: Record<number, string>;
    revealed?: Record<number, { correctAnswer?: string | string[]; explanation?: string }>;
    score?: number;
    adminComments?: Record<string, string>;
    adminEditedAnswers?: Record<string, QuizAnswer>;
  } | null;
  /** Voir ExerciseViewer.tsx — même contrat, réutilisé tel quel côté quiz. */
  adminMode?: {
    onComment: (key: string, text: string) => void;
    onEditAnswer: (key: string, value: QuizAnswer) => void;
    saving?: boolean;
  };
}

export default function QuizViewer({ quiz, onComplete, onBack, reviewMode, forceNewAttempt, bestScorePercent, openCorrection, initialProgress, adminMode }: QuizViewerProps) {
  // Calia se pose au-dessus de la barre « Précédent / Suivant » au lieu de la recouvrir.
  const caliaFloorRef = useCaliaFloor();
  const questions = quiz.content_json || [];
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, QuizAnswer>>(
    () => (reviewMode ? initialProgress?.answers : undefined) || {}
  );
  const [adminComments] = useState<Record<string, string>>(() => initialProgress?.adminComments || {});
  const [adminEditedAnswers] = useState<Record<string, QuizAnswer>>(() => initialProgress?.adminEditedAnswers || {});
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(!!reviewMode);
  const [score, setScore] = useState(() => (reviewMode ? initialProgress?.score : 0) || 0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showReview, setShowReview] = useState(!!reviewMode);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);

  // Correction immédiate des questions "text_input" (même style que les
  // mini-exercices de cours) : vérifier tout de suite, réessayer, et
  // proposer la réponse après 2 échecs plutôt que de laisser retenter à
  // l'infini. Une fois résolu, la validation finale réutilise ce verdict
  // au lieu de rappeler l'IA.
  interface InlineTextState {
    attempts: number;
    status: "grading" | "correct" | "wrong" | "revealed" | "unavailable";
    feedback?: string;
    resolvedScore?: number;
    resolvedCorrect?: boolean;
    revealedAnswer?: string;
  }
  const [inlineText, setInlineText] = useState<Record<number, InlineTextState>>({});

  const verifyTextQuestion = async (idx: number) => {
    const q = questions[idx];
    const studentAnswer = answers[idx];
    if (!studentAnswer) return;
    const current = inlineText[idx];
    const attemptsSoFar = current?.attempts || 0;
    setInlineText((prev) => ({ ...prev, [idx]: { attempts: attemptsSoFar, status: "grading" } }));
    try {
      const quizId = quiz.id || "preview";
      const res = await fetch(quizId === "demo" ? "/api/demo/grade" : `/api/child/quizzes/${quizId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(quizId === "demo" ? { kind: "quiz" } : {}),
          question_id: q.id,
          answer: studentAnswer,
          level: quiz.level || "6eme",
          question: q.text,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          points: q.points,
        }),
      });
      const data = await res.json();
      if (data.unavailable) {
        setInlineText((prev) => ({
          ...prev,
          [idx]: { attempts: attemptsSoFar, status: "unavailable", feedback: data.feedback },
        }));
        return;
      }
      if (data.is_correct) {
        setInlineText((prev) => ({
          ...prev,
          [idx]: {
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
          // La bonne réponse vient de data.reveal (le client n'a jamais
          // correctAnswer avant d'avoir soumis, comme dans validateAllAnswers).
          setInlineText((prev) => ({
            ...prev,
            [idx]: {
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
            [idx]: { attempts, status: "wrong", feedback: data.feedback },
          }));
        }
        // Verdict et réponse de base déjà affichés : le mini commentaire de l'IA arrive juste après, quand il y en a un.
        void fetchMiniComment(data.comment_token).then((comment) => {
          if (!comment) return;
          setInlineText((prev) => {
            const cur = prev[idx];
            return cur && cur.attempts === attempts && (cur.status === "wrong" || cur.status === "revealed") ? { ...prev, [idx]: { ...cur, feedback: comment } } : prev;
          });
        });
      }
    } catch {
      setInlineText((prev) => ({
        ...prev,
        [idx]: { attempts: attemptsSoFar, status: "unavailable", feedback: "Correction indisponible, réessaie." },
      }));
    }
  };
  const [questionResults, setQuestionResults] = useState<
    Record<number, boolean>
  >(() => (reviewMode ? initialProgress?.questionResults : undefined) || {});
  const [questionFeedbacks, setQuestionFeedbacks] = useState<
    Record<number, string>
  >(() => (reviewMode ? initialProgress?.questionFeedbacks : undefined) || {});
  // Réponse correcte / explication, révélées par le serveur uniquement après
  // soumission de chaque question (jamais présentes dans le contenu initial).
  const [revealed, setRevealed] = useState<
    Record<number, { correctAnswer?: string | string[]; explanation?: string }>
  >(() => (reviewMode ? initialProgress?.revealed : undefined) || {});
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Timer
  const timeLimitSeconds = quiz.time_limit_minutes ? quiz.time_limit_minutes * 60 : null;
  const [elapsed, setElapsed] = useState(0); // seconds elapsed
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  // Le chrono démarre au montage ; cet effet précède celui du minuteur, qui lit startTimeRef.
  useEffect(() => { startTimeRef.current = Date.now(); }, []);

  useEffect(() => {
    if (reviewMode || quizCompleted) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
      // Auto-submit when countdown hits 0
      if (timeLimitSeconds && secs >= timeLimitSeconds) {
        if (timerRef.current) clearInterval(timerRef.current);
        validateAllAnswers();
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées : l'effet ne doit se relancer que sur son déclencheur
  }, [quizCompleted]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };
  const displayTime = timeLimitSeconds
    ? Math.max(0, timeLimitSeconds - elapsed)
    : elapsed;
  const isLowTime = timeLimitSeconds ? displayTime <= 30 : false;

  const currentQuestion = questions[currentQuestionIndex];

  // Dynamic progress tracking
  const saveProgress = async (status: 'in_progress' | 'completed', currentScore: number, scorePercent?: number, passed?: boolean) => {
    const isPreview = quiz.id === undefined || quiz.id === "preview" || quiz.id === "demo";
    if (isPreview) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const totalPoints = questions.reduce((acc, q) => acc + (q.points || 1), 0);
    const timeSpent = status === 'completed' ? elapsed : 0;

    try {
      await fetch("/api/child/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "quiz",
          userId: session.user.id,
          itemId: quiz.id,
          score: currentScore,
          totalPoints,
          timeSpent,
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
    if (reviewMode) return;
    saveProgress('in_progress', 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées : l'effet ne doit se relancer que sur son déclencheur
  }, []);

  // Sauvegarde la progression détaillée (réponses, résultats, feedback) en base
  const saveDetailedProgress = async (status: 'in_progress' | 'completed', extra?: { results?: Record<number, boolean>; feedbacks?: Record<number, string>; revealed?: Record<number, { correctAnswer?: string | string[]; explanation?: string }>; finalScore?: number }) => {
    const isPreview = quiz.id === undefined || quiz.id === "preview" || quiz.id === "demo";
    if (isPreview || reviewMode) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    try {
      await fetch(`/api/child/quizzes/${quiz.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          progress: {
            answers,
            questionResults: extra?.results ?? questionResults,
            questionFeedbacks: extra?.feedbacks ?? questionFeedbacks,
            revealed: extra?.revealed ?? revealed,
            score: extra?.finalScore ?? score,
            status,
          },
        }),
      });
    } catch (e) {
      console.error("Failed to save quiz progress", e);
    }
  };

  // Charge la progression en cours depuis la base (reprise après déconnexion)
  useEffect(() => {
    if (reviewMode) return;
    const isPreview = quiz.id === undefined || quiz.id === "preview" || quiz.id === "demo";
    if (isPreview) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      try {
        const res = await fetch(`/api/child/quizzes/${quiz.id}/progress?userId=${session.user.id}`);
        const data = await res.json();
        if (forceNewAttempt) {
          // Nouvelle tentative : on ne restaure pas l'état d'une session précédente
        } else if (data?.status === "completed") {
          const p = data?.progress;
          if (p?.answers) setAnswers(p.answers);
          if (p?.questionResults) setQuestionResults(p.questionResults);
          if (p?.questionFeedbacks) setQuestionFeedbacks(p.questionFeedbacks);
          if (p?.revealed) setRevealed(p.revealed);
          setScore(p?.score || 0);
          setIsAnswerSubmitted(true);
          if (openCorrection) {
            setQuizCompleted(false);
            setShowReview(true);
            setCurrentQuestionIndex(0);
          } else {
            setQuizCompleted(true);
            setShowReview(true);
          }
        } else if (data?.status === "in_progress" && data?.progress?.answers) {
          setAnswers(data.progress.answers);
        }
      } catch (e) {
        console.error("Failed to load quiz progress", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sauvegarde la progression à chaque réponse (debounced)
  const saveQuizProgressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (reviewMode) return;
    if (Object.keys(answers).length === 0) return;
    if (saveQuizProgressTimeoutRef.current) clearTimeout(saveQuizProgressTimeoutRef.current);
    saveQuizProgressTimeoutRef.current = setTimeout(() => {
      saveDetailedProgress('in_progress');
    }, 1000);
    return () => {
      if (saveQuizProgressTimeoutRef.current) clearTimeout(saveQuizProgressTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);



  // Visibility control to prevent flicker
  const [contentVisible, setContentVisible] = useState(false);
  useEffect(() => {
    setContentVisible(false);
    const timer = setTimeout(() => setContentVisible(true), 150);
    return () => clearTimeout(timer);
  }, [currentQuestionIndex]);

  // Scroll back to top when changing question
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    // Lecteur intégré dans une page (démo de la page Offres) : on ne fait défiler que le lecteur, jamais la page.
    if (String(quiz.id) !== "demo") window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentQuestionIndex, quiz.id]);

  // Rend les graphiques interactifs après affichage
  useEffect(() => {
    const t = setTimeout(() => enhanceMathGraphs(document.body), 200);
    return () => clearTimeout(t);
  }, [currentQuestionIndex]);

  const handleSelectOption = (option: string) => {
    if (isAnswerSubmitted) return;

    if (currentQuestion.type === "multiple_choice") {
      const currentSelected = Array.isArray(answers[currentQuestionIndex])
        ? (answers[currentQuestionIndex] as string[])
        : [];
      if (currentSelected.includes(option)) {
        setAnswers({
          ...answers,
          [currentQuestionIndex]: currentSelected.filter((a) => a !== option)
        });
      } else {
        setAnswers({
          ...answers,
          [currentQuestionIndex]: [...currentSelected, option]
        });
      }
    } else {
      setAnswers({
        ...answers,
        [currentQuestionIndex]: option
      });
    }
  };

  async function validateAllAnswers() {
    setIsValidating(true);
    setGradingError(null);
    let totalScore = 0;
    const newResults: Record<number, boolean> = {};
    const newFeedbacks: Record<number, string> = {};
    const newCommentTokens: Record<number, string> = {};
    const newRevealed: Record<number, { correctAnswer?: string | string[]; explanation?: string }> = {};
    const quizId = quiz.id || "preview";

    // Les questions à corriger partent toutes en même temps (avant : l'une
    // après l'autre, chaque réponse attendait la précédente).
    const pending: number[] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const answer = answers[i];
      if (!answer) {
        newResults[i] = false;
        continue;
      }
      // Déjà vérifié en direct via le bouton "Vérifier" de la question : on
      // réutilise ce verdict plutôt que de rappeler l'IA une seconde fois.
      const inlineResult = inlineText[i];
      if ((q.type === "text_input" || q.type === "impossible_search") && inlineResult?.resolvedCorrect !== undefined) {
        newResults[i] = inlineResult.resolvedCorrect;
        if (inlineResult.feedback) newFeedbacks[i] = inlineResult.feedback;
        if (inlineResult.revealedAnswer) newRevealed[i] = { correctAnswer: inlineResult.revealedAnswer };
        if (inlineResult.resolvedCorrect) totalScore += inlineResult.resolvedScore ?? q.points;
        continue;
      }
      pending.push(i);
    }

    // La correction se fait toujours côté serveur : le client ne connaît
    // jamais la réponse correcte avant d'avoir soumis la sienne.
    let graded: QuizGradeResponse[];
    try {
      graded = await Promise.all(
        pending.map((i) => {
          const q = questions[i];
          return fetch(quizId === "demo" ? "/api/demo/grade" : `/api/child/quizzes/${quizId}/grade`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(quizId === "demo" ? { kind: "quiz" } : {}),
              question_id: q.id,
              answer: answers[i],
              level: quiz.level || "6eme",
              // Uniquement utilisé en mode "preview" (aperçu admin) — ignoré
              // par le serveur pour un vrai quiz.
              question: q.text,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              points: q.points,
            }),
          }).then(async (r) => {
            const d: QuizGradeResponse = await r.json().catch(() => ({}));
            if (!r.ok && !d.unavailable) throw new Error(d.error || "Correction indisponible, réessaie.");
            return d;
          });
        }),
      );
    } catch (e) {
      console.error("Failed to grade quiz", e);
      setIsValidating(false);
      setGradingError((e as Error).message || "Correction indisponible, réessaie.");
      return;
    }
    const down = graded.find((d) => d?.unavailable);
    if (down) {
      // Panne d'infra, pas une vraie tentative : rien n'est enregistré,
      // l'élève peut revalider à l'identique.
      setIsValidating(false);
      setGradingError(down.feedback || "Correction indisponible, réessaie.");
      return;
    }
    pending.forEach((i, k) => {
      const data = graded[k] || {};
      const isCorrect = !!data.is_correct;
      if (data.feedback) newFeedbacks[i] = data.feedback;
      if (data.comment_token) newCommentTokens[i] = data.comment_token;
      if (data.reveal) newRevealed[i] = data.reveal;
      newResults[i] = isCorrect;
      if (isCorrect) totalScore += questions[i].points;
    });

    setScore(totalScore);
    setQuestionResults(newResults);
    setQuestionFeedbacks(newFeedbacks);
    // Mini commentaires de l'IA sur les erreurs : ils s'ajoutent à la correction dès qu'ils arrivent.
    Object.entries(newCommentTokens).forEach(([index, token]) => {
      void fetchMiniComment(token).then((comment) => {
        if (comment) setQuestionFeedbacks((prev) => ({ ...prev, [Number(index)]: comment }));
      });
    });
    setRevealed(newRevealed);
    setIsAnswerSubmitted(true);
    setIsValidating(false);
    setQuizCompleted(true);

    // Save completed progress with pass/fail
    const tp = questions.reduce((acc, q) => acc + (q.points || 1), 0);
    const pct = tp > 0 ? Math.round((totalScore / tp) * 100) : 100;
    const didPass = pct >= passThreshold(quiz.min_score_percent);
    saveProgress('completed', totalScore, pct, didPass);
    saveDetailedProgress('completed', { results: newResults, feedbacks: newFeedbacks, revealed: newRevealed, finalScore: totalScore });

    if (onComplete) {
      const totalPoints = questions.reduce((acc, q) => acc + (q.points || 1), 0);
      onComplete(totalScore, totalPoints, elapsed);
    }
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setShowExplanation(false);
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  if (!questions.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-white border border-[var(--greek-gold)] p-8">
        <HelpCircle className="w-12 h-12 mb-4 text-[var(--greek-gold)]" />
        <p>Ce quiz ne contient aucune question pour le moment.</p>
      </div>
    );
  }

  if (quizCompleted) {
    const totalPoints = questions.reduce((acc, q) => acc + q.points, 0);
    const percentage = Math.round((score / totalPoints) * 100);
    const mins = Math.floor(elapsed / 60);
    const threshold = passThreshold(quiz.min_score_percent);
    const passed = percentage >= threshold;

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-[var(--greek-cream)]">
        <div className="container mx-auto px-3 py-4 md:px-4 md:py-6 max-w-5xl">
          <div className="bg-white rounded-[20px] shadow-lg border-2 border-[rgba(197,161,72,0.25)] overflow-hidden">
            {/* Thumbnail header */}
            <div className={`relative h-64 md:h-80 overflow-hidden flex items-center justify-center ${passed ? "bg-[var(--greek-blue)]" : "bg-red-800"}`}>
              <Trophy className="w-24 h-24 text-[var(--greek-gold)] opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                <div className="p-5 md:p-8 text-white w-full">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-full mb-3 shadow-md ${passed ? "bg-[var(--greek-gold)] text-[var(--greek-blue)]" : "bg-red-500 text-white"}`}>
                    {passed ? <><CheckCircle className="w-3.5 h-3.5" /> Quiz réussi !</> : <><XCircle className="w-3.5 h-3.5" /> Score insuffisant</>}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2">{quiz.title}</h1>
                </div>
              </div>
            </div>

            <div className="p-5 md:p-8">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                {/* Left */}
                <div className="flex-grow">
                  <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                    <Emblem3D kind="trophy" size={32} float={false} />
                    Félicitations !
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    Tu as terminé ce quiz. Consulte ta correction ou retourne t&apos;exercer !
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
                      {passed ? `Seuil atteint (${threshold}% requis)` : `Seuil non atteint : ${threshold}% requis, tu as eu ${percentage}%`}
                    </div>
                  )}
                </div>

                {/* Right CTA */}
                <div className="w-full md:w-80 flex-shrink-0">
                  <div className="bg-[var(--greek-cream)] rounded-xl p-6 border border-[rgba(197,161,72,0.25)] sticky top-24 space-y-3">
                    <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 text-center">Et maintenant ?</h3>
                    <GlassButton
                      onClick={() => {
                        setQuizCompleted(false);
                        setShowReview(true);
                        setCurrentQuestionIndex(0);
                      }}
                      variant="navy"
                      fullWidth
                      className="font-bold text-base"
                    >
                      Voir la correction
                    </GlassButton>
                    {quiz.id === "demo" ? (
                      <GlassButton href="/auth/inscription" variant="outline" fullWidth className="font-bold text-base">
                        Essayer gratuitement
                      </GlassButton>
                    ) : (
                      <>
                        <GlassButton href={quiz.course_id ? `/child/exercises?course=${quiz.course_id}` : "/child/exercises"} variant="navy" fullWidth className="font-bold text-base">
                          Faire les exercices
                        </GlassButton>
                        <GlassButton href={quiz.course_id ? `/child/quiz?course=${quiz.course_id}` : "/child/quiz"} variant="outline" fullWidth className="font-bold text-base">
                          Retour aux quiz
                        </GlassButton>
                      </>
                    )}
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
    <div className="flex flex-col h-full bg-white overflow-hidden border border-[var(--greek-gold)]" id="quiz-content-container">
      {/* Header with Progress Bar */}
      <div className="bg-[var(--greek-cream)] border-b border-[var(--greek-gold)] shrink-0">
        <div className="px-4 py-3 md:px-6 md:py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <GlassIconButton icon={ArrowLeft} onClick={onBack} color="navy" size="sm" aria-label="Retour" />
            )}
            <h3 className="font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] truncate">
              {quiz.title}
            </h3>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div aria-label="Temps restant" className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${isLowTime ? "bg-red-50 border-red-400 text-red-600 animate-pulse" : "bg-[var(--greek-blue)]/10 border-[var(--greek-gold)] text-[var(--greek-blue)]"}`}>
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {timeLimitSeconds ? formatTime(displayTime) : formatTime(elapsed)}
            </div>
            <div className="text-sm font-medium text-[var(--greek-blue)] bg-[var(--greek-blue)]/10 border border-[var(--greek-gold)] px-3 py-1 rounded-full">
              {currentQuestionIndex + 1} / {questions.length}
            </div>
          </div>
        </div>
        <div className="bg-gray-100 h-1.5 w-full overflow-hidden">
          <div
            className="bg-[var(--greek-blue)] h-full transition-all duration-500 ease-out"
            style={{
              width: `${(currentQuestionIndex / questions.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div ref={mainScrollRef} className={`flex-1 overflow-y-auto p-3 md:p-5 bg-white/50 transition-opacity duration-200 ${contentVisible ? "opacity-100" : "opacity-0"}`}>
        <div className="max-w-4xl mx-auto pt-2 pb-44 md:py-4">
        <div className="bg-[var(--greek-cream)]/30 rounded-2xl overflow-hidden p-4 md:p-6 border border-[var(--greek-gold)]">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--greek-cream)] text-[var(--greek-blue)] font-bold text-sm border border-[rgba(197,161,72,0.25)]">
                {currentQuestionIndex + 1}
              </span>
              <span className="text-gray-400 font-medium text-sm uppercase tracking-wide">
                / {questions.length} Question{questions.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="px-3 py-1 bg-[var(--greek-cream)] rounded-full text-xs font-bold text-[var(--greek-bronze)] border border-[rgba(197,161,72,0.25)]">
              {currentQuestion.points} Points
            </div>
          </div>

          <div className="mb-4">
            <ReadAloudButton
              text={`${currentQuestion.group_intro && (currentQuestionIndex === 0 || questions[currentQuestionIndex - 1]?.group_id !== currentQuestion.group_id) ? `${currentQuestion.group_intro}. ` : ""}${currentQuestion.text || ""}. ${(currentQuestion.options ?? []).map((o, i) => `Choix ${i + 1} : ${o}`).join(". ")}`}
            />
          </div>

          {/* Contexte partagé pour un groupe de "questions liées" (voir plan :
              modèle quiz plat, chaque question reste notée indépendamment : 
              ceci n'est qu'un rappel du contexte commun, pas un chaînage réel) */}
          {currentQuestion.group_intro &&
            (currentQuestionIndex === 0 ||
              questions[currentQuestionIndex - 1]?.group_id !== currentQuestion.group_id) && (
              <div className="mb-6 rounded-xl border border-[rgba(197,161,72,0.3)] bg-[var(--greek-cream)] p-4">
                <span className="text-xs font-bold text-[var(--greek-gold)] uppercase tracking-wider block mb-1">
                  Contexte des questions suivantes
                </span>
                <div
                  className="text-sm text-[var(--greek-bronze)] prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderLatexInHTML(currentQuestion.group_intro) }}
                />
              </div>
            )}

          {/* Question */}
          <div className="mb-8 prose prose-lg prose-headings:text-[var(--greek-blue)] max-w-none text-gray-900 font-bold">
            <div dangerouslySetInnerHTML={{ __html: renderLatexInHTML(currentQuestion.text || "") }} />
          </div>

          {/* Options or Input */}
          <div className="mb-8">
            {currentQuestion.type === "text_input" || currentQuestion.type === "impossible_search" ? (
              <div className="space-y-4">
                {(() => {
                  const inline = inlineText[currentQuestionIndex];
                  const inlineResolved = inline?.status === "correct" || inline?.status === "revealed";
                  const isImpossible = currentQuestion.type === "impossible_search";
                  return (
                    <>
                      {isImpossible && (
                        <div className="flex items-start gap-2 rounded-lg border border-[rgba(197,161,72,0.4)] bg-[var(--greek-cream)] p-3 text-sm text-[var(--greek-bronze)]">
                          <AlertTriangle className="w-5 h-5 shrink-0 text-[var(--greek-gold)]" />
                          <span>
                            Attention : cette question n&apos;a peut-être pas de solution. Justifie ta
                            réponse plutôt que de deviner un résultat.
                          </span>
                        </div>
                      )}
                      <div className="relative">
                        <Type className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        {isImpossible ? (
                          <textarea
                            value={(answers[currentQuestionIndex] as string) || ""}
                            onChange={(e) =>
                              !isAnswerSubmitted &&
                              !inlineResolved &&
                              setAnswers({ ...answers, [currentQuestionIndex]: e.target.value })
                            }
                            disabled={isAnswerSubmitted || inlineResolved}
                            placeholder="Explique pourquoi ce problème n'a pas de solution..."
                            className={`w-full min-h-[100px] p-3 pl-10 border-2 rounded-xl text-base outline-none transition-colors ${
                              isAnswerSubmitted
                                ? questionResults[currentQuestionIndex]
                                  ? "border-green-500 bg-green-50 text-green-800"
                                  : "border-red-500 bg-red-50 text-red-800"
                                : inline?.status === "correct"
                                ? "border-green-500 bg-green-50 text-green-800"
                                : inline?.status === "wrong" || inline?.status === "revealed"
                                ? "border-red-500 bg-red-50 text-red-800"
                                : "border-gray-200 focus:border-[var(--greek-blue)]"
                            }`}
                          />
                        ) : (
                          <input
                            type="text"
                            value={(answers[currentQuestionIndex] as string) || ""}
                            onChange={(e) =>
                              !isAnswerSubmitted &&
                              !inlineResolved &&
                              setAnswers({ ...answers, [currentQuestionIndex]: e.target.value })
                            }
                            disabled={isAnswerSubmitted || inlineResolved}
                            placeholder="Votre réponse..."
                            className={`w-full p-3 pl-10 border-2 rounded-xl text-lg outline-none transition-colors ${
                              isAnswerSubmitted
                                ? questionResults[currentQuestionIndex]
                                  ? "border-green-500 bg-green-50 text-green-800"
                                  : "border-red-500 bg-red-50 text-red-800"
                                : inline?.status === "correct"
                                ? "border-green-500 bg-green-50 text-green-800"
                                : inline?.status === "wrong" || inline?.status === "revealed"
                                ? "border-red-500 bg-red-50 text-red-800"
                                : "border-gray-200 focus:border-[var(--greek-blue)]"
                            }`}
                          />
                        )}
                      </div>
                      {isAnswerSubmitted && (
                        <AnswerFeedback
                          kind={questionResults[currentQuestionIndex] ? "correct" : "wrong"}
                          feedback={questionFeedbacks[currentQuestionIndex]}
                          correctAnswer={
                            !questionResults[currentQuestionIndex] && typeof revealed[currentQuestionIndex]?.correctAnswer === "string"
                              ? (revealed[currentQuestionIndex]!.correctAnswer as string)
                              : undefined
                          }
                        />
                      )}

                      {/* Correction immédiate, même style que les mini-exercices de cours */}
                      {!isAnswerSubmitted && (
                        <>
                          {!inlineResolved && (
                            <GlassButton
                              onClick={() => verifyTextQuestion(currentQuestionIndex)}
                              disabled={!answers[currentQuestionIndex] || inline?.status === "grading"}
                              variant="navy"
                              size="sm"
                              className="min-w-[150px]"
                            >
                              {inline?.status === "grading" ? (
                                <>
                                  <LoaderDots />
                                  <span>Correction...</span>
                                </>
                              ) : (
                                "Vérifier"
                              )}
                            </GlassButton>
                          )}

                          {inline && ["correct", "wrong", "revealed", "unavailable"].includes(inline.status) && (
                            <AnswerFeedback
                              kind={inline.status as "correct" | "wrong" | "revealed" | "unavailable"}
                              feedback={inline.feedback}
                              correctAnswer={inline.status === "revealed" ? inline.revealedAnswer : undefined}
                              tryAgain={inline.status === "wrong"}
                            />
                          )}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-3">
                {(currentQuestion.options || []).map((option, index) => {
                  const currentAns = answers[currentQuestionIndex];
                  const isSelected = Array.isArray(currentAns)
                    ? (currentAns as string[]).includes(option)
                    : currentAns === option;

                  let optionClass =
                    "border-2 border-gray-100 hover:border-[var(--greek-blue)] hover:bg-[var(--greek-cream)]";
                  let icon = (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  );

                  if (isSelected) {
                    optionClass =
                      "border-2 border-[var(--greek-blue)] bg-[var(--greek-cream)] text-[var(--greek-blue)]";
                    icon = (
                      <CheckCircle className="w-5 h-5 text-[var(--greek-blue)]" />
                    );
                  }

                  if (isAnswerSubmitted) {
                    const revealedAnswer = revealed[currentQuestionIndex]?.correctAnswer;
                    const correct = Array.isArray(revealedAnswer)
                      ? revealedAnswer
                      : revealedAnswer !== undefined
                      ? [revealedAnswer]
                      : [];
                    const isCorrectOption = correct.includes(option);

                    if (isCorrectOption) {
                      optionClass =
                        "border-2 border-green-500 bg-green-50 text-green-700";
                      icon = <CheckCircle className="w-5 h-5 text-green-600" />;
                    } else if (isSelected && !isCorrectOption) {
                      optionClass =
                        "border-2 border-red-200 bg-red-50 text-red-700 opacity-70";
                      icon = <XCircle className="w-5 h-5 text-red-500" />;
                    } else {
                      optionClass = "border-gray-100 opacity-50";
                    }
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => handleSelectOption(option)}
                      disabled={isAnswerSubmitted}
                      className={`w-full p-4 rounded-xl text-left transition-all duration-200 flex items-center gap-4 ${optionClass}`}
                    >
                      <div className="flex-shrink-0">{icon}</div>
                      <div className="font-medium text-lg prose prose-sm max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: renderLatexInHTML(option || "") }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Explanation — révélée par le serveur uniquement après soumission */}
          {isAnswerSubmitted && revealed[currentQuestionIndex]?.explanation && (
            <>
              {/* En mode révision : toujours visible. Sinon : bouton toggle */}
              {!showReview && (
                <div className="mb-4">
                  <GlassButton onClick={() => setShowExplanation(v => !v)} variant="outline" size="sm">
                    <HelpCircle className="w-4 h-4" />
                    {showExplanation ? "Masquer l'explication" : "Voir l'explication"}
                  </GlassButton>
                </div>
              )}
              {(showReview || showExplanation) && (
                <div className="mb-8 p-6 bg-[var(--greek-cream)] rounded-xl border border-[rgba(197,161,72,0.25)]">
                  <div className="flex items-center gap-2 text-[var(--greek-blue)] font-bold mb-2">
                    <HelpCircle className="w-5 h-5" />
                    Explication
                  </div>
                  <div className="text-[var(--greek-bronze)] prose prose-sm max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: renderLatexInHTML(renderMathGraphPlaceholders(revealed[currentQuestionIndex]?.explanation || "")) }} />
                  </div>
                </div>
              )}
            </>
          )}

          {isAnswerSubmitted && (
            <div className="mb-6 space-y-2">
              {adminEditedAnswers[String(currentQuestionIndex)] !== undefined && (
                <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-purple-800 text-xs">
                  <span className="font-bold block mb-0.5">Réponse corrigée par l&apos;admin :</span>
                  {typeof adminEditedAnswers[String(currentQuestionIndex)] === "string" ? adminEditedAnswers[String(currentQuestionIndex)] : JSON.stringify(adminEditedAnswers[String(currentQuestionIndex)])}
                </div>
              )}
              {adminComments[String(currentQuestionIndex)] && (
                <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-purple-800 text-xs">
                  <span className="font-bold block mb-0.5">Commentaire de l&apos;admin :</span>
                  {adminComments[String(currentQuestionIndex)]}
                </div>
              )}
              {adminMode && (
                <AdminAttemptControls
                  itemKey={String(currentQuestionIndex)}
                  currentAnswer={answers[currentQuestionIndex]}
                  existingComment={adminComments[String(currentQuestionIndex)]}
                  existingEditedAnswer={adminEditedAnswers[String(currentQuestionIndex)]}
                  adminMode={adminMode}
                />
              )}
            </div>
          )}
        </div>

          {gradingError && (
            <div
              className="p-3 rounded-xl flex items-start gap-2"
              style={{ background: "#fffbeb", color: "#92400e" }}
            >
              <Loader2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                <span className="font-semibold">Correction indisponible.</span>{" "}
                {gradingError} Tes réponses sont conservées, tu peux revalider.
              </p>
            </div>
          )}

          {/* Actions */}
          <div ref={caliaFloorRef} className="flex justify-between pt-4 border-t border-gray-100">
            <GlassButton
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0 || !showReview}
              variant="ghost"
              style={currentQuestionIndex === 0 || !showReview ? { opacity: 0 } : undefined}
            >
              <ArrowLeft className="w-5 h-5" /> Précédent
            </GlassButton>
            <GlassButton
              onClick={
                showReview
                  ? currentQuestionIndex < questions.length - 1
                    ? handleNextQuestion
                    : reviewMode || openCorrection
                    ? onBack || (() => {})
                    : () => {
                        setShowReview(false);
                        setQuizCompleted(true);
                        const tp = questions.reduce((acc, q) => acc + (q.points || 1), 0);
                        const pct = tp > 0 ? Math.round((score / tp) * 100) : 100;
                        const didPass = pct >= passThreshold(quiz.min_score_percent);
                        saveProgress('completed', score, pct, didPass);
                      }
                  : currentQuestionIndex < questions.length - 1
                  ? handleNextQuestion
                  : validateAllAnswers
              }
              disabled={
                isValidating ||
                (!showReview &&
                  (currentQuestion.type === "multiple_choice"
                    ? !(answers[currentQuestionIndex]?.length > 0)
                    : !answers[currentQuestionIndex]))
              }
              variant="navy"
              className="group"
            >
              {isValidating ? (
                <>
                  <LoaderDots /> Validation...
                </>
              ) : showReview ? (
                currentQuestionIndex < questions.length - 1 ? (
                  <>
                    Suivant
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                ) : (
                  <>
                    {reviewMode || openCorrection ? "Fermer" : "Terminer la révision"}
                    <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </>
                )
              ) : currentQuestionIndex < questions.length - 1 ? (
                <>
                  Suivant
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              ) : (
                <>
                  Valider et Terminer
                  <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </>
              )}
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  );
}
