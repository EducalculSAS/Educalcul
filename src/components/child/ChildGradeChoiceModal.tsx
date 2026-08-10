"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { GraduationCap, Loader2, AlertCircle, X } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

const CHOICES = [
  { value: "1ere-generale", label: "Première Générale", detail: "Sans spécialité mathématiques" },
  { value: "1ere-generale-maths", label: "Première Générale", detail: "Avec spécialité mathématiques" },
];

/**
 * Popup obligatoire (pas de fermeture possible) affiché à un élève dont le
 * niveau est passé de Seconde à "en attente de choix" lors du passage de
 * classe automatique (voir gradePromotionRun.ts).
 */
export default function ChildGradeChoiceModal() {
  const [needsChoice, setNeedsChoice] = useState(false);
  const [pending, setPending] = useState<string | null>(null); // choix sélectionné, en attente de confirmation
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("users")
        .select("grade_level, needs_grade_choice")
        .eq("auth_id", session.user.id)
        .maybeSingle();
      if (data?.needs_grade_choice && data.grade_level === "2nde") {
        setNeedsChoice(true);
      }
    })();
  }, []);

  const confirmChoice = async () => {
    if (!pending) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/child/choose-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice: pending }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setNeedsChoice(false);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!needsChoice) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(15,30,58,0.55)" }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-8 border border-[rgba(197,161,72,0.25)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(197,161,72,0.12)" }}>
            <GraduationCap className="w-5 h-5" style={{ color: "var(--greek-gold)" }} />
          </div>
          <h2 className="text-xl font-bold text-[var(--greek-blue)]">Tu passes en Première !</h2>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Choisis ta voie pour l'année prochaine. Ce choix est important : demande à un adulte si tu n'es pas sûr.
        </p>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg text-sm font-medium bg-red-50 text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!pending ? (
          <div className="space-y-3">
            {CHOICES.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setPending(c.value)}
                className="w-full text-left px-4 py-3 border border-[rgba(197,161,72,0.25)] rounded-xl hover:border-[var(--greek-blue)] hover:bg-blue-50 transition-colors"
              >
                <p className="font-bold text-[var(--greek-blue)]">{c.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.detail}</p>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 mb-5">
              <p className="text-sm text-amber-800">
                Confirmer : <strong>{CHOICES.find(c => c.value === pending)?.label} — {CHOICES.find(c => c.value === pending)?.detail}</strong> ?
                Seul un administrateur pourra changer ce choix ensuite.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <GlassButton
                onClick={confirmChoice}
                variant="navy" size="sm" fullWidth
                style={submitting ? { opacity: 0.5, pointerEvents: "none" } : undefined}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmer mon choix"}
              </GlassButton>
              <GlassButton
                onClick={() => setPending(null)}
                variant="ghost" size="sm"
                style={submitting ? { opacity: 0.5, pointerEvents: "none" } : undefined}
              >
                <X className="w-4 h-4" /> Retour
              </GlassButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
