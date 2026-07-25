import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";

// Ne passe pas par getAuthenticatedUser : un admin qui n'a pas encore
// configuré son TOTP doit pouvoir consulter son propre statut (c'est ce qui
// déclenche l'affichage du popup de configuration).
export async function GET(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("auth_id", identity.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const { data: totp } = await supabaseAdmin
      .from("two_factor_totp")
      .select("confirmed_at")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({ role: user.role, confirmed: !!totp?.confirmed_at });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
