// Config d'affichage des tarifs, éditable en admin et stockée en base
// (table app_settings, key 'pricing_config'). Ce fichier ne contient QUE des
// types + valeurs par défaut + normalisation — aucun accès base, donc
// importable côté client comme côté serveur.

import { DEFAULT_CUSTOM_PRICING, type PricingCustomConfig, type PricingOption, type AIId } from "./customPlanPricing";
import { DEFAULT_PERIODS, defaultPeriodLabel, isValidPeriodId, monthsOfPeriod, type BillingPeriod } from "./billingPeriods";

/** Ce qui s'affiche aux clients : l'admin masque / affiche chaque bloc sans rien supprimer. */
export interface PricingVisibility {
  /** Onglet « Pour les familles » (les formules). */
  familles: boolean;
  /** Onglet « Sur mesure ». */
  custom: boolean;
  /** Comparateur de formules (page /tarifs). */
  comparator: boolean;
  /** Bandeau « garantie » (page /tarifs). */
  guarantee: boolean;
  /** Mini-FAQ (page /tarifs). */
  faq: boolean;
}

export const DEFAULT_VISIBILITY: PricingVisibility = { familles: true, custom: true, comparator: true, guarantee: true, faq: true };

/** Présentation des formules : un onglet par période (Mensuel / Trimestriel…) ou une fiche par formule (Solo, Family…) avec le choix de la durée dedans. */
export type PricingLayout = "byPeriod" | "byPlan";

export interface PricingLabels {
  layout: PricingLayout;
  /** Étiquette « Populaire » automatique sur la fiche du milieu quand l'admin n'en a marqué aucune. */
  popularAuto: boolean;
  visibility: PricingVisibility;
  tabs: { familles: string; custom: string };
  /** Libellés des quatre périodes historiques (conservé pour les anciens appelants ; la source est `periods`). */
  intervals: { month: string; quarter: string; semester: string; year: string };
  /** Périodes proposées aux clients (onglets Mensuel / Trimestriel…), dans l'ordre d'affichage : l'admin en ajoute, retire, renomme. */
  periods: BillingPeriod[];
}

export interface PricingConfig extends PricingLabels {
  custom: PricingCustomConfig;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  layout: "byPeriod",
  popularAuto: true,
  visibility: DEFAULT_VISIBILITY,
  tabs: { familles: "Pour les familles", custom: "Sur mesure" },
  intervals: { month: "Mensuel", quarter: "Trimestriel", semester: "Semestriel", year: "Annuel" },
  periods: DEFAULT_PERIODS,
  custom: DEFAULT_CUSTOM_PRICING,
};

const AI_IDS: AIId[] = ["none", "15", "30", "60", "120", "unlim"];

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback;
};
const str = (v: unknown, fallback: string, max = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback);
/** Objet quelconque lu depuis la base ou un formulaire (jamais de confiance) : l'objet lui-même, ou `{}` si ce n'en est pas un. */
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const slug = (v: unknown) => String(v || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);

/** Ancien format `toggles` (objet) → nouvelle liste `options`. */
function migrateToggles(toggles: unknown): PricingOption[] {
  const prices = (toggles && typeof toggles === "object" ? toggles : {}) as Record<string, unknown>;
  return DEFAULT_CUSTOM_PRICING.options.map(def => ({
    ...def,
    price: num(prices[def.id], def.price),
  }));
}

function normalizeOptions(raw: unknown): PricingOption[] {
  if (Array.isArray(raw)) {
    const seen = new Set<string>();
    const out: PricingOption[] = [];
    for (const o of raw) {
      if (!o || typeof o !== "object") continue;
      let id = slug(o.id) || slug(o.label) || `opt${out.length + 1}`;
      while (seen.has(id)) id = `${id}_`;
      seen.add(id);
      out.push({
        id,
        label: str(o.label, "Option"),
        sub: typeof o.sub === "string" ? o.sub.trim().slice(0, 120) : undefined,
        price: num(o.price, 0),
        feature: slug(o.feature),
      });
    }
    return out;
  }
  return DEFAULT_CUSTOM_PRICING.options;
}

