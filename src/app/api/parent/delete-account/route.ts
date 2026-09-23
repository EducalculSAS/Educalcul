import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { deleteParentAccount } from "@/lib/deleteParentAccount";

export async function DELETE(req: Request) {
  try {
    // ✓ SECURITY : cette route utilisait supabaseAdmin.auth.getUser(token)
    // directement, ce qui contournait le gate 2FA obligatoire et le contrôle
    // de compte banni appliqués partout ailleurs via getAuthenticatedUser —
    // un token volé permettait de supprimer le compte (+ tous les enfants)
    // sans re-vérification, malgré la 2FA activée par le parent.
    const me = await getAuthenticatedUser(req);
    if (!me) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    // Seul un parent peut supprimer un compte (le sien + ceux de ses
    // enfants) — un enfant n'a pas ce droit, même sur son propre compte.
    if (me.role !== "parent") {
      return NextResponse.json({ error: "Seul un parent peut supprimer un compte" }, { status: 403 });
    }

    const result = await deleteParentAccount(me.authId);
    if (!result.ok) {
      return NextResponse.json({ error: sanitizeErrorMessage(result.error || "Suppression impossible") }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[delete-account] Unexpected error:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(error?.message || "Erreur interne") }, { status: 500 });
  }
}
