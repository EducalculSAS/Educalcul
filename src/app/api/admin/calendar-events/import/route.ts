import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { selectAllPages } from "@/lib/selectAllPages";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { requireRole } from "@/lib/apiAuth";
import { GLOBAL_EVENT_COLUMNS } from "@/lib/calendarServer";
import { fetchOfficialHolidays, isSchoolYear, type OfficialHoliday } from "@/lib/officialHolidays";
import { AuditAction, auditLog } from "@/lib/auditLog";

/**
 * Import des vacances officielles d'une année scolaire.
 * GET  ?year=2026-2027 → aperçu : chaque période, avec `exists` si elle est
 *      déjà au calendrier (même clé d'import, ou même zone + même début).
 * POST { year, keys } → ajoute les périodes choisies qui manquent encore.
 */
async function preview(year: string) {
  const [official, existing] = await Promise.all([
    fetchOfficialHolidays(year),
    selectAllPages<{ zone: string; start_date: string; import_key: string | null }>((from, to) =>
      supabaseAdmin
        .from("global_calendar_events")
        .select("zone, start_date, import_key")
        .eq("event_type", "vacances")
        .order("id")
        .range(from, to),
    ),
  ]);
  const keys = new Set(existing.map((e) => e.import_key).filter(Boolean));
  const starts = new Set(existing.map((e) => `${e.zone}|${e.start_date}`));
  return official.map((h) => ({ ...h, exists: keys.has(h.import_key) || starts.has(`${h.zone}|${h.start_date}`) }));
}

export async function GET(req: Request) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const year = new URL(req.url).searchParams.get("year");
    if (!isSchoolYear(year)) return NextResponse.json({ error: "Année scolaire invalide" }, { status: 400 });
    return NextResponse.json({ year, holidays: await preview(year) });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => null);
    const year = body?.year;
    if (!isSchoolYear(year)) return NextResponse.json({ error: "Année scolaire invalide" }, { status: 400 });
    const wanted = new Set<string>(Array.isArray(body?.keys) ? body.keys.filter((k: unknown) => typeof k === "string").slice(0, 200) : []);

    const toAdd: OfficialHoliday[] = (await preview(year)).filter((h) => !h.exists && wanted.has(h.import_key));
    if (toAdd.length === 0) return NextResponse.json({ events: [], added: 0 });

    const { data, error } = await supabaseAdmin
      .from("global_calendar_events")
      .insert(
        toAdd.map((h) => ({
          title: h.title,
          description: `Calendrier officiel ${year}`,
          event_type: "vacances",
          start_date: h.start_date,
          end_date: h.end_date !== h.start_date ? h.end_date : null,
          zone: h.zone,
          import_key: h.import_key,
          created_by: admin.id,
        })),
      )
      .select(GLOBAL_EVENT_COLUMNS);
    if (error) throw error;

    await auditLog({ action: AuditAction.CONTENT_CREATED, adminId: admin.id, targetType: "global_calendar_event", details: { import: year, added: data?.length ?? 0 } }, req);
    return NextResponse.json({ events: data ?? [], added: data?.length ?? 0 });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
