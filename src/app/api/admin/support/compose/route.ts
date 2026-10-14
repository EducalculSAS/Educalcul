import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { buildEmailHtml } from "@/lib/emailTemplates";
import { requireRole } from "@/lib/apiAuth";
import { notify } from "@/lib/notify";
import { supportLinkForAuthId } from "@/lib/supportLink";

export async function POST(req: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { subject, message, toEmail, toName, userId } = await req.json();

    if (!subject || !message || !toEmail) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    // 1. Créer le ticket support (marqué comme initié par l'admin)
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: userId || null,
        user_email: toEmail,
        user_name: toName || toEmail,
        subject,
        message: `[Message de l'équipe Educalcul]\n\n${message}`,
        status: "Ouvert",
        priority: "normal",
        is_archived: false,
      })
      .select()
      .single();

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: sanitizeErrorMessage(ticketErr?.message || "Erreur création ticket") }, { status: 500 });
    }

    // 2. Ajouter la réponse admin initiale dans ticket_replies
    await supabaseAdmin.from("ticket_replies").insert({
      ticket_id: ticket.id,
      admin_name: "Equipe Educalcul",
      author_name: "Equipe Educalcul",
      reply_message: message,
      is_admin: true,
      replied_at: new Date().toISOString(),
    });

    // 3. Envoyer l'email
    const htmlBody = `
      <p>Bonjour <strong>${toName || toEmail}</strong>,</p>
      <p>Vous avez reçu un message de l'équipe Educalcul :</p>
      <blockquote style="margin:16px 0;padding:14px 18px;border-left:3px solid #c5a148;background:#fffbeb;color:#374151;border-radius:0 8px 8px 0;">
        ${message.replace(/\n/g, "<br>")}
      </blockquote>
      <p style="font-size:13px;color:#6b7280;">Vous pouvez répondre à ce message directement depuis votre espace Educalcul.</p>
    `;

    const link = await supportLinkForAuthId(userId);

    await sendEmail({
      toEmail,
      toName: toName || toEmail,
      subject,
      textPart: message,
      htmlPart: buildEmailHtml({ title: subject, body: htmlBody, cta: { label: "Voir le message", url: `https://project-fz32e2.vercel.app${link}` } }),
      fromEmail: "support@educalcul.com",
      fromName: "Support Educalcul",
    });

    // Notification in-app si l'utilisateur a un compte
    if (userId) {
      await notify({ userId, type: "message", title: subject, body: message.slice(0, 80), link });
    }

    return NextResponse.json({ success: true, ticketId: ticket.id });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}

