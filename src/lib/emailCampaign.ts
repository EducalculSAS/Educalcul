import "server-only";
import { selectAllPages } from "@/lib/selectAllPages";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { emailTemplate } from "@/lib/emailTemplates";

export interface Recipient {
  email: string;
  first_name: string | null;
}

/**
 * Parents visés par un envoi groupé (« all », « notif_weekly_reports »,
 * « notif_offers_news »). Paginé : PostgREST plafonne un select à 1000
 * lignes, et au-delà les parents suivants n'auraient jamais reçu l'e-mail,
 * sans erreur. Utilisé par l'envoi manuel de l'admin ET par la tâche
 * automatique (/api/cron/scheduled-emails).
 */
export async function resolveParentRecipients(target: string): Promise<Recipient[]> {
  return selectAllPages<Recipient>((from, to) => {
    let query = supabaseAdmin.from("users").select("email, first_name").eq("role", "parent");
    if (target === "notif_weekly_reports") query = query.eq("notif_weekly_reports", true);
    if (target === "notif_offers_news") query = query.eq("notif_offers_news", true);
    return query.order("id").range(from, to);
  });
}

/**
 * Envoie un message à des destinataires par lots parallèles (et non un par
 * un) sur le transporteur SMTP mutualisé : l'envoi séquentiel dépassait la
 * durée maximale d'une fonction dès quelques centaines de destinataires, et
 * s'arrêtait alors en silence au milieu de la liste.
 * `build` renvoie le contenu propre à chaque destinataire (ou null : on saute).
 */
export async function sendInBatches<T extends Recipient>(
  recipients: T[],
  build: (r: T) => { subject: string; textPart: string; htmlPart: string } | null,
): Promise<{ sent: number; failed: number }> {
  const BATCH = 5;
  let sent = 0;
  let failed = 0;
  const list = recipients.filter((r) => r.email);
  for (let i = 0; i < list.length; i += BATCH) {
    const results = await Promise.all(
      list.slice(i, i + BATCH).map(async (r) => {
        const content = build(r);
        if (!content) return null;
        return sendEmail({ toEmail: r.email, toName: r.first_name || "Utilisateur", ...content });
      }),
    );
    for (const res of results) {
      if (res === null) continue;
      if (res.success) sent++; else failed++;
    }
  }
  return { sent, failed };
}

/** Modèle de l'admin (objet + corps avec {{firstName}}) envoyé tel quel à des destinataires. */
export async function sendTemplate(
  tmpl: { id: number; subject: string; body: string; sent_count: number | null },
  recipients: Recipient[],
): Promise<{ sent: number; failed: number }> {
  const result = await sendInBatches(recipients, (u) => {
    const body = tmpl.body.replace(/\{\{firstName\}\}/g, u.first_name || "Utilisateur");
    return {
      subject: tmpl.subject,
      textPart: body.replace(/<[^>]*>/g, ""),
      htmlPart: emailTemplate({ title: tmpl.subject, body }),
    };
  });
  await supabaseAdmin.from("email_templates").update({
    last_sent_at: new Date().toISOString(),
    sent_count: (tmpl.sent_count || 0) + result.sent,
  }).eq("id", tmpl.id);
  return result;
}
