import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BORDERS, COLORS, MISSIONS, MISSION_BY_ID, NO_BORDER, DEFAULT_COLOR, STAT_LABEL, grantsOfMissions, normalizeBorder, normalizeColor } from "@/lib/cosmetics/catalog";
import { RING_KEYS } from "@/components/AvatarRingDecor";
import { evaluateMission, missionsToAward } from "@/lib/cosmetics/missions";
import type { MissionStats } from "@/lib/cosmetics/catalog";

const css = fs.readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");
const zero: MissionStats = { exo: 0, cours: 0, quiz: 0, quizPerfect: 0, loginStreak: 0, loginCount: 0, mathador: 0, exoCorrect: 0, minigames: 0, badges: 0 };

describe("catalogue des contours et couleurs", () => {
  it("clés uniques", () => {
    expect(new Set(BORDERS.map((b) => b.key)).size).toBe(BORDERS.length);
    expect(new Set(COLORS.map((c) => c.key)).size).toBe(COLORS.length);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
  });

  it("chaque contour (sauf « aucun ») est dessiné : une palette existe", () => {
    for (const b of BORDERS) if (b.key !== NO_BORDER) expect(RING_KEYS, `palette de ${b.key}`).toContain(b.key);
    for (const k of RING_KEYS) expect(BORDERS.map((b) => b.key), `contour ${k} hors catalogue`).toContain(k);
  });

  it("chaque couleur a sa classe CSS (et son habillage)", () => {
    for (const c of COLORS) {
      if (c.key === DEFAULT_COLOR) continue;
      expect(css.includes(`.${c.cls}`), `classe .${c.cls}`).toBe(true);
      // dans la liste commune qui donne la police, le dégradé, le contour et les ornements (sinon le titre s'affiche en texte brut)
      expect(new RegExp(`\\.${c.cls}\\s*[,)]`).test(css), `.${c.cls} absent de la liste commune`).toBe(true);
    }
  });

  it("« Égide » : seul contour réservé aux administrateurs, jamais donné par une mission ni une formule ; aucun titre réservé", () => {
    const admin = BORDERS.filter((b) => b.adminOnly);
    expect(admin.map((b) => b.key)).toEqual(["admin"]);
    expect(admin[0].subscription).toBe(false);
    expect(MISSIONS.some((m) => m.grants.border === "admin")).toBe(false);
    expect(COLORS.map((c) => c.key)).not.toContain("admin");
    expect(normalizeBorder("border-admin")).toBe("admin");
    expect(normalizeColor("admin")).toBe(DEFAULT_COLOR);
  });

  it("chaque mission donne quelque chose de connu, avec des conditions valides", () => {
    for (const m of MISSIONS) {
      expect(m.grants.border || m.grants.color, m.id).toBeTruthy();
      if (m.grants.border) expect(BORDERS.map((b) => b.key), `${m.id} → contour`).toContain(m.grants.border);
      if (m.grants.color) expect(COLORS.map((c) => c.key), `${m.id} → couleur`).toContain(m.grants.color);
      expect(m.requirements.length).toBeGreaterThan(0);
      for (const r of m.requirements) {
        expect(STAT_LABEL[r.stat]).toBeTruthy();
        expect(r.min).toBeGreaterThan(0);
      }
    }
  });

  it("tout ce qui n'est pas offert par un abonnement s'obtient par mission", () => {
    for (const b of BORDERS) if (b.key !== NO_BORDER && !b.subscription && !b.adminOnly) expect(MISSIONS.some((m) => m.grants.border === b.key), `contour ${b.key}`).toBe(true);
    for (const c of COLORS) if (c.key !== DEFAULT_COLOR && !c.subscription) expect(MISSIONS.some((m) => m.grants.color === c.key), `couleur ${c.key}`).toBe(true);
  });

  it("les clés enregistrées avant la refonte donnent toujours la même chose", () => {
    const g = grantsOfMissions(["bronze", "flamme", "elite_text", "mathador"]);
    expect([...g.borders].sort()).toEqual(["bronze", "flamme", "mathador"]);
    expect([...g.colors].sort()).toEqual(["bronze", "elite", "flame"]);
    expect(grantsOfMissions(["inconnue"]).borders.size).toBe(0);
  });
});

describe("missions", () => {
  it("avancement : moyenne des conditions, chacune plafonnée", () => {
    const p = evaluateMission(MISSION_BY_ID.bronze, { ...zero, exo: 50, cours: 0, quiz: 15 });
    expect(p.requirements.map((r) => r.done)).toEqual([true, false, true]);
    expect(p.completed).toBe(false);
    expect(p.ratio).toBeCloseTo((1 + 0 + 1) / 3);
  });

  it("une mission est accomplie quand TOUTES ses conditions le sont", () => {
    expect(evaluateMission(MISSION_BY_ID.flamme, { ...zero, loginStreak: 30, loginCount: 30 }).completed).toBe(true);
    expect(evaluateMission(MISSION_BY_ID.flamme, { ...zero, loginStreak: 30, loginCount: 29 }).completed).toBe(false);
  });

  it("n'attribue que ce qui est accompli et pas encore possédé", () => {
    const stats = { ...zero, exo: 30, cours: 6, quiz: 20, loginStreak: 14, loginCount: 14 };
    expect(missionsToAward(stats, []).map((m) => m.id).sort()).toEqual(["aurore", "bronze"]);
    expect(missionsToAward(stats, ["bronze"]).map((m) => m.id)).toEqual(["aurore"]);
    expect(missionsToAward(zero, [])).toEqual([]);
  });

  it("les nouvelles missions s'accomplissent avec leurs seuils", () => {
    expect(missionsToAward({ ...zero, exoCorrect: 300 }, []).map((m) => m.id)).toEqual(["foudre"]);
    expect(missionsToAward({ ...zero, badges: 12 }, []).map((m) => m.id)).toEqual(["rubis"]);
    expect(missionsToAward({ ...zero, minigames: 30 }, []).map((m) => m.id)).toEqual(["camelia"]);
    expect(missionsToAward({ ...zero, cours: 30 }, []).map((m) => m.id)).toContain("sylve");
    expect(missionsToAward({ ...zero, quizPerfect: 10, quiz: 30 }, []).map((m) => m.id)).toContain("onyx");
  });
});
