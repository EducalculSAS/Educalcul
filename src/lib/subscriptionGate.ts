import { supabaseAdmin } from "@/lib/supabaseClient";
import { getLiveSubscription } from "@/lib/subscriptionLive";

/**
 * true si ce compte (identifié par son auth_id) a un abonnement actif dans
 * `subscriptions`, OU s'il n'en a jamais eu du tout — auquel cas c'est un
 * compte plan gratuit légitime (créé par /api/auth/create-account, qui ne
 * gère plus que sessionId === "free" ; les paiements passent exclusivement
 * par le webhook Stripe, qui crée toujours la ligne "subscriptions" en même
 * temps que public.users). Seul un compte ayant DÉJÀ eu un abonnement payant
 * mais dont le statut n'est plus "active" (résilié, expiré...) est bloqué —
 * même logique que subscription-status/route.ts, à garder synchronisée.
 */
export async function hasActiveSubscription(authId: string): Promise<boolean> {
  if (await getLiveSubscription(authId, "id")) return true;

  const { data: everSubscribed } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", authId)
    .limit(1)
    .maybeSingle();
  return !everSubscribed;
}
