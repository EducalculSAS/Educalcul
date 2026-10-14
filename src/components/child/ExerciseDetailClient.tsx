"use client";

import { useKatexIn } from "@/lib/useKatexIn";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Play,
  Clock,
  Brain,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Eye,
} from "lucide-react";
import ExerciseViewer from "@/components/viewers/ExerciseViewer";
import AppLoader from "@/components/AppLoader";
import { DIFFICULTY_LABELS, normalizeDifficulty } from "@/lib/difficultyLevels";
import { passThreshold } from "@/lib/scorePercent";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAITutor } from "@/contexts/AITutorContext";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

// Utility function to extract all content from exercise blocks
function extractExerciseContent(contentJson: any): string {
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

        if (block.type === "true_false") {
          if (block.statement) allContent.push(block.statement);
        }

        if (block.type === "text_input") {
          if (block.label) allContent.push(block.label);
          if (block.placeholder) allContent.push(`Indice: ${block.placeholder}`);
        }

        if (block.type === "image") {
          if (block.alt) allContent.push(`[Image: ${block.alt}]`);
          if (block.caption) allContent.push(block.caption);
        }
      });
    }
  });

  return allContent.filter((c) => c && c.length > 0).join("\n");
}

/** Page de détail exercice : le contenu (déjà purgé des réponses côté
 * serveur) et l'historique de tentatives arrivent en props quand id !==
 * "preview" (aperçu admin transmis via une ligne content_previews, cf. la
 * page serveur). */
