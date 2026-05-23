import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { buildEmailHtml } from "@/lib/emailTemplates";

export async function POST(req: Request) {
  try {
    const { subject, message, toEmail, toName, userId } = await req.json();

    if (!subject || !message || !toEmail) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    // 1. CrÃ©er le ticket support (marquÃ© comme initiÃ© par l'admin)
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: userId || null,
        user_email: toEmail,
        user_name: toName || toEmail,
        subject,
        message: `[Message de l'Ã©quipe Educalcul]\n\n${message}`,
        status: "Ouvert",
        priority: "normal",
        is_archived: false,
      })
      .select()
      .single();

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: ticketErr?.message || "Erreur crÃ©ation ticket" }, { status: 500 });
    }

    // 2. Ajouter la rÃ©ponse admin initiale dans ticket_replies
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
      <p>Vous avez reÃ§u un message de l'Ã©quipe Educalcul :</p>
      <blockquote style="margin:16px 0;padding:14px 18px;border-left:3px solid #c5a148;background:#fffbeb;color:#374151;border-radius:0 8px 8px 0;">
        ${message.replace(/\n/g, "<br>")}
      </blockquote>
      <p style="font-size:13px;color:#6b7280;">Vous pouvez rÃ©pondre Ã  ce message directement depuis votre espace Educalcul.</p>
    `;

    await sendEmail({
      toEmail,
      toName: toName || toEmail,
      subject,
      textPart: message,
      htmlPart: buildEmailHtml({ title: subject, body: htmlBody, cta: { label: "Voir le message", url: `https://project-fz32e2.vercel.app/parent/support` } }),
    });

    return NextResponse.json({ success: true, ticketId: ticket.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

