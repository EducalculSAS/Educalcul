import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * true si ce compte (identifié par son auth_id) a un abonnement actif dans
 * `subscriptions` — la même table déjà utilisée par
 * parentSubscriptionDetails.ts pour afficher l'abonnement sur
 * /parent/subscription. C'est le seul verrou explicite : normalement, un
 * compte sans paiement n'a même pas de ligne public.users (voir le
 * commentaire en tête de create-checkout-session/route.ts) — mais les
 * comptes créés hors de ce flux (ex. liste d'attente) en ont une sans jamais
 * être passés par Stripe, d'où ce check indépendant.
 */
export async function hasActiveSubscription(authId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", authId)
    .eq("status", "active")
    .maybeSingle();
  return !!data;
}
