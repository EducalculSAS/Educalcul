/**
 * Score minimum requis (en %) d'un exercice ou d'un quiz. Accepte ce qu'un
 * admin ou un import JSON peut envoyer : 75, "75", "75 %", "75,5" — borné à
 * 1–100, arrondi ; vide, 0 ou illisible = null (pas de minimum, donc le seuil
 * par défaut des viewers). Utilisé à la création ET à la modification : la
 * création l'ignorait complètement.
 */
export function parseMinScorePercent(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(100, Math.round(n));
}

/** Seuil de réussite par défaut quand l'exercice/quiz n'a pas de minimum. */
export const DEFAULT_PASS_PERCENT = 50;

/**
 * Seuil de réussite : le minimum de l'exercice/quiz, sinon 50 %. Une seule
 * définition pour les viewers ET le serveur (/api/child/activities), sinon
 * l'enfant voit « raté » alors que la base enregistre « réussi ».
 */
export const passThreshold = (min: number | null | undefined) => (min && min > 0 ? min : DEFAULT_PASS_PERCENT);
