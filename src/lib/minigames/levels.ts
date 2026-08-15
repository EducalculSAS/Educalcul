/** Les mini-jeux (calcul mental notamment) sont pensés par l'équipe pédagogique
 * en compte à rebours (11 = CP, 00 = Terminale), repris tel quel dans les
 * fiches de règles. Le reste de l'app utilise les clés `SCHOOL_LEVELS`
 * (src/lib/constants.ts) — cette table fait la correspondance dans les deux
 * sens plutôt que d'introduire un second système de niveaux.
 *
 * Le lycée n'a qu'une entrée par année ici (pas de distinction spé
 * maths/expertes/complémentaires) : les mini-jeux se calent sur l'année, pas
 * la spécialité — `gradeLevelToMinigameCode` retombe sur la même case pour
 * toutes les variantes d'une même année.
 */
export const MINIGAME_LEVEL_CODES: { code: string; gradeLevel: string; label: string }[] = [
  { code: "11", gradeLevel: "cp", label: "CP" },
  { code: "10", gradeLevel: "ce1", label: "CE1" },
  { code: "09", gradeLevel: "ce2", label: "CE2" },
  { code: "08", gradeLevel: "cm1", label: "CM1" },
  { code: "07", gradeLevel: "cm2", label: "CM2" },
  { code: "06", gradeLevel: "6eme", label: "6ème" },
  { code: "05", gradeLevel: "5eme", label: "5ème" },
  { code: "04", gradeLevel: "4eme", label: "4ème" },
  { code: "03", gradeLevel: "3eme", label: "3ème" },
  { code: "02", gradeLevel: "2nde", label: "Seconde" },
  { code: "01", gradeLevel: "1ere-generale-maths", label: "Première" },
  { code: "00", gradeLevel: "terminale-generale-maths", label: "Terminale" },
];

const GRADE_LEVEL_ALIASES: Record<string, string> = {
  "1ere-generale": "1ere-generale-maths",
  "terminale-generale": "terminale-generale-maths",
  "terminale-generale-expertes": "terminale-generale-maths",
  "terminale-generale-complementaires": "terminale-generale-maths",
};

export function minigameCodeToGradeLevel(code: string): string | null {
  return MINIGAME_LEVEL_CODES.find((l) => l.code === code)?.gradeLevel ?? null;
}

export function gradeLevelToMinigameCode(gradeLevel: string): string | null {
  const normalized = GRADE_LEVEL_ALIASES[gradeLevel] ?? gradeLevel;
  return MINIGAME_LEVEL_CODES.find((l) => l.gradeLevel === normalized)?.code ?? null;
}
