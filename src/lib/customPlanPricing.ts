// Single source of truth for the "Sur mesure" custom plan pricing.
// Shared by the client configurator (display) AND the checkout API (authoritative
// recompute). The server must NEVER trust a client-supplied price/features — it
// recomputes both from the raw config with computeCustomPlan().

export type AIId = "none" | "15" | "30" | "60" | "120" | "unlim";

export interface CustomPlanConfig {
  children: number;
  ai: AIId;
  reports: boolean;
  support: boolean;
  avatars: boolean;
  quiz: boolean;
}

export const AI_OPTIONS = [
  { id: "none",  label: "Aucune",     daily: 0,   basePrice: 0    },
  { id: "15",    label: "15/j",       daily: 15,  basePrice: 0.99 },
  { id: "30",    label: "30/j",       daily: 30,  basePrice: 1.99 },
  { id: "60",    label: "60/j",       daily: 60,  basePrice: 3.49 },
  { id: "120",   label: "120/j",      daily: 120, basePrice: 5.99 },
  { id: "unlim", label: "Illimitée",  daily: -1,  basePrice: 8.99 },
] as const;

export const CUSTOM_BASE_PRICE = 14.99;
export const MAX_CHILDREN = 20;

export function childrenCost(n: number): number {
  if (n <= 1) return 0;
  const x = n - 1;
  return Math.round((0.5 * x + 0.25 * x * x) * 100) / 100;
}

export function aiMultiplier(n: number): number {
  return Math.min(1 + (n - 1) * 0.35, 4.0);
}

export function configPrice(c: CustomPlanConfig): number {
  let p = CUSTOM_BASE_PRICE;
  const n = Math.max(1, c.children);
  p += childrenCost(n);
  const aiBase = AI_OPTIONS.find(o => o.id === c.ai)!.basePrice;
  p += Math.round(aiBase * aiMultiplier(n) * 100) / 100;
  if (c.reports) p += 0.99;
  if (c.support) p += 1.49;
  if (c.avatars) p += 0.99;
  if (c.quiz)    p += 0.99;
  return Math.round(p * 100) / 100;
}

export function configFeatures(c: CustomPlanConfig) {
  const ai = AI_OPTIONS.find(o => o.id === c.ai)!;
  const n = Math.max(1, c.children);
  return {
    max_children: n,
    access_level_exercises: "all",
    ai_access: c.ai === "none" ? "none" : c.ai === "unlim" ? "unlimited" : "limited",
    ai_daily_limit: c.ai === "none" ? 0 : ai.daily,
    detailed_reports: c.reports,
    custom_avatars: c.avatars,
    priority_support: c.support,
    quiz_access: c.quiz,
  };
}

/**
 * Validates and normalizes a raw client config, then returns the AUTHORITATIVE
 * price and features. Returns null if the config is malformed. Use this on the
 * server so a tampered client price/features can never take effect.
 */
export function computeCustomPlan(raw: any): { price: number; features: ReturnType<typeof configFeatures> } | null {
  if (!raw || typeof raw !== "object") return null;
  const validAi = AI_OPTIONS.some(o => o.id === raw.ai);
  if (!validAi) return null;
  const children = Math.min(MAX_CHILDREN, Math.max(1, Math.floor(Number(raw.children) || 1)));
  const cfg: CustomPlanConfig = {
    children,
    ai: raw.ai,
    reports: !!raw.reports,
    support: !!raw.support,
    avatars: !!raw.avatars,
    quiz: !!raw.quiz,
  };
  return { price: configPrice(cfg), features: configFeatures(cfg) };
}
