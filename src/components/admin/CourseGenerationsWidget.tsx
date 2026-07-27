"use client";

import { useState } from "react";
import { ChevronDown, Loader2, CheckCircle2, XCircle, X } from "lucide-react";
import { useCourseGenerations, type CourseGeneration } from "@/contexts/CourseGenerationsContext";
import { useSmoothPercentByKey } from "./useSmoothPercent";
import CourseGenerationFullModal from "./CourseGenerationFullModal";

function GenerationRow({
  generation,
  onFocus,
  onCancel,
  onDismiss,
}: {
  generation: CourseGeneration;
  onFocus: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const isActive =
    generation.status === "pending" ||
    generation.status === "running" ||
    generation.status === "cancel_requested";
  // Même clé (id de génération) que la modale complète : la barre continue
  // de progresser normalement, jamais de retour à 0 en rouvrant la modale.
  const pct = useSmoothPercentByKey(
    generation.id,
    generation.progress.current,
    generation.progress.total,
    isActive,
  );

  return (
    <div
      className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer group"
      onClick={onFocus}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800 truncate">
          {(generation.params.subject as string) || "Cours"}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {generation.status === "done" && <CheckCircle2 size={14} className="text-emerald-500" />}
          {generation.status === "error" && <XCircle size={14} className="text-red-500" />}
          {isActive ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
              title="Annuler"
            >
              <X size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
              title="Retirer de la liste"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      {isActive ? (
        <div className="mt-1.5 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(3, pct)}%`,
              background: "linear-gradient(to right, var(--greek-blue), var(--greek-gold))",
            }}
          />
        </div>
      ) : (
        <p className="text-xs text-gray-400 mt-0.5">
          {generation.status === "done"
            ? "Terminé"
            : generation.status === "cancelled"
              ? "Annulé"
              : "Erreur"}
        </p>
      )}
    </div>
  );
}

/**
 * Pastille persistante en haut à droite, visible sur tout l'admin : liste
 * les générations de cours en cours (ou tout juste finies) même après un
 * rechargement de page, puisque le travail tourne côté serveur. Cliquer sur
 * une ligne rouvre sa modale complète (voir CourseGenerationFullModal).
 */
export default function CourseGenerationsWidget() {
  const { generations, focusedId, focus, cancelGeneration, dismiss } = useCourseGenerations();
  const [open, setOpen] = useState(false);

  const active = generations.filter(
    (g) => g.status === "pending" || g.status === "running" || g.status === "cancel_requested",
  );
  const visible = generations.slice(0, 8);

  if (generations.length === 0) return null;

  return (
    <>
      <div className="fixed top-4 right-4 z-[1400]">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full bg-white shadow-lg border border-[rgba(197,161,72,0.3)] px-4 py-2 text-sm font-semibold text-[var(--greek-blue)] hover:shadow-xl transition-shadow"
          >
            {active.length > 0 ? (
              <Loader2 size={16} className="animate-spin text-[var(--greek-gold)]" />
            ) : (
              <CheckCircle2 size={16} className="text-emerald-500" />
            )}
            {active.length > 0
              ? `Génération${active.length > 1 ? "s" : ""} en cours (${active.length})`
              : "Générations récentes"}
            <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl shadow-2xl border border-[rgba(197,161,72,0.25)] py-2">
              {visible.map((g) => (
                <GenerationRow
                  key={g.id}
                  generation={g}
                  onFocus={() => {
                    focus(g.id);
                    setOpen(false);
                  }}
                  onCancel={() => cancelGeneration(g.id)}
                  onDismiss={() => dismiss(g.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {focusedId && <CourseGenerationFullModal />}
    </>
  );
}
