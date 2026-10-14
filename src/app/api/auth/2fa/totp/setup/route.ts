import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { generateTotpSecret, buildOtpauthUrl } from "@/lib/totp";

// Génère (ou régénère) un secret TOTP en attente de confirmation. Réservé aux
// admins, et à une session 2FA DÉJÀ validée (code e-mail pour un admin pas
// encore équipé) : avec le mot de passe seul, un tiers aurait pu enrôler SA
// propre application sur le compte, puis obtenir une session 2FA à la
// confirmation — un contournement complet de la 2FA admin.
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "admin") return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });

    const { data: user } = await supabaseAdmin.from("users").select("id, email").eq("id", me.id).maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const config = RATE_LIMITS["2fa:totp-setup"];
    const rl = await rateLimitWithBackoff(`2fa:totp-setup:${user.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de demandes, réessaie dans quelques minutes." }, { status: 429 });
    }

    const { data: existing } = await supabaseAdmin
      .from("two_factor_totp")
      .select("confirmed_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing?.confirmed_at) {
      return NextResponse.json({ error: "Le TOTP est déjà configuré." }, { status: 400 });
    }

    const secret = generateTotpSecret();
    const { error } = await supabaseAdmin
      .from("two_factor_totp")
      .upsert({ user_id: user.id, secret, confirmed_at: null }, { onConflict: "user_id" });
    if (error) {
      console.error("[2fa/totp/setup] upsert failed:", error);
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    }

    const otpauthUrl = buildOtpauthUrl(secret, user.email || `admin-${user.id}`);
    return NextResponse.json({ secret, otpauthUrl });
  } catch (err: unknown) {
    console.error("[2fa/totp/setup] failed:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
