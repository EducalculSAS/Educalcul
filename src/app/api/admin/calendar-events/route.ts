import { NextResponse } from "next/server";
import { selectAllPages } from "@/lib/selectAllPages";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { GLOBAL_EVENT_COLUMNS, parseGlobalEventInput } from "@/lib/calendarServer";
import { AuditAction, auditLog } from "@/lib/auditLog";

// GET : tous les événements globaux (vacances, dates nationales…)
export async function GET(req: Request) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const data = await selectAllPages((from, to) =>
      supabaseAdmin
        .from("global_calendar_events")
        .select(GLOBAL_EVENT_COLUMNS)
        .order("start_date", { ascending: true })
        .order("id")
        .range(from, to),
    );
    return NextResponse.json({ events: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

// POST : crée un événement, une ligne par zone choisie (`zones: string[]`).
export async function POST(req: Request) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    const parsed = parseGlobalEventInput(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("global_calendar_events")
      .insert(parsed.zones.map((zone) => ({ ...parsed.value, zone, created_by: admin.id })))
      .select(GLOBAL_EVENT_COLUMNS);
    if (error) throw error;

    await auditLog(
      { action: AuditAction.CONTENT_CREATED, adminId: admin.id, targetType: "global_calendar_event", details: { title: parsed.value.title, zones: parsed.zones } },
      req,
    );
    return NextResponse.json({ events: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
