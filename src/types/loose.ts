/**
 * Type « souple » pour le contenu JSON libre du site : blocs de cours, d'exercices et de quiz (dont la forme dépend du type de bloc, et qui
 * viennent aussi de l'IA et d'imports), lignes Supabase sélectionnées dynamiquement, et résultats de bibliothèques non typées.
 * C'est LE seul endroit où `any` est autorisé : l'utiliser, c'est dire « forme volontairement libre » ; partout ailleurs on préfère
 * `unknown` + un contrôle, ou un vrai type. Ne pas en abuser pour du code qui a une forme connue.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Loose = any;
