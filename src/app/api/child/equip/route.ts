import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSubscriptionUnlocks } from "@/lib/badgeStyles";
import { getAuthenticatedUser, canActOnAuthId } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { authId, equipped_border, name_color } = await req.json();
    if (!authId) return NextResponse.json({ error: "Missing authId" }, { status: 400 });
    if (!(await canActOnAuthId(me, authId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Selecting parent_id/role/auth_id up front avoids a second "fullUser"
    // round-trip later for the same row.
    const { data: user } = await supabaseAdmin.from("users").select("id, auth_id, role, parent_id").eq("auth_id", authId).single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const fullUser = user;

    // Verify user actually unlocked this border/color via badges, and unlock
    // from cross-category cosmetics — both independent, only need user.id.
    const [{ data: userBadges }, { data: cosmetics }] = await Promise.all([
      supabaseAdmin
        .from("user_badges")
        .select("badge:badges(unlocks_avatar_border, unlocks_name_animation)")
        .eq("user_id", user.id),
      supabaseAdmin.from("user_cosmetics").select("cosmetic_key").eq("user_id", user.id),
    ]);
    const unlockedBorders = new Set(['none']);
    const unlockedColors = new Set(['default']);
    // Each cosmetic unlocks both the border and the color of same name
    for (const c of (cosmetics || [])) {
      const key = c.cosmetic_key;
      if (key === 'flamme') { unlockedBorders.add('flamme'); unlockedColors.add('flame'); }
      else if (key === 'elite_text') { unlockedColors.add('elite'); }
      else { unlockedBorders.add(key); unlockedColors.add(key); }
    }
    // Legacy badge unlocks (kept for backward compat)
    for (const ub of (userBadges || [])) {
      const b = ub.badge as any;
      if (b?.unlocks_avatar_border) unlockedBorders.add(b.unlocks_avatar_border);
      if (b?.unlocks_name_animation) unlockedColors.add(b.unlocks_name_animation);
    }

    // Also unlock from subscription (child inherits from parent)
    let subUserId = fullUser?.auth_id || "";
    if (fullUser?.role === "child" && fullUser?.parent_id) {
      const { data: parent } = await supabaseAdmin.from("users").select("auth_id").eq("id", fullUser.parent_id).maybeSingle();
      if (parent?.auth_id) subUserId = parent.auth_id;
    }
    const { data: sub } = await supabaseAdmin.from("subscriptions").select("plan_id").eq("user_id", subUserId).maybeSingle();
    let planFeatures = null;
    if (sub?.plan_id) {
      const { data: planData } = await supabaseAdmin.from("subscription_plans").select("features").eq("id", sub.plan_id).maybeSingle();
      planFeatures = planData?.features ?? null;
    }
    const subUnlocks = getSubscriptionUnlocks(sub?.plan_id ?? null, planFeatures);
    subUnlocks.borders.forEach(b => unlockedBorders.add(b));
    subUnlocks.colors.forEach(c => unlockedColors.add(c));

    const updates: any = {};
    if (equipped_border !== undefined) {
      if (!unlockedBorders.has(equipped_border)) return NextResponse.json({ error: "Border not unlocked" }, { status: 403 });
      updates.equipped_border = equipped_border;
    }
    if (name_color !== undefined) {
      if (!unlockedColors.has(name_color)) return NextResponse.json({ error: "Color not unlocked" }, { status: 403 });
      updates.name_color = name_color;
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin.from("users").update(updates).eq("id", user.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
