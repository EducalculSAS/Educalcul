import { requireSuperAdmin } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { auditLog, AuditAction } from "@/lib/auditLog";

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
