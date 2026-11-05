import { describe, expect, it } from "vitest";
import { LEVEL_PAGES, chapterCount, neighbours } from "@/lib/seo/levels";
import { SCHOOL_LEVELS } from "@/lib/constants";
import sitemap from "@/app/sitemap";

describe("pages publiques par niveau", () => {
  it("ont des slugs uniques et des niveaux qui existent dans l'application", () => {
    const slugs = LEVEL_PAGES.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const known = new Set(SCHOOL_LEVELS.map((l) => l.value));
    for (const l of LEVEL_PAGES) expect(known.has(l.appLevel), l.appLevel).toBe(true);
  });

  it("ont des titres et descriptions de longueur raisonnable, tous différents", () => {
    for (const l of LEVEL_PAGES) {
      expect(l.title.length, l.title).toBeLessThanOrEqual(62); // Google tronque au-delà d'environ 60 caractères
      expect(l.description.length, l.slug).toBeGreaterThan(80);
      expect(l.description.length, l.slug).toBeLessThanOrEqual(200);
    }
    expect(new Set(LEVEL_PAGES.map((l) => l.title)).size).toBe(LEVEL_PAGES.length);
    expect(new Set(LEVEL_PAGES.map((l) => l.description)).size).toBe(LEVEL_PAGES.length);
  });

  it("proposent un exercice dont la bonne réponse fait partie des choix", () => {
    for (const l of LEVEL_PAGES) {
      expect(l.exercise.choices, l.slug).toContain(l.exercise.answer);
      expect(new Set(l.exercise.choices).size).toBe(l.exercise.choices.length);
      expect(chapterCount(l)).toBeGreaterThan(5);
      expect(l.faq.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("sont chaînées (précédent / suivant)", () => {
    expect(neighbours("cp").prev).toBeUndefined();
    expect(neighbours("cp").next?.slug).toBe("ce1");
    expect(neighbours("terminale-specialite-maths").next).toBeUndefined();
  });

  it("figurent dans le sitemap, sans doublon ni date future", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const l of LEVEL_PAGES) expect(urls).toContain(`https://educalcul.com/programmes/${l.slug}`);
    expect(urls).toContain("https://educalcul.com/calia-tuteur-ia-maths");
    // le sitemap ne liste que des pages indexables : la page de connexion est en noindex
    expect(urls.some((u) => u.includes("/auth/connexion"))).toBe(false);
    for (const e of entries) if (e.lastModified) expect(new Date(e.lastModified).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
