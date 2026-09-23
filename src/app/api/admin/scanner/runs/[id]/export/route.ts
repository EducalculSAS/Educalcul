import { requireRole } from "@/lib/apiAuth";
import { selectAllPages } from "@/lib/selectAllPages";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getScanCategory } from "@/lib/scanner/categories";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];
const SEVERITY_LABEL: Record<string, string> = {
  critical: "CRITIQUE",
  high: "ÉLEVÉE",
  medium: "MOYENNE",
  low: "FAIBLE",
  info: "INFO",
};

/** Génère le rapport .txt téléchargeable d'un scan — à copier/envoyer. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: run } = await supabaseAdmin
    .from("scan_runs")
    .select("id, category, status, findings_count, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!run) return Response.json({ error: "Introuvable" }, { status: 404 });

  const findings = await selectAllPages<any>((from, to) =>
    supabaseAdmin
      .from("scan_findings")
      .select("severity, file_path, title, description, suggested_fix, status")
      .eq("run_id", id)
      .order("created_at", { ascending: true })
      .order("id")
      .range(from, to),
  );

  const category = getScanCategory(run.category);
  const lines: string[] = [];

  lines.push(`RAPPORT SCANNER IA — ${category?.label || run.category}`);
  lines.push(`Généré le : ${new Date(run.created_at).toLocaleString("fr-FR")}`);
  lines.push(`Statut : ${run.status}`);
  lines.push(`Problèmes détectés : ${(findings || []).length}`);
  lines.push("");
  lines.push("=".repeat(70));

  const open = (findings || []).filter((f) => f.status !== "ignored");
  const bySeverity = new Map<string, typeof open>();
  for (const f of open) {
    if (!bySeverity.has(f.severity)) bySeverity.set(f.severity, []);
    bySeverity.get(f.severity)!.push(f);
  }

  if (open.length === 0) {
    lines.push("");
    lines.push("Aucun problème détecté.");
  }

  for (const severity of SEVERITY_ORDER) {
    const items = bySeverity.get(severity);
    if (!items || items.length === 0) continue;
    lines.push("");
    lines.push(`--- SÉVÉRITÉ ${SEVERITY_LABEL[severity]} (${items.length}) ---`);
    for (const f of items) {
      lines.push("");
      lines.push(`[${f.file_path}] ${f.title}`);
      lines.push(`  ${f.description}`);
      if (f.suggested_fix) lines.push(`  → Piste de correction : ${f.suggested_fix}`);
      if (f.status === "resolved") lines.push(`  (déjà marqué résolu dans l'admin)`);
    }
  }

  const report = lines.join("\n");

  return new Response(report, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="scanner-${run.category}-${id.slice(0, 8)}.txt"`,
    },
  });
}
