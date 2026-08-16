import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";

/** Supprime une partie jouée (modération — ex. session corrompue, doublon de
 * test) — n'affecte que l'historique/le classement, jamais le contenu généré. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from("minigame_sessions").delete().eq("id", id);
  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return Response.json({ success: true });
}
