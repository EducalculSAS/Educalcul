import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { loadUnlockedCosmetics } from "@/lib/cosmeticEntitlements";
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

    // Ce que le compte a le droit de porter aujourd'hui (cosmétiques, badges, formule d'abonnement).
    const { borders: unlockedBorders, colors: unlockedColors } = await loadUnlockedCosmetics(user);

    const updates: Record<string, unknown> = {};
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
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
