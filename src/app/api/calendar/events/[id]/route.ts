import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { EVENT_TYPE_OPTIONS, PARENT_ONLY_EVENT_TYPE_OPTIONS } from "@/lib/calendarEventTypes";
import { getAuthenticatedUser } from "@/lib/apiAuth";

const CHILD_ALLOWED_TYPES = new Set(EVENT_TYPE_OPTIONS.map(o => o.value));
const PARENT_ALLOWED_TYPES = new Set(PARENT_ONLY_EVENT_TYPE_OPTIONS.map(o => o.value));

async function resolveUser(authId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, role, parent_id")
    .eq("auth_id", authId)
    .maybeSingle();
  return data;
}

async function canAccessOwner(requester: { id: number; role: string; parent_id: number | null }, ownerId: number) {
  if (requester.id === ownerId) return true;
  if (requester.role === "parent") {
    const { data: child } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", ownerId)
      .eq("parent_id", requester.id)
      .maybeSingle();
    return !!child;
  }
  return false;
}

// PATCH: update an event
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { title, description, event_type, start_date, end_date, all_day, color, visible_to_child } = body;

    const requester = await resolveUser(me.authId);
    if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("calendar_events")
      .select("owner_id")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    if (!(await canAccessOwner(requester, existing.owner_id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (event_type !== undefined) {
      const allowedTypes = requester.role === "parent" ? PARENT_ALLOWED_TYPES : CHILD_ALLOWED_TYPES;
      updates.event_type = allowedTypes.has(event_type) ? event_type : "event";
    }
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (all_day !== undefined) updates.all_day = all_day;
    if (color !== undefined) updates.color = color;
    if (visible_to_child !== undefined) updates.visible_to_child = visible_to_child;

    const { data, error } = await supabaseAdmin
      .from("calendar_events")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

// DELETE: remove an event
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const requester = await resolveUser(me.authId);
    if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("calendar_events")
      .select("owner_id")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    if (!(await canAccessOwner(requester, existing.owner_id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from("calendar_events").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
