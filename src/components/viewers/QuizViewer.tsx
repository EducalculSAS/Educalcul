"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Trophy,
  Loader2,
  Sparkles,
  Type,
  HelpCircle,
  Clock,
} from "lucide-react";
import { Question } from "@/components/admin/QuizBuilder";
import { supabase } from "@/lib/supabaseClient";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { renderMathGraphPlaceholders, enhanceMathGraphs } from "@/lib/mathGraph";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";


interface QuizViewerProps {
  quiz: {
    title: string;
    description?: string | null;
    content_json: Question[] | null;
    time_limit_minutes?: number | null;
    level?: string;
    min_score_percent?: number | null;
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
    answers?: Record<number, any>;
    questionResults?: Record<number, boolean>;
    questionFeedbacks?: Record<number, string>;
    revealed?: Record<number, { correctAnswer?: string | string[]; explanation?: string }>;
    score?: number;
  } | null;
}

export default function QuizViewer({ quiz, onComplete, onBack, reviewMode, forceNewAttempt, bestScorePercent, openCorrection, initialProgress }: QuizViewerProps) {
  const questions = quiz.content_json || [];
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>(
    () => (reviewMode ? initialProgress?.answers : undefined) || {}
  );
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(!!reviewMode);
  const [score, setScore] = useState(() => (reviewMode ? initialProgress?.score : 0) || 0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showReview, setShowReview] = useState(!!reviewMode);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
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
  const contentRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Timer
  const timeLimitSeconds = quiz.time_limit_minutes ? quiz.time_limit_minutes * 60 : null;
  const [elapsed, setElapsed] = useState(0); // seconds elapsed
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

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
    const isPreview = (quiz as any).id === undefined || (quiz as any).id === "preview";
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
          itemId: (quiz as any).id,
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
  }, []);

  // Sauvegarde la progression détaillée (réponses, résultats, feedback) en base
  const saveDetailedProgress = async (status: 'in_progress' | 'completed', extra?: { results?: Record<number, boolean>; feedbacks?: Record<number, string>; revealed?: Record<number, any>; finalScore?: number }) => {
    const isPreview = (quiz as any).id === undefined || (quiz as any).id === "preview";
    if (isPreview || reviewMode) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    try {
      await fetch(`/api/child/quizzes/${(quiz as any).id}/progress`, {
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
    const isPreview = (quiz as any).id === undefined || (quiz as any).id === "preview";
    if (isPreview) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      try {
        const res = await fetch(`/api/child/quizzes/${(quiz as any).id}/progress?userId=${session.user.id}`);
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
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentQuestionIndex]);

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

  const validateAllAnswers = async () => {
    setIsValidating(true);
    let totalScore = 0;
    const newResults: Record<number, boolean> = {};
    const newFeedbacks: Record<number, string> = {};
    const newRevealed: Record<number, any> = {};
    const quizId = (quiz as any).id || "preview";

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const answer = answers[i];
      let isCorrect = false;

      if (!answer) {
        newResults[i] = false;
        continue;
      }

      // La correction se fait toujours côté serveur : le client ne connaît
      // jamais la réponse correcte avant d'avoir soumis la sienne.
      try {
        const response = await fetch(`/api/child/quizzes/${quizId}/grade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_id: q.id,
            answer,
            level: quiz.level || "6eme",
            // Uniquement utilisé en mode "preview" (aperçu admin, contenu pas
            // encore enregistré) — ignoré par le serveur pour un vrai quiz.
            question: q.text,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            points: q.points,
          }),
        });
        const data = await response.json();
        isCorrect = !!data.is_correct;
        if (data.feedback) newFeedbacks[i] = data.feedback;
        if (data.reveal) newRevealed[i] = data.reveal;
      } catch (e) {
        console.error("Failed to grade quiz question", e);
        newFeedbacks[i] = "Erreur de correction, réessaie.";
      }

      newResults[i] = isCorrect;
      if (isCorrect) totalScore += q.points;
    }

    setScore(totalScore);
    setQuestionResults(newResults);
    setQuestionFeedbacks(newFeedbacks);
    setRevealed(newRevealed);
    setIsAnswerSubmitted(true);
    setIsValidating(false);
    setQuizCompleted(true);

    // Save completed progress with pass/fail
    const tp = questions.reduce((acc, q) => acc + (q.points || 1), 0);
    const pct = tp > 0 ? Math.round((totalScore / tp) * 100) : 100;
    const thr = (quiz as any).min_score_percent || 0;
    const didPass = thr > 0 ? pct >= thr : true;
    saveProgress('completed', totalScore, pct, didPass);
    saveDetailedProgress('completed', { results: newResults, feedbacks: newFeedbacks, revealed: newRevealed, finalScore: totalScore });

    if (onComplete) {
      const totalPoints = questions.reduce((acc, q) => acc + (q.points || 1), 0);
      onComplete(totalScore, totalPoints, elapsed);
    }
  };

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

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIsAnswerSubmitted(false);
    setScore(0);
    setQuizCompleted(false);
    setShowReview(false);
    setShowExplanation(false);
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
    const isPreview = (quiz as any).id === undefined || (quiz as any).id === "preview";
    const threshold = (quiz as any).min_score_percent || 0;
    const passed = threshold > 0 ? percentage >= threshold : true;

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-[var(--greek-cream)]">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="bg-white rounded-[20px] shadow-lg border-2 border-[rgba(197,161,72,0.25)] overflow-hidden">
            {/* Thumbnail header */}
            <div className={`relative h-64 md:h-80 overflow-hidden flex items-center justify-center ${passed ? "bg-[var(--greek-blue)]" : "bg-red-800"}`}>
              <Trophy className="w-24 h-24 text-[var(--greek-gold)] opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                <div className="p-8 text-white w-full">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-full mb-3 shadow-md ${passed ? "bg-[var(--greek-gold)] text-[var(--greek-blue)]" : "bg-red-500 text-white"}`}>
                    {passed ? <><CheckCircle className="w-3.5 h-3.5" /> Quiz réussi !</> : <><XCircle className="w-3.5 h-3.5" /> Score insuffisant</>}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2">{quiz.title}</h1>
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
                    Tu as terminé ce quiz. Consulte ta correction ou retourne t'exercer !
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
                    <GlassButton href="/child/exercises" variant="navy" fullWidth className="font-bold text-base">
                      Faire les exercices
                    </GlassButton>
                    <GlassButton href="/child/quiz" variant="outline" fullWidth className="font-bold text-base">
                      Retour aux quiz
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
    <div className="flex flex-col h-full bg-white overflow-hidden border border-[var(--greek-gold)]" id="quiz-content-container">
      {/* Header with Progress Bar */}
      <div className="bg-[var(--greek-cream)] border-b border-[var(--greek-gold)] shrink-0">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
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

      <div ref={mainScrollRef} className={`flex-1 overflow-y-auto p-4 md:p-8 bg-white/50 transition-opacity duration-200 ${contentVisible ? "opacity-100" : "opacity-0"}`}>
        <div className="max-w-3xl mx-auto py-4">
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

          {/* Question */}
          <div className="mb-8 prose prose-lg prose-headings:text-[var(--greek-blue)] max-w-none text-gray-900 font-bold">
            <div dangerouslySetInnerHTML={{ __html: renderLatexInHTML(currentQuestion.text || "") }} />
          </div>

          {/* Options or Input */}
          <div className="mb-8">
            {currentQuestion.type === "text_input" ? (
              <div className="space-y-4">
                <div className="relative">
                  <Type className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={(answers[currentQuestionIndex] as string) || ""}
                    onChange={(e) =>
                      !isAnswerSubmitted && setAnswers({ ...answers, [currentQuestionIndex]: e.target.value })
                    }
                    disabled={isAnswerSubmitted}
                    placeholder="Votre réponse..."
                    className={`w-full p-3 pl-10 border-2 rounded-xl text-lg outline-none transition-colors ${
                      isAnswerSubmitted
                        ? questionResults[currentQuestionIndex]
                          ? "border-green-500 bg-green-50 text-green-800"
                          : "border-red-500 bg-red-50 text-red-800"
                        : "border-gray-200 focus:border-[var(--greek-blue)]"
                    }`}
                  />
                </div>
                {isAnswerSubmitted &&
                  !questionResults[currentQuestionIndex] && (
                    <div className="text-sm text-red-600 font-medium">
                      {questionFeedbacks[currentQuestionIndex] ? (
                        <div className="mb-1">{questionFeedbacks[currentQuestionIndex]}</div>
                      ) : null}
                      {!questionFeedbacks[currentQuestionIndex] && revealed[currentQuestionIndex]?.correctAnswer && (
                        <span>
                          Réponse attendue :{" "}
                          {revealed[currentQuestionIndex]!.correctAnswer as string}
                        </span>
                      )}
                    </div>
                  )}
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
                <button
                  onClick={() => setShowExplanation(v => !v)}
                  className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--greek-blue)] hover:text-blue-800 transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                  {showExplanation ? "Masquer l'explication" : "Voir l'explication"}
                </button>
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

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-gray-100">
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
                        const thr = (quiz as any).min_score_percent || 0;
                        const didPass = thr > 0 ? pct >= thr : true;
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
                  <Loader2 className="w-4 h-4 animate-spin" /> Validation...
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
