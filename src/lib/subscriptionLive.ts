import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * Seule définition de « cet abonnement donne accès aujourd'hui ».
 *
 * Statut « active » ET période non échue. Avant, seul le statut comptait : un
 * abonnement offert (sans Stripe) n'avait donc jamais de fin. Un abonnement
 * facturé garde 7 jours de grâce, le temps que le webhook Stripe de
 * renouvellement arrive (sinon un retard de quelques minutes couperait l'accès).
 */
const STRIPE_GRACE_MS = 7 * 24 * 3600 * 1000;

export interface LiveSubFields {
  status?: string | null;
  current_period_end?: string | null;
  stripe_subscription_id?: string | null;
}

export function isSubscriptionLive(sub: LiveSubFields | null | undefined, now = Date.now()): boolean {
  if (!sub || sub.status !== "active") return false;
  if (!sub.current_period_end) return true;
  const end = new Date(sub.current_period_end).getTime();
  if (!Number.isFinite(end)) return true;
  return end + (sub.stripe_subscription_id ? STRIPE_GRACE_MS : 0) > now;
}

/** Ligne d'abonnement qui donne accès aujourd'hui pour ce compte, ou null. `cols` s'ajoute aux colonnes de contrôle. */
export async function getLiveSubscription<T extends Record<string, unknown> = { plan_id: string | null }>(
  authId: string,
  cols = "plan_id",
): Promise<(T & LiveSubFields) | null> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select(`${cols}, status, current_period_end, stripe_subscription_id`)
    .eq("user_id", authId)
    .eq("status", "active")
    .maybeSingle<T & LiveSubFields>();
  const row = data;
  return isSubscriptionLive(row) ? row : null;
}
