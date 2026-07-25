import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { verifyTotp, generateBackupCodes } from "@/lib/totp";
import { generateTwoFactorSessionToken, hashTwoFactorValue, TWO_FACTOR_SESSION_TTL_MS } from "@/lib/twoFactor";

// Confirme la configuration TOTP en attente (voir /totp/setup) : valide le
// premier code généré par l'appli d'authentification, puis mint tout de
// suite une session 2FA pour cet appareil (sinon l'admin se retrouverait
// bloqué par sa propre configuration à la requête suivante).
export async function POST(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, role, status, ban_reason")
      .eq("auth_id", identity.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    if (user.status === "inactive" || user.ban_reason) return NextResponse.json({ error: "Compte suspendu" }, { status: 403 });
    if (user.role !== "admin") return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });

    const config = RATE_LIMITS["2fa:totp-verify"];
    const rl = await rateLimitWithBackoff(`2fa:totp-confirm:${user.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de tentatives, réessaie dans quelques minutes." }, { status: 429 });
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string") return NextResponse.json({ error: "Code manquant" }, { status: 400 });

    const { data: totp } = await supabaseAdmin
      .from("two_factor_totp")
      .select("secret, confirmed_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!totp) return NextResponse.json({ error: "Aucune configuration en attente." }, { status: 400 });
    if (totp.confirmed_at) return NextResponse.json({ error: "Le TOTP est déjà configuré." }, { status: 400 });

    if (!verifyTotp(totp.secret, code)) {
      return NextResponse.json({ error: "Code incorrect." }, { status: 400 });
    }

    const { error: confirmError } = await supabaseAdmin
      .from("two_factor_totp")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (confirmError) return NextResponse.json({ error: sanitizeErrorMessage(confirmError.message) }, { status: 500 });

    const token = generateTwoFactorSessionToken();
    const expiresAt = new Date(Date.now() + TWO_FACTOR_SESSION_TTL_MS.admin).toISOString();
    const { error: sessionError } = await supabaseAdmin.from("two_factor_sessions").insert({
      user_id: user.id,
      token_hash: hashTwoFactorValue(token),
      expires_at: expiresAt,
      user_agent: req.headers.get("user-agent") || null,
    });
    if (sessionError) return NextResponse.json({ error: sanitizeErrorMessage(sessionError.message) }, { status: 500 });

    // Codes de secours (usage unique) — affichés une seule fois ici, en cas
    // de perte de l'appareil d'authentification.
    const backupCodes = generateBackupCodes();
    await supabaseAdmin.from("two_factor_backup_codes").insert(
      backupCodes.map(code => ({ user_id: user.id, code_hash: hashTwoFactorValue(code) }))
    );

    return NextResponse.json({ success: true, token, expiresAt, backupCodes });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
