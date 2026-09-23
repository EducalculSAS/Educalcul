"use client";

import { BrainCircuit, Minus, Sparkles, X, Check } from "lucide-react";
import { useContentGenerations, type ContentKind } from "@/contexts/ContentGenerationsContext";
import { useSmoothPercentByKey } from "./useSmoothPercent";
import GlassButton from "@/components/ui/GlassButton";

const KIND_LABEL: Record<ContentKind, { noun: string; created: string }> = {
  course: { noun: "cours", created: "Le cours a été enregistré directement en brouillon" },
  exercise: { noun: "exercice", created: "L'exercice a été enregistré directement en brouillon" },
  quiz: { noun: "quiz", created: "Le quiz a été enregistré directement en brouillon" },
};

/**
 * Vue "plein écran" d'UNE génération (cours, exercice ou quiz) en cours,
 * pilotée par le contexte global (survit au reload puisque le vrai travail
 * tourne en arrière-plan côté serveur). La croix ne ferme jamais la
 * génération : elle la réduit dans le widget en haut à droite. Seul le
 * bouton "Annuler" l'arrête réellement.
 */
export default function ContentGenerationFullModal() {
  const { generations, focusedId, minimize, cancelGeneration, dismiss } = useContentGenerations();
  const generation = generations.find((g) => g.id === focusedId);
  const smoothPct = useSmoothPercentByKey(
    generation?.id ?? null,
    generation?.progress.current ?? 0,
    generation?.progress.total ?? 0,
    !!generation && (generation.status === "pending" || generation.status === "running"),
  );

  if (!generation) return null;

  const label = KIND_LABEL[generation.kind];
  const isFinished = ["done", "error", "cancelled"].includes(generation.status);
  const chapterTitles = generation.progress.chapterTitles || [];
  const doneChapters = generation.progress.chapters || {};

  return (
    <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200">
        <div
          className="px-8 py-6 text-white flex justify-between items-center relative overflow-hidden flex-shrink-0"
          style={{ background: "linear-gradient(to right, var(--greek-blue), #1e3a8a)" }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm flex-shrink-0">
              <Sparkles className="text-[var(--greek-gold)]" size={24} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold font-[family-name:var(--font-display)] tracking-wide truncate">
                {(generation.params.subject as string) || `Génération de ${label.noun}`}
              </h3>
              <p className="text-blue-100 text-sm opacity-90">
                {isFinished ? "Terminé" : "Génération en cours — continue même si tu quittes cette fenêtre"}
              </p>
            </div>
          </div>
          <button
            onClick={isFinished ? () => dismiss(generation.id) : minimize}
            className="group text-white/70 hover:text-white transition-colors p-2 relative z-10 flex-shrink-0"
            aria-label={isFinished ? "Fermer" : "Réduire"}
            title={isFinished ? "Fermer" : "Réduire (la génération continue en arrière-plan)"}
          >
            {isFinished ? (
              <X size={22} className="transition-transform group-hover:scale-125" />
            ) : (
              <Minus size={22} className="transition-transform group-hover:scale-125" />
            )}
          </button>
        </div>

        <div className="p-12 flex flex-col items-center justify-center min-h-[400px] bg-gray-50 flex-1">
          {generation.status === "error" ? (
            <>
              <h4 className="text-xl font-bold text-red-700 mb-2 font-[family-name:var(--font-display)]">
                Erreur de génération
              </h4>
              <p className="text-gray-600 text-center max-w-md">{generation.error}</p>
            </>
          ) : generation.status === "cancelled" ? (
            <>
              <h4 className="text-xl font-bold text-gray-700 mb-2 font-[family-name:var(--font-display)]">
                Génération annulée
              </h4>
              <p className="text-gray-500 text-center max-w-md">
                Tu as annulé cette génération avant sa fin.
              </p>
            </>
          ) : generation.status === "done" ? (
            <>
              <h4 className="text-xl font-bold text-emerald-700 mb-2 font-[family-name:var(--font-display)]">
                {generation.kind === "course" ? "Cours créé !" : generation.kind === "exercise" ? "Exercice créé !" : "Quiz créé !"}
              </h4>
              <p className="text-gray-600 text-center max-w-md">
                {label.created} — retrouve-le dans la liste.
              </p>
              {generation.error && (
                <p className="text-amber-600 text-sm text-center max-w-md mt-3">{generation.error}</p>
              )}
            </>
          ) : (
            <>
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-[var(--greek-blue)] opacity-20 blur-xl rounded-full animate-pulse" />
                <BrainCircuit size={64} className="text-[var(--greek-blue)] relative z-10 animate-bounce" />
              </div>
              <h4 className="text-xl font-bold text-gray-800 mb-2 font-[family-name:var(--font-display)]">
                {generation.status === "cancel_requested" ? "Annulation en cours..." : "Création en cours..."}
              </h4>
              <p className="text-gray-500 text-center max-w-md mb-6">
                {generation.progress.message || `Notre IA pédagogique compose ton ${label.noun} avec soin.`}
              </p>

              {generation.progress.total > 0 && (
                <div className="w-full max-w-md">
                  <div className="flex justify-between text-xs font-bold text-[var(--greek-blue)] mb-1.5">
                    <span>Progression</span>
                    <span>{Math.round(smoothPct)}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(3, smoothPct)}%`,
                        background: "linear-gradient(to right, var(--greek-blue), var(--greek-gold))",
                      }}
                    />
                  </div>

                  {chapterTitles.length > 0 && (
                    <ul className="mt-5 space-y-1.5 text-left">
                      {chapterTitles.map((title, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                              doneChapters[idx]
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            {doneChapters[idx] ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : idx + 1}
                          </span>
                          <span className="truncate">{title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {generation.status !== "cancel_requested" && (
                <GlassButton
                  size="sm"
                  variant="danger"
                  onClick={() => cancelGeneration(generation.id)}
                  className="mt-8"
                >
                  Annuler la génération
                </GlassButton>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
