import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { EVENT_COLUMNS, canAccessOwner, parseEventInput, resolveCalendarUser, type CalendarRequester } from "@/lib/calendarServer";

const UUID = /^[0-9a-f-]{36}$/i;

type Loaded = { owner_id: number; created_by: number | null; created_by_role: string | null; visible_to_child: boolean };

/** L'événement, si l'utilisateur a accès à ce calendrier. */
async function load(requester: CalendarRequester, id: string): Promise<Loaded | null> {
  if (!UUID.test(id)) return null;
  const { data } = await supabaseAdmin
    .from("calendar_events")
    .select("owner_id, created_by, created_by_role, visible_to_child")
    .eq("id", id)
    .maybeSingle();
  if (!data || !(await canAccessOwner(requester, data.owner_id))) return null;
  // Un élève n'accède jamais à un événement que son parent lui a masqué.
  if (requester.role === "child" && !data.visible_to_child) return null;
  return data;
}

/** Un élève ne modifie / supprime que ce qu'il a lui-même créé. */
function canEdit(requester: CalendarRequester, ev: Loaded): boolean {
  return requester.role !== "child" || ev.created_by === requester.id;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const requester = await resolveCalendarUser(me.authId);
    if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await params;
    const ev = await load(requester, id);
    if (!ev) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    // « Fait / pas fait » : permis à tous ceux qui voient l'événement.
    if (typeof body.completed === "boolean") updates.completed_at = body.completed ? new Date().toISOString() : null;

    const editsContent = ["title", "description", "event_type", "start_date", "end_date", "start_time", "end_time", "visible_to_child", "course_id"]
      .some((k) => body[k] !== undefined);
    if (editsContent) {
      if (!canEdit(requester, ev)) {
        return NextResponse.json({ error: "Cet événement a été ajouté par ton parent : tu peux seulement le marquer comme fait." }, { status: 403 });
      }
      const parsed = parseEventInput(body, requester.role);
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const v = parsed.value;
      Object.assign(updates, {
        title: v.title, description: v.description, event_type: v.event_type,
        start_date: v.start_date, end_date: v.end_date, start_time: v.start_time, end_time: v.end_time,
        all_day: !v.start_time,
        // Seul un parent décide de ce que voit son enfant.
        ...(requester.role === "parent" ? { visible_to_child: v.visible_to_child } : {}),
      });
    }

    const { data, error } = await supabaseAdmin.from("calendar_events").update(updates).eq("id", id).select(EVENT_COLUMNS).single();
    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const requester = await resolveCalendarUser(me.authId);
    if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await params;
    const ev = await load(requester, id);
    if (!ev) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
    if (!canEdit(requester, ev)) {
      return NextResponse.json({ error: "Cet événement a été ajouté par ton parent : tu ne peux pas le supprimer." }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from("calendar_events").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
