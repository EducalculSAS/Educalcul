import { getClientIp } from "@/lib/apiAuth";
import { NextResponse } from "next/server";
import { isPasswordPwned, PWNED_MESSAGE } from "@/lib/pwnedPassword";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { validateEmail, isValidRole } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

export async function POST(req: Request) {
  try {
    const { email, role, password } = await req.json();

    // ✓ VALIDATION: Validate email and role format
    if (!email || !role) {
      return NextResponse.json({ valid: false, error: "Champs manquants." });
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ valid: false, error: "Adresse e-mail invalide." });
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ valid: false, error: "Type de compte invalide." });
    }

    // ✓ HIGH PRIORITY FIX: Add rate limiting
    const ip = getClientIp(req);
    const config = RATE_LIMITS["auth:validate-email"];
    const rl = await rateLimitWithBackoff(`validate-signup:${ip}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({
        valid: false,
        error: "Trop de tentatives. Réessayez dans quelques minutes.",
      });
    }

    const signUpEmail = email.trim().toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", signUpEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        valid: false,
        error: "Cette adresse e-mail est déjà utilisée. Connectez-vous ou utilisez-en une autre.",
      });
    }

    // Mot de passe paru dans une fuite de données : refusé dès le formulaire (le mot de passe n'est ni gardé ni journalisé).
    if (typeof password === "string" && password && (await isPasswordPwned(password))) {
      return NextResponse.json({ valid: false, error: PWNED_MESSAGE });
    }

    return NextResponse.json({ valid: true });
  } catch (err: unknown) {
    console.error("[validate-signup] Error:", err);
    return NextResponse.json({ valid: false, error: "Internal server error" });
  }
}
