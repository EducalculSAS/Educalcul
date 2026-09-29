import "server-only";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * Catalogue Stripe (Produits et Prix) piloté par la table `subscription_plans`.
 * Modifier une formule dans Admin > Abonnements met Stripe à jour ; le paiement
 * utilise les Prix Stripe. Aucun identifiant Stripe n'est stocké en base : les
 * identifiants de test et de production diffèrent, donc tout est retrouvé par des
 * clés déterministes, identiques dans les deux modes :
 * - Produit : identifiant personnalisé `educalcul_<solo|family|…>` (par nom de formule)
 * - Prix : `lookup_key` `educalcul_plan_<id>_<centimes>_<périodicité>`
 * Un Prix Stripe est immuable : changer le montant crée un nouveau Prix et archive
 * l'ancien. Les abonnés existants gardent leur prix (ils sont sur l'ancien Prix,
 * archivé mais toujours valable) ; seuls les NOUVEAUX abonnements prennent le
 * nouveau tarif.
 */

export const RECURRING: Record<string, { interval: "month" | "year"; interval_count: number }> = {
  month: { interval: "month", interval_count: 1 },
  quarter: { interval: "month", interval_count: 3 },
  semester: { interval: "month", interval_count: 6 },
  year: { interval: "year", interval_count: 1 },
};

const INTERVAL_LABEL: Record<string, string> = {
  month: "Mensuel", quarter: "Trimestriel", semester: "Semestriel", year: "Annuel",
};

export interface CatalogPlan {
  id: number | string;
  name: string;
  description?: string | null;
  price: number | string;
  billing_interval: string;
  is_active?: boolean | null;
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "plan";

export const productIdFor = (name: string) => `educalcul_${slug(name)}`;
export const cents = (price: number | string) => Math.round(Number(price) * 100);
const priceKeyFor = (plan: CatalogPlan) => `educalcul_plan_${plan.id}_${cents(plan.price)}_${plan.billing_interval}`;

/** Le Produit existe (créé si besoin, remis à jour si le nom/la description ont changé, réactivé si archivé). */
export async function ensureProduct(name: string, description?: string | null): Promise<string> {
  const id = productIdFor(name);
  const displayName = `Educalcul ${name}`;
  try {
    const p = await stripe.products.retrieve(id);
    const wanted = { name: displayName, description: description || undefined };
    if (!p.active || p.name !== wanted.name || (p.description || undefined) !== wanted.description) {
      await stripe.products.update(id, { active: true, name: wanted.name, description: description || "" });
    }
  } catch (e) {
    if ((e as { code?: string }).code !== "resource_missing") throw e;
    await stripe.products.create({ id, name: displayName, description: description || undefined, metadata: { source: "educalcul" } });
  }
  return id;
}

/** Prix Stripe courant d'une formule (le crée au besoin, archive les anciens montants). */
export async function ensurePlanPrice(plan: CatalogPlan): Promise<{ productId: string; priceId: string }> {
  const lookup = priceKeyFor(plan);
  const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  if (existing.data[0]) {
    const pr = existing.data[0];
    return { productId: typeof pr.product === "string" ? pr.product : pr.product.id, priceId: pr.id };
  }
  const productId = await ensureProduct(plan.name, plan.description);
  const recurring = RECURRING[plan.billing_interval] || RECURRING.month;
  const created = await stripe.prices.create({
    product: productId,
    currency: "eur",
    unit_amount: cents(plan.price),
    recurring,
    lookup_key: lookup,
    transfer_lookup_key: true,
    nickname: `${plan.name} · ${INTERVAL_LABEL[plan.billing_interval] || plan.billing_interval}`,
    metadata: { plan_id: String(plan.id) },
  });
  await archiveOtherPlanPrices(productId, String(plan.id), created.id);
  return { productId, priceId: created.id };
}

async function archiveOtherPlanPrices(productId: string, planId: string, keepPriceId: string | null) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  for (const pr of prices.data) {
    if (pr.metadata?.plan_id === planId && pr.id !== keepPriceId) {
      await stripe.prices.update(pr.id, { active: false });
    }
  }
}

/** Aligne Stripe sur une formule de la base : à appeler après chaque création / modification / suppression. */
export async function syncPlanToStripe(planId: number | string): Promise<{ ok: boolean; message?: string }> {
  try {
    const { data: plan } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, name, description, price, billing_interval, is_active")
      .eq("id", planId)
      .maybeSingle();
    if (!plan) return removePlanFromStripe(planId);
    // Gratuit, désactivé ou formule « sur mesure » (prix calculé par client) : rien à vendre dans le catalogue.
    if (!plan.is_active || Number(plan.price) <= 0 || plan.name === "Sur mesure") return removePlanFromStripe(planId, plan.name);
    await ensurePlanPrice(plan);
    return { ok: true };
  } catch (e) {
    console.error("[stripeCatalog] synchronisation échouée :", (e as Error).message);
    return { ok: false, message: (e as Error).message };
  }
}

/** Archive les Prix de la formule (le Produit reste, il regroupe les autres périodicités). */
export async function removePlanFromStripe(planId: number | string, name?: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const names = name ? [name] : ["Solo", "Family"];
    for (const n of names) {
      try {
        await archiveOtherPlanPrices(productIdFor(n), String(planId), null);
      } catch (e) {
        if ((e as { code?: string }).code !== "resource_missing") throw e;
      }
    }
    return { ok: true };
  } catch (e) {
    console.error("[stripeCatalog] archivage échoué :", (e as Error).message);
    return { ok: false, message: (e as Error).message };
  }
}

/** Synchronise toutes les formules payantes actives (initialisation du catalogue, ou remise à niveau). */
export async function syncAllPlansToStripe() {
  const { data: plans } = await supabaseAdmin
    .from("subscription_plans")
    .select("id, name, price, is_active")
    .eq("is_active", true)
    .gt("price", 0)
    .neq("name", "Sur mesure");
  const results: { id: number; name: string; ok: boolean; message?: string }[] = [];
  for (const p of plans ?? []) {
    const r = await syncPlanToStripe(p.id);
    results.push({ id: p.id, name: p.name, ...r });
  }
  return results;
}
