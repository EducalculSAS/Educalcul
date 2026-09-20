import { DifficultyLevel, difficultyRank, normalizeDifficulty } from "@/lib/difficultyLevels";

/** Règle de verrou unique, partagée entre le rendu cosmétique côté client
 * (catalogues) et l'application réelle côté serveur (page + route de
 * correction) — pour ne jamais reproduire le bug où les deux divergeaient
 * (voir contexte du plan : access_level_exercises n'était vérifié que côté
 * client, comparé au mauvais champ, et contournable par URL directe).
 * `maxAllowed` = le palier le plus difficile que le plan de l'utilisateur
 * autorise ; tout ce qui est strictement plus difficile est verrouillé. */
export function isDifficultyAllowed(
  maxAllowed: DifficultyLevel,
  contentDifficulty: string | null | undefined
): boolean {
  return difficultyRank(normalizeDifficulty(contentDifficulty)) <= difficultyRank(maxAllowed);
}
