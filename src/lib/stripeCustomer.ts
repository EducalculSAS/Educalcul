import "server-only";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * Le client Stripe d'un compte Educalcul, réutilisé d'un paiement à l'autre.
 * Avant, chaque paiement passait `customer_email` : Stripe créait un NOUVEAU
 * client anonyme à chaque fois (doublons, aucun lien avec le compte). Ici :
 * 1. le client déjà enregistré pour ce compte (subscriptions.stripe_customer_id),
 *    s'il existe encore dans ce mode Stripe (les identifiants de test et de
 *    production diffèrent) ;
 * 2. sinon un client retrouvé par sa métadonnée `user_id` ;
 * 3. sinon un nouveau client, créé avec nom, e-mail et `user_id` (l'identifiant
 *    du compte Educalcul) pour retrouver la personne depuis le tableau de bord Stripe.
 */
export async function getOrCreateStripeCustomer(opts: { authId: string; email: string; name?: string }): Promise<string> {
  const { authId, email, name } = opts;

  const { data: row } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", authId)
    .maybeSingle();

  let existingId: string | null = null;
  if (row?.stripe_customer_id) {
    try {
      const c = await stripe.customers.retrieve(row.stripe_customer_id);
      if (!c.deleted) existingId = c.id;
    } catch {
      /* client absent de ce mode Stripe : on en retrouve ou crée un autre */
    }
  }

  if (!existingId) {
    try {
      const found = await stripe.customers.search({ query: `metadata['user_id']:'${authId}'`, limit: 1 });
      existingId = found.data[0]?.id ?? null;
    } catch {
      /* recherche indisponible : on crée */
    }
  }

  if (existingId) {
    const c = await stripe.customers.retrieve(existingId);
    if (!c.deleted && (c.email !== email || c.metadata?.user_id !== authId || (name && c.name !== name))) {
      await stripe.customers.update(existingId, { email, ...(name ? { name } : {}), metadata: { user_id: authId } });
    }
    return existingId;
  }

  const created = await stripe.customers.create({ email, ...(name ? { name } : {}), metadata: { user_id: authId } });
  return created.id;
}
