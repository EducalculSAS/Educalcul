import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import BadgesSettings from "@/components/child/BadgesSettings";
import { loadUnlockedCosmetics } from "@/lib/cosmeticEntitlements";
import { loadActivityCounts, toMissionStats } from "@/lib/cosmetics/stats";
import { buildCards, plansGranting } from "@/lib/cosmetics/view";

export default async function ChildBadgesPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("id, first_name, avatar, equipped_border, name_color, role, parent_id, featured_badges, login_count, login_streak")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userData) redirect("/dashboard");

  const [{ data: allBadges }, { data: ub }, { data: missions }, { data: plans }, counts, unlocked] = await Promise.all([
    supabaseAdmin.from("badges").select("id, name, icon, color, description, display_order").eq("is_active", true).order("display_order"),
    supabaseAdmin.from("user_badges").select("badge_id").eq("user_id", userData.id),
    supabaseAdmin.from("user_cosmetics").select("cosmetic_key").eq("user_id", userData.id),
    supabaseAdmin.from("subscription_plans").select("name, features").eq("is_active", true),
    loadActivityCounts(userData.id),
    // Les droits du compte : missions accomplies + formule d'abonnement active. Aucun statut (même admin) n'y change rien.
    loadUnlockedCosmetics({ id: userData.id, auth_id: authUser.authId, role: userData.role, parent_id: userData.parent_id }),
  ]);
  const earnedIds = (ub || []).map((e) => e.badge_id);

  const { borders, colors } = buildCards({
    stats: toMissionStats(counts, userData, earnedIds.length),
    ownedMissionIds: (missions || []).map((m) => m.cosmetic_key),
    unlocked,
    plansByKey: plansGranting(plans || []),
    isAdmin: userData.role === "admin",
  });

  return <BadgesSettings user={userData} badges={allBadges || []} earnedIds={earnedIds} borders={borders} colors={colors} />;
}
