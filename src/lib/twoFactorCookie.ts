import { cookies } from "next/headers";

/** Le jeton de session 2FA vit désormais dans un cookie httpOnly, jamais dans
 * le localStorage : illisible par du JS (donc par un XSS), envoyé
 * automatiquement par le navigateur sur les requêtes same-origin — plus
 * besoin de le lire/attacher manuellement côté client (voir l'ancien patch
 * fetch dans supabaseClient.ts, retiré). */
export const TWO_FACTOR_COOKIE_NAME = "edu_2fa";

export async function setTwoFactorCookie(token: string, ttlMs: number) {
  const store = await cookies();
  store.set(TWO_FACTOR_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ttlMs / 1000),
  });
}

export async function clearTwoFactorCookie() {
  const store = await cookies();
  store.delete(TWO_FACTOR_COOKIE_NAME);
}

export async function getTwoFactorCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(TWO_FACTOR_COOKIE_NAME)?.value || null;
}

/** Pour les fonctions qui reçoivent un `Request` générique (apiAuth.ts) plutôt
 * que d'être elles-mêmes le handler de route — parse directement l'en-tête
 * Cookie plutôt que de dépendre du contexte async de next/headers. */
export function getTwoFactorCookieFromRequest(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|; )${TWO_FACTOR_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
