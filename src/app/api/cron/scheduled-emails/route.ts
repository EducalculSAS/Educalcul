import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { resolveParentRecipients, sendTemplate } from "@/lib/emailCampaign";
import { sendWeeklyReports } from "@/lib/weeklyReport";

export const maxDuration = 300;

const DAY = 24 * 60 * 60 * 1000;

/**
 * E-mails automatiques planifiés, vérifiés chaque jour à 7 h UTC (Vercel Cron,
 * voir vercel.json). La planification se règle dans Admin > E-mails :
 * « Chaque semaine (lundi) » ou « Chaque mois (1er) » — jusqu'ici elle était
 * enregistrée mais rien ne l'exécutait.
 * - le modèle « weekly_report » est envoyé en version personnalisée (chiffres
 *   de chaque enfant, voir src/lib/weeklyReport.ts) ;
 * - les autres modèles planifiés sont envoyés tels quels à leur public.
 * Un modèle déjà envoyé dans la période (last_sent_at) n'est pas renvoyé si la
 * tâche est rejouée.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const isMonday = paris.getDay() === 1;
  const isFirst = paris.getDate() === 1;
  const force = new URL(req.url).searchParams.get("force") === "1";

  const { data: templates } = await supabaseAdmin
    .from("email_templates")
    .select("id, key, subject, body, target, schedule, sent_count, last_sent_at")
    .in("schedule", ["weekly", "monthly"]);

  const report: Record<string, unknown> = {};
  for (const t of templates ?? []) {
    const due = t.schedule === "weekly" ? isMonday : isFirst;
    const minGap = (t.schedule === "weekly" ? 6 : 27) * DAY;
    const recent = t.last_sent_at && now.getTime() - new Date(t.last_sent_at).getTime() < minGap;
    if (!force && (!due || recent)) { report[t.key] = "pas prévu aujourd'hui"; continue; }

    if (t.key === "weekly_report") {
      const res = await sendWeeklyReports(now);
      await supabaseAdmin.from("email_templates").update({
        last_sent_at: now.toISOString(),
        sent_count: (t.sent_count || 0) + res.sent,
      }).eq("id", t.id);
      report[t.key] = res;
    } else {
      report[t.key] = await sendTemplate(t, await resolveParentRecipients(t.target));
    }
  }
  return NextResponse.json(report);
}
