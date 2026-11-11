import { CalendarClock, FileText, GraduationCap, Moon, Target, TrendingUp } from "lucide-react";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import ChildReportLink from "@/components/parent/ChildReportLink";
import DeleteChildButton from "@/components/parent/DeleteChildButton";
import EditChildButton from "@/components/parent/EditChildButton";
import FamilyCardShell from "@/components/parent/FamilyCardShell";
import GlassButton from "@/components/ui/GlassButton";
import { getCatalogLevelLabel } from "@/lib/constants";
import { relativeTime } from "@/lib/relativeTime";
import type { FamilyEntry } from "@/lib/familyOverview";

const fmtDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" });

/**
 * Fiche d'un enfant : la MÊME dans le tableau de bord (« overview ») et dans « Mes enfants » (« manage »), qui ajoute
 * l'identifiant, les réglages en cours et les actions (modifier, supprimer). Le dessin vient de FamilyCardShell, aussi
 * utilisé par l'aperçu de l'accueil.
 */
export default function ChildFamilyCard({ entry, variant }: { entry: FamilyEntry; variant: "overview" | "manage" }) {
  const { child, stats, summary, prefs } = entry;
  const manage = variant === "manage";
  const id = String(child.id);
  const inactive = summary.daysSinceActive !== null && summary.daysSinceActive >= 4;

  const status =
    summary.daysSinceActive === null
      ? { text: "Pas encore commencé", dot: "#94a3b8" }
      : summary.daysSinceActive === 0
        ? { text: "Actif aujourd'hui", dot: "#4ade80" }
        : inactive
          ? { text: `Inactif depuis ${summary.daysSinceActive} jours`, dot: "#f0a3a3" }
          : { text: `Actif il y a ${summary.daysSinceActive} jour${summary.daysSinceActive > 1 ? "s" : ""}`, dot: "#c5a148" };

  return (
    <FamilyCardShell
      d={{
        avatar: (
          <span className="shrink-0 rounded-[30%] bg-white/95 p-0.5 shadow-lg">
            <AvatarWithBorder avatar={child.avatar ?? undefined} equippedBorder={child.equipped_border} name={child.first_name ?? ""} size="md" label="" />
          </span>
        ),
        name: `${child.first_name ?? ""} ${child.last_name ?? ""}`.trim(),
        username: manage ? child.child_username ?? undefined : undefined,
        level: child.grade_level ? getCatalogLevelLabel(child.grade_level) : "Niveau ?",
        status,
        today: summary.today,
        dailyGoal: summary.dailyGoal,
        streak: summary.streak,
        exerciseCount: stats.exerciseCount,
        successRate: stats.successRate,
        last7: summary.last7,
        weekTotal: summary.weekTotal,
        weeklyTarget: prefs.weeklyTarget,
        lastActivity: stats.lastActivity,
        extra: manage ? (
          <div className="family-glass p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Réglages et suivi</p>
            <ul className="grid grid-cols-1 gap-1.5 text-sm text-gray-700">
              <li className="flex items-center gap-2"><Target className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {prefs.dailyGoal} activité{prefs.dailyGoal > 1 ? "s" : ""} par jour{prefs.weeklyTarget ? `, ${prefs.weeklyTarget} par semaine` : ""}</li>
              <li className="flex items-center gap-2"><Moon className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {prefs.quiet.enabled ? `Repos de ${prefs.quiet.start} à ${prefs.quiet.end}` : "Pas d'heures de repos"}</li>
              <li className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {prefs.examDate ? `Examen le ${fmtDay(prefs.examDate)}` : "Pas d'examen prévu"}</li>
              <li className="flex items-center gap-2"><CalendarClock className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {child.last_active_at ? `Vu ${relativeTime(child.last_active_at)}` : summary.today > 0 ? "Actif aujourd'hui" : "Pas encore connecté"}</li>
              <li className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[var(--greek-gold)] shrink-0" /> {stats.quizCount} quiz terminé{stats.quizCount > 1 ? "s" : ""}</li>
            </ul>
            <div className="mt-3">
              <GlassButton href={`/parent/child/${id}`} variant="outline" size="sm">Régler les objectifs et le repos</GlassButton>
            </div>
          </div>
        ) : undefined,
        footer: manage ? (
          <div className="space-y-2">
            <ChildReportLink childId={id} />
            <div className="flex items-center gap-2">
              <GlassButton href={`/parent/child/${id}/bulletin`} variant="outline" size="sm" fullWidth>
                <FileText className="w-4 h-4" /> Bulletin
              </GlassButton>
              <div className="flex gap-1.5 shrink-0">
                <EditChildButton childId={id} />
                <DeleteChildButton childId={id} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0"><ChildReportLink childId={id} /></div>
            <GlassButton href={`/parent/child/${id}/bulletin`} variant="outline" size="sm">
              <FileText className="w-4 h-4" /> Bulletin
            </GlassButton>
          </div>
        ),
      }}
    />
  );
}
