import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { hashTwoFactorValue } from "@/lib/twoFactor";
import { getTwoFactorCookie } from "@/lib/twoFactorCookie";
import { sanitizeErrorMessage } from "@/lib/safeError";

/** Valide que le jeton 2FA (cookie httpOnly, jamais lisible en JS) est encore
 * réellement actif — pas juste "présent". Corrige le "flash puis
 * déconnexion" : sans ça, AdminShell ne vérifiait que la PRÉSENCE du jeton,
 * laissait le dashboard s'afficher, et c'est seulement le premier appel
 * /api/admin/* qui révélait un jeton expiré (401 → déconnexion forcée après
 * un rendu visible). Ne passe pas par getAuthenticatedUser (qui exige déjà
 * un jeton 2FA valide — circulaire pour ce cas précis). */
export async function GET(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ valid: false }, { status: 401 });

    const token = await getTwoFactorCookie();
    if (!token) return NextResponse.json({ valid: false });

    const { data: user } = await supabaseAdmin.from("users").select("id").eq("auth_id", identity.authId).maybeSingle();
    if (!user) return NextResponse.json({ valid: false });

    const { data: session } = await supabaseAdmin
      .from("two_factor_sessions")
      .select("expires_at")
      .eq("user_id", user.id)
      .eq("token_hash", hashTwoFactorValue(token))
      .maybeSingle();

    const valid = !!session && new Date(session.expires_at) > new Date();
    return NextResponse.json({ valid });
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
