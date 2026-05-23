import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { notify } from "@/lib/notify";
import { buildEmailHtml } from "@/lib/emailTemplates";


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
      // Charger le template depuis la DB
      const { data: tmpl } = await supabaseAdmin.from("email_templates").select("subject,body").eq("key", "support_reply").single();
      const firstName = user_name?.split(" ")[0] || "Utilisateur";
      const emailSubject = tmpl ? tmpl.subject.replace(/\{\{name\}\}/g, firstName) : `Re: ${subject} — Educalcul Support`;
      const bodyHtml = tmpl
        ? tmpl.body.replace(/\{\{name\}\}/g, firstName).replace(/\{\{reply\}\}/g, message.replace(/\n/g, "<br>"))
        : `<p>Bonjour ${firstName},</p><blockquote style="border-left:3px solid #c5a148;padding:12px 16px;background:#fffbeb;">${message.replace(/\n/g, "<br>")}</blockquote>`;
      const emailHtml = buildEmailHtml({ title: emailSubject, body: bodyHtml, cta: { label: "Nous contacter", url: "https://educalcul.fr/contact" } });
      const emailText = `Bonjour ${firstName},\n\nNotre équipe a répondu à votre message :\n\n${message}\n\nL'équipe Educalcul`;

      const result = await sendEmail({
        toEmail: user_email,
        toName: user_name || "Visiteur",
        subject: emailSubject,
        textPart: emailText,
        htmlPart: emailHtml,
      });

      if (!result.success) {
        console.error("Email non envoyé:", result.error);
      }

      // Notification in-app si l'utilisateur a un compte
      const { data: ticketData } = await supabaseAdmin
        .from("support_tickets").select("user_id").eq("id", id).maybeSingle();
      if (ticketData?.user_id) {
        notify({ userId: ticketData.user_id, type: "support_reply", title: "Réponse à votre message", body: message.slice(0, 80), link: "/parent/support" });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
