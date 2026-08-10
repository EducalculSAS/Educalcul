import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { BORDER_STYLES, NAME_COLORS, getSubscriptionUnlocks } from "@/lib/badgeStyles";
import BadgesSettings from "@/components/child/BadgesSettings";

export default async function ChildBadgesPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("id, first_name, avatar, equipped_border, name_color, role, parent_id, featured_badges")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userData) redirect("/dashboard");

  const [{ data: allBadges }, { data: ub }] = await Promise.all([
    supabaseAdmin.from("badges").select("id, name, icon, color, description, display_order").eq("is_active", true).order("display_order"),
    supabaseAdmin.from("user_badges").select("badge_id").eq("user_id", userData.id),
  ]);
  const earnedIds = (ub || []).map((e) => e.badge_id);

  const borders = new Set(["none"]);
  const colors = new Set(["default"]);

  if (userData.role === "admin") {
    Object.keys(BORDER_STYLES).forEach((k) => borders.add(k));
    Object.keys(NAME_COLORS).forEach((k) => colors.add(k));
  } else {
    // Cosmétiques et chaîne d'abonnement (parent -> sub -> plan) sont
    // indépendants : on les lance en parallèle plutôt qu'en série.
    const [{ data: cosmetics }, subResult] = await Promise.all([
      supabaseAdmin.from("user_cosmetics").select("cosmetic_key").eq("user_id", userData.id),
      (async () => {
        let subUserId = authUser.authId;
        if (userData.role === "child" && userData.parent_id) {
          const { data: parentUser } = await supabaseAdmin.from("users").select("auth_id").eq("id", userData.parent_id).maybeSingle();
          if (parentUser?.auth_id) subUserId = parentUser.auth_id;
        }
        const { data: sub } = await supabaseAdmin.from("subscriptions").select("plan_id").eq("user_id", subUserId).maybeSingle();
        let planFeatures = null;
        if (sub?.plan_id) {
          const { data: planData } = await supabaseAdmin.from("subscription_plans").select("features").eq("id", sub.plan_id).maybeSingle();
          planFeatures = planData?.features ?? null;
        }
        return { planId: sub?.plan_id ?? null, planFeatures };
      })(),
    ]);
    for (const c of cosmetics || []) {
      const k = c.cosmetic_key;
      if (BORDER_STYLES[k]?.source === "subscription" || NAME_COLORS[k]?.source === "subscription") continue;
      if (k === "flamme") { borders.add("flamme"); colors.add("flame"); }
      else if (k === "elite_text") { colors.add("elite"); }
      else { borders.add(k); colors.add(k); }
    }

    const subUnlocks = getSubscriptionUnlocks(subResult.planId, subResult.planFeatures);
    subUnlocks.borders.forEach((b) => borders.add(b));
    subUnlocks.colors.forEach((c) => colors.add(c));
  }

  return (
    <BadgesSettings
      user={userData}
      badges={allBadges || []}
      earnedIds={earnedIds}
      unlockedBorders={[...borders]}
      unlockedColors={[...colors]}
    />
  );
}
