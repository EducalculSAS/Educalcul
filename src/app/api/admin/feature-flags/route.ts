import { requireRole, requireSuperAdmin } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { auditLog, AuditAction } from "@/lib/auditLog";

export async function GET(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .select("id, key, enabled, description, updated_at")
    .order("key");

  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return Response.json({ flags: data || [] });
}

/** Crée un nouveau flag (activé par défaut — le but est de pouvoir COUPER une
 * fonctionnalité en cas d'incident, pas d'en cacher une pas encore prête). */
export async function POST(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { key, description } = await req.json();
    if (!key || typeof key !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(key)) {
      return Response.json({ error: "Clé invalide (minuscules, chiffres, - ou _ uniquement)" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("feature_flags")
      .insert({ key, description: description || null, enabled: true, updated_by: admin.id })
      .select("id, key, enabled, description, updated_at")
      .single();

    if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    await auditLog(
      { action: AuditAction.CONTENT_CREATED, adminId: admin.id, targetType: "feature_flag", targetId: data.id, details: { key } },
      req,
    );

    return Response.json({ flag: data });
  } catch (err: any) {
    return Response.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
