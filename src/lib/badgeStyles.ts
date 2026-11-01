/** Avatar border styles by key */
export const BORDER_STYLES: Record<string, { ring: string; label: string; preview: string; source?: "badge" | "subscription" | "admin" }> = {
  none:     { ring: "",    label: "Classique",       preview: "border-gray-200",   source: "badge" },
  bronze:   { ring: "",    label: "Forge",      preview: "border-amber-600",  source: "badge" },
  silver:   { ring: "",    label: "Acier",      preview: "border-gray-400",   source: "badge" },
  gold:     { ring: "",    label: "Lauriers",          preview: "border-yellow-400", source: "badge" },
  diamond:  { ring: "",    label: "Cristal",     preview: "border-cyan-400",   source: "badge" },
  premium:  { ring: "",    label: "Royal",     preview: "border-purple-500", source: "subscription" },
  famille:  { ring: "",    label: "Jardin",     preview: "border-teal-400",   source: "subscription" },
  flamme:   { ring: "",    label: "Brasier",      preview: "border-orange-500", source: "subscription" },
  pro:      { ring: "",    label: "Ailes d'or",  preview: "border-yellow-500", source: "subscription" },
  elite:    { ring: "",    label: "Astral",       preview: "border-pink-500",   source: "subscription" },
  mathador: { ring: "",    label: "Constellation",    preview: "border-indigo-500", source: "badge" },
  admin:    { ring: "",    label: "Égide",       preview: "border-red-500",    source: "admin" },
};

/** Name color styles by key */
export const NAME_COLORS: Record<string, { cls: string; label: string; source?: "badge" | "subscription" | "admin" }> = {
  // Badge unlocks (5 tiers)
  default:  { cls: "text-gray-800",         label: "Classique",      source: "badge" },
  bronze:   { cls: "name-bronze-animated",  label: "Forge",      source: "badge" },
  silver:   { cls: "name-silver-animated",  label: "Acier",      source: "badge" },
  gold:     { cls: "name-gold-animated",    label: "Lauriers",          source: "badge" },
  diamond:  { cls: "name-diamond-animated", label: "Cristal",     source: "badge" },
  // Subscription unlocks
  premium:  { cls: "name-purple-animated",  label: "Royal",     source: "subscription" },
  famille:  { cls: "name-teal-animated",    label: "Jardin",     source: "subscription" },
  pro:      { cls: "name-pro-animated",     label: "Ailes d'or",  source: "subscription" },
  flame:    { cls: "name-flame",            label: "Brasier",      source: "subscription" },
  elite:    { cls: "name-elite",            label: "Astral",       source: "subscription" },
  // Admin exclusive
  admin:    { cls: "name-admin-animated",   label: "Égide",       source: "admin" },
};

/** Fallback statique (si features pas encore chargées) */
const SUBSCRIPTION_UNLOCKS_FALLBACK: Record<string, { borders: string[]; colors: string[] }> = {
  "2": { borders: ["premium"],          colors: ["premium"] },
  "3": { borders: ["famille","flamme"], colors: ["famille"] },
};

export function getBorderStyle(key: string) { return BORDER_STYLES[key] ?? BORDER_STYLES.none; }
export function getNameColor(key: string) { return NAME_COLORS[key] ?? NAME_COLORS.default; }

/** Utilise les features du plan si disponibles, sinon fallback hardcodé */
export function getSubscriptionUnlocks(
  planId: string | number | null,
  planFeatures?: { cosmetic_borders?: string[]; cosmetic_colors?: string[] } | null
): { borders: string[]; colors: string[] } {
  if (planFeatures?.cosmetic_borders !== undefined) {
    return {
      borders: planFeatures.cosmetic_borders ?? [],
      colors: planFeatures.cosmetic_colors ?? [],
    };
  }
  return SUBSCRIPTION_UNLOCKS_FALLBACK[String(planId)] ?? { borders: [], colors: [] };
}
