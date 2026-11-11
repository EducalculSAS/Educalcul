"use client";

import { useEffect, useState } from "react";
import LoaderDots from "@/components/LoaderDots";
import { AlertCircle, CheckCircle2, Circle, GraduationCap } from "lucide-react";
import { getMyProfile } from "@/lib/updateMyProfile";
import GlassButton from "@/components/ui/GlassButton";
import GlassSwitch from "@/components/ui/GlassSwitch";
import { PREMIERE_TRACKS, TERMINALE_TRACKS, hasSpecialtyChoice, isTerminale, type TrackOption } from "@/lib/specialties";

type Mode = "promotion" | "specialties";

/**
 * Choix obligatoire (pas de fermeture) affiché à l'élève :
 * - « promotion » : il sort de Seconde (passage de classe automatique, voir
 *   gradePromotionRun.ts) et choisit sa voie de Première ;
 * - « specialties » : il est en Première ou Terminale et n'a pas encore
 *   indiqué ses spécialités (première connexion, ou entrée en Terminale).
 *   En Terminale, les maths expertes s'ajoutent à la spécialité maths.
 */
export default function ChildGradeChoiceModal() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [terminale, setTerminale] = useState(false);
  const [track, setTrack] = useState<string | null>(null);
  const [expertes, setExpertes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyProfile<{ role?: string; grade_level?: string; needs_grade_choice?: boolean; specialties_chosen_at?: string | null }>().then((p) => {
      if (!p || p.role !== "child") return;
      if (p.needs_grade_choice && p.grade_level === "2nde") setMode("promotion");
      else if (hasSpecialtyChoice(p.grade_level) && !p.specialties_chosen_at) {
        setTerminale(isTerminale(p.grade_level));
        // Présélection : la voie actuelle, pour qu'un simple « Valider » suffise.
        setTrack(p.grade_level === "terminale-generale-expertes" ? "terminale-generale-maths" : p.grade_level ?? null);
        setExpertes(p.grade_level === "terminale-generale-expertes");
        setMode("specialties");
      }
    });
  }, []);

  if (!mode) return null;

  const options: TrackOption[] = mode === "promotion" || !terminale ? PREMIERE_TRACKS : TERMINALE_TRACKS;
  const title = mode === "promotion" ? "Tu passes en Première !" : terminale ? "Tes maths en Terminale" : "Tes maths en Première";

  const submit = async () => {
    if (!track) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(mode === "promotion" ? "/api/child/choose-grade" : "/api/child/specialties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "promotion" ? { choice: track } : { track, expertes: terminale && track === "terminale-generale-maths" && expertes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Une erreur est survenue.");
      // Le catalogue dépend de ce choix : on recharge pour l'afficher à jour.
      window.location.reload();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm overlay-enter">
      <div role="dialog" aria-modal="true" aria-labelledby="grade-choice-title" className="dialog-enter w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white/95 backdrop-blur-[24px] shadow-2xl border border-[rgba(197,161,72,0.3)] p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-[rgba(197,161,72,0.14)]">
            <GraduationCap className="w-5 h-5 text-[var(--greek-gold)]" />
          </span>
          <h2 id="grade-choice-title" className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">{title}</h2>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          {mode === "promotion"
            ? "Choisis ta voie pour l'année prochaine. Demande à un adulte si tu n'es pas sûr."
            : "Indique ce que tu suis en maths cette année : tes cours, exercices et quiz s'adaptent à ton choix."}
        </p>

        {error && (
          <p className="flex items-center gap-2 px-3 py-2 mb-4 rounded-xl text-sm font-medium bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}

        <div className="space-y-2.5" role="radiogroup" aria-label="Ta voie en maths">
          {options.map((o) => {
            const on = track === o.level;
            return (
              <button
                key={o.level}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTrack(o.level)}
                className={`w-full text-left rounded-2xl border p-4 flex gap-3 transition-all ${on ? "border-[var(--greek-blue)] bg-[rgba(15,30,58,0.04)] shadow-sm" : "border-[rgba(197,161,72,0.3)] hover:bg-[var(--greek-cream)]"}`}
              >
                {on ? <CheckCircle2 className="w-5 h-5 text-[var(--greek-blue)] shrink-0 mt-0.5" /> : <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />}
                <span>
                  <span className="block font-semibold text-[var(--greek-blue)]">{o.label}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{o.detail}</span>
                </span>
              </button>
            );
          })}
        </div>

        {mode === "specialties" && terminale && track === "terminale-generale-maths" && (
          <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[rgba(197,161,72,0.3)] p-4 cursor-pointer">
            <span>
              <span className="block font-semibold text-[var(--greek-blue)]">Je suis aussi l&apos;option maths expertes</span>
              <span className="block text-xs text-gray-500 mt-0.5">Tu verras les deux programmes.</span>
            </span>
            <GlassSwitch checked={expertes} onChange={setExpertes} label="Option maths expertes" />
          </label>
        )}

        <p className="text-xs text-[var(--text-muted)] mt-4">Ensuite, seul un parent ou l&apos;équipe Educalcul pourra modifier ce choix.</p>
        <div className="mt-5 flex justify-end">
          <GlassButton variant="navy" onClick={submit} disabled={!track || submitting}>
            {submitting && <LoaderDots />} Valider mon choix
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
