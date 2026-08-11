import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { auditLog, AuditAction } from "@/lib/auditLog";
import { IMPERSONATION_COOKIE_NAME } from "@/lib/impersonationCookie";

/** Termine l'impersonation : le cookie httpOnly `edu_impersonation` (posé au
 * démarrage, voir /api/admin/impersonate) fait office d'autorisation — la
 * session active au moment de l'appel est celle de la CIBLE, pas de l'admin,
 * donc pas de requireSuperAdmin ici. Le refresh_token d'origine, jamais
 * exposé au navigateur jusqu'ici, est échangé contre une session fraîche
 * renvoyée une seule fois dans la réponse pour que le client appelle
 * supabase.auth.setSession() — jamais écrit en sessionStorage/localStorage. */
export async function POST(req: Request) {
  try {
    const store = await cookies();
    const id = store.get(IMPERSONATION_COOKIE_NAME)?.value;
    if (!id) return Response.json({ error: "Aucune impersonation en cours" }, { status: 404 });

    const { data: row } = await supabaseAdmin
      .from("impersonation_sessions")
      .select("admin_id, origin_refresh_token, target_id, target_name, return_to")
      .eq("id", id)
      .maybeSingle();

    store.delete(IMPERSONATION_COOKIE_NAME);
    if (!row) return Response.json({ error: "Session d'impersonation introuvable" }, { status: 404 });

    await supabaseAdmin.from("impersonation_sessions").delete().eq("id", id);

    const { data: refreshed, error: refreshError } = await supabaseAdmin.auth.refreshSession({
      refresh_token: row.origin_refresh_token,
    });
    if (refreshError || !refreshed?.session) {
      return Response.json({ error: "Impossible de restaurer la session admin" }, { status: 500 });
    }

    await auditLog(
      {
        action: AuditAction.IMPERSONATION_ENDED,
        adminId: row.admin_id,
        targetUserId: row.target_id,
        targetType: "user",
        targetId: String(row.target_id),
        details: { targetName: row.target_name },
      },
      req,
    );

    return Response.json({
      access_token: refreshed.session.access_token,
      refresh_token: refreshed.session.refresh_token,
      returnTo: row.return_to,
    });
  } catch (err: any) {
    return Response.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
