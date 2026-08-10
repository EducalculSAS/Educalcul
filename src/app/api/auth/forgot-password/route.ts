import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { buildEmailHtml, EMAIL_BASE_URL } from "@/lib/emailTemplates";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

  const entered = email.trim().toLowerCase();

  // Rate limit (per IP + per target email) to prevent reset-email bombing.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const cfg = RATE_LIMITS["auth:forgot-password"];
  const rlIp = await rateLimitWithBackoff(`forgot:ip:${ip}`, cfg.maxAttempts, cfg.windowMs);
  const rlEmail = await rateLimitWithBackoff(`forgot:email:${entered}`, cfg.maxAttempts, cfg.windowMs);
  if (!rlIp.allowed || !rlEmail.allowed) {
    // Generic success to avoid revealing anything; just don't send another mail.
    return NextResponse.json({ success: true });
  }

  // Trouver l'auth_id via SQL (cherche dans auth.users + auth.identities + public.users)
  const { data: foundId, error: rpcErr } = await supabaseAdmin
    .rpc("find_auth_id_by_email", { p_email: entered });

  if (rpcErr) {
    console.error("[forgot-password] RPC error:", rpcErr.message);
    return NextResponse.json({ success: true });
  }

  if (!foundId) {
    return NextResponse.json({ success: true }); // compte inexistant, ne pas révéler
  }

  // Récupérer l'email principal du compte (celui enregistré dans auth.users)
  const { data: authUser, error: auErr } = await supabaseAdmin.auth.admin.getUserById(foundId);
  if (auErr || !authUser.user?.email) {
    console.error("[forgot-password] getUserById error:", auErr?.message);
    return NextResponse.json({ success: true });
  }

  // Récupérer le prénom
  const { data: profile } = await supabaseAdmin
    .from("users").select("first_name").eq("auth_id", foundId).maybeSingle();
  const firstName = profile?.first_name || authUser.user.user_metadata?.first_name || "Utilisateur";

  // Générer le lien de reset (utilise l'email principal du compte)
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: authUser.user.email,
    options: { redirectTo: `${EMAIL_BASE_URL}/auth/update-password` },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    console.error("[forgot-password] generateLink error:", linkErr?.message);
    return NextResponse.json({ success: true });
  }

  // Envoyer à l'email entré par l'utilisateur (pas forcément l'email principal)
  const result = await sendEmail({
    toEmail: entered,
    toName: firstName,
    subject: "Réinitialisation de votre mot de passe",
    textPart: `Bonjour ${firstName},\n\nRéinitialisez votre mot de passe :\n${linkData.properties.action_link}\n\nLien valable 1h.\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Réinitialisation du mot de passe",
      preheader: "Réinitialisez votre mot de passe Educalcul",
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong>${firstName}</strong>,</p>
        <p style="margin:0 0 16px;">Vous avez demandé la réinitialisation de votre mot de passe Educalcul.</p>
        <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">Ce lien est valable <strong>1 heure</strong> et ne peut être utilisé qu'une seule fois.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr>
            <td style="background:#fffbeb;border-left:3px solid #c5a148;padding:14px 18px;border-radius:0 8px 8px 0;">
              <p style="margin:0;font-size:13px;color:#92400e;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
            </td>
          </tr>
        </table>
      `,
      cta: { label: "Réinitialiser mon mot de passe", url: linkData.properties.action_link },
    }),
  });

  if (!result.success) {
    console.error("[forgot-password] sendEmail error:", result.error);
    return NextResponse.json({ error: "Impossible d'envoyer l'email pour le moment. Réessayez dans quelques instants." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
