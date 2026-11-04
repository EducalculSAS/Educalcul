import { reconcileCosmeticsForFamily } from "@/lib/cosmeticEntitlements";
import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { legacyPeriodField } from "@/lib/stripePeriod";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { withdrawalConfirmedEmail } from "@/lib/emailTemplates";

/**
 * Droit de rétractation (Code de la consommation, art. L.221-18) et
 * « fonction de rétractation » en ligne (directive (UE) 2023/2673, en
 * vigueur depuis le 19 juin 2026) : pendant 14 jours après la souscription,
 * le parent se rétracte depuis son espace Abonnement, en deux clics.
 * L'abonnement est arrêté tout de suite et, comme l'accès immédiat a été
 * demandé au paiement (voir create-checkout-session), le remboursement est
 * calculé au prorata de la période non utilisée (CGV).
 */
const WITHDRAWAL_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export type WithdrawalQuote =
  | { eligible: false }
  | { eligible: true; deadline: string; refundCents: number; planName: string };

async function loadContract(authId: string) {
  const { data: row } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_id, status, stripe_subscription_id")
    .eq("user_id", authId)
    .maybeSingle();
  if (!row?.stripe_subscription_id || row.status === "cancelled") return null;

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
  } catch {
    return null;
  }
  if (sub.status === "canceled" || sub.status === "incomplete_expired") return null;
  const startMs = sub.start_date * 1000;
  const deadlineMs = startMs + WITHDRAWAL_DAYS * DAY;
  if (Date.now() > deadlineMs) return null;
  return { row, sub, startMs, deadlineMs };
}

/** Paiements encaissés depuis la souscription, et la part remboursable au prorata. */
async function refundPlan(sub: Stripe.Subscription, startMs: number) {
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number }) | undefined;
  const periodStart = (legacyPeriodField(sub, "current_period_start") ?? item?.current_period_start ?? 0) * 1000;
  const periodEnd = (legacyPeriodField(sub, "current_period_end") ?? item?.current_period_end ?? 0) * 1000;
  const unused = periodEnd > periodStart ? Math.min(1, Math.max(0, (periodEnd - Date.now()) / (periodEnd - periodStart))) : 0;

  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const charges = await stripe.charges.list({ customer, created: { gte: Math.floor(startMs / 1000) - 3600 }, limit: 20 });
  return charges.data
    .filter((c) => c.paid && c.status === "succeeded" && c.amount > c.amount_refunded)
    .map((c) => ({ charge: c.id, amount: Math.floor((c.amount - c.amount_refunded) * unused) }))
    .filter((r) => r.amount > 0);
}

async function planName(planId: string | null) {
  if (!planId) return "Educalcul";
  const { data } = await supabaseAdmin.from("subscription_plans").select("name").eq("id", planId).maybeSingle();
  return (data?.name as string) || "Educalcul";
}

export async function getWithdrawalQuote(authId: string): Promise<WithdrawalQuote> {
  const c = await loadContract(authId);
  if (!c) return { eligible: false };
  const refunds = await refundPlan(c.sub, c.startMs);
  return {
    eligible: true,
    deadline: new Date(c.deadlineMs).toISOString(),
    refundCents: refunds.reduce((s, r) => s + r.amount, 0),
    planName: await planName(c.row.plan_id),
  };
}

export async function withdraw(authId: string): Promise<{ ok: true; refundCents: number } | { ok: false; error: string }> {
  const c = await loadContract(authId);
  if (!c) return { ok: false, error: "Le délai de rétractation est dépassé ou aucun abonnement n'est en cours." };

  // Trace d'abord (contrainte unique : une seule rétractation par contrat,
  // même en cas de double clic), puis arrêt et remboursement.
  const { data: record, error: recErr } = await supabaseAdmin
    .from("subscription_withdrawals")
    .insert({ user_id: authId, stripe_subscription_id: c.sub.id, plan_id: c.row.plan_id, contract_start: new Date(c.startMs).toISOString() })
    .select("id, requested_at")
    .single();
  if (recErr) return { ok: false, error: recErr.code === "23505" ? "La rétractation a déjà été enregistrée." : "Impossible d'enregistrer la rétractation." };

  const refunds = await refundPlan(c.sub, c.startMs);
  // Le webhook « abonnement terminé » ne doit pas envoyer son email : celui
  // de la rétractation le remplace.
  await stripe.subscriptions.update(c.sub.id, { metadata: { ...c.sub.metadata, withdrawn: "true" } });
  await stripe.subscriptions.cancel(c.sub.id);

  const refundIds: string[] = [];
  let refunded = 0;
  for (const r of refunds) {
    try {
      const refund = await stripe.refunds.create({ charge: r.charge, amount: r.amount, reason: "requested_by_customer", metadata: { withdrawal: String(record.id) } });
      refundIds.push(refund.id);
      refunded += r.amount;
    } catch (e) {
      console.error("[withdrawal] remboursement échoué", r.charge, (e as Error).message);
    }
  }

  await Promise.all([
    supabaseAdmin.from("subscription_withdrawals").update({ refund_cents: refunded, refund_ids: refundIds }).eq("id", record.id),
    supabaseAdmin.from("subscriptions").update({ status: "cancelled", cancel_at_period_end: false, updated_at: new Date().toISOString() }).eq("user_id", authId),
  ]);

  await reconcileCosmeticsForFamily(authId).catch((e) => console.error("[withdrawal] cosmétiques non mis à jour", (e as Error).message));

  const { data: parent } = await supabaseAdmin.from("users").select("first_name, email").eq("auth_id", authId).maybeSingle();
  if (parent?.email) {
    const when = new Date(record.requested_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
    const amount = refunded > 0 ? `${(refunded / 100).toFixed(2).replace(".", ",")} €` : null;
    await sendEmail({
      toEmail: parent.email,
      toName: parent.first_name || "",
      ...withdrawalConfirmedEmail(parent.first_name || "", await planName(c.row.plan_id), when, amount),
    }).catch(console.error);
  }
  return { ok: true, refundCents: refunded };
}
