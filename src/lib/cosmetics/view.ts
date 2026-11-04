import { BORDERS, COLORS, MISSIONS, STAT_LABEL, missionsForBorder, missionsForColor, type MissionStat, type MissionStats } from "@/lib/cosmetics/catalog";
import { evaluateMission } from "@/lib/cosmetics/missions";
import type { Unlocked } from "@/lib/cosmetics/entitlements";

/** Une carte de la vitrine : un contour ou une couleur de nom, avec d'où il vient et où l'on en est. */
export interface CosmeticCard {
  kind: "border" | "color";
  key: string;
  label: string;
  /** Équipable maintenant. */
  unlocked: boolean;
  /** Par quoi il est débloqué en ce moment (null = verrouillé). */
  unlockedVia: "mission" | "subscription" | "base" | "admin" | null;
  /** Une mission le donne. */
  byMission: boolean;
  /** Une formule d'abonnement peut le donner. */
  bySubscription: boolean;
  /** Formules (noms courts) qui le donnent aujourd'hui. */
  plans: string[];
  missions: {
    id: string;
    title: string;
    description: string;
    earned: boolean;
    ratio: number;
    requirements: { stat: MissionStat; label: string; value: number; min: number; done: boolean }[];
  }[];
  /** Avancement de la mission la plus proche (0 à 1) pour le tri ; 1 si déjà gagnée. */
  bestRatio: number;
}

export interface CardInput {
  stats: MissionStats;
  ownedMissionIds: Iterable<string>;
  unlocked: Unlocked;
  /** clé → noms de formules qui la donnent (voir shortPlanName). */
  plansByKey?: { borders?: Record<string, string[]>; colors?: Record<string, string[]> };
  /** Administrateur : seul « Égide » est montré (imposé) ; pour tout autre compte, « Égide » n'apparaît jamais. */
  isAdmin?: boolean;
}

/** « Solo - 1 an » → « Solo ». */
export const shortPlanName = (name: string): string => name.split(" - ")[0].trim();

/** Pour chaque contour / couleur, les formules ACTIVES qui le donnent. */
export function plansGranting(plans: { name: string; features: unknown }[]): { borders: Record<string, string[]>; colors: Record<string, string[]> } {
  const borders: Record<string, Set<string>> = {};
  const colors: Record<string, Set<string>> = {};
  for (const p of plans) {
    const f = p.features && typeof p.features === "object" && !Array.isArray(p.features) ? (p.features as { cosmetic_borders?: unknown; cosmetic_colors?: unknown }) : null;
    const name = shortPlanName(p.name);
    for (const k of Array.isArray(f?.cosmetic_borders) ? f.cosmetic_borders : []) if (typeof k === "string") (borders[k] ??= new Set()).add(name);
    for (const k of Array.isArray(f?.cosmetic_colors) ? f.cosmetic_colors : []) if (typeof k === "string") (colors[k] ??= new Set()).add(name);
  }
  const out = (m: Record<string, Set<string>>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]));
  return { borders: out(borders), colors: out(colors) };
}

export function buildCards(input: CardInput): { borders: CosmeticCard[]; colors: CosmeticCard[] } {
  const owned = new Set(input.ownedMissionIds);
  const make = (kind: "border" | "color", key: string, label: string, bySubscription: boolean, base: boolean): CosmeticCard => {
    const defs = kind === "border" ? missionsForBorder(key) : missionsForColor(key);
    const missions = defs.map((m) => {
      const p = evaluateMission(m, input.stats);
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        earned: owned.has(m.id),
        ratio: owned.has(m.id) ? 1 : p.ratio,
        requirements: p.requirements.map((r) => ({ stat: r.stat, label: STAT_LABEL[r.stat], value: r.value, min: r.min, done: r.done })),
      };
    });
    const set = kind === "border" ? input.unlocked.borders : input.unlocked.colors;
    const unlocked = set.has(key);
    const viaMission = missions.some((m) => m.earned);
    const unlockedVia = !unlocked ? null : (kind === "border" ? BORDERS : COLORS).find((d) => d.key === key && d.adminOnly) ? "admin" : base ? "base" : viaMission ? "mission" : "subscription";
    const plans = (kind === "border" ? input.plansByKey?.borders?.[key] : input.plansByKey?.colors?.[key]) ?? [];
    return {
      kind, key, label, unlocked, unlockedVia,
      byMission: missions.length > 0, bySubscription, plans, missions,
      bestRatio: missions.length ? Math.max(...missions.map((m) => m.ratio)) : 0,
    };
  };
  return {
    borders: BORDERS.filter((b) => (input.isAdmin ? b.adminOnly : !b.adminOnly)).map((b) => make("border", b.key, b.label, b.subscription, b.key === "none")),
    colors: COLORS.filter((c) => (input.isAdmin ? c.adminOnly : !c.adminOnly)).map((c) => make("color", c.key, c.label, c.subscription, c.key === "default")),
  };
}

export type SourceFilter = "all" | "mission" | "subscription" | "owned";
export type SortMode = "default" | "owned" | "progress" | "name";

export function filterCards(cards: CosmeticCard[], filter: SourceFilter): CosmeticCard[] {
  switch (filter) {
    case "mission": return cards.filter((c) => c.byMission);
    case "subscription": return cards.filter((c) => c.bySubscription);
    case "owned": return cards.filter((c) => c.unlocked);
    default: return cards;
  }
}

export function sortCards(cards: CosmeticCard[], mode: SortMode): CosmeticCard[] {
  const withIndex = cards.map((c, i) => ({ c, i }));
  const by = (cmp: (a: CosmeticCard, b: CosmeticCard) => number) => withIndex.sort((x, y) => cmp(x.c, y.c) || x.i - y.i).map((x) => x.c);
  switch (mode) {
    case "owned": return by((a, b) => Number(b.unlocked) - Number(a.unlocked));
    case "progress": return by((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.bestRatio - a.bestRatio);
    case "name": return by((a, b) => a.label.localeCompare(b.label, "fr"));
    default: return cards;
  }
}

/** Nombres pour les pastilles du curseur (Tous · Missions · Abonnement · Obtenus). */
export function countByFilter(cards: CosmeticCard[]): Record<SourceFilter, number> {
  return { all: cards.length, mission: filterCards(cards, "mission").length, subscription: filterCards(cards, "subscription").length, owned: filterCards(cards, "owned").length };
}

export const MISSION_COUNT = MISSIONS.length;
