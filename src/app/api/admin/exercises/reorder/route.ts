import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { auditLog, AuditAction } from "@/lib/auditLog";
import { reorderInFolder } from "@/lib/reorderContent";

/** Ordre des exercises d'un dossier (corps : { orderedIds }). Voir reorderContent.ts. */
export async function POST(req: Request) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const result = await reorderInFolder("exercises", body.orderedIds);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    await auditLog(
      { action: AuditAction.CONTENT_UPDATED, adminId: admin.id, details: { reorder: "exercises", count: result.count } },
      req,
    ).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error) || "Erreur interne") }, { status: 500 });
  }
}
