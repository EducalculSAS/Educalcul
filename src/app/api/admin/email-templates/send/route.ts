import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { emailTemplate } from "@/lib/emailTemplates";
import { requireSuperAdmin } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { templateId, target, specificEmail, selectedUserId, customEmail } = await req.json();

    const { data: tmpl, error: tmplErr } = await supabaseAdmin
      .from("email_templates")
      .select("*")
      .eq("id", templateId)
      .single();
    if (tmplErr || !tmpl) return NextResponse.json({ error: "Template introuvable" }, { status: 404 });

    // Résoudre les destinataires
    let users: { email: string; first_name: string | null }[] = [];

    if (target === "custom_email" && customEmail) {
      // Adresse personnalisée — pas forcément un user du site
      users = [{ email: customEmail.trim(), first_name: null }];
    } else if (target === "specific_user" && selectedUserId) {
      const { data: u } = await supabaseAdmin
        .from("users").select("email, first_name").eq("id", selectedUserId).maybeSingle();
      if (!u) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      users = [u];
    } else if (specificEmail) {
      const { data: u } = await supabaseAdmin
        .from("users").select("email, first_name").eq("email", specificEmail).maybeSingle();
      if (!u) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      users = [u];
    } else {
      let query = supabaseAdmin.from("users").select("email, first_name").eq("role", "parent");
      if (target === "notif_weekly_reports") query = query.eq("notif_weekly_reports", true);
      if (target === "notif_offers_news") query = query.eq("notif_offers_news", true);
      const { data } = await query;
      users = data || [];
    }

    let sent = 0;
    let failed = 0;

    for (const u of users) {
      if (!u.email) continue;
      const firstName = u.first_name || "Utilisateur";
      const personalizedBody = tmpl.body.replace(/\{\{firstName\}\}/g, firstName);
      const html = emailTemplate({ title: tmpl.subject, body: personalizedBody });

      const result = await sendEmail({
        toEmail: u.email,
        toName: firstName,
        subject: tmpl.subject,
        textPart: personalizedBody.replace(/<[^>]*>/g, ""),
        htmlPart: html,
      });
      if (result.success) sent++; else failed++;
    }

    // Mettre à jour last_sent_at et sent_count
    await supabaseAdmin.from("email_templates").update({
      last_sent_at: new Date().toISOString(),
      sent_count: (tmpl.sent_count || 0) + sent,
    }).eq("id", templateId);

    return NextResponse.json({ success: true, sent, failed, total: users.length });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}

