import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { validateEmail, isValidRole } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

export async function POST(req: Request) {
  try {
    const { email, role } = await req.json();

    // ✓ VALIDATION: Validate email and role format
    if (!email || !role) {
      return NextResponse.json({ valid: false, error: "Missing fields" });
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ valid: false, error: "Invalid email format" });
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ valid: false, error: "Invalid role" });
    }

    // ✓ HIGH PRIORITY FIX: Add rate limiting
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const config = RATE_LIMITS["auth:validate-email"];
    const rl = await rateLimitWithBackoff(`validate-signup:${ip}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({
        valid: false,
        error: "Too many validation attempts. Please try again later.",
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
        error: "This email is already in use. Please log in or use a different email.",
      });
    }

    return NextResponse.json({ valid: true });
  } catch (err: unknown) {
    console.error("[validate-signup] Error:", err);
    return NextResponse.json({ valid: false, error: "Internal server error" });
  }
}
