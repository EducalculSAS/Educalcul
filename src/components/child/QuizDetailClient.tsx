"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Play,
  Clock,
  Trophy,
  AlertCircle,
  CheckCircle,
  BookOpen,
  X,
  Eye,
} from "lucide-react";
import QuizViewer from "@/components/viewers/QuizViewer";
import AppAdminLoader from "@/components/AppAdminLoader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAITutor } from "@/contexts/AITutorContext";

/** Page de détail quiz : le contenu (déjà purgé des réponses côté serveur)
 * et l'historique de tentatives arrivent en props quand id !== "preview". Le
 * mode "preview" (ouvert depuis l'admin via localStorage) reste entièrement
 * client, comme avant. */
export default function QuizDetailClient({
  quizId,
  initialQuiz,
  initialAttemptsHistory,
  initialAlreadyCompleted,
}: {
  quizId: string;
  initialQuiz: any | null;
  initialAttemptsHistory: any[];
  initialAlreadyCompleted: boolean;
}) {
  const router = useRouter();
  const { setPageContext, clearContext } = useAITutor();
  const isPreview = quizId === "preview";

  const [loading, setLoading] = useState(isPreview);
  const [quiz, setQuiz] = useState<any>(isPreview ? null : initialQuiz);
  const [started, setStartedState] = useState(() => {
    if (typeof window === "undefined") return false;
    const wasStarted = localStorage.getItem(`quiz-${quizId}-started`);
    if (wasStarted !== "true") return false;
    if (localStorage.getItem(`qz-${quizId}-status`)) return false;
    return true;
  });
  const [isRendering, setIsRendering] = useState(false);
  const attemptsHistory = isPreview ? [] : initialAttemptsHistory;
  const alreadyCompleted = isPreview ? false : initialAlreadyCompleted;
  const [attemptKey, setAttemptKey] = useState(0);
  const [forceNewAttempt, setForceNewAttempt] = useState(false);
  const [openCorrection, setOpenCorrection] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialAlreadyCompleted) setStartedState(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStarted = (value: boolean) => {
    setStartedState(value);
    if (value) {
      localStorage.setItem(`quiz-${quizId}-started`, "true");
    } else {
      localStorage.removeItem(`quiz-${quizId}-started`);
    }
  };

  // Mode preview uniquement : le contenu vient du localStorage de l'admin.
  useEffect(() => {
    if (!isPreview) return;
    const previewData = localStorage.getItem("quiz_preview_data");
    if (previewData) {
      try {
        setQuiz(JSON.parse(previewData));
      } catch (e) {
        console.error("Error parsing preview data", e);
      }
    }
    setLoading(false);
  }, [isPreview]);

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
  useEffect(() => {
    if (loading || !quiz || started) return;

    const loadKatex = async () => {
      if (!document.getElementById("katex-css")) {
        const link = document.createElement("link");
        link.id = "katex-css";
        link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
        link.rel = "stylesheet";
        link.integrity = "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV";
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }

      const loadScript = (src: string, integrity: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          if ((window as any).katex && src.includes("katex.min.js")) return resolve();
          if ((window as any).renderMathInElement && src.includes("auto-render.min.js")) return resolve();

          const script = document.createElement("script");
          script.src = src;
          script.integrity = integrity;
          script.crossOrigin = "anonymous";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load script ${src}`));
          document.head.appendChild(script);
        });
      };

      try {
        await loadScript(
          "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js",
          "sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8"
        );
        await loadScript(
          "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js",
          "sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05"
        );

        renderMath();
      } catch (err) {
        console.error("KaTeX initialization failed:", err);
      }
    };

    const renderMath = () => {
      if (contentRef.current && (window as any).renderMathInElement) {
        setIsRendering(true);
        try {
          (window as any).renderMathInElement(contentRef.current, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\(", right: "\\)", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
          });
        } catch (e) {
          console.error("Math rendering error:", e);
        } finally {
          setTimeout(() => setIsRendering(false), 50);
        }
      }
    };

    loadKatex();
  }, [loading, quiz, started]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AppAdminLoader />
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

  const difficultyLabel = quiz.difficulty_level
    ? quiz.difficulty_level === "easy"
      ? "FACILE"
      : quiz.difficulty_level === "medium"
      ? "MOYEN"
      : quiz.difficulty_level === "hard"
      ? "DIFFICILE"
      : quiz.difficulty_level === "expert"
      ? "EXPERT"
      : quiz.difficulty_level.toUpperCase()
    : "NORMAL";

  const questionCount = quiz.content_json?.length || 0;

  if (started) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-[var(--greek-gold)] bg-[var(--greek-blue)] text-white shrink-0">
          <button
            onClick={() => { if (isPreview) { window.close(); } else { setStarted(false); } }}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
            title="Retour à l'aperçu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold truncate flex-1">{quiz.title}</h1>
          <button
            onClick={() => {
              if (isPreview) { window.close(); } else {
                if (quiz?.id) localStorage.removeItem(`quiz-${quiz.id}-page`);
                setStarted(false);
              }
            }}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <QuizViewer
            key={attemptKey}
            quiz={quiz}
            forceNewAttempt={forceNewAttempt}
            openCorrection={openCorrection}
            bestScorePercent={attemptsHistory.length > 0 ? Math.max(...attemptsHistory.map((a: any) => a.score_percent ?? 0)) : undefined}
            onBack={() => setStarted(false)}
            onComplete={(score, total, timeSpent) => {
              console.log(`Quiz completed: ${score}/${total} in ${timeSpent}s`);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <button
        onClick={() => {
          if (isPreview) {
            window.close();
          } else {
            router.back();
          }
        }}
        className="flex items-center text-[var(--greek-blue)] hover:text-[var(--greek-gold)] mb-6 transition-colors font-bold"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Retour
      </button>

      <div
        ref={contentRef}
        className={`bg-white rounded-[20px] shadow-lg border-2 border-[rgba(197,161,72,0.25)] overflow-hidden transition-opacity duration-300 ${isRendering ? "opacity-0" : "opacity-100"}`}
      >
        <div className="relative h-64 md:h-80 bg-[var(--greek-blue)] relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-10 pattern-grid-lg"></div>
          <Trophy className="w-24 h-24 text-[var(--greek-gold)] drop-shadow-lg" />
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
                    <CheckCircle className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Validation globale à la fin</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Score basé sur la précision</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Explications détaillées fournies</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" />
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
                    <button
                      onClick={() => {
                        if (limitReached) return;
                        setForceNewAttempt(alreadyCompleted);
                        if (alreadyCompleted) setAttemptKey((k) => k + 1);
                        setStarted(true);
                      }}
                      disabled={limitReached}
                      className={`w-full py-4 text-lg shadow-lg mb-1 flex items-center justify-center gap-2 transform transition-all rounded-full font-bold ${limitReached ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "btn-primary-greek hover:scale-105"}`}
                    >
                      <Play className="w-6 h-6 fill-current" />
                      {limitReached ? "Tentatives épuisées" : alreadyCompleted ? "Recommencer le quiz" : "Démarrer le quiz"}
                    </button>
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
                            {a.completed_at ? new Date(a.completed_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={`font-bold ${a.passed === false ? "text-red-500" : "text-green-600"}`}>
                              {a.score_percent ?? 0}%
                            </span>
                            {i === 0 && (
                              <button
                                onClick={() => { setForceNewAttempt(false); setOpenCorrection(true); setStarted(true); }}
                                title="Voir ma correction"
                                className="text-[var(--greek-blue)] hover:opacity-70"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
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