export default function ExerciseDetailClient({
  exerciseId,
  initialExercise,
  initialAttemptsHistory,
  initialAlreadyCompleted,
}: {
  exerciseId: string;
  initialExercise: any | null;
  initialAttemptsHistory: any[];
  initialAlreadyCompleted: boolean;
}) {
  const router = useRouter();
  const { setPageContext, clearContext } = useAITutor();
  const isPreview = exerciseId === "preview";

  const [loading] = useState(false);
  const [exercise] = useState<any>(initialExercise);
  const [started, setStarted] = useState(false);
  const savedAttempts = isPreview ? [] : initialAttemptsHistory;
  const alreadyCompleted = isPreview ? false : initialAlreadyCompleted;
  const [attemptKey, setAttemptKey] = useState(0);
  const [forceNewAttempt, setForceNewAttempt] = useState(false);
  const [openCorrection, setOpenCorrection] = useState(false);
  // Parties terminées depuis l'ouverture de la page : elles s'ajoutent aux essais déjà enregistrés
  // (la liste serveur n'est relue qu'au rechargement), pour la limite de tentatives et « Refaire ».
  const [sessionAttempts, setSessionAttempts] = useState<{ score_percent: number | null; passed: boolean | null; pending?: boolean; completed_at: string }[]>([]);
  const attemptsHistory = [...savedAttempts, ...sessionAttempts];
  const attemptsUsed = attemptsHistory.length;
  const maxAttempts: number | null = exercise?.max_attempts ?? null;
  const limitReached = !!maxAttempts && attemptsUsed >= maxAttempts;
  const completedBefore = alreadyCompleted || sessionAttempts.length > 0;
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exercise) return;
    let questionText = extractExerciseContent(exercise.content_json);
    if (!questionText && (exercise.question || exercise.description)) {
      questionText = (exercise.question || exercise.description).slice(0, 1000);
    }
    const hints = (exercise.content_json?.hints || [])
      .map((h: any) => (typeof h === "string" ? h : h.text || h.hint || ""))
      .filter((h: string) => h.length > 0)
      .slice(0, 3);

    setPageContext({
      page: "exercise_detail",
      exerciseTitle: exercise.title || "Exercice sans titre",
      exerciseDifficulty: exercise.difficulty_level || "moyen",
      exerciseQuestion: questionText,
      exerciseType: exercise.type || "standard",
      exerciseHints: hints,
      courseTitle: exercise.courses?.title || exercise.course_title,
      courseSubject: exercise.courses?.subject || "Mathématiques",
      courseLevel: exercise.courses?.level || exercise.level,
    });
    return () => clearContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise]);

  // Load KaTeX for Math rendering on the landing page
  // Formules rendues en place, sans masquer la page (avant : opacité 0 puis 1,
  // la page « clignotait » à chaque mise à jour).
  useKatexIn(contentRef, [loading, exercise, started]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AppLoader />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">Exercice introuvable</h1>
        <Link href="/child/exercises" className="text-[var(--greek-gold)] hover:underline">
          Retour aux exercices
        </Link>
      </div>
    );
  }

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
          <h1 className="text-lg font-bold truncate flex-1">{exercise.title}</h1>
          <GlassCloseButton
            variant="dark"
            onClick={() => {
              if (isPreview) { window.close(); } else { setStarted(false); }
            }}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <ExerciseViewer
            key={attemptKey}
            exercise={exercise}
            forceNewAttempt={forceNewAttempt}
            openCorrection={openCorrection}
            onRestart={isPreview ? undefined : () => {
              if (limitReached) return;
              setOpenCorrection(false);
              setForceNewAttempt(true);
              setAttemptKey((k) => k + 1);
            }}
            restartBlocked={limitReached}
            bestScorePercent={attemptsHistory.length > 0 ? Math.max(...attemptsHistory.map((a) => a.score_percent ?? 0)) : undefined}
            onBack={() => setStarted(false)}
            onComplete={(score: number, total: number) => {
              // Correction manuelle : pas de note tant que l'enseignant n'a pas corrigé.
              if (exercise.grading_type === "manual") {
                setSessionAttempts((l) => [...l, { score_percent: null, passed: null, pending: true, completed_at: new Date().toISOString() }]);
                return;
              }
              const pct = total > 0 ? Math.round((score / total) * 100) : 100;
              setSessionAttempts((l) => [...l, { score_percent: pct, passed: pct >= passThreshold(exercise.min_score_percent), completed_at: new Date().toISOString() }]);
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
        <div className="relative h-64 md:h-80 bg-[var(--greek-cream)] relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-20 pattern-grid-lg"></div>
          <Brain className="w-24 h-24 text-[var(--greek-blue)] opacity-90 drop-shadow-lg" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
            <div className="p-8 text-white w-full">
              <div className="inline-block px-3 py-1 bg-[var(--greek-gold)] text-[var(--greek-blue)] text-xs font-bold rounded-full mb-3 shadow-md">
                {exercise.courses?.title || "Mathématiques"}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-display)] mb-2 text-shadow-sm">
                {exercise.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-grow">
              <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
                <Brain className="w-6 h-6 text-[var(--greek-gold)]" />
                Objectifs de l&apos;exercice
              </h2>
              <div className="prose max-w-none text-gray-600 leading-relaxed mb-6">
                {exercise.description || "Entraîne-toi sur ce sujet pour maîtriser tes compétences !"}
              </div>

              <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
                <h3 className="text-lg font-bold text-[var(--greek-blue)] mb-4">
                  Ce que tu vas pratiquer :
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Application directe du cours</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Résolution de problèmes concrets</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Auto-correction et feedback immédiat</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">Préparation aux évaluations supérieures</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full md:w-80 flex-shrink-0">
              <div className="bg-[var(--greek-cream)] rounded-xl p-6 border border-[rgba(197,161,72,0.25)] sticky top-24">
                <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-4 text-center">
                  Prêt à t&apos;entraîner ?
                </h3>

                {(() => {
                  return (
                    <GlassButton
                      onClick={() => {
                        if (limitReached) return;
                        setForceNewAttempt(completedBefore);
                        if (completedBefore) setAttemptKey((k) => k + 1);
                        setStarted(true);
                      }}
                      variant={limitReached ? "ghost" : "navy"}
                      fullWidth
                      className="text-lg mb-1"
                      style={limitReached ? { opacity: 0.6, pointerEvents: "none" } : undefined}
                    >
                      <Play className="w-6 h-6 fill-current" />
                      {limitReached ? "Tentatives épuisées" : completedBefore ? "Recommencer l'exercice" : "Commencer l'exercice"}
                    </GlassButton>
                  );
                })()}
                {!!exercise.max_attempts && (
                  <p className="text-xs text-gray-500 text-center mb-4">
                    {attemptsUsed}/{exercise.max_attempts} tentative{exercise.max_attempts > 1 ? "s" : ""} utilisée{attemptsUsed > 1 ? "s" : ""}
                  </p>
                )}
                {!exercise.max_attempts && <div className="mb-4" />}

                <div className="space-y-4 text-sm text-gray-600">
                  <div className="flex items-center justify-between border-b border-[rgba(197,161,72,0.25)] pb-2">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Durée estimée
                    </span>
                    <span className="font-bold">{exercise.estimated_time || 15} min</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[rgba(197,161,72,0.25)] pb-2">
                    <span className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4" /> Difficulté
                    </span>
                    <span className="font-bold text-[var(--greek-blue)]">{DIFFICULTY_LABELS[normalizeDifficulty(exercise.difficulty_level)].toUpperCase()}</span>
                  </div>
                </div>

                {attemptsHistory.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-[rgba(197,161,72,0.25)]">
                    <h4 className="text-sm font-bold text-[var(--greek-blue)] mb-3">Tes derniers essais</h4>
                    <div className="space-y-2">
                      {attemptsHistory.slice(-5).reverse().map((a, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-[rgba(197,161,72,0.15)]">
                          <span className="text-gray-500">
                            {a.completed_at ? new Date(a.completed_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={`font-bold ${a.pending ? "text-gray-400" : a.passed === false ? "text-red-500" : "text-green-600"}`}>
                              {a.pending ? "En attente" : `${a.score_percent ?? 0}%`}
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
