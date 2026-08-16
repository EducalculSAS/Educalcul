import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { reconcileStaleGenerations } from "@/lib/ai/runtime";

/** Historique des scans (toutes catégories), plus récents d'abord. */
export async function GET(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await reconcileStaleGenerations("scan_runs");

  const { data, error } = await supabaseAdmin
    .from("scan_runs")
    .select("id, category, status, progress, findings_count, error, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
  return Response.json({ runs: data || [] });
}
