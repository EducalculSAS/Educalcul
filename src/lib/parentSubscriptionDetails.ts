import type { Loose } from "@/types/loose";
import { stripe, subscriptionPeriodEnd } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseClient";

/** Stripe répond « No such … » quand l'objet n'existe plus (compte de test, abonnement supprimé côté Stripe) : ce n'est pas une panne. */
function isStripeMissing(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "resource_missing";
}

/** Facture payée, telle qu'affichée dans l'historique de facturation du parent. */
export interface BillingInvoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string | null;
  pdf_url: string | null | undefined;
  number: string | null;
}

export async function fetchParentSubscriptionDetails(userId: string) {
  // 1. Get subscription from Supabase to find Stripe Customer ID
  // "past_due" (echec de paiement) reste inclus : le client garde acces a
  // cette page pour voir le probleme et mettre a jour son moyen de paiement
  // (bouton "Gerer votre abonnement" plus bas) -- l'exclure ici le faisait
  // atterrir sur un "Plan actuel : Gratuit" trompeur, sans aucun moyen d'agir
  // depuis la page (seule la notification in-app + l'email l'informaient).
  let { data: subscription, error: dbError } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "past_due"])
    .maybeSingle();

  // Auto-Healing: If no subscription in DB, check Stripe by email
  if (!subscription || !subscription.stripe_customer_id) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userData?.user?.email) {
      const customers = await stripe.customers.list({
        email: userData.user.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        const customer = customers.data[0];
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const activeSub = subscriptions.data[0];
          let planId = "premium";
          if (activeSub.items.data[0].price.unit_amount === 1999) {
            planId = "family";
          }

          const { data: newSub, error: insertError } = await supabaseAdmin
            .from("subscriptions")
            .upsert({
              user_id: userId,
              plan_id: planId,
              status: "active",
              current_period_start: new Date((activeSub as Loose).current_period_start * 1000).toISOString(),
              current_period_end: subscriptionPeriodEnd(activeSub),
              stripe_customer_id: customer.id,
              stripe_subscription_id: activeSub.id,
            }, { onConflict: "user_id" })
            .select()
            .single();

          if (newSub) {
            subscription = newSub;
          } else if (insertError) {
            console.error("Auto-healing failed:", insertError);
            subscription = {
              user_id: userId,
              plan_id: planId,
              status: "active",
              stripe_customer_id: customer.id,
              stripe_subscription_id: activeSub.id,
              current_period_end: subscriptionPeriodEnd(activeSub),
              cancel_at_period_end: activeSub.cancel_at_period_end,
            } as unknown;
          }
        }
      }
    }
  }

  if (dbError && !subscription) {
    throw new Error("Database error");
  }

  if (!subscription) {
    return { subscription: null, invoices: [] as BillingInvoice[] };
  }

  if (!subscription.stripe_customer_id) {
    return { subscription, invoices: [] as BillingInvoice[] };
  }

  const customerId = subscription.stripe_customer_id;

  // 2. Fetch subscription details from Stripe to get renewal date + cancellation status
  let stripeSubscription: Loose = null;
  if (subscription.stripe_subscription_id) {
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
    } catch (err) {
      if (!isStripeMissing(err)) throw err;
      // L'abonnement n'existe plus chez Stripe : on montre ce que la base sait, sans factures.
      return { subscription, invoices: [] as BillingInvoice[] };
    }
  }

  const stripeCancelAtPeriodEnd = stripeSubscription?.cancel_at_period_end ?? false;
  const stripePeriodEnd = subscriptionPeriodEnd(stripeSubscription) ?? subscription.current_period_end;

  // Synchroniser cancel_at_period_end en DB si Stripe est différent
  // (l'utilisateur a annulé via le portail Stripe → DB doit refléter ça)
  if (stripeSubscription && stripeCancelAtPeriodEnd !== subscription.cancel_at_period_end) {
    await supabaseAdmin
      .from("subscriptions")
      .update({
        cancel_at_period_end: stripeCancelAtPeriodEnd,
        current_period_end: stripePeriodEnd,
      })
      .eq("stripe_subscription_id", subscription.stripe_subscription_id);
  }

  // 3. Fetch invoices from Stripe
  let invoices;
  try {
    invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 12,
      status: "paid",
    });
  } catch (err) {
    if (!isStripeMissing(err)) throw err;
    return { subscription, invoices: [] as BillingInvoice[] };
  }

  const formattedInvoices = invoices.data.map((invoice) => ({
    id: invoice.id,
    date: new Date(invoice.created * 1000).toISOString(),
    amount: invoice.amount_paid / 100,
    currency: invoice.currency.toUpperCase(),
    status: invoice.status,
    pdf_url: invoice.invoice_pdf,
    number: invoice.number,
  }));

  return {
    subscription: {
      ...subscription,
      current_period_end: stripePeriodEnd,
      cancel_at_period_end: stripeCancelAtPeriodEnd,
    },
    invoices: formattedInvoices,
  };
}
