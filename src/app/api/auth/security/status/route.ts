import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { hashTwoFactorValue } from "@/lib/twoFactor";
import { getTwoFactorCookie } from "@/lib/twoFactorCookie";
import { sanitizeErrorMessage } from "@/lib/safeError";

/**
 * État de sécurité du compte connecté, en UN seul appel :
 *  - `role`                  : rôle public.users
 *  - `totpConfirmed`         : l'admin a-t-il fini de configurer son TOTP
 *  - `twoFactorSessionValid` : le cookie httpOnly `edu_2fa` est-il encore actif
 *                              (pas juste présent) sur cet appareil
 *
 * Remplace les anciens /api/auth/2fa/totp/status + /api/auth/2fa/totp/verify-session
 * (appelés en 2 requêtes séquentielles par AdminShell et authRedirect).
 * Ne passe pas par getAuthenticatedUser : un admin qui n'a pas encore
 * configuré son TOTP doit pouvoir consulter son propre statut, et
 * verify-session serait circulaire (ce gate exige déjà un jeton 2FA valide).
 */
export async function GET(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("auth_id", identity.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const [{ data: totp }, twoFactorSessionValid] = await Promise.all([
      supabaseAdmin
        .from("two_factor_totp")
        .select("confirmed_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      (async () => {
        const token = await getTwoFactorCookie();
        if (!token) return false;
        const { data: session } = await supabaseAdmin
          .from("two_factor_sessions")
          .select("expires_at")
          .eq("user_id", user.id)
          .eq("token_hash", hashTwoFactorValue(token))
          .maybeSingle();
        return !!session && new Date(session.expires_at) > new Date();
      })(),
    ]);

    return NextResponse.json({
      role: user.role,
      totpConfirmed: !!totp?.confirmed_at,
      twoFactorSessionValid,
    });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
