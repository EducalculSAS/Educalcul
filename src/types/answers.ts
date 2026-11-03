/**
 * Réponse d'un élève à un bloc d'exercice. La forme dépend du type de bloc :
 * - texte, code, recherche de l'impossible, QCM à choix unique, vrai/faux ("true"/"false") : `string` ;
 * - choix multiples, mise en ordre, association, catégories, trous : liste de textes (`null` = case encore vide) ;
 * - droite graduée : `string` ou `number` ; repérage d'erreur : index de l'étape (`number`) ;
 * - dessin : `string` (image en data URL).
 */
export type AnswerValue = string | number | boolean | null | undefined | (string | null)[];

/** Réponses d'une tentative, indexées par identifiant de bloc. */
export type AnswerMap = Record<string, AnswerValue>;

/** Texte de la réponse, ou chaîne vide si ce n'est pas un texte. */
export const answerText = (v: AnswerValue): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** Liste de la réponse, ou liste vide si ce n'est pas une liste. */
export const answerList = (v: AnswerValue): (string | null)[] => (Array.isArray(v) ? v : []);
