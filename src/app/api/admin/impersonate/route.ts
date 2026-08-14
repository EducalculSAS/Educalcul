import { cookies } from "next/headers";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { auditLog, AuditAction } from "@/lib/auditLog";
import { IMPERSONATION_COOKIE_NAME, IMPERSONATION_MAX_AGE } from "@/lib/impersonationCookie";

/** Génère un lien de connexion à usage unique pour se connecter en tant
 * qu'un parent/enfant, sans jamais voir ni manipuler son mot de passe.
 * Réservé au super admin. Impersonation d'un autre admin explicitement
 * interdite : ça empêcherait de tracer qui a réellement fait quoi. */
export async function POST(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { targetUserId } = await req.json();
    if (!targetUserId) return Response.json({ error: "targetUserId requis" }, { status: 400 });

    // Capture le refresh_token admin (cookies de la requête courante) pour
    // pouvoir restaurer sa session côté serveur à la fin de l'impersonation
    // — jamais copié en sessionStorage côté navigateur.
    const serverClient = await createSupabaseServerClient();
    const { data: originSessionData } = await serverClient.auth.getSession();
    const originRefreshToken = originSessionData?.session?.refresh_token;
    if (!originRefreshToken) return Response.json({ error: "Session admin introuvable" }, { status: 401 });

    const { data: target } = await supabaseAdmin
      .from("users")
      .select("id, email, role, first_name, last_name, status, ban_reason")
      .eq("id", targetUserId)
      .maybeSingle();

    if (!target) return Response.json({ error: "Utilisateur introuvable" }, { status: 404 });
    if (target.role === "admin") {
      return Response.json({ error: "Impossible de se connecter en tant qu'un autre admin" }, { status: 400 });
    }
    if (target.status === "inactive" || target.ban_reason) {
      return Response.json({ error: "Ce compte est suspendu" }, { status: 400 });
    }
    if (!target.email) return Response.json({ error: "Ce compte n'a pas d'email (probablement un profil enfant sans connexion propre)" }, { status: 400 });

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: target.email,
    });
    if (error || !link?.properties?.hashed_token) {
      return Response.json({ error: sanitizeErrorMessage(error?.message || "Échec de génération du lien") }, { status: 500 });
    }

    const targetName = [target.first_name, target.last_name].filter(Boolean).join(" ") || target.email;
    // Pas de route dynamique /admin/users/[id] dans ce repo — la fiche
    // détaillée vit sur /admin/users/detail?id=X (voir src/app/admin/users/detail/page.tsx).
    const returnTo = `/admin/users/detail?id=${targetUserId}`;

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("impersonation_sessions")
      .insert({
        admin_id: admin.id,
        origin_refresh_token: originRefreshToken,
        target_id: target.id,
        target_name: targetName,
        return_to: returnTo,
      })
      .select("id")
      .single();
    if (sessionError || !session) {
      return Response.json({ error: "Impossible de démarrer l'impersonation" }, { status: 500 });
    }

    const store = await cookies();
    store.set(IMPERSONATION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: IMPERSONATION_MAX_AGE,
    });

    await auditLog(
      { action: AuditAction.IMPERSONATION_STARTED, adminId: admin.id, targetUserId: target.id, targetType: "user", targetId: String(target.id), details: { targetName, targetRole: target.role } },
      req,
    );

    return Response.json({
      tokenHash: link.properties.hashed_token,
      targetRole: target.role,
      targetName,
    });
  } catch (err: any) {
    return Response.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
