/**
 * Content-Security-Policy du site, posée par src/proxy.ts (et non plus par next.config.ts) parce que la version stricte exige un
 * « nonce » différent à chaque requête.
 *
 * Deux niveaux, selon la page :
 * - STRICTE (espaces connectés, contenu utilisateur, admin) : `script-src 'self' 'nonce-…'` — AUCUN script en ligne sans le nonce, donc
 *   un HTML injecté (<script>, onerror=…) ne s'exécute pas. Ces pages sont rendues à la demande (ƒ) : Next y pose le nonce sur ses
 *   scripts. Les scripts d'initialisation du thème sont un fichier externe (/api/boot-script), couvert par 'self'.
 * - STANDARD (vitrine, pages de connexion, 404) : ces pages sont pré-rendues (○) : leur HTML est identique pour tous, il ne peut donc pas
 *   porter de nonce ; `'unsafe-inline'` y reste nécessaire pour les scripts de Next. Elles n'affichent aucun contenu saisi par un utilisateur.
 *
 * `'unsafe-eval'` reste autorisé dans les deux cas : jsxgraph (figures de géométrie) et mathjs construisent des fonctions à l'exécution.
 *
 * ⚠ Si une page de la liste STRICTE devient pré-rendue (○), elle cessera de fonctionner : `npm run check:csp-routes` (lancé par le CI
 * après le build) le détecte.
 */

/** Préfixes rendus à la demande, protégés par la CSP stricte avec nonce. */
const STRICT_CSP_PREFIXES = ["/admin", "/parent", "/child", "/dashboard", "/u/", "/suivi/", "/maintenance", "/indisponible"] as const;

export function isStrictCspPath(pathname: string): boolean {
  return STRICT_CSP_PREFIXES.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)));
}

const SCRIPT_HOSTS = "https://js.stripe.com https://cdn.jsdelivr.net";

function common(): string[] {
  return [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "media-src 'self' blob: https://kygsmclnwuiocqyvzrvp.supabase.co",
    "connect-src 'self' https://*.supabase.co https://js.stripe.com https://m.stripe.network https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com",
    "frame-src https://js.stripe.com",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ];
}

/** CSP stricte : scripts en ligne uniquement avec le nonce de la requête. */
export function strictCsp(nonce: string): string {
  return [`script-src 'self' 'nonce-${nonce}' 'unsafe-eval' ${SCRIPT_HOSTS}`, ...common()].join("; ");
}

/** CSP des pages pré-rendues (HTML partagé, pas de nonce possible). */
export function standardCsp(): string {
  return [`script-src 'self' 'unsafe-inline' 'unsafe-eval' ${SCRIPT_HOSTS}`, ...common()].join("; ");
}

/** Nonce aléatoire (128 bits) en base64, compatible runtime Edge. */
export function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
