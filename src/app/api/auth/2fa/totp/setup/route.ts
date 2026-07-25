import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { generateTotpSecret, buildOtpauthUrl } from "@/lib/totp";

// Génère (ou régénère) un secret TOTP en attente de confirmation. Réservé aux
// admins. Ne bloque pas sur une éventuelle session 2FA manquante : c'est
// justement l'étape qui permet d'en obtenir une pour la première fois.
export async function POST(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, role, email, status, ban_reason")
      .eq("auth_id", identity.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    if (user.status === "inactive" || user.ban_reason) return NextResponse.json({ error: "Compte suspendu" }, { status: 403 });
    if (user.role !== "admin") return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });

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
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    const otpauthUrl = buildOtpauthUrl(secret, user.email || identity.email || `admin-${user.id}`);
    return NextResponse.json({ secret, otpauthUrl });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
