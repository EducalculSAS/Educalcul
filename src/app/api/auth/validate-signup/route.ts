import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const { email, role } = await req.json();

    if (!email || !role) {
      return NextResponse.json({ valid: false, error: "Champs manquants" });
    }

    const signUpEmail = (email || "").trim().toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", signUpEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        valid: false,
        error: "Cette adresse email est déjà utilisée. Connectez-vous ou utilisez une autre adresse.",
      });
    }

    return NextResponse.json({ valid: true });
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message });
  }
}
