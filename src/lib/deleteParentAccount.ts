import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripe } from "@/lib/stripe";
import { deleteAuthUser } from "@/lib/deleteAuthUser";
import { purgeUserData } from "@/lib/userData";

/**
 * Supprime un compte parent et ceux de ses enfants : abonnement Stripe annulé,
 * données supprimées (RPC delete_user_account, cascade), puis connexions
 * (auth). Utilisé par la suppression demandée par le parent et par la purge
 * des comptes inactifs (voir /api/cron/data-retention).
 */
export async function deleteParentAccount(parentAuthId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: parentRow } = await supabaseAdmin.from("users").select("id").eq("auth_id", parentAuthId).maybeSingle();

  let childAuthIds: string[] = [];
  const purgeIds: number[] = parentRow?.id ? [parentRow.id] : [];
  if (parentRow?.id) {
    const { data: children } = await supabaseAdmin.from("users").select("id, auth_id").eq("parent_id", parentRow.id).eq("role", "child");
    childAuthIds = (children || []).map((c) => c.auth_id).filter(Boolean);
    purgeIds.push(...(children || []).map((c) => c.id));
  }
  // Objectifs, carnet d'erreurs, alertes : effacés avec le compte (droit à l'effacement).
  await purgeUserData(purgeIds).catch((e) => console.warn("[deleteParentAccount] données élève (non bloquant):", (e as Error)?.message));

  // 1. Abonnement Stripe (non bloquant : déjà annulé ou inexistant)
  try {
    const { data: sub } = await supabaseAdmin.from("subscriptions").select("stripe_subscription_id").eq("user_id", parentAuthId).maybeSingle();
    if (sub?.stripe_subscription_id) await stripe.subscriptions.cancel(sub.stripe_subscription_id);
  } catch (e) {
    console.warn("[deleteParentAccount] Stripe cancel (non bloquant):", (e as Error)?.message);
  }

  // 2. Données (cascade)
  const { error } = await supabaseAdmin.rpc("delete_user_account", { p_auth_id: parentAuthId });
  if (error) return { ok: false, error: error.message };

  // 3. Connexions des enfants puis du parent
  for (const childAuthId of childAuthIds) {
    const ok = await deleteAuthUser(childAuthId, `child ${childAuthId}`);
    if (!ok) console.error(`[deleteParentAccount] connexion enfant ${childAuthId} non supprimée`);
  }
  const parentOk = await deleteAuthUser(parentAuthId, "parent");
  if (!parentOk) return { ok: false, error: "Le compte a été supprimé mais la connexion associée n'a pas pu l'être, contacte le support technique." };
  return { ok: true };
}
