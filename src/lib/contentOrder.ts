/**
 * Ordre d'affichage des exercices et des quiz dans un dossier — le même pour
 * l'élève et pour l'admin, qui le règle avec les flèches. Sans ordre choisi,
 * l'ordre de création (id) ; un élément sans ordre passe après ceux qui en ont.
 */
export function compareDisplayOrder(
  a: { display_order?: number | null; id: string | number },
  b: { display_order?: number | null; id: string | number },
): number {
  const oa = a.display_order ?? Number.POSITIVE_INFINITY;
  const ob = b.display_order ?? Number.POSITIVE_INFINITY;
  if (oa !== ob) return oa < ob ? -1 : 1;
  return Number(a.id) - Number(b.id);
}

/**
 * Ordre des dossiers d'un même niveau : display_order, puis l'ordre reçu du serveur (déjà trié par nom) — le tri est
 * stable, donc sans ordre choisi l'admin voit exactement ce que voit l'élève.
 */
export function compareFolderOrder(a: { display_order?: number | null }, b: { display_order?: number | null }): number {
  return (a.display_order ?? 0) - (b.display_order ?? 0);
}
