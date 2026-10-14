import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";

function generateCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// GET — return (or auto-create) the user's personal referral code
export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const authId = me.authId;

    // Resolve DB user id
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name")
      .eq("auth_id", authId)
      .maybeSingle();

    if (userErr || !userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Look for existing code
    const { data: existing } = await supabaseAdmin
      .from("referral_codes")
      .select("*")
      .eq("owner_user_id", userRow.id)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      // Fetch uses with user info
      const { data: uses } = await supabaseAdmin
        .from("referral_uses")
        .select("id, used_at, used_by_user_id, users:used_by_user_id(first_name, last_name, email)")
        .eq("referral_code_id", existing.id)
        .order("used_at", { ascending: false });
      return NextResponse.json({ ...existing, uses: uses || [] });
    }

    // Auto-create one
    const name = [userRow.first_name, userRow.last_name].filter(Boolean).join("").toUpperCase().replace(/\s/g, "").slice(0, 5);
    const suffix = generateCode(4);
    const code = name ? `${name}${suffix}` : generateCode(8);

    const { data: created, error: createErr } = await supabaseAdmin
      .from("referral_codes")
      .insert({
        code,
        owner_user_id: userRow.id,
        discount_type: "percent",
        discount_value: 10,
        is_active: true,
        description: `Code parrainage de ${userRow.first_name || "utilisateur"}`,
      })
      .select()
      .single();

    if (createErr) return NextResponse.json({ error: sanitizeErrorMessage(createErr.message) }, { status: 500 });
    return NextResponse.json(created);
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
