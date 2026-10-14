import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

// Liste les clés d'accès enregistrées pour l'admin connecté (jamais la clé
// publique/l'identifiant technique, juste de quoi les afficher/supprimer).
export async function GET(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", identity.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const { data, error } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("id, device_label, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[webauthn/status] failed:", error);
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    }

    return NextResponse.json({ credentials: data || [] });
  } catch (err: unknown) {
    console.error("[webauthn/status] failed:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
