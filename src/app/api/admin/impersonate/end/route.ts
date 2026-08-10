import { requireSuperAdmin } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { auditLog, AuditAction } from "@/lib/auditLog";

/** Appelée après que le navigateur a restauré la session admin d'origine —
 * trace la fin de la session d'impersonation. */
export async function POST(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { targetUserId, targetName } = await req.json();
    await auditLog(
      { action: AuditAction.IMPERSONATION_ENDED, adminId: admin.id, targetUserId: targetUserId || undefined, targetType: "user", targetId: targetUserId ? String(targetUserId) : undefined, details: { targetName } },
      req,
    );
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
