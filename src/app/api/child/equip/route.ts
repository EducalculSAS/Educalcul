import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSubscriptionUnlocks } from "@/lib/badgeStyles";

export async function POST(req: Request) {
  try {
    const { authId, equipped_border, name_color } = await req.json();
    if (!authId) return NextResponse.json({ error: "Missing authId" }, { status: 400 });

    const { data: user } = await supabaseAdmin.from("users").select("id").eq("auth_id", authId).single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Verify user actually unlocked this border/color via badges
    const { data: userBadges } = await supabaseAdmin
      .from("user_badges")
      .select("badge:badges(unlocks_avatar_border, unlocks_name_animation)")
      .eq("user_id", user.id);

    // Unlock from cross-category cosmetics
    const { data: cosmetics } = await supabaseAdmin.from("user_cosmetics").select("cosmetic_key").eq("user_id", user.id);
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
    const { data: fullUser } = await supabaseAdmin.from("users").select("auth_id, role, parent_id").eq("id", user.id).single();
    let subUserId = fullUser?.auth_id || "";
    if (fullUser?.role === "child" && fullUser?.parent_id) {
      const { data: parent } = await supabaseAdmin.from("users").select("auth_id").eq("id", fullUser.parent_id).maybeSingle();
      if (parent?.auth_id) subUserId = parent.auth_id;
    }
    const { data: sub } = await supabaseAdmin.from("subscriptions").select("plan_id").eq("user_id", subUserId).maybeSingle();
    const subUnlocks = getSubscriptionUnlocks(sub?.plan_id ?? null);
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
