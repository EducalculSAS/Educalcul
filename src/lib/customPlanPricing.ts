// Single source of truth for the "Sur mesure" custom plan pricing.
// Pricing parameters (base price, AI tiers, add-on OPTIONS, max children) are
// DB-driven (table app_settings, key 'pricing_config') and passed in as a
// PricingCustomConfig. Add-on options are a DYNAMIC list (admin can add / delete
// / rename / reprice). The formulas (quadratic per-child cost, AI multiplier)
// stay in code. The server must NEVER trust a client-supplied price/features —
// it recomputes both from the raw config with computeCustomPlan() using the
// authoritative pricing loaded from the DB.

export type AIId = "none" | "15" | "30" | "60" | "120" | "unlim";

export interface PricingAiOption {
  id: AIId;
  label: string;
  daily: number;
  basePrice: number;
}

// Une option additionnelle du sur-mesure (interrupteur payant).
export interface PricingOption {
  id: string;        // slug unique et stable
  label: string;
  sub?: string;      // petite description
  price: number;
  feature: string;   // clé de fonctionnalité activée quand cochée ("" = aucun effet)
}

export interface PricingCustomConfig {
  base_price: number;
  max_children: number;
  ai_options: PricingAiOption[];
  options: PricingOption[];
}

// La config choisie par le client : nb d'enfants, palier IA, et l'état de
// chaque option (par id).
export interface CustomPlanConfig {
  children: number;
  ai: AIId;
  options: Record<string, boolean>;
}

// Valeurs par défaut = ce qui était codé en dur historiquement. Sert de repli.
export const DEFAULT_CUSTOM_PRICING: PricingCustomConfig = {
  base_price: 14.99,
  max_children: 20,
  ai_options: [
    { id: "none",  label: "Aucune",     daily: 0,   basePrice: 0    },
    { id: "15",    label: "15/j",       daily: 15,  basePrice: 0.99 },
    { id: "30",    label: "30/j",       daily: 30,  basePrice: 1.99 },
    { id: "60",    label: "60/j",       daily: 60,  basePrice: 3.49 },
    { id: "120",   label: "120/j",      daily: 120, basePrice: 5.99 },
    { id: "unlim", label: "Illimitée",  daily: -1,  basePrice: 8.99 },
  ],
  options: [
    { id: "reports", label: "Rapports hebdomadaires", sub: "Résumé email chaque semaine",        price: 0.99, feature: "detailed_reports" },
    { id: "quiz",    label: "Quiz",                    sub: "Accès à tous les quiz et évaluations", price: 0.99, feature: "quiz_access" },
    { id: "avatars", label: "Avatars & cosmétiques",  sub: "Contours et couleurs de nom exclusifs", price: 0.99, feature: "custom_avatars" },
    { id: "support", label: "Support prioritaire",    sub: "Réponse garantie sous 4h en semaine",  price: 1.49, feature: "priority_support" },
  ],
};

// Compat : anciens exports (= valeurs par défaut).
export const AI_OPTIONS = DEFAULT_CUSTOM_PRICING.ai_options;
export const CUSTOM_BASE_PRICE = DEFAULT_CUSTOM_PRICING.base_price;
export const MAX_CHILDREN = DEFAULT_CUSTOM_PRICING.max_children;

export function childrenCost(n: number): number {
  if (n <= 1) return 0;
  const x = n - 1;
  return Math.round((0.5 * x + 0.25 * x * x) * 100) / 100;
}

export function aiMultiplier(n: number): number {
  return Math.min(1 + (n - 1) * 0.35, 4.0);
}

export function configPrice(c: CustomPlanConfig, pricing: PricingCustomConfig = DEFAULT_CUSTOM_PRICING): number {
  let p = pricing.base_price;
  const n = Math.max(1, c.children);
  p += childrenCost(n);
  const aiBase = pricing.ai_options.find(o => o.id === c.ai)?.basePrice ?? 0;
  p += Math.round(aiBase * aiMultiplier(n) * 100) / 100;
  for (const opt of pricing.options) {
    if (c.options?.[opt.id]) p += opt.price;
  }
  return Math.round(p * 100) / 100;
}

export function configFeatures(c: CustomPlanConfig, pricing: PricingCustomConfig = DEFAULT_CUSTOM_PRICING) {
  const ai = pricing.ai_options.find(o => o.id === c.ai);
  const n = Math.max(1, c.children);
  const feats: Record<string, any> = {
    max_children: n,
    access_level_exercises: "difficile",
    ai_access: c.ai === "none" ? "none" : c.ai === "unlim" ? "unlimited" : "limited",
    ai_daily_limit: c.ai === "none" ? 0 : (ai?.daily ?? 0),
  };
  for (const opt of pricing.options) {
    if (c.options?.[opt.id] && opt.feature) feats[opt.feature] = true;
  }
  return feats;
}

/**
 * Validates and normalizes a raw client config, then returns the AUTHORITATIVE
 * price and features from the given pricing parameters. Only option ids present
 * in the server pricing are honored — a tampered client can never inject an
 * unknown priced option. Returns null if malformed.
 */
export function computeCustomPlan(
  raw: any,
  pricing: PricingCustomConfig = DEFAULT_CUSTOM_PRICING,
): { price: number; features: ReturnType<typeof configFeatures> } | null {
  if (!raw || typeof raw !== "object") return null;
  const validAi = pricing.ai_options.some(o => o.id === raw.ai);
  if (!validAi) return null;
  const children = Math.min(pricing.max_children, Math.max(1, Math.floor(Number(raw.children) || 1)));
  const options: Record<string, boolean> = {};
  for (const opt of pricing.options) {
    options[opt.id] = !!(raw.options && raw.options[opt.id]);
  }
  const cfg: CustomPlanConfig = { children, ai: raw.ai, options };
  return { price: configPrice(cfg, pricing), features: configFeatures(cfg, pricing) };
}
