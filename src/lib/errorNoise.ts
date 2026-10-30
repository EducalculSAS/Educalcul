/**
 * Erreurs qui ne méritent PAS d'apparaître dans Admin > Erreurs : elles viennent du navigateur, du réseau ou des pages
 * de test, jamais d'un défaut du site à corriger. Une ligne de plus dans le journal = une notification de plus aux admins.
 */

// Message ou pile.
const NOISE = [
  /Lock was stolen by another request/i, // verrou d'authentification Supabase repris par un autre onglet / aperçu : la requête est rejouée
  /ResizeObserver loop/i,
  /^Script error\.?$/i, // script d'un autre domaine (extension, publicité) : aucun détail exploitable
  /Load failed/i,
  /Failed to fetch/i,
  /NetworkError/i,
  /AbortError/i,
  /NEXT_REDIRECT/,
  /NEXT_NOT_FOUND/,
  /chrome-extension:\/\//,
  /moz-extension:\/\//,
  /safari-(web-)?extension:\/\//,
  /Router action dispatched before initialization/i, // interne à Next.js, au démarrage d'une page
  /ChunkLoadError|Loading chunk .* failed|Failed to load chunk|error loading dynamically imported module|Importing a module script failed/i, // visiteur resté sur une ancienne version après un déploiement
  /Non-Error promise rejection captured/i,
  /Java object is gone|Illegal invocation.*webkit/i, // navigateurs intégrés des applications (Facebook, Instagram...)
];

// Pages de test et de démonstration : jamais vues par un élève ou un parent.
const NOISE_PATHS = /^\/?(GET |POST )?\/(dev|tmp|test|demo)(-[\w-]*)?(\/|$)/i;

// Erreurs d'hydratation React (#418, #423, #425...) : sur les pages publiques, elles viennent presque toujours du navigateur du visiteur
// (traduction automatique, extension, numéros transformés en liens). On ne les garde que dans les espaces que le site contrôle.
const HYDRATION = /Minified React error #(418|423|425)\b|Hydration failed|Text content does not match server-rendered HTML|There was an error while hydrating/i;
const APP_AREAS = /^\/(admin|child|parent)(\/|$)/;

export function isNoiseError(report: { message: string; stack?: string | null; url?: string | null }): boolean {
  const message = report.message ?? "";
  const stack = report.stack ?? "";
  const url = report.url ?? "";
  if (NOISE.some((re) => re.test(message) || re.test(stack))) return true;
  if (NOISE_PATHS.test(url)) return true;
  if (HYDRATION.test(message) && !APP_AREAS.test(url)) return true;
  return false;
}
