import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getLiveSubscription } from "@/lib/subscriptionLive";
import { getSubscriptionUnlocks } from "@/lib/badgeStyles";
import { relationOne } from "@/lib/validate";
import { badgeUnlockSchema } from "@/lib/schemas";

/**
 * Contours d'avatar et couleurs de nom : à quoi un compte a droit AUJOURD'HUI.
 * Trois sources : les cosmétiques gagnés (user_cosmetics), les badges (ancien système) et la formule de l'abonnement
 * (celui du parent pour un enfant). Quand une source disparaît (abonnement terminé, résilié, formule changée), ce que le
 * compte portait grâce à elle doit disparaître aussi : voir reconcileCosmetics*.
 */

export const NO_BORDER = "none";
export const DEFAULT_COLOR = "default";

export interface CosmeticUser {
  id: number;
  auth_id: string;
  role: string;
  parent_id: number | null;
}

export interface UnlockedCosmetics {
  borders: Set<string>;
  colors: Set<string>;
}

/** Ce que le compte a le droit d'équiper (toujours : « aucun contour » et la couleur par défaut). */
export async function loadUnlockedCosmetics(user: CosmeticUser): Promise<UnlockedCosmetics> {
  const [{ data: userBadges }, { data: cosmetics }] = await Promise.all([
    supabaseAdmin.from("user_badges").select("badge:badges(unlocks_avatar_border, unlocks_name_animation)").eq("user_id", user.id),
    supabaseAdmin.from("user_cosmetics").select("cosmetic_key").eq("user_id", user.id),
  ]);
  const borders = new Set([NO_BORDER]);
  const colors = new Set([DEFAULT_COLOR]);
  // Chaque cosmétique débloque le contour ET la couleur du même nom.
  for (const c of cosmetics || []) {
    const key = c.cosmetic_key;
    if (key === "flamme") { borders.add("flamme"); colors.add("flame"); }
    else if (key === "elite_text") { colors.add("elite"); }
    else { borders.add(key); colors.add(key); }
  }
  for (const ub of userBadges || []) {
    const b = relationOne(badgeUnlockSchema, ub.badge);
    if (b?.unlocks_avatar_border) borders.add(b.unlocks_avatar_border);
    if (b?.unlocks_name_animation) colors.add(b.unlocks_name_animation);
  }

  // Abonnement : celui du parent pour un enfant.
  let subOwnerAuthId = user.auth_id;
  if (user.role === "child" && user.parent_id) {
    const { data: parent } = await supabaseAdmin.from("users").select("auth_id").eq("id", user.parent_id).maybeSingle();
    if (parent?.auth_id) subOwnerAuthId = parent.auth_id;
  }
  const sub = await getLiveSubscription(subOwnerAuthId);
  let planFeatures = null;
  if (sub?.plan_id) {
    const { data: plan } = await supabaseAdmin.from("subscription_plans").select("features").eq("id", sub.plan_id).maybeSingle();
    planFeatures = plan?.features ?? null;
  }
  const fromPlan = getSubscriptionUnlocks(sub?.plan_id ?? null, planFeatures);
  fromPlan.borders.forEach((b) => borders.add(b));
  fromPlan.colors.forEach((c) => colors.add(c));
  return { borders, colors };
}

/**
 * Retire d'un compte le contour et la couleur qu'il n'a plus le droit de porter. Les administrateurs choisissent librement
 * (pas de vérification côté serveur à l'équipement) : on n'y touche pas.
 * Renvoie ce qui a été retiré.
 */
export async function reconcileCosmeticsForUser(
  user: CosmeticUser & { equipped_border: string | null; name_color: string | null },
): Promise<{ border?: string; color?: string }> {
  if (user.role === "admin") return {};
  const border = user.equipped_border || NO_BORDER;
  const color = user.name_color || DEFAULT_COLOR;
  if (border === NO_BORDER && color === DEFAULT_COLOR) return {};
  const unlocked = await loadUnlockedCosmetics(user);
  const updates: Record<string, string> = {};
  const removed: { border?: string; color?: string } = {};
  if (!unlocked.borders.has(border)) { updates.equipped_border = NO_BORDER; removed.border = border; }
  if (!unlocked.colors.has(color)) { updates.name_color = DEFAULT_COLOR; removed.color = color; }
  if (Object.keys(updates).length > 0) await supabaseAdmin.from("users").update(updates).eq("id", user.id);
  return removed;
}

const USER_COLUMNS = "id, auth_id, role, parent_id, equipped_border, name_color";

/** À appeler quand l'abonnement d'un parent change ou se termine : le parent ET ses enfants sont remis en règle. */
export async function reconcileCosmeticsForFamily(parentAuthId: string): Promise<number> {
  const { data: parent } = await supabaseAdmin.from("users").select(USER_COLUMNS).eq("auth_id", parentAuthId).maybeSingle();
  if (!parent) return 0;
  const { data: children } = await supabaseAdmin.from("users").select(USER_COLUMNS).eq("parent_id", parent.id);
  let changed = 0;
  for (const u of [parent, ...(children ?? [])]) {
    const removed = await reconcileCosmeticsForUser(u);
    if (removed.border || removed.color) changed++;
  }
  return changed;
}

/** Filet de sécurité quotidien (abonnement arrivé à échéance sans événement Stripe, formule modifiée par un admin…). */
export async function reconcileAllCosmetics(): Promise<{ checked: number; changed: number }> {
  let checked = 0;
  let changed = 0;
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(USER_COLUMNS)
      .neq("role", "admin")
      // neq exclut les valeurs vides (rien d'équipé) : seuls les comptes qui portent quelque chose sont examinés.
      .or("equipped_border.neq.none,name_color.neq.default")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const u of data ?? []) {
      checked++;
      const removed = await reconcileCosmeticsForUser(u);
      if (removed.border || removed.color) changed++;
    }
    if (!data || data.length < pageSize) break;
  }
  return { checked, changed };
}
