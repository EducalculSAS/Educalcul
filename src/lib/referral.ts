import "server-only";
import { stripe, legacyPeriodField } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { notify } from "@/lib/notify";

/**
 * Parrainage (codes personnels des parents) :
 * - le filleul reçoit une semaine gratuite en plus de l'essai de sa formule (son premier prélèvement arrive 7 jours
 *   plus tard) ;
 * - le parrain reçoit une semaine gratuite quand son filleul paie pour la première fois.
 * Des semaines plutôt qu'un pourcentage : « 2 semaines gratuites » (essai + parrainage) se comprend tout de suite et
 * ne touche pas au prix affiché, ce qui convertit mieux qu'une petite remise répétée sur chaque échéance.
 * Les codes promotionnels sans propriétaire (créés par l'admin) gardent leur remise en pourcentage.
 */
export const REFERRAL_BONUS_DAYS = 7;
export const REFERRER_BONUS_DAYS = 7;

const DAY = 24 * 60 * 60;

/**
 * Semaine offerte au parrain. Abonnement Stripe en cours : la prochaine échéance est repoussée de 7 jours (période
 * gratuite ajoutée, sans prorata). Sinon, les jours sont mis de côté et s'ajoutent à l'essai de son prochain abonnement.
 */
export async function grantReferrerFreeWeek(referrerUserId: number): Promise<void> {
  const { data: referrer } = await supabaseAdmin
    .from("users")
    .select("id, auth_id, referral_free_days")
    .eq("id", referrerUserId)
    .maybeSingle();
  if (!referrer?.auth_id) return;

  let applied = false;
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", referrer.auth_id)
    .maybeSingle();
  if (sub?.stripe_subscription_id && sub.status === "active") {
    try {
      const s = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      if ((s.status === "active" || s.status === "trialing") && !s.cancel_at_period_end && !s.cancel_at) {
        const periodEnd = legacyPeriodField(s, "current_period_end") ?? s.items?.data?.[0]?.current_period_end;
        const from = s.status === "trialing" && s.trial_end ? s.trial_end : periodEnd;
        if (typeof from === "number") {
          await stripe.subscriptions.update(s.id, { trial_end: from + REFERRER_BONUS_DAYS * DAY, proration_behavior: "none" });
          applied = true;
        }
      }
    } catch (e) {
      console.error("[referral] semaine du parrain non appliquée sur Stripe :", (e as Error).message);
    }
  }
  if (!applied) {
    await supabaseAdmin
      .from("users")
      .update({ referral_free_days: (Number(referrer.referral_free_days) || 0) + REFERRER_BONUS_DAYS })
      .eq("id", referrer.id);
  }
  await notify({
    userId: referrer.auth_id,
    type: "subscription",
    title: "Une semaine offerte",
    body: applied
      ? "Votre filleul s'est abonné : votre prochaine échéance est repoussée d'une semaine."
      : "Votre filleul s'est abonné : une semaine gratuite s'ajoutera à votre prochain abonnement.",
    link: "/parent/subscription",
  }).catch(() => undefined);
}
