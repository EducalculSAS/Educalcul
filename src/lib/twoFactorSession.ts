import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { generateTwoFactorSessionToken, hashTwoFactorValue, TWO_FACTOR_SESSION_TTL_MS } from "@/lib/twoFactor";
import { setTwoFactorCookie } from "@/lib/twoFactorCookie";

/**
 * Émet une session 2FA pour cet appareil, une fois le second facteur vérifié
 * (code e-mail, application TOTP, code de secours ou clé d'accès) : ligne en
 * base + cookie httpOnly. Seul endroit qui le fait — les routes de
 * vérification n'ont plus chacune leur copie.
 */
export async function issueTwoFactorSession(
  user: { id: number; role: string },
  req: Request,
): Promise<{ expiresAt: string } | { error: string }> {
  const token = generateTwoFactorSessionToken();
  const ttl = user.role === "admin" ? TWO_FACTOR_SESSION_TTL_MS.admin : TWO_FACTOR_SESSION_TTL_MS.default;
  const expiresAt = new Date(Date.now() + ttl).toISOString();

  const { error } = await supabaseAdmin.from("two_factor_sessions").insert({
    user_id: user.id,
    token_hash: hashTwoFactorValue(token),
    expires_at: expiresAt,
    user_agent: req.headers.get("user-agent") || null,
  });
  if (error) return { error: error.message };

  await setTwoFactorCookie(token, ttl);
  return { expiresAt };
}
