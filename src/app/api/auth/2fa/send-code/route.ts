import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { sendEmail } from "@/lib/mailer";
import { twoFactorCodeEmail } from "@/lib/emailTemplates";
import { generateTwoFactorCode, hashTwoFactorValue } from "@/lib/twoFactor";
import { auditLog, AuditAction } from "@/lib/auditLog";

// Envoie un code de vérification par email à l'utilisateur actuellement
// authentifié (session Supabase déjà valide — le mot de passe a été vérifié,
// il ne manque que le 2e facteur). N'utilise PAS getAuthenticatedUser : cette
// route doit rester joignable même quand la vérification 2FA n'a pas encore
// eu lieu, c'est justement son rôle de la produire.
export async function POST(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, role, first_name, email, status, ban_reason")
      .eq("auth_id", identity.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    if (user.status === "inactive" || user.ban_reason) return NextResponse.json({ error: "Compte suspendu" }, { status: 403 });

    // Un admin avec TOTP confirmé utilise le code de son application
    // d'authentification, jamais un envoi par email — même si ce endpoint
    // est appelé par erreur (ex. un bouton "renvoyer" qui n'a pas vérifié la
    // méthode de 2FA active). Sans ce garde-fou, on enverrait un email OTP
    // inutile — et surtout inattendu — à un compte qui n'en a pas besoin.
    if (user.role === "admin") {
      const { data: totp } = await supabaseAdmin
        .from("two_factor_totp")
        .select("confirmed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (totp?.confirmed_at) {
        return NextResponse.json(
          { error: "Ce compte utilise une application d'authentification, pas l'email." },
          { status: 400 },
        );
      }
    }

    const config = RATE_LIMITS["2fa:send"];
    const rl = await rateLimitWithBackoff(`2fa:send:${user.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de demandes, réessaie dans quelques minutes." }, { status: 429 });
    }

    const code = generateTwoFactorCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabaseAdmin.from("two_factor_codes").insert({
      user_id: user.id,
      code_hash: hashTwoFactorValue(code),
      expires_at: expiresAt,
    });
    if (insertError) return NextResponse.json({ error: sanitizeErrorMessage(insertError.message) }, { status: 500 });

    const toEmail = user.email || identity.email;
    if (toEmail) {
      const tmpl = twoFactorCodeEmail(user.first_name || "là", code);
      const result = await sendEmail({ toEmail, toName: user.first_name || "Utilisateur", ...tmpl });
      if (!result.success) {
        console.error("[2fa/send-code] email non envoyé:", result.error);
        return NextResponse.json({ error: "Impossible d'envoyer l'email. Réessaie dans quelques instants." }, { status: 500 });
      }
    }

    await auditLog({ action: AuditAction.TWO_FACTOR_CODE_SENT, adminId: user.id, details: { method: "email" } }, req);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
