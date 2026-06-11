import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { EVENT_TYPE_OPTIONS, PARENT_ONLY_EVENT_TYPE_OPTIONS } from "@/lib/calendarEventTypes";

const CHILD_ALLOWED_TYPES = new Set(EVENT_TYPE_OPTIONS.map(o => o.value));
const PARENT_ALLOWED_TYPES = new Set(PARENT_ONLY_EVENT_TYPE_OPTIONS.map(o => o.value));

// Resolves the internal bigint user id + role + parent_id from an auth UUID
async function resolveUser(authId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, role, parent_id, school_zone")
    .eq("auth_id", authId)
    .maybeSingle();
  return data;
}

// Checks whether `requester` may access the calendar of `ownerId`
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

// GET: list events for a given calendar owner (child or parent)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const authId = searchParams.get("userId");
    const ownerIdParam = searchParams.get("ownerId");

    if (!authId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const requester = await resolveUser(authId);
    if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const ownerId = ownerIdParam ? Number(ownerIdParam) : requester.id;

    if (!(await canAccessOwner(requester, ownerId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let query = supabaseAdmin
      .from("calendar_events")
      .select("*")
      .eq("owner_id", ownerId)
      .order("start_date", { ascending: true });

    // A child only sees events explicitly visible to them
    if (requester.role === "child" && requester.id === ownerId) {
      query = query.eq("visible_to_child", true);
    }

    const { data, error } = await query;
    if (error) throw error;

    let ownerZone = requester.school_zone || "C";
    if (ownerId !== requester.id) {
      const { data: ownerData } = await supabaseAdmin
        .from("users")
        .select("school_zone")
        .eq("id", ownerId)
        .maybeSingle();
      ownerZone = ownerData?.school_zone || "C";
    }

    const { data: globalEvents, error: globalError } = await supabaseAdmin
      .from("global_calendar_events")
      .select("*")
      .or(`zone.eq.all,zone.eq.${ownerZone}`)
      .order("start_date", { ascending: true });
    if (globalError) throw globalError;

    return NextResponse.json({ events: data || [], globalEvents: globalEvents || [], schoolZone: ownerZone });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: create a new event
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, ownerId, title, description, event_type, start_date, end_date, all_day, color, visible_to_child } = body;

    if (!userId || !ownerId || !title || !start_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const requester = await resolveUser(userId);
    if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const ownerIdNum = Number(ownerId);
    if (!(await canAccessOwner(requester, ownerIdNum))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allowedTypes = requester.role === "parent" ? PARENT_ALLOWED_TYPES : CHILD_ALLOWED_TYPES;
    const safeEventType = event_type && allowedTypes.has(event_type) ? event_type : "event";

    const { data, error } = await supabaseAdmin
      .from("calendar_events")
      .insert({
        owner_id: ownerIdNum,
        created_by: requester.id,
        created_by_role: requester.role,
        title,
        description: description || null,
        event_type: safeEventType,
        start_date,
        end_date: end_date || null,
        all_day: all_day !== false,
        color: color || null,
        visible_to_child: visible_to_child !== false,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
