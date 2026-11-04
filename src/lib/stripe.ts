// Garde-fou : ce module manipule une clé secrète. Importé par erreur depuis
// un composant client, la COMPILATION échoue au lieu d'exposer la clé dans
// le bundle du navigateur.
import "server-only";
import Stripe from 'stripe';
import { legacyPeriodField } from "@/lib/stripePeriod";
export { legacyPeriodField };

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia' as Stripe.StripeConfig["apiVersion"],
  typescript: true,
});

/**
 * Fin de période d'un abonnement Stripe, quelle que soit la version de l'API :
 * depuis 2025-07-30 (« basil »), current_period_end n'est plus sur
 * l'abonnement mais sur chacun de ses éléments. null si introuvable (jamais
 * de date invalide, qui faisait échouer toute l'écriture).
 */
export function subscriptionPeriodEnd(sub: Stripe.Subscription | null | undefined): string | null {
  if (!sub) return null;
  const raw = legacyPeriodField(sub, "current_period_end") ?? sub.items?.data?.[0]?.current_period_end;
  return typeof raw === "number" && Number.isFinite(raw) ? new Date(raw * 1000).toISOString() : null;
}

/** Un abonnement en essai gratuit donne accès comme un abonnement payé. */
export function subscriptionIsEntitled(sub: Stripe.Subscription | null | undefined): boolean {
  return !!sub && (sub.status === "active" || sub.status === "trialing");
}
