import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";

// Supprime une clé d'accès enregistrée — uniquement la sienne (filtrée par
// user_id, jamais juste par id de credential).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", identity.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const { id } = await params;
    const { error } = await supabaseAdmin
      .from("webauthn_credentials")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      console.error("[webauthn/credentials/DELETE] failed:", error);
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    console.error("[webauthn/credentials/DELETE] failed:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