/** Liste de périodes valide : identifiants connus et uniques, triés par durée ; au moins une période. Sans liste enregistrée,
 * on part des quatre historiques (avec les anciens libellés personnalisés). */
function normalizePeriods(raw: unknown, legacyIntervals: Record<string, unknown>): BillingPeriod[] {
  if (!Array.isArray(raw)) {
    return DEFAULT_PERIODS.map((p) => ({ ...p, label: str(legacyIntervals?.[p.id], p.label) }));
  }
  const seen = new Set<string>();
  const out: BillingPeriod[] = [];
  for (const entry of raw) {
    const p = rec(entry);
    const id = String(p?.id ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!isValidPeriodId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: str(p?.label, defaultPeriodLabel(id), 40), months: monthsOfPeriod(id)! });
  }
  if (out.length === 0) return DEFAULT_PERIODS.slice(0, 1);
  return out.sort((a, b) => a.months - b.months);
}

/** Complète/nettoie une config brute (DB ou formulaire) avec les valeurs par défaut. */
export function normalizePricingConfig(raw: unknown): PricingConfig {
  const d = DEFAULT_PRICING_CONFIG;
  const r = rec(raw);
  const tabs = rec(r.tabs);
  const intervals = rec(r.intervals);
  const custom = rec(r.custom);

  // AI options : ordre canonique, seuls label/basePrice/daily varient.
  const rawAi = (Array.isArray(custom.ai_options) ? custom.ai_options : []).map(rec);
  const ai_options = AI_IDS.map((id) => {
    const def = DEFAULT_CUSTOM_PRICING.ai_options.find(o => o.id === id)!;
    const found = rawAi.find((o) => o?.id === id) || {};
    return {
      id,
      label: str(found.label, def.label, 40),
      daily: Number.isFinite(Number(found.daily)) ? Number(found.daily) : def.daily,
      basePrice: num(found.basePrice, def.basePrice),
    };
  });

  // Options : nouvelle liste, ou migration depuis l'ancien `toggles`.
  const options = Array.isArray(custom.options)
    ? normalizeOptions(custom.options)
    : custom.toggles
    ? migrateToggles(custom.toggles)
    : DEFAULT_CUSTOM_PRICING.options;

  const periods = normalizePeriods(r.periods, intervals);
  const labelOf = (id: string, fallback: string) => periods.find((p) => p.id === id)?.label ?? fallback;

  // Visible sauf si l'admin l'a masqué ; au moins un onglet reste affiché (sinon la page de choix serait vide).
  const vis = rec(r.visibility);
  const visibility: PricingVisibility = {
    familles: vis.familles !== false,
    custom: vis.custom !== false,
    comparator: vis.comparator !== false,
    guarantee: vis.guarantee !== false,
    faq: vis.faq !== false,
  };
  if (!visibility.familles && !visibility.custom) visibility.familles = true;

  return {
    layout: r.layout === "byPlan" ? "byPlan" : "byPeriod",
    popularAuto: r.popularAuto !== false,
    visibility,
    tabs: {
      familles: str(tabs.familles, d.tabs.familles),
      custom: str(tabs.custom, d.tabs.custom),
    },
    intervals: {
      month: labelOf("month", d.intervals.month),
      quarter: labelOf("quarter", d.intervals.quarter),
      semester: labelOf("semester", d.intervals.semester),
      year: labelOf("year", d.intervals.year),
    },
    periods,
    custom: {
      base_price: num(custom.base_price, d.custom.base_price),
      max_children: Math.min(999, Math.max(1, Math.floor(Number(custom.max_children) || d.custom.max_children))),
      child_linear: num(custom.child_linear, d.custom.child_linear),
      child_quadratic: num(custom.child_quadratic, d.custom.child_quadratic),
      ai_child_factor: num(custom.ai_child_factor, d.custom.ai_child_factor),
      ai_max_multiplier: Math.max(1, num(custom.ai_max_multiplier, d.custom.ai_max_multiplier)),
      ai_options,
      options,
    },
  };
}
