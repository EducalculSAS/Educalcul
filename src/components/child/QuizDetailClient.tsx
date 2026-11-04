"use client";

import type { AttemptSummary } from "@/types/attempts";
import { useKatexIn } from "@/lib/useKatexIn";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Play,
  Clock,
  Trophy,
  AlertCircle,
  CheckCircle,
  BookOpen,
  Eye,
} from "lucide-react";
import QuizViewer, { type QuizViewerProps } from "@/components/viewers/QuizViewer";
import AppLoader from "@/components/AppLoader";
import { DIFFICULTY_LABELS, normalizeDifficulty } from "@/lib/difficultyLevels";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAITutor } from "@/contexts/AITutorContext";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

/** Page de détail quiz : le contenu (déjà purgé des réponses côté serveur)
 * et l'historique de tentatives arrivent en props quand id !== "preview"
 * (aperçu admin transmis via une ligne content_previews, cf. la page
 * serveur). */
/** Quiz tel que chargé par la page serveur : ce que lit le lecteur, plus quelques champs d'affichage. */
export type QuizDetail = QuizViewerProps["quiz"] & { difficulty_level?: string; estimated_time?: number | null; max_attempts?: number | null; courses?: { title?: string } | null };

export default function QuizDetailClient({
  quizId,
  initialQuiz,
  initialAttemptsHistory,
  initialAlreadyCompleted,
}: {
  quizId: string;
  initialQuiz: QuizDetail | null;
  initialAttemptsHistory: AttemptSummary[];
  initialAlreadyCompleted: boolean;
}) {
  const router = useRouter();
  const { setPageContext, clearContext } = useAITutor();
  const isPreview = quizId === "preview";

  const [loading] = useState(false);
  const [quiz] = useState(initialQuiz);
  const [started, setStarted] = useState(false);
  const attemptsHistory = isPreview ? [] : initialAttemptsHistory;
  const alreadyCompleted = isPreview ? false : initialAlreadyCompleted;
  const [attemptKey, setAttemptKey] = useState(0);
  const [forceNewAttempt, setForceNewAttempt] = useState(false);
  const [openCorrection, setOpenCorrection] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!quiz) return;
    setPageContext({
      page: "quiz_detail",
      quizTitle: quiz.title,
    });
    return () => clearContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz]);

  // Load KaTeX for Math rendering on the landing page
  // Formules rendues en place, sans masquer la page (avant : opacité 0 puis 1,
  // la page « clignotait » à chaque mise à jour).
  useKatexIn(contentRef, [loading, quiz, started]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AppLoader />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">Quiz introuvable</h1>
        <Link href="/child/quiz" className="text-[var(--greek-gold)] hover:underline">
          Retour aux quiz
        </Link>
      </div>
    );
  }

  const difficultyLabel = DIFFICULTY_LABELS[normalizeDifficulty(quiz.difficulty_level)].toUpperCase();

  const questionCount = quiz.content_json?.length || 0;

  if (started) {
    return (
      <div className="fixed inset-x-0 bottom-0 top-[calc(var(--nav-h)+var(--imp-banner-h,0px))] z-50 bg-white flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-[var(--greek-gold)] bg-[var(--greek-blue)] text-white shrink-0">
          <GlassIconButton
            icon={ArrowLeft}
            onClick={() => { if (isPreview) { window.close(); } else { setStarted(false); } }}
            color="white"
            className="flex-shrink-0"
            aria-label="Retour à l'aperçu"
          />
          <h1 className="text-lg font-bold truncate flex-1">{quiz.title}</h1>
          <GlassCloseButton
            variant="dark"
            onClick={() => {
              if (isPreview) { window.close(); } else { setStarted(false); }
            }}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <QuizViewer
            key={attemptKey}
            quiz={quiz}
            forceNewAttempt={forceNewAttempt}
            openCorrection={openCorrection}
            bestScorePercent={attemptsHistory.length > 0 ? Math.max(...attemptsHistory.map((a) => a.score_percent ?? 0)) : undefined}
            onBack={() => setStarted(false)}
            onComplete={(score, total, timeSpent) => {
              console.info(`Quiz completed: ${score}/${total} in ${timeSpent}s`);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <GlassButton
          onClick={() => {
            if (isPreview) {
              window.close();
            } else {
              router.back();
            }
          }}
          variant="ghost"
          size="sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </GlassButton>
      </div>

      <div
        ref={contentRef}
        className={`bg-white rounded-[20px] shadow-lg border-2 border-[rgba(197,161,72,0.25)] overflow-hidden`}
      >
        <div className="relative h-64 md:h-80 bg-[var(--greek-blue)] relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-10 pattern-grid-lg"></div>
          <Trophy className="w-24 h-24 text-[var(--greek-gold)] drop-shadow-lg" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
            <div className="p-8 text-white w-full">
              <div className="inline-block px-3 py-1 bg-[var(--greek-gold)] text-[var(--greek-blue)] text-xs font-bold rounded-full mb-3 shadow-md">
                {quiz.courses?.title || "Évaluation"}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2 text-shadow-sm">
                {quiz.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-grow">
              <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-[var(--greek-gold)]" />
                Défie tes connaissances
              </h2>
              <div className="prose max-w-none text-gray-600 leading-relaxed mb-6">
                {quiz.description || "Prêt à tester tes connaissances ? Réponds correctement aux questions pour gagner des points !"}
              </div>

              <div className="mt-8 p-6 bg-[var(--greek-cream)] rounded-xl border border-[rgba(197,161,72,0.25)]">
                <h3 className="text-lg font-bold text-[var(--greek-blue)] mb-4">
                  Règles du quiz :
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-sm text-gray-600">Validation globale à la fin</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-sm text-gray-600">Score basé sur la précision</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-sm text-gray-600">Explications détaillées fournies</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-sm text-gray-600">Accumule des points XP</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full md:w-80 flex-shrink-0">
              <div className="bg-white rounded-xl p-6 border-2 border-[var(--greek-blue)]/10 shadow-sm sticky top-24">
                <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-4 text-center">
                  Prêt pour le défi ?
                </h3>

                {(() => {
                  const maxAttempts: number | null = quiz.max_attempts ?? null;
                  const attemptsUsed = attemptsHistory.length;
                  const limitReached = !!maxAttempts && attemptsUsed >= maxAttempts;
                  return (
                    <GlassButton
                      onClick={() => {
                        if (limitReached) return;
                        setForceNewAttempt(alreadyCompleted);
                        if (alreadyCompleted) setAttemptKey((k) => k + 1);
                        setStarted(true);
                      }}
                      variant={limitReached ? "ghost" : "navy"}
                      fullWidth
                      className="text-lg mb-1"
                      style={limitReached ? { opacity: 0.6, pointerEvents: "none" } : undefined}
                    >
                      <Play className="w-6 h-6 fill-current" />
                      {limitReached ? "Tentatives épuisées" : alreadyCompleted ? "Recommencer le quiz" : "Démarrer le quiz"}
                    </GlassButton>
                  );
                })()}
                {!!quiz.max_attempts && (
                  <p className="text-xs text-gray-500 text-center mb-4">
                    {attemptsHistory.length}/{quiz.max_attempts} tentative{quiz.max_attempts > 1 ? "s" : ""} utilisée{attemptsHistory.length > 1 ? "s" : ""}
                  </p>
                )}
                {!quiz.max_attempts && <div className="mb-4" />}

                <div className="space-y-4 text-sm text-gray-600">
                  <div className="flex items-center justify-between border-b border-[rgba(197,161,72,0.25)] pb-2">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" /> {quiz.time_limit_minutes ? "Limite de temps" : "Temps estimé"}
                    </span>
                    <span className={`font-bold ${quiz.time_limit_minutes ? "text-red-500" : ""}`}>
                      {quiz.time_limit_minutes ? `${quiz.time_limit_minutes} min` : `${quiz.estimated_time || 15} min`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[rgba(197,161,72,0.25)] pb-2">
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> Questions
                    </span>
                    <span className="font-bold">{questionCount}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[rgba(197,161,72,0.25)] pb-2">
                    <span className="flex items-center gap-2">
                      <Trophy className="w-4 h-4" /> Difficulté
                    </span>
                    <span className="font-bold text-[var(--greek-blue)]">{difficultyLabel}</span>
                  </div>
                </div>

                {attemptsHistory.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-[rgba(197,161,72,0.25)]">
                    <h4 className="text-sm font-bold text-[var(--greek-blue)] mb-3">Tes derniers essais</h4>
                    <div className="space-y-2">
                      {attemptsHistory.slice(-5).reverse().map((a, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-[var(--greek-cream)] rounded-lg px-3 py-2 border border-[rgba(197,161,72,0.15)]">
                          <span className="text-gray-500">
                            {a.completed_at ? new Date(a.completed_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={`font-bold ${a.passed === false ? "text-red-500" : "text-green-600"}`}>
                              {a.score_percent ?? 0}%
                            </span>
                            {i === 0 && (
                              <GlassIconButton
                                icon={Eye}
                                onClick={() => { setForceNewAttempt(false); setOpenCorrection(true); setStarted(true); }}
                                color="navy"
                                size="sm"
                                aria-label="Voir ma correction"
                              />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
