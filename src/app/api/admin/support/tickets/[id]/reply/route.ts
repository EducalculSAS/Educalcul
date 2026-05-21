import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailjet";


export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message, user_email, user_name, subject, is_public } = body;

    if (!message) {
      return NextResponse.json({ error: "Message requis" }, { status: 400 });
    }

    const adminName = "Support Educalcul"; // Could be dynamic if we fetch current user

    // 1. Insert Reply
    const { error: replyError } = await supabaseAdmin
      .from('ticket_replies')
      .insert({
        ticket_id: id,
        admin_name: adminName,
        reply_message: message,
        replied_at: new Date().toISOString()
      });

    if (replyError) return NextResponse.json({ error: replyError.message }, { status: 500 });

    // 2. Update updated_at only (status change is manual)
    const { error: updateError } = await supabaseAdmin
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    // 3. Envoyer email UNIQUEMENT pour les tickets publics (contact form)
    if (is_public && user_email) {
      const emailSubject = `Re: ${subject} — Educalcul Support`;
      const emailHtml = `
        <p>Bonjour ${user_name || ""},</p>
        <p>Notre équipe a répondu à votre message :</p>
        <div style="padding:12px;background:#f9f9f9;border-left:3px solid #3a6ea5;margin:16px 0;">
          ${message.replace(/\n/g, "<br>")}
        </div>
        <p>Si vous avez d'autres questions, n'hésitez pas à nous recontacter sur <a href="https://educalcul.fr/contact">educalcul.fr/contact</a>.</p>
        <p>Cordialement,<br>L'équipe Educalcul</p>
      `;
      const emailText = `Bonjour ${user_name || ""},\n\nNotre équipe a répondu à votre message :\n\n${message}\n\nCordialement,\nL'équipe Educalcul`;

      const result = await sendEmail({
        toEmail: user_email,
        toName: user_name || "Visiteur",
        subject: emailSubject,
        textPart: emailText,
        htmlPart: emailHtml,
      });

      if (!result.success) {
        console.error("Email non envoyé:", result.error);
        return NextResponse.json({ success: true, warning: "Réponse sauvegardée mais email non envoyé." });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
