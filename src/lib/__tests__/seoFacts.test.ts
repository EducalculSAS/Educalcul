import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Plan } from "@/lib/plans";
import { offersSchema, planFamily, priceTable, pricingDescription } from "@/lib/seo/pricing";
import { FOUNDERS, LEGAL_NAME, LEGAL_STATUS } from "@/lib/seo/site";

const plan = (id: number, name: string, price: number, billing_interval: string): Plan =>
  ({ id, name, description: null, price, billing_interval, trial_days: 7, promo_description: null, features: {} });
const PLANS = [plan(4, "Découverte", 0, "month"), plan(9, "Solo - 1 mois", 10, "month"), plan(10, "Solo - 1 trimestre", 25, "quarter"), plan(13, "Family - 1 mois", 15, "month"), plan(16, "Family - 1 an", 119, "year")];

describe("prix publiés pour les moteurs de recherche", () => {
  it("la description de /tarifs vient des formules réelles", () => {
    expect(pricingDescription(PLANS)).toBe("Formules Educalcul : Découverte (gratuite), Solo dès 10 €/mois, Family dès 15 €/mois. 7 jours d'essai gratuit, sans engagement.");
    expect(pricingDescription([plan(1, "Solo - 1 mois", 9.9, "month")])).toContain("Solo dès 9,9 €/mois");
  });
  it("sans formules (base indisponible) : un texte neutre, jamais un prix inventé", () => {
    const d = pricingDescription([]);
    expect(d).not.toMatch(/€/);
    expect(d).toContain("7 jours");
  });
  it("les données structurées reprennent chaque formule avec son vrai prix et sa période", () => {
    const items = offersSchema(PLANS).itemListElement.map((i) => i.item);
    expect(items.map((o) => [o.name, o.price])).toEqual([["Découverte", "0"], ["Solo - 1 mois", "10"], ["Solo - 1 trimestre", "25"], ["Family - 1 mois", "15"], ["Family - 1 an", "119"]]);
    expect(items[2]).toMatchObject({ priceSpecification: { billingDuration: "P3M", price: "25" } });
    expect(items[4]).toMatchObject({ priceSpecification: { billingDuration: "P1Y" } });
    expect(items[0]).not.toHaveProperty("priceSpecification");
    expect(planFamily("Family - 1 an")).toBe("Family");
  });
  it("aucun prix n'est écrit en dur dans les pages (ils avaient fini par différer des vraies formules)", () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? (f === "__tests__" ? [] : walk(p)) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
    for (const file of walk(join(process.cwd(), "src"))) expect(readFileSync(file, "utf8"), file).not.toMatch(/\b(9[.,]99|16[.,]99)\b/);
  });
});

describe("tableau des prix lisible dans le HTML", () => {
  const periods = [{ id: "month", label: "Mensuel" }, { id: "quarter", label: "Trimestriel" }, { id: "semester", label: "Semestriel" }, { id: "year", label: "Annuel" }];
  const withKids = (p: Plan, n: number): Plan => ({ ...p, features: { max_children: n } });
  const T = priceTable([withKids(PLANS[0], 1), ...PLANS.slice(1, 4).map((p) => withKids(p, 1)), withKids(PLANS[3], 5), withKids(PLANS[4], 5)], periods);
  it("une ligne par formule payante, une colonne par période réellement vendue", () => {
    expect(T.columns.map((c) => c.id)).toEqual(["month", "quarter", "year"]); // pas de colonne « semestriel » : aucune formule semestrielle
    expect(T.rows.map((r) => r.name)).toEqual(["Solo", "Family"]);
    expect(T.rows[0].prices).toEqual({ month: 10, quarter: 25 });
    expect(T.rows[1].prices).toEqual({ month: 15, year: 119 });
    expect(T.free).toEqual({ name: "Découverte", maxChildren: 1 });
  });
  it("sans formule payante : aucun tableau", () => {
    expect(priceTable([PLANS[0]], periods).rows).toEqual([]);
  });
});

describe("identité publiée : même orthographe que les mentions légales", () => {
  it("fondateurs et éditeur", () => {
    expect(FOUNDERS.map((f) => f.name)).toEqual(["Ruben Combe-Tamain", "Alexandre Tamain-Gloz"]);
    expect(LEGAL_NAME).toBe("EDUCALCUL");
    expect(LEGAL_STATUS).toContain("SAS");
  });
});
