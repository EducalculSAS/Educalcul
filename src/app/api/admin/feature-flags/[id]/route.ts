import { requireSuperAdmin } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { auditLog, AuditAction } from "@/lib/auditLog";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const { enabled } = await req.json();
  if (typeof enabled !== "boolean") return Response.json({ error: "enabled (boolean) requis" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .update({ enabled, updated_by: admin.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("key")
    .single();

  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

  await auditLog(
    { action: enabled ? AuditAction.CONTENT_PUBLISHED : AuditAction.CONTENT_UPDATED, adminId: admin.id, targetType: "feature_flag", targetId: id, details: { key: data.key, enabled } },
    req,
  );

  return Response.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const { data: existing } = await supabaseAdmin.from("feature_flags").select("key").eq("id", id).maybeSingle();

  const { error } = await supabaseAdmin.from("feature_flags").delete().eq("id", id);
  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

  await auditLog(
    { action: AuditAction.CONTENT_DELETED, adminId: admin.id, targetType: "feature_flag", targetId: id, details: { key: existing?.key } },
    req,
  );

  return Response.json({ success: true });
}
