import { getAuthenticatedUser } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";

/** Déconnecte un appareil à distance (ex: téléphone perdu) — l'utilisateur ne
 * peut révoquer que ses propres sessions (p_auth_id = user.authId, jamais un
 * id fourni par le client). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin.rpc("revoke_auth_session", {
    p_auth_id: user.authId,
    p_session_id: id,
  });
  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  if (!data) return Response.json({ error: "Session introuvable" }, { status: 404 });

  return Response.json({ success: true });
}
