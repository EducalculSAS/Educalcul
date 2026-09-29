import "server-only";
import { stripe } from "@/lib/stripe";

/**
 * TVA française sur les abonnements. Les prix affichés sur le site sont des
 * prix TTC : on applique un taux de TVA « inclus » (20 %, France) que Stripe
 * ventile sur la page de paiement et sur la facture (« dont TVA »), sans rien
 * changer au montant payé par le client.
 *
 * Le taux est CRÉÉ DANS STRIPE (Produits > Taux de TVA : « TVA », 20 %,
 * « Inclusif », pays France) : tant qu'il n'existe pas, aucune TVA n'est
 * appliquée (comportement d'avant). L'archiver désactive la TVA. À valider
 * avec l'expert-comptable (assujettissement, taux) avant le lancement.
 */
let cache: { id: string | null; at: number } | null = null;
const TTL = 10 * 60 * 1000;

export async function getVatTaxRateId(): Promise<string | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.id;
  let id: string | null = null;
  try {
    const rates = await stripe.taxRates.list({ active: true, inclusive: true, limit: 50 });
    id = rates.data.find((r) => r.country === "FR" && r.percentage === 20)?.id ?? null;
  } catch (e) {
    // Pas de TVA plutôt qu'un paiement impossible si Stripe ne répond pas.
    console.warn("[stripeVat] taux de TVA illisible :", (e as Error).message);
    return cache?.id ?? null;
  }
  cache = { id, at: Date.now() };
  return id;
}
