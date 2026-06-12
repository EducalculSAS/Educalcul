import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { validateUsername } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

export async function POST(request: Request) {
  try {
    const { username } = await request.json();
    
    // ✓ VALIDATION: Validate username format
    const validatedUsername = validateUsername(username);
    if (!validatedUsername) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    // ✓ HIGH PRIORITY FIX: Add rate limiting
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const config = RATE_LIMITS["auth:resolve-username"];
    const rl = rateLimitWithBackoff(`resolve-username:${ip}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { data: childUser } = await supabaseAdmin
      .from("users")
      .select("auth_id")
      .eq("child_username", validatedUsername)
      .maybeSingle();

    if (!childUser?.auth_id) {
      return NextResponse.json({ email: `${validatedUsername}@educalcul.user` });
    }

    const { data: authUser, error } = await supabaseAdmin.auth.admin.getUserById(childUser.auth_id);
    if (error || !authUser?.user?.email) {
      return NextResponse.json({ email: `${validatedUsername}@educalcul.user` });
    }

    return NextResponse.json({ email: authUser.user.email });
  } catch (error: any) {
    console.error("[resolve-username] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
