/**
 * Secret serveur de base pour signer/chiffrer (liens de partage, commentaires chiffrés). Il vient de la clé de service Supabase.
 * En production, son absence est une erreur (on ne retombe JAMAIS sur une valeur écrite dans le code : n'importe qui pourrait alors
 * fabriquer des liens valides) ; hors production, une valeur de développement permet de travailler sans configuration.
 */
export function serverSecret(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUPABASE_SERVICE_ROLE manquant : impossible de signer ou chiffrer en production.");
  }
  return "educalcul-dev-secret";
}
