/** Le calcul mental groupe les 16 valeurs `SCHOOL_LEVELS` (src/lib/constants.ts)
 * en 12 "paliers" de difficulté (11=CP → 00=Terminale, décompte fourni par
 * l'équipe pédagogique) — plusieurs niveaux scolaires partagent le même
 * palier (ex. les 4 variantes de Terminale partagent le palier "00"), la
 * grille d'opérations ne distingue pas les filières à ce niveau de détail.
 * Mathador n'utilise pas de palier — il reste rattaché au `grade_level` brut. */
export const PALIER_CODES = [
  "11", "10", "09", "08", "07", "06", "05", "04", "03", "02", "01", "00",
] as const;
export type PalierCode = (typeof PALIER_CODES)[number];

const GRADE_LEVEL_TO_PALIER: Record<string, PalierCode> = {
  cp: "11",
  ce1: "10",
  ce2: "09",
  cm1: "08",
  cm2: "07",
  "6eme": "06",
  "5eme": "05",
  "4eme": "04",
  "3eme": "03",
  "2nde": "02",
  "1ere-generale": "01",
  "1ere-generale-maths": "01",
  "terminale-generale": "00",
  "terminale-generale-maths": "00",
  "terminale-generale-expertes": "00",
  "terminale-generale-complementaires": "00",
};

export function gradeLevelToPalier(gradeLevel: string): PalierCode | null {
  return GRADE_LEVEL_TO_PALIER[gradeLevel] ?? null;
}

/** Tous les `grade_level` qui partagent le palier donné — sert à regrouper
 * le classement calcul mental par palier plutôt que par niveau exact. */
export function palierToGradeLevels(code: PalierCode): string[] {
  return Object.entries(GRADE_LEVEL_TO_PALIER)
    .filter(([, c]) => c === code)
    .map(([gl]) => gl);
}

// Alias conservés pour les call-sites existants (Mathador affiche encore un
// "levelCode" informatif dans sa réponse API — non utilisé pour filtrer quoi
// que ce soit côté Mathador, juste un résumé de niveau côté client).
export function gradeLevelToMinigameCode(gradeLevel: string): string | null {
  return gradeLevelToPalier(gradeLevel);
}
