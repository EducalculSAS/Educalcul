"use client";

import { useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { SCHOOL_LEVELS, getLevelLabel } from "@/lib/constants";
import { EXPERTES_LEVEL, hasSpecialtyChoice } from "@/lib/specialties";

/**
 * Niveaux visibles par un élève : sa classe principale + des niveaux en plus
 * (ex. revoir la Première spé en Terminale), attribués ici — en général sur
 * demande d'un parent. L'option maths expertes apparaît aussi ici quand
 * l'élève l'a choisie.
 */
export default function ChildLevelsCard({
  userId, gradeLevel, initialExtras, specialtiesChosenAt, onDone,
}: {
  userId: number;
  gradeLevel: string | null;
  initialExtras: string[];
  specialtiesChosenAt: string | null;
  onDone: (type: "success" | "error", text: string) => void;
}) {
  const [extras, setExtras] = useState<string[]>(initialExtras);
  const [saved, setSaved] = useState<string[]>(initialExtras);
  const [saving, setSaving] = useState(false);
  const dirty = extras.slice().sort().join() !== saved.slice().sort().join();

  const toggle = (level: string) =>
    setExtras((l) => (l.includes(level) ? l.filter((x) => x !== level) : [...l, level]));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/user-detail?id=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extra_levels: extras }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible");
      setExtras(data.extra_levels ?? extras);
      setSaved(data.extra_levels ?? extras);
      onDone("success", "Niveaux visibles mis à jour.");
    } catch (e) {
      onDone("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
        <GraduationCap className="w-4 h-4" /> Niveaux visibles
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Classe principale : <strong className="text-[var(--greek-blue)]">{gradeLevel ? getLevelLabel(gradeLevel) : "-"}</strong>.
        {hasSpecialtyChoice(gradeLevel) && (specialtiesChosenAt ? " Spécialités confirmées." : " Spécialités pas encore choisies (demandées à la prochaine connexion).")}
        {" "}Cochez les niveaux à afficher en plus.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SCHOOL_LEVELS.filter((l) => l.value !== gradeLevel).map((l) => {
          const on = extras.includes(l.value);
          return (
            <button
              key={l.value}
              type="button"
              onClick={() => toggle(l.value)}
              aria-pressed={on}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${on ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]" : "border-[rgba(197,161,72,0.35)] text-[var(--greek-blue)] hover:bg-[var(--greek-cream)]"}`}
            >
              {l.label}
              {l.value === EXPERTES_LEVEL && on ? " · option" : ""}
            </button>
          );
        })}
      </div>
      {dirty && (
        <div className="mt-3 flex justify-end gap-2">
          <GlassButton size="sm" variant="ghost" onClick={() => setExtras(saved)}>Annuler</GlassButton>
          <GlassButton size="sm" variant="navy" onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
          </GlassButton>
        </div>
      )}
    </div>
  );
}
