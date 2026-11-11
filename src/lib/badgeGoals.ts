/** Ce qu'il faut d'un badge pour dire où en est l'élève. */
export interface GoalBadge {
  id: number;
  name: string;
  icon: string;
  description?: string | null;
  requirement_type: string | null;
  requirement_value: number | null;
}

export interface BadgeGoal<B extends GoalBadge = GoalBadge> {
  badge: B;
  /** Valeur actuelle, plafonnée au seuil. */
  current: number;
  target: number;
  /** De 0 à 1. */
  ratio: number;
  /** Seuil atteint mais badge pas encore remis (il l'est à l'ouverture de « Mes trophées »). */
  ready: boolean;
}

/**
 * Les prochains badges à viser : dans chaque catégorie, le premier palier pas encore obtenu, puis les plus avancés
 * d'abord. `stats` associe chaque `requirement_type` au compteur de l'élève.
 */
export function nextBadgeGoals<B extends GoalBadge>(badges: B[], earnedIds: Iterable<number>, stats: Record<string, number>, max = 3): BadgeGoal<B>[] {
  const earned = new Set(earnedIds);
  const next = new Map<string, B>();
  for (const b of badges) {
    if (earned.has(b.id) || !b.requirement_type || !(b.requirement_value && b.requirement_value > 0)) continue;
    const held = next.get(b.requirement_type);
    if (!held || (b.requirement_value ?? 0) < (held.requirement_value ?? 0)) next.set(b.requirement_type, b);
  }
  return [...next.values()]
    .map((badge) => {
      const target = badge.requirement_value ?? 1;
      const current = Math.max(0, Math.min(target, stats[badge.requirement_type ?? ""] ?? 0));
      return { badge, current, target, ratio: current / target, ready: current >= target };
    })
    .sort((a, b) => b.ratio - a.ratio || a.target - b.target)
    .slice(0, max);
}
