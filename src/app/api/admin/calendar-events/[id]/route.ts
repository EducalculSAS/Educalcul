import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { requireRole } from "@/lib/apiAuth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Vérifie le rôle à partir du Bearer token du VRAI appelant — un userId
    // fourni par le client ne prouve rien sur son identité.
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { title, description, event_type, start_date, end_date, zone } = body;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (event_type !== undefined) updates.event_type = event_type;
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (zone !== undefined) updates.zone = zone;

    const { data, error } = await supabaseAdmin
      .from("global_calendar_events")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ event: data });
  } catch (error: any) {
    console.error("[admin/calendar-events PATCH] error:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(error?.message || String(error)) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;

    const { error } = await supabaseAdmin.from("global_calendar_events").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[admin/calendar-events DELETE] error:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(error?.message || String(error)) }, { status: 500 });
  }
}
