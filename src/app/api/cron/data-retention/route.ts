import type { Loose } from "@/types/loose";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { selectAllPages } from "@/lib/selectAllPages";
import { sendEmail } from "@/lib/mailer";
import { inactivityWarningEmail, renewalReminderEmail } from "@/lib/emailTemplates";
import { deleteParentAccount } from "@/lib/deleteParentAccount";

export const maxDuration = 300;

const DAY = 24 * 60 * 60 * 1000;
const frDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Engagements de la Politique de confidentialité et des CGV, appliqués chaque
 * jour (Vercel Cron, voir vercel.json) :
 * 1. purge : historique de connexion > 12 mois, journaux d'erreurs > 6 mois ;
 * 2. rappel avant la reconduction d'un abonnement ANNUEL (entre 1 et 2 mois
 *    avant l'échéance, une seule fois par échéance) ;
 * 3. comptes parents inactifs (parent et enfants) depuis 3 ans : e-mail
 *    d'avertissement, puis suppression 30 jours plus tard sans reconnexion.
 *    Jamais un compte avec un abonnement payant en cours.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const report = { loginHistoryPurged: 0, errorsPurged: 0, renewalReminders: 0, inactivityWarnings: 0, accountsDeleted: 0 };

  // 1. Purge
  const { count: lh } = await supabaseAdmin
    .from("user_login_history")
    .delete({ count: "exact" })
    .lt("logged_at", new Date(now - 365 * DAY).toISOString());
  report.loginHistoryPurged = lh ?? 0;
  const { count: el } = await supabaseAdmin
    .from("error_logs")
    .delete({ count: "exact" })
    .lt("last_seen", new Date(now - 182 * DAY).toISOString());
  report.errorsPurged = el ?? 0;

  // 2. Rappels de reconduction (abonnements annuels)
  const subs = await selectAllPages<Loose>((from, to) =>
    supabaseAdmin
      .from("subscriptions")
      .select("id, user_id, plan_id, status, cancel_at_period_end, current_period_start, current_period_end, renewal_reminder_for")
      .in("status", ["active", "trialing"])
      .eq("cancel_at_period_end", false)
      .gte("current_period_end", new Date(now + 30 * DAY).toISOString())
      .lte("current_period_end", new Date(now + 60 * DAY).toISOString())
      .order("id")
      .range(from, to),
  );
  for (const s of subs) {
    const start = new Date(s.current_period_start).getTime();
    const end = new Date(s.current_period_end).getTime();
    const annual = end - start > 300 * DAY;
    if (!annual || (s.renewal_reminder_for && new Date(s.renewal_reminder_for).getTime() === end)) continue;
    const [{ data: parent }, { data: plan }] = await Promise.all([
      supabaseAdmin.from("users").select("first_name, email").eq("auth_id", s.user_id).maybeSingle(),
      supabaseAdmin.from("subscription_plans").select("name").eq("id", s.plan_id).maybeSingle(),
    ]);
    if (!parent?.email) continue;
    const tmpl = renewalReminderEmail(parent.first_name || "", plan?.name || "Educalcul", frDate(new Date(end)));
    const sent = await sendEmail({ toEmail: parent.email, toName: parent.first_name || "", ...tmpl });
    if (sent?.success !== false) {
      await supabaseAdmin.from("subscriptions").update({ renewal_reminder_for: s.current_period_end }).eq("id", s.id);
      report.renewalReminders++;
    }
  }

  // 3. Comptes inactifs depuis 3 ans (parent ET enfants)
  const threeYears = new Date(now - 3 * 365 * DAY).toISOString();
  const parents = await selectAllPages<Loose>((from, to) =>
    supabaseAdmin
      .from("users")
      .select("id, auth_id, first_name, email, last_active_at, created_at, inactivity_warned_at")
      .eq("role", "parent")
      .or(`last_active_at.lt.${threeYears},and(last_active_at.is.null,created_at.lt.${threeYears})`)
      .order("id")
      .range(from, to),
  );
  for (const p of parents) {
    if (!p.auth_id) continue;
    // Un enfant actif récemment garde le compte familial.
    const { data: activeChild } = await supabaseAdmin
      .from("users").select("id").eq("parent_id", p.id).gte("last_active_at", threeYears).limit(1).maybeSingle();
    if (activeChild) continue;
    // Jamais un abonné payant.
    const { data: sub } = await supabaseAdmin
      .from("subscriptions").select("status").eq("user_id", p.auth_id).in("status", ["active", "trialing", "past_due"]).maybeSingle();
    if (sub) continue;

    // Averti puis revenu entre-temps : l'ancien avertissement ne compte plus.
    const staleWarning = p.inactivity_warned_at && p.last_active_at && new Date(p.last_active_at) > new Date(p.inactivity_warned_at);
    if (!p.inactivity_warned_at || staleWarning) {
      if (!p.email) continue;
      const tmpl = inactivityWarningEmail(p.first_name || "", frDate(new Date(now + 30 * DAY)));
      await sendEmail({ toEmail: p.email, toName: p.first_name || "", ...tmpl });
      await supabaseAdmin.from("users").update({ inactivity_warned_at: new Date(now).toISOString() }).eq("id", p.id);
      report.inactivityWarnings++;
    } else if (new Date(p.inactivity_warned_at).getTime() < now - 30 * DAY) {
      // Toujours inactif 30 jours après l'avertissement (une reconnexion met
      // last_active_at à jour et fait sortir le compte de cette liste).
      const res = await deleteParentAccount(p.auth_id);
      if (res.ok) report.accountsDeleted++;
    }
  }

  return NextResponse.json(report);
}
