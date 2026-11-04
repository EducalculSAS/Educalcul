import { BORDERS, COLORS } from "@/lib/cosmetics/catalog";

/**
 * Vue de compatibilité du catalogue (src/lib/cosmetics/catalog.ts, qui reste LA source) : contours et couleurs de nom
 * par clé. `source` vaut « subscription » quand une formule d'abonnement peut le donner, « badge » sinon (mission).
 */
export const BORDER_STYLES: Record<string, { label: string; preview: string; source: "badge" | "subscription" }> = Object.fromEntries(
  BORDERS.map((b) => [b.key, { label: b.label, preview: b.preview, source: b.subscription ? "subscription" : "badge" }]),
);

export const NAME_COLORS: Record<string, { cls: string; label: string; source: "badge" | "subscription" }> = Object.fromEntries(
  COLORS.map((c) => [c.key, { cls: c.cls, label: c.label, source: c.subscription ? "subscription" : "badge" }]),
);

export function getNameColor(key: string) {
  return NAME_COLORS[key] ?? NAME_COLORS.default;
}
