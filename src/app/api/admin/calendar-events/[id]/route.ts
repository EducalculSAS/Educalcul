import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { requireRole } from "@/lib/apiAuth";
import { isValidUUID } from "@/lib/validation";
import { GLOBAL_EVENT_COLUMNS, parseGlobalEventInput } from "@/lib/calendarServer";
import { AuditAction, auditLog } from "@/lib/auditLog";

// PATCH : modifie un événement global (une seule zone : la ligne éditée).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    if (!isValidUUID(id)) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    const parsed = parseGlobalEventInput({ ...body, zones: undefined });
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("global_calendar_events")
      .update({ ...parsed.value, zone: parsed.zones[0], updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(GLOBAL_EVENT_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });

    await auditLog({ action: AuditAction.CONTENT_UPDATED, adminId: admin.id, targetType: "global_calendar_event", targetId: id, details: { title: parsed.value.title } }, req);
    return NextResponse.json({ event: data });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error?.message || String(error)) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    if (!isValidUUID(id)) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });

    const { error } = await supabaseAdmin.from("global_calendar_events").delete().eq("id", id);
    if (error) throw error;

    await auditLog({ action: AuditAction.CONTENT_DELETED, adminId: admin.id, targetType: "global_calendar_event", targetId: id }, req);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error?.message || String(error)) }, { status: 500 });
  }
}
