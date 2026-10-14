import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

// Route publique intentionnellement (un visiteur pas encore inscrit doit
// pouvoir vérifier un code de parrainage avant de créer son compte) — le
// rate limit protège contre le brute-force de codes plutôt qu'une auth qui
// casserait ce flux.
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const cfg = RATE_LIMITS["auth:resolve-username"];
    const rl = await rateLimitWithBackoff(`referral:validate:${ip}`, cfg.maxAttempts, cfg.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ valid: false, error: "Trop de tentatives, réessaie dans quelques instants." });
    }

    const { code } = await req.json();
    if (!code) return NextResponse.json({ valid: false, error: "Code manquant" });

    const { data, error } = await supabaseAdmin
      .from("referral_codes")
      .select("code, is_active, valid_until, max_uses, current_uses, discount_type, discount_value, description")
      .eq("code", code.trim().toUpperCase())
      .eq("is_active", true)
      .single();

    if (error || !data) return NextResponse.json({ valid: false, error: "Code invalide ou expiré" });

    // Check expiry
    if (data.valid_until && new Date(data.valid_until) < new Date()) {
      return NextResponse.json({ valid: false, error: "Ce code a expiré" });
    }

    // Check max uses
    if (data.max_uses !== null && data.current_uses >= data.max_uses) {
      return NextResponse.json({ valid: false, error: "Ce code a atteint sa limite d'utilisation" });
    }

    return NextResponse.json({
      valid: true,
      code: data.code,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      description: data.description,
    });
  } catch (err: unknown) {
    return NextResponse.json({ valid: false, error: sanitizeErrorMessage(errMessage(err)) });
  }
}
