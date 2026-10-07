import type { ReactNode } from "react";
import { BookOpen, Bell, CheckCircle, Target, TrendingUp } from "lucide-react";
import StreakFlame from "@/components/StreakFlame";

const DAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"];

export interface FamilyCardData {
  avatar: ReactNode;
  name: string;
  username?: string;
  level: string;
  status: { text: string; dot: string };
  today: number;
  dailyGoal: number;
  streak: number;
  exerciseCount?: number;
  successRate?: number;
  last7: { day: string; count: number }[];
  weekTotal: number;
  weeklyTarget: number | null;
  /** Niveau par chapitre (aperçu de l'accueil) ; `chaptersReady` déclenche le remplissage animé des barres. */
  chapters?: { label: string; pct: number; color: string }[];
  chaptersReady?: boolean;
  lastActivity?: { type: string; title: string; relativeTime: string } | null;
  alert?: { text: string; tone: "gold" | "green" | "warn" };
  /** Bloc supplémentaire sous la semaine (« Réglages et suivi » dans Mes enfants). */
  extra?: ReactNode;
  footer: ReactNode;
}

/** Anneau de l'objectif du jour. */
function GoalRing({ done, goal }: { done: number; goal: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const pct = Math.min(1, done / Math.max(1, goal));
  const reached = done >= goal;
  return (
    <div className="relative w-[92px] h-[92px] shrink-0" role="img" aria-label={`Objectif du jour : ${done} sur ${goal}`}>
      <svg viewBox="0 0 92 92" className="w-full h-full -rotate-90" aria-hidden>
        <circle cx="46" cy="46" r={R} fill="none" stroke="rgba(197,161,72,0.2)" strokeWidth="9" />
        <circle cx="46" cy="46" r={R} fill="none" stroke={reached ? "#16a34a" : "#c5a148"} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-2xl font-bold text-[var(--greek-blue)]">{done}</span>
        <span className="text-[10px] font-semibold text-gray-400 mt-0.5">sur {goal}</span>
      </div>
    </div>
  );
}

/**
 * La fiche « verre liquide » d'un enfant : bandeau bleu nuit, anneau d'objectif, flamme de série animée, graphique des
 * 7 jours. Utilisée par la vraie fiche (tableau de bord parent, Mes enfants) ET par l'aperçu de l'accueil : un seul dessin.
 */
export default function FamilyCardShell({ d }: { d: FamilyCardData }) {
  const reached = d.today >= d.dailyGoal;
  const maxDay = Math.max(1, ...d.last7.map((x) => x.count), d.dailyGoal);
  const weekPct = d.weeklyTarget ? Math.min(100, Math.round((d.weekTotal / d.weeklyTarget) * 100)) : Math.min(100, d.weekTotal * 10);
  const alert = d.alert && (d.alert.tone === "gold" ? { bg: "rgba(197,161,72,0.15)", fg: "#8a6d1f" } : d.alert.tone === "green" ? { bg: "rgba(22,163,74,0.12)", fg: "#15803d" } : { bg: "rgba(220,38,38,0.1)", fg: "#b91c1c" });

  return (
    <article className="family-card" data-reached={reached ? "true" : "false"}>
      <header className="family-card-head">
        <div className="flex items-center gap-3">
          {d.avatar}
          <div className="min-w-0 flex-1">
            <h3 className="font-[family-name:var(--font-display)] font-bold text-lg leading-tight truncate">{d.name}</h3>
            {d.username && <p className="text-xs opacity-60">@{d.username}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: "rgba(197,161,72,0.95)", color: "#0f1e3a" }}>{d.level}</span>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold opacity-90">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.status.dot, boxShadow: `0 0 8px ${d.status.dot}` }} />
                {d.status.text}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 flex-grow space-y-3">
        <div className="family-glass p-3.5 flex items-center gap-4">
          <GoalRing done={d.today} goal={d.dailyGoal} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Objectif du jour</p>
            <p className={`text-sm font-bold mb-1.5 ${reached ? "text-green-600" : "text-[var(--greek-blue)]"}`}>{reached ? "Atteint, bravo !" : `Encore ${d.dailyGoal - d.today} activité${d.dailyGoal - d.today > 1 ? "s" : ""}`}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs whitespace-nowrap">
              <StreakFlame lit={d.streak > 0} count={d.streak} size={52} />
              {d.exerciseCount !== undefined && <span className="flex items-center gap-1 text-gray-600"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> {d.exerciseCount}</span>}
              {d.successRate !== undefined && <span className="flex items-center gap-1 text-gray-600"><TrendingUp className="w-3.5 h-3.5 text-[var(--greek-gold)]" /> {d.successRate} %</span>}
            </div>
          </div>
        </div>

        {d.chapters && (
          <div className="family-glass p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2.5">Niveau par chapitre</p>
            {d.chapters.map((c, i) => (
              <div key={c.label} className="mb-2 last:mb-0">
                <div className="flex justify-between mb-1 text-xs">
                  <span className="text-gray-600">{c.label}</span>
                  <span className="font-bold tabular-nums" style={{ color: c.color }}>{d.chaptersReady === false ? 0 : c.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[rgba(15,30,58,0.08)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: d.chaptersReady === false ? "0%" : `${c.pct}%`, background: c.color, transition: "width 1100ms cubic-bezier(0.16,1,0.3,1)", transitionDelay: `${i * 90}ms` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="family-glass p-3.5">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Cette semaine</p>
            <p className="text-xs font-bold text-[var(--greek-blue)]">{d.weekTotal}{d.weeklyTarget ? ` / ${d.weeklyTarget}` : ""}</p>
          </div>
          <div className="flex items-end justify-between gap-1.5 h-12" aria-label="Activité des 7 derniers jours">
            {d.last7.map((x) => (
              <div key={x.day} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${x.day} : ${x.count} activité${x.count > 1 ? "s" : ""}`}>
                <div className="w-full rounded-md" style={{ height: `${Math.max(x.count > 0 ? 18 : 6, Math.round((x.count / maxDay) * 100))}%`, background: x.count >= d.dailyGoal ? "linear-gradient(180deg,#4ade80,#16a34a)" : x.count > 0 ? "linear-gradient(180deg,#e0c068,#c5a148)" : "rgba(15,30,58,0.1)" }} />
                <span className="text-[9px] font-semibold text-gray-400 leading-none">{DAY_LETTER[new Date(`${x.day}T12:00:00Z`).getUTCDay()]}</span>
              </div>
            ))}
          </div>
          {d.weeklyTarget && (
            <div className="h-1.5 rounded-full bg-[rgba(15,30,58,0.08)] overflow-hidden mt-2.5">
              <div className="h-full rounded-full" style={{ width: `${weekPct}%`, background: "linear-gradient(90deg,#e0c068,#c5a148)" }} />
            </div>
          )}
        </div>

        {d.lastActivity && (
          <div className="flex items-center gap-2.5 px-1">
            <div className={`p-1.5 rounded-lg shrink-0 ${d.lastActivity.type === "Quiz" ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"}`}>
              {d.lastActivity.type === "Quiz" ? <CheckCircle className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{d.lastActivity.title}</p>
              <p className="text-xs text-gray-400">{d.lastActivity.relativeTime}</p>
            </div>
          </div>
        )}

        {alert && d.alert && (
          <p className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5" style={{ background: alert.bg, color: alert.fg }}>
            <Bell className="w-3.5 h-3.5 shrink-0" /> {d.alert.text}
          </p>
        )}

        {d.extra}
      </div>

      <footer className="family-foot">{d.footer}</footer>
    </article>
  );
}
