import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { verifyTotp, generateBackupCodes } from "@/lib/totp";
import { hashTwoFactorValue } from "@/lib/twoFactor";
import { issueTwoFactorSession } from "@/lib/twoFactorSession";

// Confirme la configuration TOTP en attente (voir /totp/setup) : valide le
// premier code généré par l'appli d'authentification, puis émet une session
// 2FA neuve pour cet appareil. Exige, comme /setup, une session 2FA déjà
// valide (code e-mail) : le mot de passe seul ne suffit jamais.
export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Codes de secours (usage unique) — affichés une seule fois ici, en cas
    // de perte de l'appareil d'authentification. Indépendants de la session,
    // donc écrits en parallèle.
    const backupCodes = generateBackupCodes();
    const [session, { error: backupError }] = await Promise.all([
      issueTwoFactorSession(user, req),
      supabaseAdmin.from("two_factor_backup_codes").insert(
        backupCodes.map(code => ({ user_id: user.id, code_hash: hashTwoFactorValue(code) }))
      ),
    ]);
    if ("error" in session) return NextResponse.json({ error: sanitizeErrorMessage(session.error) }, { status: 500 });
    if (backupError) return NextResponse.json({ error: sanitizeErrorMessage(backupError.message) }, { status: 500 });

    return NextResponse.json({ success: true, expiresAt: session.expiresAt, backupCodes });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
