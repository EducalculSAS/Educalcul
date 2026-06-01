import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const { email, role, childUsername } = await req.json();

    if (!email || !role) {
      return NextResponse.json({ valid: false, error: "Champs manquants" });
    }

    // Self-registered children have their own email; parent-created children use pseudo@educalcul.user
    const childHasOwnEmail = role === "child" && email && email.includes("@") && !email.endsWith("@educalcul.user");
    const signUpEmail = role === "child" && !childHasOwnEmail
      ? `${(childUsername || "").replace(/\s+/g, "").toLowerCase()}@educalcul.user`
      : (email || "").trim().toLowerCase();

    // Check pseudo uniqueness for children with username-based email
    if (role === "child" && !childHasOwnEmail && childUsername) {
      const { data: existingUsername } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("child_username", childUsername.toLowerCase())
        .maybeSingle();
      if (existingUsername) {
        return NextResponse.json({ valid: false, error: "Ce nom d'utilisateur est déjà pris." });
      }
    }

    // Vérifier dans public.users (fiable, rapide, pas de pagination)
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", signUpEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        valid: false,
        error: childHasOwnEmail
          ? "Cette adresse email est déjà utilisée. Connectez-vous ou utilisez une autre adresse."
          : role === "child"
            ? "Ce nom d'utilisateur est déjà pris."
            : "Cette adresse email est déjà utilisée. Connectez-vous ou utilisez une autre adresse.",
      });
    }

    return NextResponse.json({ valid: true });
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message });
  }
}
