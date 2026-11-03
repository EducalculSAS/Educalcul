import { readJsonBody } from "@/lib/apiJson";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";

const VALID_STATUSES = new Set(["open", "resolved", "ignored"]);

/** Marque un finding comme résolu/ignoré/rouvert. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await readJsonBody(request);
  if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
    return Response.json({ error: "Statut invalide." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("scan_findings").update({ status }).eq("id", id);
  if (error) {
    return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
  return Response.json({ success: true });
}
