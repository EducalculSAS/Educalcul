/** Champ de période encore présent sur l'abonnement des anciennes versions de l'API (absent du type récent) : lu sans conversion, contrôlé à l'exécution. */
export function legacyPeriodField(sub: object, key: "current_period_start" | "current_period_end"): number | undefined {
  const v = key in sub ? (sub as Record<string, unknown>)[key] : undefined;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
