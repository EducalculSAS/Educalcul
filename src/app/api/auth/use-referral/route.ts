import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const { code, newUserAuthId } = await req.json();
    if (!code || !newUserAuthId) return NextResponse.json({ error: "Params manquants" }, { status: 400 });

    // Resolve referral code
    const { data: refCode, error: refErr } = await supabaseAdmin
      .from("referral_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("is_active", true)
      .single();

    if (refErr || !refCode) return NextResponse.json({ error: "Code invalide" }, { status: 404 });

    // Check limits
    if (refCode.valid_until && new Date(refCode.valid_until) < new Date())
      return NextResponse.json({ error: "Code expiré" }, { status: 400 });
    if (refCode.max_uses !== null && refCode.current_uses >= refCode.max_uses)
      return NextResponse.json({ error: "Code épuisé" }, { status: 400 });

    // Resolve new user DB id
    const { data: newUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", newUserAuthId)
      .maybeSingle();

    if (!newUser) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

    // Record use
    await supabaseAdmin.from("referral_uses").insert({
      referral_code_id: refCode.id,
      used_by_user_id: newUser.id,
    });

    // Increment current_uses
    await supabaseAdmin
      .from("referral_codes")
      .update({ current_uses: refCode.current_uses + 1 })
      .eq("id", refCode.id);

    // Reward the referrer: +10% on next subscription
    if (refCode.owner_user_id) {
      await supabaseAdmin
        .from("users")
        .update({ pending_discount_percent: 10 })
        .eq("id", refCode.owner_user_id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
