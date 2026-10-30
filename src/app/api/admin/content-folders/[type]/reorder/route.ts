import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { folderTable, reorderFolders } from "@/lib/contentFolders";

/** Enregistre l'ordre des dossiers d'un même dossier parent. Corps : { orderedIds: number[] } dans l'ordre voulu. */
export async function POST(req: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    if (!(await requireRole(req, ["admin"]))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { type } = await params;
    const table = folderTable(type);
    if (!table) return NextResponse.json({ error: "Type inconnu" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const result = await reorderFolders(table, body.orderedIds);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
