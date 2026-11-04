import { describe, expect, it } from "vitest";
import { SEASON_INIT_SCRIPT, isSeasonPath, isSeasonPreference, resolveSeason, seasonForDate } from "@/lib/season";

const d = (s: string) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };

describe("thème automatique selon le calendrier", () => {
  it("Noël du 1er décembre au 6 janvier", () => {
    expect(seasonForDate(d("2026-12-01"))).toBe("noel");
    expect(seasonForDate(d("2027-01-06"))).toBe("noel");
    expect(seasonForDate(d("2027-01-07"))).toBe("classique");
    expect(seasonForDate(d("2026-11-30"))).toBe("classique");
  });
  it("Pâques : une semaine avant et après (dimanche de Pâques calculé)", () => {
    expect(seasonForDate(d("2027-03-28"))).toBe("paques"); // Pâques 2027
    expect(seasonForDate(d("2026-04-05"))).toBe("paques"); // Pâques 2026
    expect(seasonForDate(d("2026-04-12"))).toBe("paques");
    expect(seasonForDate(d("2026-04-20"))).toBe("classique");
  });
  it("Coupe du monde 2026", () => {
    expect(seasonForDate(d("2026-06-11"))).toBe("foot");
    expect(seasonForDate(d("2026-07-19"))).toBe("foot");
    expect(seasonForDate(d("2026-07-20"))).toBe("classique");
  });
  it("Halloween du 20 octobre au 2 novembre", () => {
    expect(seasonForDate(d("2026-10-31"))).toBe("halloween");
    expect(seasonForDate(d("2026-11-03"))).toBe("classique");
  });
  it("un choix explicite l'emporte sur le calendrier", () => {
    expect(resolveSeason("foot", d("2026-12-25"))).toBe("foot");
    expect(resolveSeason("classique", d("2026-12-25"))).toBe("classique");
    expect(resolveSeason("auto", d("2026-12-25"))).toBe("noel");
  });
  it("seules les valeurs connues sont acceptées", () => {
    expect(isSeasonPreference("noel")).toBe(true);
    expect(isSeasonPreference("admin")).toBe(false);
  });
  const runInit = (pathname: string) => {
    const attrs: Record<string, string> = {};
    const fakeDoc = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } };
    const store = { getItem: () => "halloween" };
    new Function("localStorage", "document", "location", SEASON_INIT_SCRIPT)(store, fakeDoc, { pathname });
    return attrs;
  };
  it("le script d'initialisation est du JavaScript valide et applique le thème dans les espaces connectés", () => {
    expect(runInit("/child/dashboard")["data-season"]).toBe("halloween");
    expect(runInit("/parent/profile")["data-season"]).toBe("halloween");
    expect(runInit("/admin/profile")["data-season"]).toBe("halloween");
  });
  it("les pages publiques ne reçoivent jamais le thème de saison", () => {
    for (const p of ["/", "/offres", "/tarifs", "/programmes/6eme", "/calia-tuteur-ia-maths", "/a-propos", "/auth/connexion"]) expect(runInit(p)["data-season"], p).toBeUndefined();
    expect(isSeasonPath("/child")).toBe(true);
    expect(isSeasonPath("/childish")).toBe(false);
    expect(isSeasonPath("/")).toBe(false);
  });
});
