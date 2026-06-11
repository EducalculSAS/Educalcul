import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { generateIcs } from "@/lib/ics";
import { SCHOOL_HOLIDAYS } from "@/lib/schoolHolidays";

// GET /api/calendar/export?token=<auth_uuid>&ownerId=<id>
// `token` must match the auth_id of either the owner or their parent.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const ownerIdParam = searchParams.get("ownerId");

    if (!token || !ownerIdParam) {
      return NextResponse.json({ error: "Missing token or ownerId" }, { status: 400 });
    }
    const ownerId = Number(ownerIdParam);

    const { data: requester } = await supabaseAdmin
      .from("users")
      .select("id, role, parent_id")
      .eq("auth_id", token)
      .maybeSingle();
    if (!requester) return NextResponse.json({ error: "Invalid token" }, { status: 403 });

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

    let query = supabaseAdmin
      .from("calendar_events")
      .select("*")
      .eq("owner_id", ownerId)
      .order("start_date", { ascending: true });

    if (requester.role === "child" && requester.id === ownerId) {
      query = query.eq("visible_to_child", true);
    }

    const { data: events, error } = await query;
    if (error) throw error;

    const { data: globalEvents, error: globalError } = await supabaseAdmin
      .from("global_calendar_events")
      .select("*");
    if (globalError) throw globalError;

    const icsEvents = [
      ...(events || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        start_date: e.start_date,
        end_date: e.end_date,
      })),
      ...SCHOOL_HOLIDAYS.map(h => ({
        id: `holiday-${h.id}`,
        title: h.title,
        start_date: h.start_date,
        end_date: h.end_date,
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
