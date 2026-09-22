/**
 * Chemin de redirection sûr, issu d'un paramètre d'URL.
 *
 * N'accepte qu'un chemin INTERNE au site (« /child/dashboard »). Refusés :
 *  - une URL absolue (« https://site-pirate.com ») — redirection ouverte :
 *    un lien piégé renverrait l'utilisateur, juste après sa vraie connexion,
 *    vers une fausse page qui lui redemande son mot de passe ;
 *  - « //site-pirate.com » et « /\site-pirate.com », que les navigateurs
 *    interprètent comme une URL absolue sans protocole ;
 *  - « javascript:… » et tout autre schéma : assigné à window.location, du
 *    code s'exécuterait dans la session de l'utilisateur.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  let path: string;
  try {
    path = decodeURIComponent(value).trim();
  } catch {
    return fallback;
  }
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  // Caractères de contrôle (tabulation, retour chariot…) : certains
  // navigateurs les ignorent, ce qui transforme « /\t/pirate.com » en « //pirate.com ».
  if (/[\u0000-\u001f\u007f]/.test(path)) return fallback;
  return path;
}
