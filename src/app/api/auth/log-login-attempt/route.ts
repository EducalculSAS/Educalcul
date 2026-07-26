import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { auditLog, AuditAction } from "@/lib/auditLog";

/**
 * Journalise une tentative de connexion (réussie ou échouée) pour le compte
 * concerné, avant même que la 2FA n'intervienne. Appelée par le client juste
 * après signInWithPassword, réussite ou échec : jusqu'ici, un mot de passe
 * refusé n'était visible nulle part dans notre système (seul Supabase le
 * voyait), donc impossible de repérer une tentative suspecte sur un compte.
 * Ne nécessite PAS de session (un échec de connexion n'en a pas) : identifie
 * le compte par email, sans jamais révéler si l'email existe ou non — la
 * réponse est toujours générique.
 */
export async function POST(req: Request) {
  try {
    const { email, success } = await req.json();
    if (!email || typeof email !== "string" || typeof success !== "boolean") {
      return NextResponse.json({ success: true });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const config = RATE_LIMITS["auth:login"];
    const rl = await rateLimitWithBackoff(`auth:login:${normalizedEmail}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      // Ne bloque jamais la connexion elle-même pour cette raison — seul le
      // journal est sauté en cas d'abus (spam de fausses entrées).
      return NextResponse.json({ success: true });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (user) {
      await auditLog(
        {
          action: success ? AuditAction.LOGIN_SUCCESS : AuditAction.LOGIN_FAILED,
          adminId: user.id,
        },
        req,
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
