import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { generateTwoFactorSessionToken, hashTwoFactorValue, TWO_FACTOR_SESSION_TTL_MS } from "@/lib/twoFactor";
import { auditLog, AuditAction } from "@/lib/auditLog";

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

    const config = RATE_LIMITS["2fa:verify"];
    const rl = await rateLimitWithBackoff(`2fa:verify:${user.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de tentatives, demande un nouveau code." }, { status: 429 });
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code manquant" }, { status: 400 });
    }

    const { data: pending } = await supabaseAdmin
      .from("two_factor_codes")
      .select("id, code_hash, expires_at, attempts")
      .eq("user_id", user.id)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pending || new Date(pending.expires_at) < new Date()) {
      return NextResponse.json({ error: "Code expiré, demande un nouveau code." }, { status: 400 });
    }
    if (pending.attempts >= 5) {
      return NextResponse.json({ error: "Trop d'essais pour ce code, demande un nouveau code." }, { status: 400 });
    }

    if (hashTwoFactorValue(code.trim()) !== pending.code_hash) {
      await supabaseAdmin.from("two_factor_codes").update({ attempts: pending.attempts + 1 }).eq("id", pending.id);
      await auditLog({ action: AuditAction.TWO_FACTOR_FAILED, adminId: user.id, details: { method: "email" } }, req);
      return NextResponse.json({ error: "Code incorrect." }, { status: 400 });
    }

    await supabaseAdmin.from("two_factor_codes").update({ consumed_at: new Date().toISOString() }).eq("id", pending.id);

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

    await auditLog({ action: AuditAction.TWO_FACTOR_VERIFIED, adminId: user.id, details: { method: "email" } }, req);

    return NextResponse.json({ success: true, token, expiresAt });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
