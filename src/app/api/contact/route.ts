import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/apiAuth";
import { runAfterResponse } from "@/lib/background";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { validateEmail, validateString, validateName } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sendEmail } from "@/lib/mailer";
import { buildEmailHtml } from "@/lib/emailTemplates";

const SUBJECTS = [
  "Question sur les abonnements",
  "Problème technique",
  "Problème de compte",
  "Question pédagogique",
  "Demande de partenariat",
  "Signaler un contenu",
  "Suggestion d'amélioration",
  "Autre",
];

export async function POST(req: Request) {
  try {
    const { name, email, subject, message } = await req.json();

    // ✓ HIGH PRIORITY FIX: Validate all inputs with length limits
    const validatedName = validateName(name);
    if (!validatedName) {
      return NextResponse.json({ error: "Nom invalide" }, { status: 400 });
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
    }

    if (!subject || !SUBJECTS.includes(subject)) {
      return NextResponse.json({ error: "Sujet invalide" }, { status: 400 });
    }

    const validatedMessage = validateString(message, 10000);
    if (!validatedMessage || validatedMessage.length < 10) {
      return NextResponse.json({ error: "Message trop court ou invalide (10 caractères minimum)" }, { status: 400 });
    }

    // ✓ HIGH PRIORITY FIX: Add rate limiting
    const ip = getClientIp(req);
    const config = RATE_LIMITS["contact:form"];
    const rl = await rateLimitWithBackoff(`contact:${ip}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop d'envois, réessaie plus tard." },
        { status: 429 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: null,
        user_email: email,
        user_name: validatedName,
        subject,
        message: validatedMessage,
        priority: "normal",
        status: "Ouvert",
      })
      .select()
      .single();

    if (error) {
      console.error("[contact] Database error:", error);
      return NextResponse.json({ error: "Impossible d'envoyer le message" }, { status: 500 });
    }

    // Load email templates and send confirmation (après la réponse, voir background.ts)
    runAfterResponse(Promise.all([
      supabaseAdmin.from("email_templates").select("subject,body").eq("key", "contact_user").single(),
      supabaseAdmin.from("email_templates").select("subject,body").eq("key", "contact_admin").single(),
    ]).then(async ([tmplUser, tmplAdmin]) => {
      const safeReplace = (s: string, vars: Record<string, string>) => {
        let result = s;
        for (const [key, value] of Object.entries(vars)) {
          result = result.split(`{{${key}}}`).join(value);
        }
        return result;
      };

      const vars = { name: validatedName, email, subject, message: validatedMessage };

      if (tmplUser.data) {
        await sendEmail({
          toEmail: email,
          toName: validatedName,
          subject: safeReplace(tmplUser.data.subject, vars),
          textPart: safeReplace(tmplUser.data.body, vars).replace(/<[^>]*>/g, ""),
          htmlPart: buildEmailHtml({
            title: safeReplace(tmplUser.data.subject, vars),
            body: safeReplace(tmplUser.data.body, vars),
          }),
        }).catch(console.error);
      }

      if (tmplAdmin.data) {
        const adminEmail = process.env.ADMIN_EMAIL_FROM || "support@educalcul.com";
        await sendEmail({
          toEmail: adminEmail,
          toName: "Educalcul Support",
          subject: safeReplace(tmplAdmin.data.subject, vars),
          textPart: safeReplace(tmplAdmin.data.body, vars).replace(/<[^>]*>/g, ""),
          htmlPart: buildEmailHtml({
            title: safeReplace(tmplAdmin.data.subject, vars),
            body: safeReplace(tmplAdmin.data.body, vars),
          }),
        }).catch(console.error);
      }
    }).catch(console.error));

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (err: unknown) {
    console.error("[contact] Error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

