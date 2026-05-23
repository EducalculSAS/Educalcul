import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const { email, role, childUsername } = await req.json();

    if (!email || !role) {
      return NextResponse.json({ valid: false, error: "Champs manquants" });
    }

    const signUpEmail =
      role === "child"
        ? `${(childUsername || "").replace(/\s+/g, "").toLowerCase()}@educalcul.user`
        : email.trim().toLowerCase();

    // Vérifier dans public.users (fiable, rapide, pas de pagination)
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", signUpEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        valid: false,
        error:
          role === "child"
            ? "Ce nom d'utilisateur est déjà pris."
            : "Cette adresse email est déjà utilisée. Connectez-vous ou utilisez une autre adresse.",
      });
    }

    return NextResponse.json({ valid: true });
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message });
  }
}
