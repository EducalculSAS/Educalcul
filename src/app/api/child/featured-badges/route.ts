import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser, canActOnAuthId } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { authId, badgeIds } = await req.json(); // badgeIds: number[3]
    if (!authId || !Array.isArray(badgeIds)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    if (!(await canActOnAuthId(me, authId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: user } = await supabaseAdmin.from("users").select("id").eq("auth_id", authId).single();
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Verify user owns these badges
    const { data: owned } = await supabaseAdmin.from("user_badges").select("badge_id").eq("user_id", user.id);
    const ownedIds = new Set((owned || []).map(b => b.badge_id));
    const valid = badgeIds.slice(0, 3).filter(id => !id || ownedIds.has(id));

    await supabaseAdmin.from("users").update({ featured_badges: badgeIds.slice(0, 3) }).eq("id", user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
