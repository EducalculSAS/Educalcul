/** Avatar border styles by key */
export const BORDER_STYLES: Record<string, { ring: string; label: string; preview: string; source?: "badge" | "subscription" }> = {
  none:     { ring: "",    label: "Aucun",       preview: "border-gray-200",   source: "badge" },
  bronze:   { ring: "",    label: "Bronze",      preview: "border-amber-600",  source: "badge" },
  silver:   { ring: "",    label: "Argent",      preview: "border-gray-400",   source: "badge" },
  gold:     { ring: "",    label: "Or",          preview: "border-yellow-400", source: "badge" },
  diamond:  { ring: "",    label: "Diamant",     preview: "border-cyan-400",   source: "badge" },
  premium:  { ring: "",    label: "Premium",     preview: "border-purple-500", source: "subscription" },
  famille:  { ring: "",    label: "Famille",     preview: "border-teal-400",   source: "subscription" },
  flamme:   { ring: "",    label: "Flamme",      preview: "border-orange-500", source: "subscription" },
  pro:      { ring: "",    label: "Annuel Pro",  preview: "border-yellow-500", source: "subscription" },
  elite:    { ring: "",    label: "Elite",       preview: "border-pink-500",   source: "subscription" },
};

/** Name color styles by key */
export const NAME_COLORS: Record<string, { cls: string; label: string; source?: "badge" | "subscription" }> = {
  // Badge unlocks (5 tiers)
  default:  { cls: "text-gray-800",         label: "Défaut",      source: "badge" },
  bronze:   { cls: "name-bronze-animated",  label: "Bronze",      source: "badge" },
  silver:   { cls: "name-silver-animated",  label: "Argent",      source: "badge" },
  gold:     { cls: "name-gold-animated",    label: "Or",          source: "badge" },
  diamond:  { cls: "name-diamond-animated", label: "Diamant",     source: "badge" },
  // Subscription unlocks
  premium:  { cls: "name-purple-animated",  label: "Premium",     source: "subscription" },
  famille:  { cls: "name-teal-animated",    label: "Famille",     source: "subscription" },
  pro:      { cls: "name-pro-animated",     label: "Annuel Pro",  source: "subscription" },
  flame:    { cls: "name-flame",            label: "Flamme",      source: "subscription" },
  elite:    { cls: "name-elite",            label: "Elite",       source: "subscription" },
};

/** Plan ID → unlocked borders & colors */
export const SUBSCRIPTION_UNLOCKS: Record<string, { borders: string[]; colors: string[] }> = {
  "1": { borders: [],                       colors: [] },
  "2": { borders: ["premium"],              colors: ["premium"] },
  "3": { borders: ["famille","flamme"],     colors: ["famille"] },
  "4": { borders: ["flamme","pro","elite"], colors: ["pro","flame","elite"] },
};

export function getBorderStyle(key: string) { return BORDER_STYLES[key] ?? BORDER_STYLES.none; }
export function getNameColor(key: string) { return NAME_COLORS[key] ?? NAME_COLORS.default; }
export function getSubscriptionUnlocks(planId: string | number | null) {
  return SUBSCRIPTION_UNLOCKS[String(planId)] ?? { borders: [], colors: [] };
}
