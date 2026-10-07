import Link from "next/link";
import { BookOpen, CalendarClock, CheckCircle, FileText, Flame, GraduationCap, Moon, Target, TrendingUp } from "lucide-react";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import ChildReportLink from "@/components/parent/ChildReportLink";
import DeleteChildButton from "@/components/parent/DeleteChildButton";
import GlassButton from "@/components/ui/GlassButton";
import EditChildButton from "@/components/parent/EditChildButton";
import { getCatalogLevelLabel } from "@/lib/constants";
import { relativeTime } from "@/lib/relativeTime";
import type { FamilyEntry } from "@/lib/familyOverview";

const fmtDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
const DAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"];

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
        <circle cx="46" cy="46" r={R} fill="none" stroke={reached ? "#16a34a" : "#c5a148"} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-2xl font-bold text-[var(--greek-blue)]">{done}</span>
        <span className="text-[10px] font-semibold text-gray-400 mt-0.5">sur {goal}</span>
      </div>
    </div>
  );
}

/**
 * Fiche d'un enfant en « verre liquide » : la MÊME dans le tableau de bord (« overview ») et dans « Mes enfants »
 * (« manage »), qui ajoute l'identifiant, les réglages en cours et les actions (modifier, supprimer).
 */
export default function ChildFamilyCard({ entry, variant }: { entry: FamilyEntry; variant: "overview" | "manage" }) {
  const { child, stats, summary, prefs } = entry;
  const manage = variant === "manage";
  const id = String(child.id);
  const inactive = summary.daysSinceActive !== null && summary.daysSinceActive >= 4;
  const maxDay = Math.max(1, ...summary.last7.map((d) => d.count), summary.dailyGoal);
  const weekPct = prefs.weeklyTarget ? Math.min(100, Math.round((summary.weekTotal / prefs.weeklyTarget) * 100)) : Math.min(100, summary.weekTotal * 10);

  const status =
    summary.daysSinceActive === null
      ? { text: "Pas encore commencé", dot: "#94a3b8" }
      : summary.daysSinceActive === 0
        ? { text: "Actif aujourd'hui", dot: "#4ade80" }
        : inactive
          ? { text: `Inactif depuis ${summary.daysSinceActive} jours`, dot: "#f0a3a3" }
          : { text: `Actif il y a ${summary.daysSinceActive} jour${summary.daysSinceActive > 1 ? "s" : ""}`, dot: "#c5a148" };

  return (
    <article className="family-card">
      {/* Bandeau */}
      <header className="family-card-head">
        <div className="flex items-center gap-3">
          <span className="shrink-0 rounded-[30%] bg-white/95 p-0.5 shadow-lg">
            <AvatarWithBorder avatar={child.avatar ?? undefined} equippedBorder={child.equipped_border} name={child.first_name ?? ""} size="md" label="" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-[family-name:var(--font-display)] font-bold text-lg leading-tight truncate">{child.first_name} {child.last_name}</h3>
            {manage && child.child_username && <p className="text-xs opacity-60">@{child.child_username}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: "rgba(197,161,72,0.95)", color: "#0f1e3a" }}>
                {child.grade_level ? getCatalogLevelLabel(child.grade_level) : "Niveau ?"}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold opacity-90">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot, boxShadow: `0 0 8px ${status.dot}` }} />
                {status.text}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Corps */}
      <div className="p-4 flex-grow space-y-3">
        {/* Objectif du jour, série, résultats */}
        <div className="family-glass p-3.5 flex items-center gap-4">
          <GoalRing done={summary.today} goal={summary.dailyGoal} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Objectif du jour</p>
            <p className={`text-sm font-bold mb-2 ${summary.goalReached ? "text-green-600" : "text-[var(--greek-blue)]"}`}>{summary.goalReached ? "Atteint, bravo !" : `Encore ${summary.dailyGoal - summary.today} activité${summary.dailyGoal - summary.today > 1 ? "s" : ""}`}</p>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-bold text-[var(--greek-blue)]"><Flame className={`w-4 h-4 ${summary.streak > 0 ? "text-orange-500 fill-orange-400" : "text-gray-300"}`} /> {summary.streak} j</span>
              <span className="flex items-center gap-1 text-gray-600"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> {stats.exerciseCount}</span>
              <span className="flex items-center gap-1 text-gray-600"><TrendingUp className="w-3.5 h-3.5 text-[var(--greek-gold)]" /> {stats.successRate} %</span>
            </div>
          </div>
        </div>

        {/* Semaine : 7 jours et cible */}
        <div className="family-glass p-3.5">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Cette semaine</p>
            <p className="text-xs font-bold text-[var(--greek-blue)]">{summary.weekTotal}{prefs.weeklyTarget ? ` / ${prefs.weeklyTarget}` : ""}</p>
          </div>
          <div className="flex items-end justify-between gap-1.5 h-12" aria-label="Activité des 7 derniers jours">
            {summary.last7.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${d.day} : ${d.count} activité${d.count > 1 ? "s" : ""}`}>
                <div className="w-full rounded-md" style={{ height: `${Math.max(d.count > 0 ? 18 : 6, Math.round((d.count / maxDay) * 100))}%`, background: d.count >= summary.dailyGoal ? "linear-gradient(180deg,#4ade80,#16a34a)" : d.count > 0 ? "linear-gradient(180deg,#e0c068,#c5a148)" : "rgba(15,30,58,0.1)" }} />
                <span className="text-[9px] font-semibold text-gray-400 leading-none">{DAY_LETTER[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</span>
              </div>
            ))}
          </div>
          {prefs.weeklyTarget && (
            <div className="h-1.5 rounded-full bg-[rgba(15,30,58,0.08)] overflow-hidden mt-2.5">
              <div className="h-full rounded-full" style={{ width: `${weekPct}%`, background: "linear-gradient(90deg,#e0c068,#c5a148)" }} />
            </div>
          )}
        </div>

        {stats.lastActivity && (
          <div className="flex items-center gap-2.5 px-1">
            <div className={`p-1.5 rounded-lg shrink-0 ${stats.lastActivity.type === "Quiz" ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"}`}>
              {stats.lastActivity.type === "Quiz" ? <CheckCircle className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{stats.lastActivity.title}</p>
              <p className="text-xs text-gray-400">{stats.lastActivity.relativeTime}</p>
            </div>
          </div>
        )}

        {/* Plus d'infos, seulement dans « Mes enfants » */}
        {manage && (
          <div className="family-glass p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Réglages et suivi</p>
            <ul className="grid grid-cols-1 gap-1.5 text-sm text-gray-700">
              <li className="flex items-center gap-2"><Target className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {prefs.dailyGoal} activité{prefs.dailyGoal > 1 ? "s" : ""} par jour{prefs.weeklyTarget ? `, ${prefs.weeklyTarget} par semaine` : ""}</li>
              <li className="flex items-center gap-2"><Moon className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {prefs.quiet.enabled ? `Repos de ${prefs.quiet.start} à ${prefs.quiet.end}` : "Pas d'heures de repos"}</li>
              <li className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {prefs.examDate ? `Examen le ${fmtDay(prefs.examDate)}` : "Pas d'examen prévu"}</li>
              <li className="flex items-center gap-2"><CalendarClock className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {child.last_active_at ? `Vu ${relativeTime(child.last_active_at)}` : "Jamais connecté"}</li>
              <li className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {stats.quizCount} quiz terminé{stats.quizCount > 1 ? "s" : ""}</li>
            </ul>
            <Link href={`/parent/child/${id}`} className="inline-block mt-2.5 text-xs font-bold text-[var(--greek-blue)] hover:text-[var(--greek-gold)] transition-colors">
              Régler les objectifs et le repos
            </Link>
          </div>
        )}
      </div>

      {/* Pied */}
      <footer className="family-foot">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0"><ChildReportLink childId={id} /></div>
          <GlassButton href={`/parent/child/${id}/bulletin`} variant="outline" size="sm" rounded="xl">
            <FileText className="w-4 h-4" /> Bulletin
          </GlassButton>
          {manage && (
            <div className="flex gap-1.5 shrink-0">
              <EditChildButton childId={id} />
              <DeleteChildButton childId={id} />
            </div>
          )}
        </div>
      </footer>
    </article>
  );
}
