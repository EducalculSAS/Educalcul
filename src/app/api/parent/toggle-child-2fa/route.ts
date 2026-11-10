import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { hashTwoFactorValue } from "@/lib/twoFactor";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

// La 2FA d'un compte enfant est gérée par le parent, pas par l'enfant
// lui-même. Le parent doit avoir vérifié un code envoyé à SON email juste
// avant (voir /api/auth/2fa/send-code + verify-code) — verificationToken est
// le jeton de session 2FA renvoyé par verify-code, vérifié ici pour que la
// vérification par code soit réellement appliquée côté serveur, pas juste
// dans l'UI.
export async function POST(req: Request) {
  try {
    const parent = await requireRole(req, ["parent"]);
    if (!parent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const config = RATE_LIMITS["child-account:mutate"];
    const rl = await rateLimitWithBackoff(`toggle-child-2fa:${parent.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de tentatives, réessayez dans quelques minutes." }, { status: 429 });
    }

    const { childId, verificationToken } = await req.json();
    if (!childId) return NextResponse.json({ error: "childId manquant" }, { status: 400 });
    if (!verificationToken) return NextResponse.json({ error: "Vérification par code requise" }, { status: 400 });

    const { data: session } = await supabaseAdmin
      .from("two_factor_sessions")
      .select("expires_at")
      .eq("user_id", parent.id)
      .eq("token_hash", hashTwoFactorValue(verificationToken))
      .maybeSingle();
    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: "Vérification expirée, recommence." }, { status: 400 });
    }

    const { data: child } = await supabaseAdmin
      .from("users")
      .select("id, two_factor_enabled")
      .eq("id", childId)
      .eq("parent_id", parent.id)
      .eq("role", "child")
      .maybeSingle();
    if (!child) return NextResponse.json({ error: "Enfant introuvable" }, { status: 404 });

    const enabled = !child.two_factor_enabled;
    // Activer verrouille la 2FA (l'enfant ne peut plus la désactiver seul,
    // voir /api/auth/2fa/toggle) ; désactiver déverrouille et lui redonne la
    // main pour gérer sa 2FA lui-même depuis son propre profil.
    const { error } = await supabaseAdmin
      .from("users")
      .update({ two_factor_enabled: enabled, two_factor_locked_by_parent: enabled })
      .eq("id", child.id);
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    return NextResponse.json({ success: true, enabled });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
