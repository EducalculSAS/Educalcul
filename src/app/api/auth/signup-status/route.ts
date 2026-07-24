import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { validateEmail, isValidUUID } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

// Polled by the post-checkout success pages while the Stripe webhook finishes
// creating the account. Returns only a boolean — no user data — so it's safe
// to call unauthenticated.
//
// Prefer `authId` over `email`: the email typed on Stripe's own checkout page
// is editable by the payer and can diverge from the account's real email, so
// polling by email alone can time out even though the account was created
// correctly under its actual auth id.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const authId = searchParams.get("authId");
  const email = searchParams.get("email");

  if (!authId && (!email || !validateEmail(email))) {
    return NextResponse.json({ error: "Missing authId or a valid email" }, { status: 400 });
  }
  if (authId && !isValidUUID(authId)) {
    return NextResponse.json({ error: "Invalid authId" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const config = RATE_LIMITS["auth:resolve-username"];
  const rl = await rateLimitWithBackoff(`signup-status:${ip}`, config.maxAttempts, config.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const query = supabaseAdmin.from("users").select("id");
  const { data } = authId
    ? await query.eq("auth_id", authId).maybeSingle()
    : await query.ilike("email", email!.trim()).maybeSingle();

  return NextResponse.json({ ready: !!data });
}
