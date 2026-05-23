import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { buildEmailHtml, EMAIL_BASE_URL } from "@/lib/emailTemplates";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

  const entered = email.trim().toLowerCase();

  // Trouver l'auth_id via SQL (cherche dans auth.users + auth.identities + public.users)
  const { data: foundId, error: rpcErr } = await supabaseAdmin
    .rpc("find_auth_id_by_email", { p_email: entered });

  if (rpcErr) {
    return NextResponse.json({ error: `RPC error: ${rpcErr.message}` }, { status: 500 });
  }

  if (!foundId) {
    return NextResponse.json({ success: true }); // compte inexistant, ne pas rÃ©vÃ©ler
  }

  // RÃ©cupÃ©rer l'email principal du compte (celui enregistrÃ© dans auth.users)
  const { data: authUser, error: auErr } = await supabaseAdmin.auth.admin.getUserById(foundId);
  if (auErr || !authUser.user?.email) {
    return NextResponse.json({ error: `getUserById error: ${auErr?.message}` }, { status: 500 });
  }

  // RÃ©cupÃ©rer le prÃ©nom
  const { data: profile } = await supabaseAdmin
    .from("users").select("first_name").eq("auth_id", foundId).maybeSingle();
  const firstName = profile?.first_name || authUser.user.user_metadata?.first_name || "Utilisateur";

  // GÃ©nÃ©rer le lien de reset (utilise l'email principal du compte)
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: authUser.user.email,
    options: { redirectTo: `${EMAIL_BASE_URL}/auth/update-password` },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: `generateLink: ${linkErr?.message}` }, { status: 500 });
  }

  // Envoyer Ã  l'email entrÃ© par l'utilisateur (pas forcÃ©ment l'email principal)
  const result = await sendEmail({
    toEmail: entered,
    toName: firstName,
    subject: "RÃ©initialisation de votre mot de passe",
    textPart: `Bonjour ${firstName},\n\nRÃ©initialisez votre mot de passe :\n${linkData.properties.action_link}\n\nLien valable 1h.\n\nL'Ã©quipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "RÃ©initialisation du mot de passe",
      preheader: "RÃ©initialisez votre mot de passe Educalcul",
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong>${firstName}</strong>,</p>
        <p style="margin:0 0 16px;">Vous avez demandÃ© la rÃ©initialisation de votre mot de passe Educalcul.</p>
        <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">Ce lien est valable <strong>1 heure</strong> et ne peut Ãªtre utilisÃ© qu'une seule fois.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr>
            <td style="background:#fffbeb;border-left:3px solid #c5a148;padding:14px 18px;border-radius:0 8px 8px 0;">
              <p style="margin:0;font-size:13px;color:#92400e;">Si vous n'avez pas demandÃ© cette rÃ©initialisation, ignorez cet email.</p>
            </td>
          </tr>
        </table>
      `,
      cta: { label: "RÃ©initialiser mon mot de passe", url: linkData.properties.action_link },
    }),
  });

  if (!result.success) {
    return NextResponse.json({ error: `Email error: ${result.error}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

