import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { fetchAuditLogPage } from "@/lib/auditLogQuery";

export async function GET(req: Request) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const action = searchParams.get("action");

    const result = await fetchAuditLogPage(page, action);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
