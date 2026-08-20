import { getAuthenticatedUser } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { getDeviceIdFromRequest } from "@/lib/deviceIdentity";

/** Appareils connectés du compte appelant — parent ou enfant, tout rôle. Une
 * ligne par appareil PHYSIQUE (table `user_devices`, dédupliquée par cookie
 * device_id — voir track-login/route.ts), pas une ligne par session Supabase
 * brute (`auth.sessions` en crée une nouvelle à chaque connexion, y compris
 * pour un même appareil qui se reconnecte) : c'était la cause des doublons
 * "Mac" vus plusieurs fois dans la liste. */
export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("user_devices")
    .select("id, device_id, label, user_agent, first_seen_at, last_active_at")
    .eq("auth_id", user.authId)
    .order("last_active_at", { ascending: false });
  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

  const currentDeviceId = getDeviceIdFromRequest(req);
  // device_id est le cookie brut du navigateur — utile seulement pour ce
  // calcul côté serveur, jamais renvoyé au client (ni sensible, ni utile).
  const sessions = (data || []).map((s) => ({
    id: s.id,
    label: s.label,
    user_agent: s.user_agent,
    created_at: s.first_seen_at,
    updated_at: s.last_active_at,
    is_current: currentDeviceId !== null && s.device_id === currentDeviceId,
  }));

  return Response.json({ sessions });
}
