import Link from "next/link";
import { BookOpen, CalendarClock, CheckCircle, Edit, FileText, Flame, GraduationCap, Moon, Target, TrendingUp } from "lucide-react";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import ChildReportLink from "@/components/parent/ChildReportLink";
import DeleteChildButton from "@/components/parent/DeleteChildButton";
import { getCatalogLevelLabel } from "@/lib/constants";
import { relativeTime } from "@/lib/relativeTime";
import type { FamilyEntry } from "@/lib/familyOverview";

const fmtDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

/**
 * Fiche d'un enfant : la MÊME dans le tableau de bord (« overview ») et dans « Mes enfants » (« manage »), qui ajoute
 * l'identifiant, les réglages en cours et les actions (modifier, supprimer).
 */
export default function ChildFamilyCard({ entry, variant }: { entry: FamilyEntry; variant: "overview" | "manage" }) {
  const { child, stats, summary, prefs } = entry;
  const manage = variant === "manage";
  const id = String(child.id);
  const weekPct = prefs.weeklyTarget ? Math.min(100, Math.round((summary.weekTotal / prefs.weeklyTarget) * 100)) : Math.min(100, summary.weekTotal * 10);
  const inactive = summary.daysSinceActive !== null && summary.daysSinceActive >= 4;

  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
      {/* En-tête */}
      <div className="p-5 border-b border-[rgba(197,161,72,0.25)]">
        <div className="flex items-center gap-3">
          <span className="group-hover:scale-110 transition-transform duration-300 shrink-0">
            <AvatarWithBorder avatar={child.avatar ?? undefined} equippedBorder={child.equipped_border} name={child.first_name ?? ""} size="md" label="" />
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-[var(--greek-blue)] text-lg leading-tight">{child.first_name} {child.last_name}</h3>
            {manage && child.child_username && <p className="text-xs text-gray-400">@{child.child_username}</p>}
            <span className="inline-block mt-1 text-xs font-semibold bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] px-2 py-0.5 rounded-full">
              {child.grade_level ? getCatalogLevelLabel(child.grade_level) : "Niveau non défini"}
            </span>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="p-5 flex-grow space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-xl border border-[rgba(197,161,72,0.25)] text-center">
            <CheckCircle className="w-4 h-4 text-green-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-gray-800">{stats.exerciseCount}</div>
            <div className="text-xs text-gray-500">Exercices</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-[rgba(197,161,72,0.25)] text-center">
            <TrendingUp className="w-4 h-4 text-[var(--greek-gold)] mx-auto mb-1" />
            <div className="text-lg font-bold text-gray-800">{stats.successRate}%</div>
            <div className="text-xs text-gray-500">Réussite</div>
          </div>
        </div>

        <div className="rounded-xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/50 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-600"><Target className="w-4 h-4 text-[var(--greek-gold)]" /> Aujourd&apos;hui</span>
            <strong className={summary.goalReached ? "text-green-600" : "text-[var(--greek-blue)]"}>{summary.today}/{summary.dailyGoal}</strong>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-600"><Flame className={`w-4 h-4 ${summary.streak > 0 ? "text-orange-500" : "text-gray-300"}`} /> Série</span>
            <strong className="text-[var(--greek-blue)]">{summary.streak} j</strong>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Cette semaine</span><span>{summary.weekTotal}{prefs.weeklyTarget ? ` / ${prefs.weeklyTarget}` : ""}</span></div>
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden"><div className="h-full rounded-full bg-[var(--greek-gold)]" style={{ width: `${weekPct}%` }} /></div>
          </div>
          <p className={`text-xs font-semibold ${summary.daysSinceActive === null ? "text-gray-400" : inactive ? "text-[var(--greek-bronze)]" : "text-green-600"}`}>
            {summary.daysSinceActive === null ? "Pas encore commencé" : summary.daysSinceActive === 0 ? "Actif aujourd'hui" : `Inactif depuis ${summary.daysSinceActive} jour${summary.daysSinceActive > 1 ? "s" : ""}`}
          </p>
        </div>

        {stats.lastActivity && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dernière activité</p>
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${stats.lastActivity.type === "Quiz" ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"}`}>
                {stats.lastActivity.type === "Quiz" ? <CheckCircle className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{stats.lastActivity.title}</p>
                <p className="text-xs text-gray-400">{stats.lastActivity.relativeTime}</p>
              </div>
            </div>
          </div>
        )}

        {/* Plus d'infos, seulement dans « Mes enfants » */}
        {manage && (
          <div className="pt-4 border-t border-[rgba(197,161,72,0.25)]">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Réglages et suivi</p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              <li className="flex items-center gap-2"><Target className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> Objectif : {prefs.dailyGoal} activité{prefs.dailyGoal > 1 ? "s" : ""} par jour{prefs.weeklyTarget ? `, ${prefs.weeklyTarget} par semaine` : ""}</li>
              <li className="flex items-center gap-2"><Moon className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {prefs.quiet.enabled ? `Repos de ${prefs.quiet.start} à ${prefs.quiet.end}` : "Pas d'heures de repos"}</li>
              <li className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {prefs.examDate ? `Examen le ${fmtDay(prefs.examDate)}` : "Pas d'examen prévu"}</li>
              <li className="flex items-center gap-2"><CalendarClock className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {child.last_active_at ? `Vu ${relativeTime(child.last_active_at)}` : "Jamais connecté"}</li>
              <li className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {stats.quizCount} quiz terminé{stats.quizCount > 1 ? "s" : ""}</li>
            </ul>
            <Link href={`/parent/child/${id}`} className="inline-block mt-3 text-xs font-bold text-[var(--greek-blue)] hover:text-[var(--greek-gold)] transition-colors">
              Régler les objectifs et le repos
            </Link>
          </div>
        )}
      </div>

      {/* Pied */}
      <div className="p-4 bg-gray-50 border-t border-[rgba(197,161,72,0.25)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0"><ChildReportLink childId={id} /></div>
          <Link href={`/parent/child/${id}/bulletin`} className="text-xs font-bold text-[var(--greek-blue)] hover:underline flex items-center gap-1 whitespace-nowrap">
            <FileText className="w-3.5 h-3.5" /> Bulletin
          </Link>
          {manage && (
            <div className="flex gap-1 shrink-0">
              <Link href={`/parent/edit-child/${id}`} className="p-2 text-gray-400 hover:text-[var(--greek-blue)] hover:bg-[var(--greek-blue)]/10 rounded-lg transition-colors" title="Modifier" aria-label="Modifier le profil">
                <Edit className="w-4 h-4" />
              </Link>
              <DeleteChildButton childId={id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
