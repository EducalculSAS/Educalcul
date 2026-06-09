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
import Link from "next/link";
import { Question } from "@/components/admin/QuizBuilder";
import { supabase } from "@/lib/supabaseClient";
import { renderLatexInHTML } from "@/lib/katexLoader";


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
}

export default function QuizViewer({ quiz, onComplete, onBack }: QuizViewerProps) {
  const questions = quiz.content_json || [];
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [questionResults, setQuestionResults] = useState<
    Record<number, boolean>
  >({});
  const [questionFeedbacks, setQuestionFeedbacks] = useState<
    Record<number, string>
  >({});
  const contentRef = useRef<HTMLDivElement>(null);

  // Timer
  const timeLimitSeconds = quiz.time_limit_minutes ? quiz.time_limit_minutes * 60 : null;
  const [elapsed, setElapsed] = useState(0); // seconds elapsed
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (quizCompleted) {
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
    saveProgress('in_progress', 0);
  }, []);



  // Visibility control to prevent flicker
  const [contentVisible, setContentVisible] = useState(false);
  useEffect(() => {
    setContentVisible(false);
    const timer = setTimeout(() => setContentVisible(true), 150);
    return () => clearTimeout(timer);
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

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const answer = answers[i];
      let isCorrect = false;

      if (!answer) {
        newResults[i] = false;
        continue;
      }

      if (q.type === "text_input") {
        try {
          const response = await fetch("/api/child/quizzes/preview/grade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: q.text,
              correctAnswer: q.correctAnswer,
              answer: answer,
              explanation: q.explanation,
              level: quiz.level || "6eme", // Passing level for tailored feedback
              points: q.points,
            }),
          });
          const data = await response.json();
          isCorrect = data.is_correct;
          if (data.feedback) newFeedbacks[i] = data.feedback;
        } catch (e) {
          isCorrect = String(answer).toLowerCase().trim() === String(q.correctAnswer).toLowerCase().trim();
        }
      } else if (q.type === "multiple_choice") {
        const correct = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
        const selected = Array.isArray(answer) ? answer : [answer];
        isCorrect = correct.length === selected.length && correct.every(a => selected.includes(String(a)));
      } else {
        isCorrect = String(answer) === String(q.correctAnswer);
      }

      newResults[i] = isCorrect;
      if (isCorrect) totalScore += q.points;
    }

    setScore(totalScore);
    setQuestionResults(newResults);
    setQuestionFeedbacks(newFeedbacks);
    setIsAnswerSubmitted(true);
    setIsValidating(false);
    setQuizCompleted(true);

    // Save completed progress with pass/fail
    const tp = questions.reduce((acc, q) => acc + (q.points || 1), 0);
    const pct = tp > 0 ? Math.round((totalScore / tp) * 100) : 100;
    const thr = (quiz as any).min_score_percent || 0;
    const didPass = thr > 0 ? pct >= thr : true;
    saveProgress('completed', totalScore, pct, didPass);

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
    // Save pass/fail to localStorage
    const qzId = (quiz as any).id;
    if (qzId && qzId !== "preview") {
      localStorage.setItem(`qz-${qzId}-status`, passed ? "passed" : "failed");
      localStorage.setItem(`qz-${qzId}-score`, String(percentage));
    }

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
                        setQuizCompleted(false);
                        setShowReview(true);
                        setCurrentQuestionIndex(0);
                      }}
                      className="w-full btn-primary-greek py-4 text-base shadow-lg flex items-center justify-center transform hover:scale-105 transition-all"
                    >
                      Voir la correction
                    </button>
                    <Link
                      href="/child/exercises"
                      className="w-full flex items-center justify-center py-4 rounded-xl font-bold text-base bg-[var(--greek-blue)] text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
                    >
                      Faire les exercices
                    </Link>
                    <Link
                      href="/child/quiz"
                      className="w-full flex items-center justify-center py-4 rounded-xl font-bold text-base bg-[var(--greek-bronze)] text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
                    >
                      Retour aux quiz
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
    <div className="flex flex-col h-full bg-white overflow-hidden border border-[var(--greek-gold)]" id="quiz-content-container">
      {/* Header with Progress Bar */}
      <div className="bg-[var(--greek-cream)] border-b border-[var(--greek-gold)] shrink-0">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-lg text-[var(--greek-blue)] flex-shrink-0 transition-transform duration-150 hover:scale-110 active:scale-95"
                title="Retour"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h3 className="font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] truncate">
              {quiz.title}
            </h3>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${isLowTime ? "bg-red-50 border-red-400 text-red-600 animate-pulse" : "bg-[var(--greek-blue)]/10 border-[var(--greek-gold)] text-[var(--greek-blue)]"}`}>
              <Clock className="w-3.5 h-3.5" />
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

      <div className={`flex-1 overflow-y-auto p-4 md:p-8 bg-white/50 transition-opacity duration-200 ${contentVisible ? "opacity-100" : "opacity-0"}`}>
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
                      {!questionFeedbacks[currentQuestionIndex] && (
                        <span>
                          Réponse attendue :{" "}
                          {currentQuestion.correctAnswer as string}
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
                    const correct = Array.isArray(currentQuestion.correctAnswer)
                      ? currentQuestion.correctAnswer
                      : [currentQuestion.correctAnswer];
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

          {/* Explanation */}
          {currentQuestion.explanation && (
            <>
              {/* En mode révision : toujours visible. Sinon : bouton toggle */}
              {!showReview && isAnswerSubmitted && (
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
                    <div dangerouslySetInnerHTML={{ __html: renderLatexInHTML(currentQuestion.explanation || "") }} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0 || !showReview}
              className={`px-4 py-2 text-[var(--greek-bronze)] font-medium rounded-lg flex items-center gap-2 transition-colors ${
                currentQuestionIndex === 0 || !showReview ? "opacity-0 pointer-events-none" : "hover:bg-[var(--greek-gold)]/10"
              }`}
            >
              <ArrowLeft className="w-5 h-5" /> Précédent
            </button>
            <button
              onClick={
                showReview
                  ? currentQuestionIndex < questions.length - 1
                    ? handleNextQuestion
                    : () => {
                        setShowReview(false);
                        setQuizCompleted(true);
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
              className="btn-primary-greek px-8 py-3 flex items-center gap-2 group disabled:opacity-50 shadow-md hover:shadow-lg"
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
                    Terminer la révision
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
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
