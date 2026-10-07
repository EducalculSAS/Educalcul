import { Award, BookOpen, Brain, CheckCircle2, TrendingUp } from "lucide-react";
import StreakFlame from "@/components/StreakFlame";
import type { Bulletin } from "@/lib/bulletin";
import { getCatalogLevelLabel } from "@/lib/constants";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function WeeklyChart({ weeks }: { weeks: Bulletin["weeks"] }) {
  const max = Math.max(4, ...weeks.map((w) => w.activities));
  const W = 560;
  const H = 150;
  const barW = 34;
  const gap = (W - barW * weeks.length) / (weeks.length + 1);
  return (
    <svg viewBox={`0 0 ${W} ${H + 46}`} className="w-full h-auto" role="img" aria-label="Activités par semaine">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} stroke="rgba(15,30,58,0.08)" />
      ))}
      {weeks.map((w, i) => {
        const x = gap + i * (barW + gap);
        const h = (w.activities / max) * (H - 18);
        return (
          <g key={w.label + i}>
            <rect x={x} y={H - h} width={barW} height={Math.max(h, w.activities > 0 ? 3 : 0)} rx="6" fill="#c5a148" opacity="0.85" />
            <text x={x + barW / 2} y={H - h - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f1e3a">{w.activities || ""}</text>
            <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize="10" fill="#64748b">{w.label}</text>
            <text x={x + barW / 2} y={H + 32} textAnchor="middle" fontSize="11" fontWeight="700" fill={w.avgScore === null ? "#cbd5e1" : w.avgScore >= 70 ? "#15803d" : w.avgScore >= 50 ? "#b45309" : "#dc2626"}>{w.avgScore === null ? "–" : `${w.avgScore} %`}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Bulletin : même rendu pour la page imprimable du parent et le lien de suivi en lecture seule. */
export default function BulletinView({ bulletin: b, shared = false }: { bulletin: Bulletin; shared?: boolean }) {
  const kpis = [
    { icon: CheckCircle2, label: "Activités (8 semaines)", value: b.kpis.activities },
    { icon: StreakFlame, label: "Série en cours", value: `${b.kpis.streak} j` },
    { icon: TrendingUp, label: "Réussite exercices", value: b.kpis.exerciseAvg === null ? "–" : `${b.kpis.exerciseAvg} %` },
    { icon: Brain, label: "Score moyen quiz", value: b.kpis.quizAvg === null ? "–" : `${b.kpis.quizAvg} %` },
    { icon: BookOpen, label: "Cours terminés", value: b.kpis.coursesDone },
    { icon: Award, label: "Badges", value: b.kpis.badges },
  ];

  return (
    <article className="bulletin-sheet bg-white text-[var(--text-dark,#1a1008)] mx-auto max-w-[820px] rounded-2xl border border-[rgba(197,161,72,0.3)] shadow-sm p-8 md:p-10">
      <header className="flex items-start justify-between gap-6 border-b-2 border-[var(--greek-gold)] pb-5 mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--greek-gold)]">Educalcul · Bulletin de suivi</p>
          <h1 className="text-3xl font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] mt-1">{b.child.firstName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {b.child.gradeLevel ? getCatalogLevelLabel(b.child.gradeLevel) : "Niveau non défini"} · édité le {fmtDate(b.generatedAt)}
          </p>
        </div>
        <p className="text-right text-xs text-gray-400 max-w-[190px]">Objectif : {b.goals.dailyGoal} activité{b.goals.dailyGoal > 1 ? "s" : ""} par jour{b.goals.weeklyTarget ? ` · cible semaine ${b.goals.weeklyTarget}` : ""}</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream,#faf7f2)]/60 p-4">
            {k.icon === StreakFlame ? <StreakFlame lit={b.kpis.streak > 0} count={b.kpis.streak} size={44} className="mb-1" /> : <k.icon className="w-4 h-4 text-[var(--greek-gold)] mb-1" />}
            <div className="text-2xl font-bold text-[var(--greek-blue)]">{k.value}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{k.label}</div>
          </div>
        ))}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-[var(--greek-blue)] mb-1">Évolution</h2>
        <p className="text-xs text-gray-500 mb-2">Activités terminées par semaine (barres) et score moyen de la semaine (en dessous).</p>
        <WeeklyChart weeks={b.weeks} />
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-[var(--greek-blue)] mb-3">Niveau par chapitre</h2>
        {b.chapters.length === 0 ? (
          <p className="text-sm text-gray-500">Pas encore de chapitre travaillé.</p>
        ) : (
          <ul className="space-y-2.5">
            {b.chapters.map((c) => (
              <li key={c.name} className="break-inside-avoid">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-gray-800 truncate">{c.name}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{c.done}/{c.courses} cours{c.avgScore !== null ? ` · ${c.avgScore} % aux exercices` : ""}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 mt-1 overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--greek-gold)]" style={{ width: `${Math.round((c.done / Math.max(1, c.courses)) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid md:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="text-lg font-bold text-green-700 mb-2">Points forts</h2>
          {b.strong.length ? <ul className="list-disc pl-5 text-sm space-y-1">{b.strong.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="text-sm text-gray-500">À venir : les points forts apparaissent au fil des séances avec Calia.</p>}
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--greek-bronze)] mb-2">À travailler</h2>
          {b.weak.length ? <ul className="list-disc pl-5 text-sm space-y-1">{b.weak.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="text-sm text-gray-500">Aucune notion fragile repérée pour le moment.</p>}
          <p className="text-xs text-gray-500 mt-3">Cahier d&apos;erreurs : {b.review.inBook} question{b.review.inBook > 1 ? "s" : ""} à revoir, {b.review.mastered} maîtrisée{b.review.mastered > 1 ? "s" : ""}.</p>
        </div>
      </section>

      <section className="rounded-xl bg-[var(--greek-cream,#faf7f2)] border border-[rgba(197,161,72,0.3)] p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--greek-blue)] mb-1">Observation</h2>
        <p className="text-sm leading-relaxed text-gray-700">{b.comment}</p>
      </section>

      <footer className="mt-8 pt-4 border-t border-gray-100 text-[11px] text-gray-400 flex justify-between gap-4">
        <span>educalcul.com{shared ? " · suivi partagé en lecture seule" : ""}</span>
        <span>Document généré automatiquement à partir de l&apos;activité de l&apos;élève.</span>
      </footer>
    </article>
  );
}
