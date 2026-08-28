import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { hashTwoFactorValue } from "@/lib/twoFactor";
import { getTwoFactorCookie } from "@/lib/twoFactorCookie";
import { getDashboardPath } from "@/lib/authRedirect";
import { sanitizeErrorMessage } from "@/lib/safeError";

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
      .select("id, role, status, ban_reason, first_name, two_factor_enabled")
      .eq("auth_id", identity.authId)
      .maybeSingle();

    if (!user) return NextResponse.json({ dest: "no_account" });
    if (user.status === "inactive" || user.ban_reason) return NextResponse.json({ dest: "banned" });
    if (!user.first_name) return NextResponse.json({ dest: "incomplete" });

    const dashboard = getDashboardPath(user.role);

    let requires2FA = !!user.two_factor_enabled;
    if (user.role === "admin") {
      const { data: totp } = await supabaseAdmin
        .from("two_factor_totp")
        .select("confirmed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      requires2FA = !!totp?.confirmed_at;
    }

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
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err?.message || "Erreur interne") }, { status: 500 });
  }
}
