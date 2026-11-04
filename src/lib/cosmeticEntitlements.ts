import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getLiveSubscription } from "@/lib/subscriptionLive";
import { resolveUnlocked, type Unlocked } from "@/lib/cosmetics/entitlements";
import { ADMIN_BORDER, ADMIN_COLOR, DEFAULT_COLOR, NO_BORDER, normalizeBorder, normalizeColor } from "@/lib/cosmetics/catalog";

/**
 * Contours d'avatar et couleurs de nom : à quoi un compte a droit AUJOURD'HUI.
 * Deux sources seulement (voir cosmetics/catalog.ts) : les missions accomplies (user_cosmetics, pour toujours) et la formule
 * d'abonnement active (celle du parent pour un enfant, tant qu'elle dure). Seule exception : un administrateur porte
 * d'office le contour « Égide » et aucun autre (voir aussi le trigger en base). Quand une source disparaît, ce que le compte portait grâce à elle
 * disparaît aussi : voir reconcileCosmetics*.
 */

export interface CosmeticUser {
  id: number;
  auth_id: string;
  role: string;
  parent_id: number | null;
}

export type UnlockedCosmetics = Unlocked;

/** Ce que le compte a le droit d'équiper (toujours : « aucun contour » et la couleur par défaut). */
export async function loadUnlockedCosmetics(user: CosmeticUser): Promise<UnlockedCosmetics> {
  const { data: missions } = await supabaseAdmin.from("user_cosmetics").select("cosmetic_key").eq("user_id", user.id);

  // Abonnement : celui du parent pour un enfant.
  let subOwnerAuthId = user.auth_id;
  if (user.role === "child" && user.parent_id) {
    const { data: parent } = await supabaseAdmin.from("users").select("auth_id").eq("id", user.parent_id).maybeSingle();
    if (parent?.auth_id) subOwnerAuthId = parent.auth_id;
  }
  const sub = await getLiveSubscription(subOwnerAuthId);
  let planFeatures: { cosmetic_borders?: unknown; cosmetic_colors?: unknown } | null = null;
  if (sub?.plan_id) {
    const { data: plan } = await supabaseAdmin.from("subscription_plans").select("features").eq("id", sub.plan_id).maybeSingle();
    const f = plan?.features;
    planFeatures = f && typeof f === "object" && !Array.isArray(f) ? f : null;
  }
  return resolveUnlocked({ missionIds: (missions || []).map((m) => m.cosmetic_key), planFeatures, planId: sub?.plan_id ?? null, isAdmin: user.role === "admin" });
}

/** Retire d'un compte le contour et la couleur qu'il n'a plus le droit de porter. Renvoie ce qui a été retiré. */
export async function reconcileCosmeticsForUser(
  user: CosmeticUser & { equipped_border: string | null; name_color: string | null },
): Promise<{ border?: string; color?: string }> {
  const border = user.equipped_border || NO_BORDER;
  const color = user.name_color || DEFAULT_COLOR;
  const isAdmin = user.role === "admin";
  if (!isAdmin && border === NO_BORDER && color === DEFAULT_COLOR) return {};
  const unlocked = await loadUnlockedCosmetics(user);
  const updates: Record<string, string> = {};
  const removed: { border?: string; color?: string } = {};
  // Une clé inconnue du catalogue (ancien contour « admin », clé retirée) ne peut jamais être portée.
  // Un administrateur porte toujours le contour et le titre « Égide » ; quiconque d'autre ne peut pas les porter.
  if (normalizeBorder(border) !== border || !unlocked.borders.has(border)) { updates.equipped_border = isAdmin ? ADMIN_BORDER : NO_BORDER; removed.border = border; }
  if (normalizeColor(color) !== color || !unlocked.colors.has(color)) { updates.name_color = isAdmin ? ADMIN_COLOR : DEFAULT_COLOR; removed.color = color; }
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
      // neq exclut les valeurs vides (rien d'équipé) : seuls les comptes qui portent quelque chose sont examinés.
      .or("equipped_border.neq.none,name_color.neq.default,role.eq.admin")
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
