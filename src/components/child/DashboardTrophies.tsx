import { Target } from "lucide-react";
import Link from "@/components/AppLink";
import GlassButton from "@/components/ui/GlassButton";
import BadgeEmblem from "@/components/BadgeEmblem";
import Emblem3D from "@/components/Emblem3D";
import type { BadgeGoal, GoalBadge } from "@/lib/badgeGoals";

interface Props {
  /** Derniers badges obtenus, du plus récent au plus ancien. */
  latest: GoalBadge[];
  earnedCount: number;
  totalCount: number;
  goals: BadgeGoal[];
  /** Rang de chaque badge dans sa catégorie : il donne son métal (voir badgeTiers). */
  tiers: Record<number, number>;
}

/** « Mes trophées » du tableau de bord : les mêmes emblèmes que la page des trophées, et où en est l'élève. */
export default function DashboardTrophies({ latest, earnedCount, totalCount, goals, tiers }: Props) {
  const pct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;
  const emblem = (b: GoalBadge) => ({ icon: b.icon, requirement_type: b.requirement_type, tier: tiers[b.id] ?? 0 });

  return (
    <section className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3 min-w-0">
          <Emblem3D kind="trophy" size={28} float={false} />
          <h2 className="text-xl font-bold text-[var(--greek-blue)]">Mes trophées</h2>
        </div>
        <GlassButton href="/child/badges" variant="outline" size="sm" className="whitespace-nowrap">Voir tout</GlassButton>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        {earnedCount === 0 ? `Aucun badge pour l'instant, ${totalCount} à gagner.` : `${earnedCount} badge${earnedCount > 1 ? "s" : ""} obtenu${earnedCount > 1 ? "s" : ""} sur ${totalCount}.`}
      </p>
      <div className="h-2 rounded-full bg-[rgba(197,161,72,0.18)] overflow-hidden mb-6" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Badges obtenus">
        <div className="h-full rounded-full bg-[var(--greek-gold)]" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Derniers badges obtenus */}
        <div>
          <h3 className="text-sm font-bold text-[var(--greek-blue)] mb-3">Derniers obtenus</h3>
          {latest.length === 0 ? (
            <div className="rounded-2xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/40 p-5 flex items-center gap-4">
              <Emblem3D kind="trophy" size={64} />
              <p className="text-sm text-gray-600">Ton premier badge arrive vite : termine un exercice, un quiz ou un cours.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3">
              {latest.map((b) => (
                <li key={b.id} className="rounded-2xl border border-[rgba(197,161,72,0.25)] px-2 py-4 flex flex-col items-center gap-2 text-center">
                  <BadgeEmblem badge={emblem(b)} size={64} />
                  <span className="text-xs font-bold text-gray-800 line-clamp-2">{b.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Prochains objectifs */}
        <div>
          <h3 className="text-sm font-bold text-[var(--greek-blue)] mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-[var(--greek-gold)]" /> Prochains objectifs
          </h3>
          {goals.length === 0 ? (
            <p className="rounded-2xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/40 p-5 text-sm text-gray-600">Tu as obtenu tous les badges. Bravo !</p>
          ) : (
            <ul className="space-y-3">
              {goals.map(({ badge, current, target, ratio, ready }) => (
                <li key={badge.id}>
                  <Link href="/child/badges" className="flex items-center gap-4 rounded-2xl border border-[rgba(197,161,72,0.25)] p-3 hover:border-[var(--greek-gold)] transition-colors">
                    <BadgeEmblem badge={emblem(badge)} size={48} locked={!ready} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-bold text-gray-800 truncate">{badge.name}</span>
                        <span className={`text-xs font-semibold whitespace-nowrap ${ready ? "text-green-700" : "text-gray-500"}`}>{ready ? "À récupérer" : `${current} / ${target}`}</span>
                      </div>
                      {badge.description && <p className="text-xs text-gray-500 truncate">{badge.description}</p>}
                      <div className="mt-1.5 h-1.5 rounded-full bg-[rgba(197,161,72,0.18)] overflow-hidden">
                        <div className={`h-full rounded-full ${ready ? "bg-green-600" : "bg-[var(--greek-gold)]"}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
