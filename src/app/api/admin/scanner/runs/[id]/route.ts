import { requireRole } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { reconcileStaleGenerations } from "@/lib/ai/runtime";

/** Statut + progression + findings d'un scan (en cours ou terminé). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await reconcileStaleGenerations("scan_runs");
  const { data: run, error } = await supabaseAdmin
    .from("scan_runs")
    .select("id, category, status, progress, findings_count, error, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
  if (!run) return Response.json({ error: "Introuvable" }, { status: 404 });

  const { data: findings } = await supabaseAdmin
    .from("scan_findings")
    .select("id, severity, file_path, title, description, suggested_fix, status, created_at")
    .eq("run_id", id)
    .order("created_at", { ascending: true });

  return Response.json({ ...run, findings: findings || [] });
}

/** Demande d'annulation : le scan s'arrête au prochain lot. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: existing } = await supabaseAdmin
    .from("scan_runs")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return Response.json({ error: "Introuvable" }, { status: 404 });
  if (!["pending", "running"].includes(existing.status)) {
    return Response.json({ success: true, alreadyFinished: true });
  }

  const { error } = await supabaseAdmin
    .from("scan_runs")
    .update({ status: "cancel_requested", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
  return Response.json({ success: true });
}

/** Retire un scan de l'historique (et ses findings, en cascade). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from("scan_runs").delete().eq("id", id);

  if (error) {
    return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
  return Response.json({ success: true });
}
