import { cookies } from "next/headers";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
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

    // Suppression de la ligne et échange du jeton en PARALLÈLE (avant : l'un après l'autre, puis l'audit, avant de
    // répondre) : la sortie d'impersonation attend un seul aller-retour réseau au lieu de quatre.
    const deleted = supabaseAdmin.from("impersonation_sessions").delete().eq("id", id).then(() => undefined, () => undefined);
    // NE JAMAIS passer par supabaseAdmin.auth.* ici : ce client est un
    // singleton partagé par tout le processus serveur, et refreshSession()
    // y installe la session de l'utilisateur — l'en-tête Authorization du
    // client passe alors du service_role au JWT admin (rôle "authenticated").
    // Toutes les opérations admin suivantes du processus échouaient donc en
    // RLS 42501 (audit_logs, two_factor_totp, rate_limits…) jusqu'au
    // redémarrage du serveur. On échange le refresh_token par un appel HTTP
    // direct, qui ne touche aucun état partagé.
    const tokenRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: row.origin_refresh_token }),
      },
    );
    const [refreshedSession] = await Promise.all([tokenRes.json().catch(() => null), deleted]);
    if (!tokenRes.ok || !refreshedSession?.access_token || !refreshedSession?.refresh_token) {
      return Response.json({ error: "Impossible de restaurer la session admin" }, { status: 500 });
    }

    // Le journal d'audit s'écrit après l'envoi de la réponse (after) : il ne retarde plus le retour à la session admin.
    after(() => auditLog(
      {
        action: AuditAction.IMPERSONATION_ENDED,
        adminId: row.admin_id,
        targetUserId: row.target_id,
        targetType: "user",
        targetId: String(row.target_id),
        details: { targetName: row.target_name },
      },
      req,
    ));

    return Response.json({
      access_token: refreshedSession.access_token,
      refresh_token: refreshedSession.refresh_token,
      returnTo: row.return_to,
    });
  } catch (err: unknown) {
    return Response.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
