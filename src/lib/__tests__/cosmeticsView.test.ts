import { describe, expect, it } from "vitest";
import { buildCards, countByFilter, filterCards, plansGranting, shortPlanName, sortCards } from "@/lib/cosmetics/view";
import { resolveUnlocked } from "@/lib/cosmetics/entitlements";
import type { MissionStats } from "@/lib/cosmetics/catalog";

const zero: MissionStats = { exo: 0, cours: 0, quiz: 0, quizPerfect: 0, loginStreak: 0, loginCount: 0, mathador: 0, exoCorrect: 0, minigames: 0, badges: 0 };
const features = { cosmetic_borders: ["premium", "flamme"], cosmetic_colors: ["premium", "flame"] };
const plans = [
  { name: "Solo - 1 mois", features },
  { name: "Solo - 1 an", features },
  { name: "Family - 1 mois", features: { cosmetic_borders: ["famille", "flamme"], cosmetic_colors: ["famille"] } },
  { name: "Découverte", features: null },
];

const make = (opts: { stats?: Partial<MissionStats>; owned?: string[]; withPlan?: boolean } = {}) => {
  const unlocked = resolveUnlocked({ missionIds: opts.owned ?? [], planFeatures: opts.withPlan ? features : null });
  return buildCards({ stats: { ...zero, ...opts.stats }, ownedMissionIds: opts.owned ?? [], unlocked, plansByKey: plansGranting(plans) });
};
const card = (cards: ReturnType<typeof make>["borders"], key: string) => cards.find((c) => c.key === key)!;

describe("formules qui donnent un élément", () => {
  it("noms courts, sans doublon", () => {
    expect(shortPlanName("Solo - 1 trimestre")).toBe("Solo");
    const g = plansGranting(plans);
    expect(g.borders.flamme.sort()).toEqual(["Family", "Solo"]);
    expect(g.borders.premium).toEqual(["Solo"]);
    expect(g.colors.famille).toEqual(["Family"]);
  });
});

describe("cartes de la vitrine", () => {
  it("un contour de mission verrouillé montre son avancement", () => {
    const { borders } = make({ stats: { exoCorrect: 150 } });
    const foudre = card(borders, "foudre");
    expect(foudre.unlocked).toBe(false);
    expect(foudre.unlockedVia).toBeNull();
    expect(foudre.byMission).toBe(true);
    expect(foudre.bestRatio).toBeCloseTo(0.5);
    expect(foudre.missions[0].requirements[0]).toMatchObject({ value: 150, min: 300, done: false });
  });

  it("gagné par mission : « mission » ; donné par l'abonnement : « subscription »", () => {
    const m = make({ owned: ["rubis"] }).borders;
    expect(card(m, "rubis")).toMatchObject({ unlocked: true, unlockedVia: "mission", bestRatio: 1 });
    const s = make({ withPlan: true }).borders;
    expect(card(s, "premium")).toMatchObject({ unlocked: true, unlockedVia: "subscription", bySubscription: true, plans: ["Solo"] });
    expect(card(s, "flamme").byMission).toBe(true); // Brasier : les deux façons
    expect(card(s, "flamme").bySubscription).toBe(true);
  });

  it("« aucun contour » est toujours disponible, sans source", () => {
    const none = card(make().borders, "none");
    expect(none).toMatchObject({ unlocked: true, unlockedVia: "base", byMission: false, bySubscription: false });
  });

  it("l'abonnement qui s'arrête verrouille ce qu'il donnait", () => {
    expect(card(make({ withPlan: true }).borders, "premium").unlocked).toBe(true);
    expect(card(make({ withPlan: false }).borders, "premium").unlocked).toBe(false);
  });
});

describe("filtres et tri", () => {
  const cards = make({ owned: ["rubis", "bronze"], stats: { cours: 15 }, withPlan: true }).borders;

  it("missions : seulement ceux qu'une mission donne", () => {
    const m = filterCards(cards, "mission").map((c) => c.key);
    expect(m).toContain("rubis");
    expect(m).not.toContain("premium");
    expect(m).not.toContain("none");
  });

  it("abonnement : seulement ceux qu'une formule peut donner", () => {
    const s = filterCards(cards, "subscription").map((c) => c.key);
    expect(s.sort()).toEqual(["elite", "famille", "flamme", "premium", "pro"].sort());
  });

  it("obtenus : ce qui est équipable maintenant", () => {
    const o = filterCards(cards, "owned").map((c) => c.key);
    expect(o).toEqual(expect.arrayContaining(["none", "bronze", "rubis", "premium", "flamme"]));
    expect(o).not.toContain("foudre");
    expect(filterCards(cards, "all")).toHaveLength(cards.length);
  });

  it("les compteurs du curseur correspondent aux filtres", () => {
    const c = countByFilter(cards);
    expect(c.all).toBe(cards.length);
    expect(c.mission).toBe(filterCards(cards, "mission").length);
    expect(c.subscription).toBe(filterCards(cards, "subscription").length);
    expect(c.owned).toBe(filterCards(cards, "owned").length);
  });

  it("tri : obtenus d'abord, puis plus proches, puis A → Z ; l'ordre du catalogue est stable", () => {
    const byOwned = sortCards(cards, "owned");
    const firstLocked = byOwned.findIndex((c) => !c.unlocked);
    expect(byOwned.slice(0, firstLocked).every((c) => c.unlocked)).toBe(true);
    expect(byOwned.slice(firstLocked).every((c) => !c.unlocked)).toBe(true);
    // l'ordre relatif d'origine est conservé à égalité
    const original = cards.filter((c) => c.unlocked).map((c) => c.key);
    expect(byOwned.slice(0, firstLocked).map((c) => c.key)).toEqual(original);

    const byProgress = sortCards(cards, "progress").filter((c) => !c.unlocked);
    for (let i = 1; i < byProgress.length; i++) expect(byProgress[i - 1].bestRatio).toBeGreaterThanOrEqual(byProgress[i].bestRatio);
    expect(byProgress[0].key).toBe("sylve"); // 15 cours sur 30 : la plus avancée

    const names = sortCards(cards, "name").map((c) => c.label);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "fr")));
    expect(sortCards(cards, "default")).toBe(cards);
  });

  it("trier ne modifie pas la liste d'origine", () => {
    const before = cards.map((c) => c.key);
    sortCards(cards, "name");
    expect(cards.map((c) => c.key)).toEqual(before);
  });
});
