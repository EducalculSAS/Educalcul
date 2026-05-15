import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ valid: false, error: "Code manquant" });

    const { data, error } = await supabaseAdmin
      .from("referral_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("is_active", true)
      .single();

    if (error || !data) return NextResponse.json({ valid: false, error: "Code invalide ou expiré" });

    // Check expiry
    if (data.valid_until && new Date(data.valid_until) < new Date()) {
      return NextResponse.json({ valid: false, error: "Ce code a expiré" });
    }

    // Check max uses
    if (data.max_uses !== null && data.current_uses >= data.max_uses) {
      return NextResponse.json({ valid: false, error: "Ce code a atteint sa limite d'utilisation" });
    }

    return NextResponse.json({
      valid: true,
      code: data.code,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      description: data.description,
    });
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message });
  }
}
