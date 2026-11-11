/** Rang de chaque badge dans sa catégorie (ordre des seuils). */
export function badgeTiers(badges: { id: number; requirement_type?: string | null; requirement_value?: number | null }[]): Record<number, number> {
  const byType: Record<string, { id: number; v: number }[]> = {};
  for (const b of badges) (byType[b.requirement_type || "?"] ??= []).push({ id: b.id, v: b.requirement_value ?? 0 });
  const out: Record<number, number> = {};
  for (const list of Object.values(byType)) list.sort((a, b) => a.v - b.v).forEach((b, i) => { out[b.id] = i; });
  return out;
}
