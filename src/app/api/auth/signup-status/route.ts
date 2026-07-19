import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { validateEmail } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

// Polled by the post-checkout success pages while the Stripe webhook finishes
// creating the account. Returns only a boolean — no user data — so it's safe
// to call unauthenticated.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  if (!email || !validateEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const config = RATE_LIMITS["auth:resolve-username"];
  const rl = rateLimitWithBackoff(`signup-status:${ip}`, config.maxAttempts, config.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { data } = await supabaseAdmin
    .from("users")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();

  return NextResponse.json({ ready: !!data });
}
