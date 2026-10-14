import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { hashTwoFactorValue } from "@/lib/twoFactor";
import { getTwoFactorCookie } from "@/lib/twoFactorCookie";
import { getDashboardPath } from "@/lib/authRedirect";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

/**
 * Destination post-authentification, résolue ENTIÈREMENT côté serveur (ban +
 * rôle + inscription incomplète + 2FA). Remplace la logique client de
 * resolveAuthDestination qui lisait `users` / `two_factor_*` directement.
 *
 * Renvoie { dest } où dest vaut :
 *  - "banned" / "incomplete" / "no_account"
 *  - sinon un chemin ("/parent/dashboard", "/auth/2fa-verify?redirect=…", …)
 */
export async function GET(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ dest: "no_account" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, role, status, ban_reason, first_name, two_factor_enabled, has_passkey")
      .eq("auth_id", identity.authId)
      .maybeSingle();

    if (!user) return NextResponse.json({ dest: "no_account" });
    if (user.status === "inactive" || user.ban_reason) return NextResponse.json({ dest: "banned" });
    if (!user.first_name) return NextResponse.json({ dest: "incomplete" });

    const dashboard = getDashboardPath(user.role);

    // Même règle que getAuthenticatedUser : tout admin passe par la 2FA
    // (code e-mail tant que son TOTP n'est pas configuré).
    const requires2FA = user.role === "admin" || !!user.two_factor_enabled || !!user.has_passkey;

    if (requires2FA) {
      const token = await getTwoFactorCookie();
      let valid = false;
      if (token) {
        const { data: session } = await supabaseAdmin
          .from("two_factor_sessions")
          .select("expires_at")
          .eq("user_id", user.id)
          .eq("token_hash", hashTwoFactorValue(token))
          .maybeSingle();
        valid = !!session && new Date(session.expires_at) > new Date();
      }
      if (!valid) {
        return NextResponse.json({ dest: `/auth/2fa-verify?redirect=${encodeURIComponent(dashboard)}` });
      }
    }

    return NextResponse.json({ dest: dashboard });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err) || "Erreur interne") }, { status: 500 });
  }
}
