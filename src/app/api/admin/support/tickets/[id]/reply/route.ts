import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailjet";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message, user_email, user_name, subject } = body;

    if (!message || !user_email) {
      return NextResponse.json({ error: "Message and user email are required" }, { status: 400 });
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

    // 2. Update Ticket Status
    const { error: updateError } = await supabaseAdmin
      .from('support_tickets')
      .update({
        status: 'Répondu',
        updated_at: new Date().toISOString(),
        is_archived: false,
        archived_at: null
      })
      .eq('id', id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    // 3. Send Email
    const emailSubject = `Re: ${subject} (Ticket #${id})`;
    const emailText = `Bonjour ${user_name},\n\n`
      + `${adminName} a répondu à votre demande de support concernant le ticket #${id} ("${subject}") :\n\n`
      + `------------------------------------------------------\n`
      + `${message}\n`
      + `------------------------------------------------------\n\n`
      + `Si vous avez d'autres questions, veuillez répondre à cet email ou consulter notre site.\n\n`
      + `Cordialement,\nL'équipe Educalcul`;

    const emailHtml = `<p>Bonjour ${user_name},</p>`
      + `<p>${adminName} a répondu à votre demande de support concernant le ticket #${id} ("${subject}") :</p>`
      + `<hr>`
      + `<div style='padding: 10px; border-left: 3px solid #eee; margin: 10px 0;'>${message.replace(/\n/g, '<br>')}</div>`
      + `<hr>`
      + `<p>Si vous avez d'autres questions, veuillez répondre à cet email ou consulter notre site.</p>`
      + `<p>Cordialement,<br>L'équipe Educalcul</p>`;

    const emailResult = await sendEmail({
      toEmail: user_email,
      toName: user_name,
      subject: emailSubject,
      textPart: emailText,
      htmlPart: emailHtml
    });

    if (!emailResult.success) {
      console.error("Failed to send email:", emailResult.error);
      // We don't fail the request if email fails, but we might want to notify
      return NextResponse.json({ success: true, warning: "Reply saved but email failed to send." });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
