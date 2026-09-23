import { NextResponse } from "next/server";
import { selectAllPages } from "@/lib/selectAllPages";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { generateIcs } from "@/lib/ics";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { safeZone } from "@/lib/calendarServer";

// GET /api/calendar/export?ownerId=<id>
// Identité via JWT (header Authorization), comme le reste de l'API : on ne fait
// plus circuler l'auth_id en clair dans l'URL (fuite via logs/referrer).
export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const ownerIdParam = searchParams.get("ownerId");
    if (!ownerIdParam) {
      return NextResponse.json({ error: "Missing ownerId" }, { status: 400 });
    }
    const ownerId = Number(ownerIdParam);
    if (!Number.isInteger(ownerId)) {
      return NextResponse.json({ error: "Invalid ownerId" }, { status: 400 });
    }

    const { data: requester } = await supabaseAdmin
      .from("users")
      .select("id, role, parent_id, school_zone")
      .eq("auth_id", me.authId)
      .maybeSingle();
    if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let allowed = requester.id === ownerId;
    if (!allowed && requester.role === "parent") {
      const { data: child } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", ownerId)
        .eq("parent_id", requester.id)
        .maybeSingle();
      allowed = !!child;
    }
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Paginé : les événements d'une famille s'accumulent au fil des années.
    const childOnly = requester.role === "child" && requester.id === ownerId;
    const eventsQuery = selectAllPages<any>((from, to) => {
      let q = supabaseAdmin
        .from("calendar_events")
        .select("id, title, description, start_date, end_date, start_time, end_time")
        .eq("owner_id", ownerId);
      if (childOnly) q = q.eq("visible_to_child", true);
      return q.order("start_date", { ascending: true }).order("id").range(from, to);
    });


    // The events query and the owner's school zone lookup are independent —
    // run them in parallel instead of one after the other.
    const [{ data: events, error }, ownerZoneRes] = await Promise.all([
      eventsQuery.then((data) => ({ data, error: null })),
      ownerId !== requester.id
        ? supabaseAdmin.from("users").select("school_zone").eq("id", ownerId).maybeSingle()
        : Promise.resolve(null),
    ]);
    if (error) throw error;

    const ownerZone = ownerZoneRes ? ownerZoneRes.data?.school_zone || "C" : requester.school_zone || "C";

    const globalEvents = await selectAllPages<any>((from, to) =>
      supabaseAdmin
        .from("global_calendar_events")
        .select("id, title, description, start_date, end_date")
        .or(`zone.eq.all,zone.eq.${safeZone(ownerZone)}`)
        .order("id")
        .range(from, to),
    );

    const icsEvents = [
      ...(events || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        start_date: e.start_date,
        end_date: e.end_date,
        start_time: e.start_time,
        end_time: e.end_time,
      })),
      ...(globalEvents || []).map((e: any) => ({
        id: `global-${e.id}`,
        title: e.title,
        description: e.description,
        start_date: e.start_date,
        end_date: e.end_date,
      })),
    ];

    const ics = generateIcs(icsEvents, "Educalcul - Calendrier scolaire");

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="educalcul-calendrier.ics"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
