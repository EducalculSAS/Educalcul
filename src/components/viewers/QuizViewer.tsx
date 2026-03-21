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
} from "lucide-react";
import { Question } from "@/components/admin/QuizBuilder";
import { supabase } from "@/lib/supabaseClient";

interface QuizViewerProps {
  quiz: {
    title: string;
    description?: string | null;
    content_json: Question[] | null;
    time_limit_minutes?: number | null;
    level?: string;
  };
  onComplete?: (score: number, totalPoints: number, timeSpent: number) => void;
}

export default function QuizViewer({ quiz, onComplete }: QuizViewerProps) {
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
  const [startTime] = useState(Date.now());
  const contentRef = useRef<HTMLDivElement>(null);

  const currentQuestion = questions[currentQuestionIndex];

  // Dynamic progress tracking
  const saveProgress = async (status: 'in_progress' | 'completed', currentScore: number) => {
    const isPreview = (quiz as any).id === undefined || (quiz as any).id === "preview";
    if (isPreview) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    const totalPoints = questions.reduce((acc, q) => acc + (q.points || 1), 0);
    const timeSpent = status === 'completed' ? Math.floor((Date.now() - startTime) / 1000) : 0;

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

  // Robust LaTeX rendering using MutationObserver
  useEffect(() => {
    // Standard loading check
    const loadKaTeX = () => {
      if ((window as any).renderMathInElement) {
        renderMath();
        return;
      }
      
      const link = document.createElement("link");
      link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
      link.rel = "stylesheet";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
      script.defer = true;
      document.head.appendChild(script);

      const autoRenderScript = document.createElement("script");
      autoRenderScript.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js";
      autoRenderScript.defer = true;
      autoRenderScript.onload = renderMath;
      document.head.appendChild(autoRenderScript);
    };

    const renderMath = () => {
      const container = document.getElementById("quiz-content-container");
      if (container && (window as any).renderMathInElement) {
        (window as any).renderMathInElement(container, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      }
    };

    loadKaTeX();

    // Setup MutationObserver
    const container = document.getElementById("quiz-content-container");
    if (!container) return;

    const observer = new MutationObserver(() => {
      renderMath();
    });

    observer.observe(container, { 
      childList: true, 
      subtree: true, 
      characterData: true 
    });

    return () => observer.disconnect();
  }, [currentQuestionIndex, quizCompleted, showExplanation]);

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

    // Save completed progress dynamically
    saveProgress('completed', totalScore);

    if (onComplete) {
      const totalPoints = questions.reduce((acc, q) => acc + (q.points || 1), 0);
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      onComplete(totalScore, totalPoints, timeSpent);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
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
    const isPreview = (quiz as any).id === undefined || (quiz as any).id === "preview";

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in bg-white border border-[var(--greek-gold)]">
        <div className="w-24 h-24 bg-[var(--greek-blue)] rounded-full flex items-center justify-center mb-6 shadow-xl">
          <Trophy className="w-12 h-12 text-[var(--greek-gold)]" />
        </div>
        <h2 className="text-4xl font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] mb-2">
          Félicitations !
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-md">
          Tu as terminé ce quiz avec un score de{" "}
          <span className="font-bold text-[var(--greek-blue)]">
            {score} / {totalPoints}
          </span>
          .
        </p>
        
        <div className="w-full max-w-md bg-gray-50 border border-[var(--greek-gold)]/20 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 font-medium">Réussite</span>
            <span className="text-[var(--greek-blue)] font-bold">{percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
            <div 
              className="bg-[var(--greek-gold)] h-full transition-all duration-1000" 
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <button
            onClick={() => {
              setQuizCompleted(false);
              setShowReview(true);
              setCurrentQuestionIndex(0);
            }}
            className="py-4 px-8 text-lg flex items-center justify-center gap-2 shadow-md bg-white text-[var(--greek-blue)] border-2 border-[var(--greek-blue)] hover:bg-[var(--greek-cream)] font-bold rounded-xl transition-all"
          >
            <Sparkles className="w-5 h-5 text-[var(--greek-gold)]" />
            Voir la correction
          </button>
          <button
            onClick={() => {
              if (isPreview) {
                window.close();
              } else {
                window.location.href = "/child/quiz";
              }
            }}
            className="btn-primary-greek py-4 px-8 text-lg flex items-center justify-center gap-2 shadow-xl rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
            {isPreview ? "Fermer l'aperçu" : "Retour aux quiz"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden border border-[var(--greek-gold)]" id="quiz-content-container">
      {/* Header with Progress Bar */}
      <div className="bg-[var(--greek-cream)] border-b border-[var(--greek-gold)] shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)]">
            {quiz.title}
          </h3>
          <div className="text-sm font-medium text-[var(--greek-blue)] bg-[var(--greek-blue)]/10 border border-[var(--greek-gold)] px-3 py-1 rounded-full">
            Question {currentQuestionIndex + 1} / {questions.length}
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
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--greek-cream)] text-[var(--greek-blue)] font-bold text-sm border border-[var(--greek-gold)]/30">
                {currentQuestionIndex + 1}
              </span>
              <span className="text-gray-400 font-medium text-sm uppercase tracking-wide">
                / {questions.length} Question{questions.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="px-3 py-1 bg-[var(--greek-cream)] rounded-full text-xs font-bold text-[var(--greek-bronze)] border border-[var(--greek-gold)]/30">
              {currentQuestion.points} Points
            </div>
          </div>

          {/* Question */}
          <div className="mb-8 prose prose-lg prose-headings:text-[var(--greek-blue)] max-w-none text-gray-900 font-bold">
            <div dangerouslySetInnerHTML={{ __html: currentQuestion.text }} />
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
                        <div dangerouslySetInnerHTML={{ __html: option }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Explanation */}
          {showExplanation && currentQuestion.explanation && (
            <div className="mb-8 p-6 bg-[var(--greek-cream)] rounded-xl border border-[var(--greek-gold)]/30 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-[var(--greek-blue)] font-bold mb-2">
                <HelpCircle className="w-5 h-5" />
                Explication
              </div>
              <div className="text-[var(--greek-bronze)] prose prose-sm max-w-none">
                <div
                  dangerouslySetInnerHTML={{
                    __html: currentQuestion.explanation,
                  }}
                />
              </div>
            </div>
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
