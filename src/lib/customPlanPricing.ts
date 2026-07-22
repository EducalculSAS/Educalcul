// Single source of truth for the "Sur mesure" custom plan pricing.
// The pricing parameters (base price, AI tiers, option prices, max children) are
// now DB-driven (table app_settings, key 'pricing_config') and passed in as a
// PricingCustomConfig. The formulas (quadratic per-child cost, AI multiplier)
// stay in code. The server must NEVER trust a client-supplied price/features —
// it recomputes both from the raw config with computeCustomPlan() using the
// authoritative pricing loaded from the DB.

export type AIId = "none" | "15" | "30" | "60" | "120" | "unlim";

export interface CustomPlanConfig {
  children: number;
  ai: AIId;
  reports: boolean;
  support: boolean;
  avatars: boolean;
  quiz: boolean;
}

export interface PricingAiOption {
  id: AIId;
  label: string;
  daily: number;
  basePrice: number;
}

export interface PricingCustomConfig {
  base_price: number;
  max_children: number;
  ai_options: PricingAiOption[];
  toggles: { reports: number; quiz: number; avatars: number; support: number };
}

// Valeurs par défaut = ce qui était codé en dur historiquement. Sert de repli
// si la config DB est absente/malformée.
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
  toggles: { reports: 0.99, quiz: 0.99, avatars: 0.99, support: 1.49 },
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
  if (c.reports) p += pricing.toggles.reports;
  if (c.support) p += pricing.toggles.support;
  if (c.avatars) p += pricing.toggles.avatars;
  if (c.quiz)    p += pricing.toggles.quiz;
  return Math.round(p * 100) / 100;
}

export function configFeatures(c: CustomPlanConfig, pricing: PricingCustomConfig = DEFAULT_CUSTOM_PRICING) {
  const ai = pricing.ai_options.find(o => o.id === c.ai);
  const n = Math.max(1, c.children);
  return {
    max_children: n,
    access_level_exercises: "all",
    ai_access: c.ai === "none" ? "none" : c.ai === "unlim" ? "unlimited" : "limited",
    ai_daily_limit: c.ai === "none" ? 0 : (ai?.daily ?? 0),
    detailed_reports: c.reports,
    custom_avatars: c.avatars,
    priority_support: c.support,
    quiz_access: c.quiz,
  };
}

/**
 * Validates and normalizes a raw client config, then returns the AUTHORITATIVE
 * price and features from the given pricing parameters. Returns null if the
 * config is malformed. Use this on the server so a tampered client
 * price/features can never take effect.
 */
export function computeCustomPlan(
  raw: any,
  pricing: PricingCustomConfig = DEFAULT_CUSTOM_PRICING,
): { price: number; features: ReturnType<typeof configFeatures> } | null {
  if (!raw || typeof raw !== "object") return null;
  const validAi = pricing.ai_options.some(o => o.id === raw.ai);
  if (!validAi) return null;
  const children = Math.min(pricing.max_children, Math.max(1, Math.floor(Number(raw.children) || 1)));
  const cfg: CustomPlanConfig = {
    children,
    ai: raw.ai,
    reports: !!raw.reports,
    support: !!raw.support,
    avatars: !!raw.avatars,
    quiz: !!raw.quiz,
  };
  return { price: configPrice(cfg, pricing), features: configFeatures(cfg, pricing) };
}
