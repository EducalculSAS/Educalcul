// Taxonomie de difficulté partagée par les exercices et les quiz. Avant ce
// fichier, chaque écran (admin, catalogues enfant, détail quiz) redéclarait sa
// propre liste facile/moyen/difficile avec des synonymes anglais/français
// incohérents — source de bugs de comparaison (ex: ExercisesCatalog.tsx
// comparait "moyen" à rien du tout, jamais verrouillé). Un seul point de vérité
// désormais, avec normalisation de tout ce qui existe déjà en base.

export const DIFFICULTY_LEVELS = ["facile", "moyen", "avance", "difficile"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  facile: "Facile",
  moyen: "Moyen",
  avance: "Avancé",
  difficile: "Difficile",
};

const LEGACY_MAP: Record<string, DifficultyLevel> = {
  // Valeurs canoniques historiques (admin, AI generation)
  easy: "facile",
  medium: "moyen",
  hard: "difficile",
  expert: "difficile", // label quiz jamais réellement atteignable avant ce chantier
  // Synonymes français déjà tolérés défensivement dans plusieurs écrans
  facile: "facile",
  moyen: "moyen",
  moyenne: "moyen",
  avance: "avance",
  avancé: "avance",
  difficile: "difficile",
  // Anciennes valeurs de la feature plan "access_level_exercises" (sémantique
  // "niveau scolaire" avant ce chantier) — tolérées le temps que les plans en
  // base soient réenregistrés depuis l'admin avec les nouveaux paliers.
  basic: "facile",
  intermediate: "moyen",
  college: "moyen",
  advanced: "avance",
  all: "difficile",
};

/** Absorbe tout l'historique (easy/medium/hard/expert, synonymes FR déjà
 * présents en base) vers l'un des 4 paliers canoniques. Ne touche jamais la
 * base — sert uniquement à la comparaison/l'affichage. `null`/valeur inconnue
 * → "facile" (le palier le plus permissif, jamais un verrou par erreur sur du
 * contenu mal renseigné). */
export function normalizeDifficulty(raw: string | null | undefined): DifficultyLevel {
  if (!raw) return "facile";
  const key = raw.trim().toLowerCase();
  return LEGACY_MAP[key] ?? "facile";
}

/** 0 (facile) à 3 (difficile) — pour comparer "au moins aussi difficile que". */
export function difficultyRank(level: DifficultyLevel): number {
  return DIFFICULTY_LEVELS.indexOf(level);
}
