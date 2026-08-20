import { getAuthenticatedUser } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";

/** Déconnecte un appareil à distance (ex: téléphone perdu, ordinateur d'un
 * associé) — l'utilisateur ne peut révoquer que ses propres appareils
 * (auth_id = user.authId, jamais un id fourni par le client). `id` est
 * maintenant l'id `user_devices` (une ligne par appareil physique), pas
 * directement un id `auth.sessions` — on retrouve la session Supabase sous-
 * jacente via `session_id` (capturé à la dernière connexion de l'appareil)
 * pour la révoquer réellement : sans refresh token valide, cet appareil
 * devra se reconnecter avec le mot de passe la prochaine fois. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: device, error: fetchError } = await supabaseAdmin
    .from("user_devices")
    .select("id, session_id")
    .eq("id", id)
    .eq("auth_id", user.authId)
    .maybeSingle();
  if (fetchError) return Response.json({ error: sanitizeErrorMessage(fetchError.message) }, { status: 500 });
  if (!device) return Response.json({ error: "Appareil introuvable" }, { status: 404 });

  if (device.session_id) {
    // Best-effort : une session déjà expirée ne renvoie pas d'erreur
    // bloquante, l'important est de retirer l'appareil de la liste.
    await supabaseAdmin.rpc("revoke_auth_session", {
      p_auth_id: user.authId,
      p_session_id: device.session_id,
    });
  }

  const { error: deleteError } = await supabaseAdmin.from("user_devices").delete().eq("id", id);
  if (deleteError) return Response.json({ error: sanitizeErrorMessage(deleteError.message) }, { status: 500 });

  return Response.json({ success: true });
}
