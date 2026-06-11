import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

async function resolveAdmin(authId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("auth_id", authId)
    .maybeSingle();
  return data && data.role === "admin" ? data : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { userId, title, description, event_type, start_date, end_date, zone } = body;
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const admin = await resolveAdmin(userId);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const admin = await resolveAdmin(userId);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await supabaseAdmin.from("global_calendar_events").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
