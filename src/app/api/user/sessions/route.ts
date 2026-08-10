import { getAuthenticatedUser } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";

function decodeSessionId(req: Request): string | null {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.session_id || null;
  } catch {
    return null;
  }
}

/** Sessions actives (appareils connectés) du compte appelant — parent ou
 * enfant, tout rôle. `auth.sessions` n'est pas exposée par PostgREST : la
 * lecture passe par la fonction Postgres `list_auth_sessions` (SECURITY
 * DEFINER, exécutable uniquement par service_role). */
export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin.rpc("list_auth_sessions", { p_auth_id: user.authId });
  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

  const currentSessionId = decodeSessionId(req);
  const sessions = (data || []).map((s: any) => ({ ...s, is_current: s.id === currentSessionId }));

  return Response.json({ sessions });
}
