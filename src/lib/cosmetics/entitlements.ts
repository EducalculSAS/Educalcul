import { ADMIN_BORDER, ADMIN_COLOR, BORDERS, COLORS, DEFAULT_COLOR, NO_BORDER, grantsOfMissions } from "@/lib/cosmetics/catalog";

export interface Unlocked {
  borders: Set<string>;
  colors: Set<string>;
}

/** Repli quand les caractéristiques de la formule ne listent pas de cosmétiques (anciens enregistrements). */
const FALLBACK_BY_PLAN: Record<string, { borders: string[]; colors: string[] }> = {
  "2": { borders: ["premium"], colors: ["premium"] },
  "3": { borders: ["famille", "flamme"], colors: ["famille"] },
};

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Ce que donne une formule : uniquement des éléments que le catalogue autorise à venir d'un abonnement. */
export function planGrants(planFeatures: { cosmetic_borders?: unknown; cosmetic_colors?: unknown } | null, planId: string | number | null) {
  const listed = planFeatures && planFeatures.cosmetic_borders !== undefined;
  const raw = listed
    ? { borders: strings(planFeatures?.cosmetic_borders), colors: strings(planFeatures?.cosmetic_colors) }
    : (planId !== null && FALLBACK_BY_PLAN[String(planId)]) || { borders: [], colors: [] };
  const allowedBorders = new Set(BORDERS.filter((b) => b.subscription).map((b) => b.key));
  const allowedColors = new Set(COLORS.filter((c) => c.subscription).map((c) => c.key));
  return { borders: raw.borders.filter((k) => allowedBorders.has(k)), colors: raw.colors.filter((k) => allowedColors.has(k)) };
}

/**
 * LA règle de droits, en une fonction pure : missions accomplies (pour toujours) + formule active (tant qu'elle dure).
 * Seule exception de rôle : un administrateur porte d'office le contour « Égide » et aucun autre.
 */
export function resolveUnlocked(input: {
  missionIds: Iterable<string>;
  planFeatures?: { cosmetic_borders?: unknown; cosmetic_colors?: unknown } | null;
  planId?: string | number | null;
  /** Administrateur : un seul contour et un seul titre possibles, « Égide ». */
  isAdmin?: boolean;
}): Unlocked {
  const fromMissions = grantsOfMissions(input.missionIds);
  const fromPlan = planGrants(input.planFeatures ?? null, input.planId ?? null);
  return {
    borders: input.isAdmin ? new Set([ADMIN_BORDER]) : new Set([NO_BORDER, ...fromMissions.borders, ...fromPlan.borders]),
    colors: input.isAdmin ? new Set([ADMIN_COLOR]) : new Set([DEFAULT_COLOR, ...fromMissions.colors, ...fromPlan.colors]),
  };
}
