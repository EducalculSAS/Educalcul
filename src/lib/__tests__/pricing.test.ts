import { describe, expect, it } from "vitest";
import { normalizePricingConfig, DEFAULT_PRICING_CONFIG } from "@/lib/pricingConfig";
import { computeCustomPlan } from "@/lib/customPlanPricing";

describe("normalizePricingConfig : jamais de confiance dans une config brute", () => {
  it("valeurs par défaut sur n'importe quelle entrée invalide", () => {
    for (const bad of [null, undefined, 42, "x", [], { custom: "oups", tabs: 3 }]) {
      const c = normalizePricingConfig(bad);
      expect(c.periods.length).toBeGreaterThan(0);
      expect(c.custom.ai_options.length).toBe(DEFAULT_PRICING_CONFIG.custom.ai_options.length);
      expect(c.visibility.familles || c.visibility.custom).toBe(true);
    }
  });
  it("nettoie les libellés et borne les nombres", () => {
    const c = normalizePricingConfig({ tabs: { familles: "  Mes familles  " }, custom: { max_children: 99999, base_price: -3 } });
    expect(c.tabs.familles).toBe("Mes familles");
    expect(c.custom.max_children).toBe(999);
    expect(c.custom.base_price).toBe(DEFAULT_PRICING_CONFIG.custom.base_price);
  });
});

describe("computeCustomPlan : le prix vient du serveur", () => {
  it("rejette une config absente ou à IA inconnue", () => {
    expect(computeCustomPlan(null)).toBeNull();
    expect(computeCustomPlan({ ai: "inconnu", children: 2 })).toBeNull();
  });
  it("ignore les options inconnues envoyées par le client", () => {
    const ok = computeCustomPlan({ ai: "none", children: 2, options: { pirate: true } });
    expect(ok).not.toBeNull();
    expect(ok!.price).toBe(computeCustomPlan({ ai: "none", children: 2, options: {} })!.price);
  });
});
