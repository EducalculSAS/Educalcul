import { getClientIp } from "@/lib/apiAuth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { isValidUUID } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

// Interrogée par les pages de retour de paiement pendant que le webhook Stripe
// termine la création du compte. Ne renvoie qu'un booléen.
//
// Uniquement par `authId` (UUID du compte en attente, impossible à deviner) :
// la variante par e-mail, sans connexion, permettait de tester si une adresse
// avait un compte Educalcul (énumération des inscrits).
export async function GET(req: Request) {
  const authId = new URL(req.url).searchParams.get("authId");
  if (!authId || !isValidUUID(authId)) {
    return NextResponse.json({ error: "Invalid authId" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const config = RATE_LIMITS["auth:resolve-username"];
  const rl = await rateLimitWithBackoff(`signup-status:${ip}`, config.maxAttempts, config.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { data } = await supabaseAdmin.from("users").select("id").eq("auth_id", authId).maybeSingle();
  return NextResponse.json({ ready: !!data });
}
