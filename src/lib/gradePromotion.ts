/**
 * Passage automatique à la classe supérieure. Les niveaux qui se ramifient
 * (sortie de Seconde : choix d'une spécialité maths) n'ont pas de "suivant"
 * automatique — un adulte doit choisir la voie manuellement dans ce cas.
 */
const NEXT_GRADE: Record<string, string | null> = {
  cp: "ce1",
  ce1: "ce2",
  ce2: "cm1",
  cm1: "cm2",
  cm2: "6eme",
  "6eme": "5eme",
  "5eme": "4eme",
  "4eme": "3eme",
  "3eme": "2nde",
  "2nde": null, // choix de spécialité requis, pas d'avancement automatique
  "1ere-generale": "terminale-generale",
  "1ere-generale-maths": "terminale-generale-maths",
  "terminale-generale": null,
  "terminale-generale-maths": null,
  "terminale-generale-expertes": null,
  "terminale-generale-complementaires": null,
};

export function getNextGrade(current: string | null | undefined): string | null {
  if (!current) return null;
  return NEXT_GRADE[current] ?? null;
}
