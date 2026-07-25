import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { verifyTotp, looksLikeBackupCode } from "@/lib/totp";
import { generateTwoFactorSessionToken, hashTwoFactorValue, TWO_FACTOR_SESSION_TTL_MS } from "@/lib/twoFactor";

// Vérifie un code TOTP au login (une fois la configuration déjà confirmée)
// et mint une session 2FA, comme /2fa/verify-code pour le flux email.
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

    const config = RATE_LIMITS["2fa:totp-verify"];
    const rl = await rateLimitWithBackoff(`2fa:totp-verify:${user.id}`, config.maxAttempts, config.windowMs);
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
    if (!totp?.confirmed_at) return NextResponse.json({ error: "TOTP non configuré." }, { status: 400 });

    let usedBackupCode = false;
    if (looksLikeBackupCode(code)) {
      const { data: backupCode } = await supabaseAdmin
        .from("two_factor_backup_codes")
        .select("id, code_hash")
        .eq("user_id", user.id)
        .is("used_at", null);
      const match = (backupCode || []).find(b => b.code_hash === hashTwoFactorValue(code.trim().toUpperCase()));
      if (!match) return NextResponse.json({ error: "Code de secours incorrect ou déjà utilisé." }, { status: 400 });
      await supabaseAdmin.from("two_factor_backup_codes").update({ used_at: new Date().toISOString() }).eq("id", match.id);
      usedBackupCode = true;
    } else if (!verifyTotp(totp.secret, code)) {
      return NextResponse.json({ error: "Code incorrect." }, { status: 400 });
    }

    const token = generateTwoFactorSessionToken();
    const ttl = user.role === "admin" ? TWO_FACTOR_SESSION_TTL_MS.admin : TWO_FACTOR_SESSION_TTL_MS.default;
    const expiresAt = new Date(Date.now() + ttl).toISOString();
    const { error: sessionError } = await supabaseAdmin.from("two_factor_sessions").insert({
      user_id: user.id,
      token_hash: hashTwoFactorValue(token),
      expires_at: expiresAt,
      user_agent: req.headers.get("user-agent") || null,
    });
    if (sessionError) return NextResponse.json({ error: sanitizeErrorMessage(sessionError.message) }, { status: 500 });

    return NextResponse.json({ success: true, token, expiresAt, usedBackupCode });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
