/**
 * URL de base du site.
 *
 * Contexte (bug corrigé le 2026-09-21) : `NEXT_PUBLIC_SITE_URL` pointe sur
 * `educalcul.com`, qui sert aujourd'hui le projet Vercel "liste d'attente" —
 * pas l'application. Les URLs de retour Stripe construites avec cette valeur
 * renvoyaient donc les clients qui venaient de payer sur un 404 Vercel. Et
 * sans variable d'environnement du tout, le repli serveur était
 * `localhost:3000`, tout aussi inutilisable en production.
 *
 * `getRequestSiteUrl()` résout les deux cas : on renvoie l'utilisateur sur le
 * domaine d'où sa requête vient réellement — mais uniquement si ce domaine
 * fait partie d'une liste blanche, car un en-tête `Origin`/`Host` est
 * falsifiable et servirait sinon d'open redirect via les URLs Stripe.
 */

/** Domaines de l'application connus, en plus de ceux injectés par Vercel. */
const KNOWN_APP_ORIGINS = [
  "https://educalcul.vercel.app",
  "https://educalcul.com",
  "https://www.educalcul.com",
];

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, "").toLowerCase();
}

/** URL de base issue de la configuration serveur (jamais du client). */
export function getSiteUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Repli serveur : les URLs que Vercel injecte automatiquement, avant de
  // tomber sur localhost (qui n'a de sens qu'en développement).
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) {
    return `https://${vercelHost.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

/** Origines acceptables pour une URL de retour (Stripe, OAuth…). */
function allowedOrigins(): string[] {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL &&
      `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
    ...KNOWN_APP_ORIGINS,
    process.env.NODE_ENV !== "production" && "http://localhost:3000",
  ];

  return [
    ...new Set(
      candidates
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .map(normalizeOrigin),
    ),
  ];
}

/**
 * URL de base à utiliser pour renvoyer l'utilisateur sur le site après un
 * détour externe (paiement Stripe, portail de facturation). Préfère le
 * domaine réellement utilisé par la requête quand il est légitime, sinon
 * retombe sur la configuration serveur.
 */
export function getRequestSiteUrl(req: Request): string {
  const allowed = allowedOrigins();

  const headerOrigin = req.headers.get("origin");
  if (headerOrigin && allowed.includes(normalizeOrigin(headerOrigin))) {
    return headerOrigin.replace(/\/$/, "");
  }

  // Une navigation classique n'envoie pas toujours d'en-tête Origin : on
  // reconstruit alors l'origine à partir de l'hôte de la requête.
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const reconstructed = `${proto}://${host}`;
    if (allowed.includes(normalizeOrigin(reconstructed))) {
      return reconstructed;
    }
  }

  return getSiteUrl();
}
