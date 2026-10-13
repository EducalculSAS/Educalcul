import { supabaseAdmin } from "@/lib/supabaseClient";
import { periodDays as periodDaysOf } from "@/lib/billingPeriods";

/**
 * Attribution d'un abonnement par un admin, SANS passer par Stripe.
 *
 * À ne pas confondre avec l'action `set_plan` "normale" (voir
 * src/app/api/admin/user-detail/route.ts), qui exige une facturation Stripe
 * réelle pour tout plan payant : c'est volontaire, un bug passé marquait un
 * abonnement "active" alors que Stripe avait échoué, donnant un accès payant
 * jamais facturé sans que personne ne le voie.
 *
 * Ici l'absence de facturation est au contraire le but recherché et explicite
 * (compte offert, test, partenariat, élève sans parent payeur). L'état reste
 * reconnaissable en base : `has_paid = false` et aucun identifiant Stripe, ce
 * qui distingue un abonnement offert d'un abonnement réellement payé.
 */

export type BillingMode = "stripe" | "offert";

export function isBillingMode(value: unknown): value is BillingMode {
  return value === "stripe" || value === "offert";
}

export async function grantOfferedSubscription(params: {
  authId: string;
  planId: number | string;
  /** Durée forcée en jours ; sinon déduite de l'intervalle de facturation du plan. */
  days?: number | null;
}): Promise<{ ok: true; planName: string | null } | { ok: false; error: string }> {
  const { authId, planId, days } = params;

  const { data: plan } = await supabaseAdmin
    .from("subscription_plans")
    .select("name, billing_interval")
    .eq("id", Number(planId))
    .maybeSingle();

  if (!plan) return { ok: false, error: "Plan introuvable" };

  const periodDays =
    days && Number.isFinite(days) && days > 0
      ? days
      : periodDaysOf(plan.billing_interval);

  const now = new Date();
  const end = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: authId,
      plan_id: String(planId),
      status: "active",
      // Aucun identifiant Stripe : c'est ce qui rend l'abonnement offert
      // reconnaissable, et ce qui empêche le portail de facturation de
      // prétendre gérer un abonnement qui n'existe pas chez Stripe.
      stripe_subscription_id: null,
      stripe_customer_id: null,
      // has_paid reste false : aucun paiement réel n'a eu lieu. Le webhook
      // Stripe est seul habilité à le passer à true (il sert notamment aux
      // récompenses de parrainage, qui ne doivent pas se déclencher sur un
      // compte offert).
      has_paid: false,
      cancel_at_period_end: false,
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return { ok: false, error: error.message };

  return { ok: true, planName: plan.name ?? null };
}
