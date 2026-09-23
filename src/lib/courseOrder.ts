/**
 * Ordre d'affichage des cours dans un dossier — le même pour l'élève et pour
 * l'admin, qui le règle.
 *
 * `chapter_order` a été initialisé depuis le programme (thème × 100 +
 * chapitre, d'après les codes « 6e-t04-c02 » des fichiers source). Un cours
 * sans ordre passe en fin de liste, et les ex æquo se départagent par titre
 * pour que l'affichage reste stable d'un chargement à l'autre.
 */
export function compareCourseOrder(
  a: { chapter_order?: number | null; title?: string | null },
  b: { chapter_order?: number | null; title?: string | null },
): number {
  const oa = a.chapter_order ?? Number.POSITIVE_INFINITY;
  const ob = b.chapter_order ?? Number.POSITIVE_INFINITY;
  if (oa !== ob) return oa < ob ? -1 : 1;
  return String(a.title ?? "").localeCompare(String(b.title ?? ""), "fr");
}
