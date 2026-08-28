import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Vérification LOCALE du JWT Supabase (clé de signature asymétrique ES256,
 * exposée sur le endpoint JWKS du projet).
 *
 * Avant : chaque route /api/* authentifiée appelait `supabase.auth.getUser()`,
 * soit un aller-retour réseau vers GoTrue (/auth/v1/user) À CHAQUE requête, sans
 * timeout. Quand GoTrue ralentissait, la fonction Vercel tournait jusqu'au mur
 * des 30 s → 504 en cascade sur /2fa/totp/status, /webauthn/status,
 * /2fa/verify-code, etc. (toutes passent par apiAuth.ts).
 *
 * Maintenant : la signature est vérifiée en local via le JWKS (téléchargé une
 * fois puis mis en cache par `createRemoteJWKSet`, avec cooldown intégré). Plus
 * aucun appel réseau par requête, et un jeton invalide/expiré est rejeté en
 * quelques microsecondes.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Singleton au niveau module : le cache JWKS survit entre les requêtes d'une
// même instance de fonction (contrairement à un client Supabase recréé par
// requête, qui re-téléchargeait le JWKS à chaque fois).
const jwks = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    })
  : null;

export interface SupabaseJwtClaims {
  authId: string;
  email: string | null;
}

/**
 * Extrait et vérifie le Bearer token d'une requête. Retourne les claims
 * (`sub` = auth UUID, `email`) ou `null` si absent / mal formé / signature
 * invalide / expiré. Ne touche jamais le réseau (hors 1er chargement JWKS).
 */
export async function verifySupabaseJwt(req: Request): Promise<SupabaseJwtClaims | null> {
  if (!jwks) return null;

  const header = req.headers.get("authorization");
  if (!header) return null;
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, jwks, {
      // GoTrue signe avec `aud: "authenticated"` pour un utilisateur connecté.
      audience: "authenticated",
    });
    if (!payload.sub) return null;
    return {
      authId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch {
    // Signature invalide, jeton expiré, aud incorrect, JWKS injoignable…
    return null;
  }
}
