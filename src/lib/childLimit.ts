import { supabaseAdmin } from "@/lib/supabaseClient";
import { getUserFeatures } from "@/lib/checkSubscription";

export interface ChildLimit {
  /** Nombre d'enfants inclus dans la formule (-1 = illimité). */
  max: number;
  count: number;
  canAdd: boolean;
}

/**
 * Nombre d'enfants qu'un parent peut encore ajouter, selon sa formule (`features.max_children`).
 * Contrôle SERVEUR : avant, rien n'empêchait une formule « 1 enfant » d'en créer autant qu'on voulait.
 * Seuil 99 et plus = illimité (valeur utilisée par la formule sur mesure et l'admin).
 */
export async function getChildLimit(parent: { id: number; authId: string }): Promise<ChildLimit> {
  const [features, { count }] = await Promise.all([
    getUserFeatures(parent.authId, { id: parent.id, role: "parent", parent_id: null }),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("parent_id", parent.id).eq("role", "child"),
  ]);
  const max = Number(features.max_children ?? 1);
  const used = count ?? 0;
  const unlimited = max < 0 || max >= 99;
  return { max: unlimited ? -1 : max, count: used, canAdd: unlimited || used < max };
}

export function childLimitMessage(l: ChildLimit): string {
  return `Votre formule inclut ${l.max} enfant${l.max > 1 ? "s" : ""} et vous en avez déjà ${l.count}. Passez à une formule supérieure pour en ajouter.`;
}
