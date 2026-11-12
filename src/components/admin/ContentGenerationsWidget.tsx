"use client";

import { useState } from "react";
import { ChevronDown, Loader2, CheckCircle2, XCircle, X, BookOpen, PencilLine, ListChecks } from "lucide-react";
import { useContentGenerations, type ContentGeneration, type ContentKind } from "@/contexts/ContentGenerationsContext";
import { useSmoothPercentByKey } from "./useSmoothPercent";
import ContentGenerationFullModal from "./ContentGenerationFullModal";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";

const KIND_ICON: Record<ContentKind, React.ElementType> = {
  course: BookOpen,
  exercise: PencilLine,
  quiz: ListChecks,
};
const KIND_FALLBACK_LABEL: Record<ContentKind, string> = {
  course: "Cours",
  exercise: "Exercice",
  quiz: "Quiz",
};

function GenerationRow({
  generation,
  onFocus,
  onCancel,
  onDismiss,
}: {
  generation: ContentGeneration;
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
  const Icon = KIND_ICON[generation.kind];

  return (
    <div
      className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer group"
      onClick={onFocus}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800 truncate min-w-0">
          <Icon size={13} className="text-[var(--greek-gold)] flex-shrink-0" />
          <span className="truncate">
            {(generation.params.subject as string) || KIND_FALLBACK_LABEL[generation.kind]}
          </span>
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {generation.status === "done" && <CheckCircle2 size={14} className="text-emerald-500" aria-label="Terminé" />}
          {generation.status === "error" && <XCircle size={14} className="text-red-500" aria-label="Erreur" />}
          {isActive ? (
            <span onClick={(e) => e.stopPropagation()}>
              <GlassIconButton icon={X} color="red" size="sm" onClick={onCancel} aria-label="Annuler la génération" />
            </span>
          ) : (
            <span onClick={(e) => e.stopPropagation()}>
              <GlassIconButton icon={X} color="gray" size="sm" onClick={onDismiss} aria-label="Retirer de la liste" />
            </span>
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
 * Pastille persistante en haut à droite (conteneur dans AdminShell), visible sur tout l'admin : liste
 * les générations (cours, exercices, quiz) en cours ou tout juste finies,
 * même après un rechargement de page, puisque le travail tourne côté
 * serveur. Cliquer sur une ligne rouvre sa modale complète.
 */
export default function ContentGenerationsWidget() {
  const { generations, focusedId, focus, cancelGeneration, dismiss } = useContentGenerations();
  const [open, setOpen] = useState(false);

  const active = generations.filter(
    (g) => g.status === "pending" || g.status === "running" || g.status === "cancel_requested",
  );
  const visible = generations.slice(0, 8);

  if (generations.length === 0) return null;

  return (
    <>
      <div>
        <div className="relative">
          <GlassButton variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
            {active.length > 0 ? (
              <Loader2 size={16} className="animate-spin text-[var(--greek-gold)]" />
            ) : (
              <CheckCircle2 size={16} className="text-emerald-500" />
            )}
            {active.length > 0
              ? `Génération${active.length > 1 ? "s" : ""} en cours (${active.length})`
              : "Générations récentes"}
            <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </GlassButton>

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

      {focusedId && <ContentGenerationFullModal />}
    </>
  );
}
