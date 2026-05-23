import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { buildEmailHtml, EMAIL_BASE_URL } from "@/lib/emailTemplates";

const SUBJECTS = [
  "Question sur les abonnements",
  "ProblÃ¨me technique",
  "ProblÃ¨me de compte",
  "Question pÃ©dagogique",
  "Demande de partenariat",
  "Signaler un contenu",
  "Suggestion d'amÃ©lioration",
  "Autre",
];

export async function POST(req: Request) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "Tous les champs sont obligatoires." }, { status: 400 });
    }
    if (!SUBJECTS.includes(subject)) {
      return NextResponse.json({ error: "Sujet invalide." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: null,
        user_email: email,
        user_name: name,
        subject,
        message,
        priority: "normal",
        status: "Ouvert",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Charger les templates depuis la DB et envoyer les emails (non bloquants)
    const [tmplUser, tmplAdmin] = await Promise.all([
      supabaseAdmin.from("email_templates").select("subject,body").eq("key", "contact_user").single(),
      supabaseAdmin.from("email_templates").select("subject,body").eq("key", "contact_admin").single(),
    ]);

    const vars = (s: string) => s
      .replace(/\{\{name\}\}/g, name)
      .replace(/\{\{email\}\}/g, email)
      .replace(/\{\{subject\}\}/g, subject)
      .replace(/\{\{message\}\}/g, message);

    if (tmplUser.data) {
      sendEmail({
        toEmail: email, toName: name,
        subject: vars(tmplUser.data.subject),
        textPart: vars(tmplUser.data.body).replace(/<[^>]*>/g, ""),
        htmlPart: buildEmailHtml({ title: vars(tmplUser.data.subject), body: vars(tmplUser.data.body) }),
      }).catch(console.error);
    }

    if (tmplAdmin.data) {
      const adminEmail = process.env.ADMIN_EMAIL_FROM || "ruben.combe@gmail.com";
      sendEmail({
        toEmail: adminEmail, toName: "Admin Educalcul",
        subject: vars(tmplAdmin.data.subject),
        textPart: vars(tmplAdmin.data.body).replace(/<[^>]*>/g, ""),
        htmlPart: buildEmailHtml({ title: vars(tmplAdmin.data.subject), body: vars(tmplAdmin.data.body) }),
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

