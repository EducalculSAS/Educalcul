export const IMPERSONATION_COOKIE_NAME = "edu_impersonation";
/** Témoin lisible par le navigateur (sans valeur secrète) : indique seulement qu'une impersonation est en cours. */
export const IMPERSONATION_MARKER = "edu_imp";
export const IMPERSONATION_MAX_AGE = 60 * 60 * 6; // 6h — largement la durée d'une session admin.
