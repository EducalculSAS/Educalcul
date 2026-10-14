import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

// Supprime une clé d'accès enregistrée — uniquement la sienne (filtrée par
// user_id, jamais juste par id de credential). Connexion complète exigée :
// retirer un second facteur avec le seul mot de passe l'annulerait.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  } catch (err: unknown) {
    console.error("[webauthn/credentials/DELETE] failed:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
