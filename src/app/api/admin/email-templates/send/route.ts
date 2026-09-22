import { NextResponse } from "next/server";
import { selectAllPages } from "@/lib/selectAllPages";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { emailTemplate } from "@/lib/emailTemplates";
import { requireSuperAdmin } from "@/lib/apiAuth";

// Un envoi groupé peut durer : on laisse le maximum autorisé par le plan.
export const maxDuration = 300;

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
      // Paginé : PostgREST plafonne un select à 1000 lignes, et au-delà les
      // parents suivants n'auraient jamais reçu l'e-mail — sans erreur.
      users = await selectAllPages((from, to) => {
        let query = supabaseAdmin.from("users").select("email, first_name").eq("role", "parent");
        if (target === "notif_weekly_reports") query = query.eq("notif_weekly_reports", true);
        if (target === "notif_offers_news") query = query.eq("notif_offers_news", true);
        return query.order("id").range(from, to);
      });
    }

    let sent = 0;
    let failed = 0;

    // Envois par lots parallèles (et non un par un) sur le transporteur SMTP
    // mutualisé : l'envoi séquentiel dépassait la durée maximale d'une
    // fonction dès quelques centaines de destinataires, et s'arrêtait alors
    // en silence au milieu de la liste.
    const BATCH = 5;
    const recipients = users.filter((u) => u.email);
    for (let i = 0; i < recipients.length; i += BATCH) {
      const results = await Promise.all(
        recipients.slice(i, i + BATCH).map((u) => {
          const firstName = u.first_name || "Utilisateur";
          const personalizedBody = tmpl.body.replace(/\{\{firstName\}\}/g, firstName);
          return sendEmail({
            toEmail: u.email,
            toName: firstName,
            subject: tmpl.subject,
            textPart: personalizedBody.replace(/<[^>]*>/g, ""),
            htmlPart: emailTemplate({ title: tmpl.subject, body: personalizedBody }),
          });
        }),
      );
      for (const r of results) if (r.success) sent++; else failed++;
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

