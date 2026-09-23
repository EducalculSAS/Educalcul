"use client";

import { useState } from "react";
import { BookOpen, CalendarCheck, CheckSquare, Loader2, Sparkles, Square, Target, TrendingUp } from "lucide-react";
import GlassDialog from "@/components/ui/GlassDialog";
import GlassButton from "@/components/ui/GlassButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { longDate } from "./calendarUtils";

interface Proposal {
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_min: number;
  title: string;
  description: string;
  reason: string;
  course_id: number;
  course_title: string;
  event_type: string;
}

interface PlanResponse {
  summary: string;
  sessions: Proposal[];
  basis?: { coursesAnalyzed: number; toConsolidate: number; upcomingTests: number; weakNotions: number };
  error?: string;
}

/**
 * Plan de révision proposé par l'IA à partir de l'activité réelle de l'élève.
 * Rien n'est ajouté sans validation : chaque séance est visible (date,
 * horaire, cours, raison), on décoche ce qu'on ne veut pas, puis on ajoute.
 */
export default function AiPlanDialog({
  studentName, childId, onClose, onAccept,
}: {
  studentName: string;
  /** Parent : l'enfant concerné. Élève : non renseigné (lui-même). */
  childId?: number;
  onClose: () => void;
  onAccept: (sessions: Proposal[]) => Promise<boolean>;
}) {
  const [horizon, setHorizon] = useState("14");
  const [focus, setFocus] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, horizonDays: Number(horizon), focus }),
      });
      const data: PlanResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Le plan n'a pas pu être généré.");
      setPlan(data);
      setSelected(new Set(data.sessions.map((_, i) => i)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  const accept = async () => {
    if (!plan) return;
    setSaving(true);
    const ok = await onAccept(plan.sessions.filter((_, i) => selected.has(i)));
    if (!ok) setSaving(false);
  };

  return (
    <GlassDialog
      title={`Plan de révision — ${studentName}`}
      onClose={onClose}
      wide
      footer={
        plan && plan.sessions.length > 0 ? (
          <>
            <GlassButton variant="ghost" size="sm" onClick={() => setPlan(null)}>Refaire un plan</GlassButton>
            <GlassButton variant="navy" size="sm" onClick={accept} disabled={saving || selected.size === 0}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
              Ajouter {selected.size} séance{selected.size > 1 ? "s" : ""} au calendrier
            </GlassButton>
          </>
        ) : undefined
      }
    >
      {!plan ? (
        <div className="space-y-5">
          <p className="text-sm text-[var(--text-muted)]">
            Calia analyse les résultats aux exercices et aux quiz, les cours en cours, les notions fragiles repérées en séance,
            les contrôles déjà notés et les habitudes de travail, puis propose des séances ciblées. Tu choisis ensuite ce que tu gardes.
          </p>
          <div>
            <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-2">Sur combien de temps ?</span>
            <GlassSegmentedControl
              size="sm"
              value={horizon}
              onChange={setHorizon}
              options={[{ id: "7", label: "1 semaine" }, { id: "14", label: "2 semaines" }, { id: "28", label: "4 semaines" }]}
            />
          </div>
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Une priorité ? <span className="font-normal text-[var(--text-muted)]">(facultatif)</span></span>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value.slice(0, 200))}
              placeholder="Ex. contrôle de géométrie vendredi, plutôt le mercredi après-midi…"
              className="w-full px-4 py-2.5 rounded-xl border border-[rgba(197,161,72,0.3)] bg-white text-sm outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25"
            />
          </label>
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex justify-end">
            <GlassButton variant="navy" size="sm" onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Analyse en cours…" : "Construire le plan"}
            </GlassButton>
          </div>
        </div>
      ) : (
        <div className="space-y-4 pb-2">
          {plan.summary && (
            <div className="rounded-2xl bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.3)] p-4 flex gap-3">
              <TrendingUp className="w-5 h-5 text-[var(--greek-gold)] shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--greek-blue)]">{plan.summary}</p>
            </div>
          )}
          {plan.basis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                { n: plan.basis.coursesAnalyzed, l: "cours analysés" },
                { n: plan.basis.toConsolidate, l: "à consolider" },
                { n: plan.basis.upcomingTests, l: "contrôles à venir" },
                { n: plan.basis.weakNotions, l: "notions fragiles" },
              ].map((b) => (
                <div key={b.l} className="rounded-xl border border-[rgba(197,161,72,0.2)] bg-white py-2">
                  <p className="text-lg font-bold text-[var(--greek-blue)] tabular-nums">{b.n}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{b.l}</p>
                </div>
              ))}
            </div>
          )}
          {plan.sessions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">
              Pas de séance à proposer pour l&apos;instant : il faut un peu plus d&apos;activité (exercices, quiz) pour cibler les révisions.
            </p>
          ) : (
            <ul className="space-y-2">
              {plan.sessions.map((s, i) => {
                const on = selected.has(i);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      aria-pressed={on}
                      className={`w-full text-left rounded-2xl border p-4 flex gap-3 transition-colors ${on ? "border-[var(--greek-gold)] bg-white" : "border-[rgba(15,30,58,0.1)] bg-gray-50 opacity-70"}`}
                    >
                      {on ? <CheckSquare className="w-5 h-5 text-[var(--greek-blue)] shrink-0" /> : <Square className="w-5 h-5 text-gray-400 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--greek-bronze)] first-letter:uppercase">
                          {longDate(s.start_date)}{s.start_time ? ` · ${s.start_time}` : ""} · {s.duration_min} min
                        </p>
                        <p className="font-semibold text-[var(--greek-blue)]">{s.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{s.description}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-2 inline-flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> {s.course_title}</p>
                        {s.reason && <p className="text-xs text-[var(--greek-bronze)] mt-1 inline-flex items-start gap-1.5"><Target className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {s.reason}</p>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </GlassDialog>
  );
}
