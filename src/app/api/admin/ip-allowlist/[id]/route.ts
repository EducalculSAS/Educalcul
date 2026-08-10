import { requireSuperAdmin } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { auditLog, AuditAction } from "@/lib/auditLog";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  const { data: existing } = await supabaseAdmin.from("admin_ip_allowlist").select("cidr").eq("id", id).maybeSingle();

  const { error } = await supabaseAdmin.from("admin_ip_allowlist").delete().eq("id", id);
  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

  await auditLog(
    { action: AuditAction.ADMIN_IP_ALLOWLIST_REMOVED, adminId: admin.id, targetType: "admin_ip_allowlist", targetId: id, details: { cidr: existing?.cidr } },
    req,
  );

  return Response.json({ success: true });
}
