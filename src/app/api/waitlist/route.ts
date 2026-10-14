import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { validateEmail } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { getClientIp } from "@/lib/ipGeo";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    // Validation stricte du format e-mail (et longueur max) plutôt qu'un simple
    // test sur "@", pour éviter d'insérer des données arbitraires.
    if (!email || typeof email !== "string" || !validateEmail(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    // Rate limiting pour éviter le spam de la table d'attente.
    const ip = getClientIp(req) ?? "unknown";
    const config = RATE_LIMITS["waitlist:join"];
    const rl = await rateLimitWithBackoff(`waitlist:${ip}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez plus tard." },
        { status: 429 }
      );
    }

    const { error } = await supabaseAdmin
      .from("waitlist")
      .insert({ email: email.trim().toLowerCase() });

    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        return NextResponse.json({ success: true, already: true });
      }
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
