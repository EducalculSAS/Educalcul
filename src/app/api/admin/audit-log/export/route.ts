import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { fetchAllAuditLogEntries } from "@/lib/auditLogQuery";

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function userLabel(u: { first_name?: string | null; last_name?: string | null; email?: string | null } | null): string {
  if (!u) return "";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return name || u.email || "";
}

/** Export CSV du journal d'audit — utile en cas d'incident/litige, pour
 * archiver ou faire analyser la donnée hors de l'admin. */
export async function GET(req: Request) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    const entries = await fetchAllAuditLogEntries(action);

    const header = ["Date", "Action", "Admin", "Cible", "Type cible", "IP", "Détails"];
    const lines = [header.map(csvCell).join(",")];
    for (const e of entries) {
      lines.push(
        [
          new Date(e.created_at).toISOString(),
          e.action,
          userLabel(e.admin),
          e.target ? userLabel(e.target) : "",
          e.target_type || "",
          e.ip_address || "",
          e.details ? JSON.stringify(e.details) : "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
    // BOM pour qu'Excel détecte l'UTF-8 correctement à l'ouverture.
    const csv = "﻿" + lines.join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="journal-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: unknown) {
    return Response.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
