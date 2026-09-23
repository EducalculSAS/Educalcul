import { NextResponse } from "next/server";
import { selectAllPages } from "@/lib/selectAllPages";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff } from "@/lib/rateLimitAdvanced";
import { EVENT_COLUMNS, canAccessOwner, parseEventInput, resolveCalendarUser, safeZone } from "@/lib/calendarServer";

const MAX_REPEAT = 20;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Événements d'un calendrier (le sien ou celui d'un de ses enfants) +
 * vacances scolaires de la zone. */
export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requester = await resolveCalendarUser(me.authId);
    if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const ownerIdParam = new URL(req.url).searchParams.get("ownerId");
    const ownerId = ownerIdParam ? Number(ownerIdParam) : requester.id;
    if (!(await canAccessOwner(requester, ownerId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Un élève ne voit pas les événements que son parent a masqués.
    const childOnly = requester.role === "child" && requester.id === ownerId;
    const [events, ownerZoneRes] = await Promise.all([
      selectAllPages<any>((from, to) => {
        let q = supabaseAdmin.from("calendar_events").select(EVENT_COLUMNS).eq("owner_id", ownerId);
        if (childOnly) q = q.eq("visible_to_child", true);
        return q.order("start_date", { ascending: true }).order("id").range(from, to);
      }),
      ownerId !== requester.id
        ? supabaseAdmin.from("users").select("school_zone").eq("id", ownerId).maybeSingle()
        : Promise.resolve(null),
    ]);

    const ownerZone = ownerZoneRes ? ownerZoneRes.data?.school_zone || "C" : requester.school_zone || "C";
    const globalEvents = await selectAllPages((from, to) =>
      supabaseAdmin
        .from("global_calendar_events")
        .select("id, title, description, event_type, start_date, end_date, zone")
        .or(`zone.eq.all,zone.eq.${safeZone(ownerZone)}`)
        .order("start_date", { ascending: true })
        .order("id")
        .range(from, to),
    );

    return NextResponse.json({ events, globalEvents, schoolZone: ownerZone });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

/**
 * Créer un ou plusieurs événements :
 *  - `{ ownerId, ...champs }` : un événement ;
 *  - avec `repeatWeeks: n` (2 à 20) : le même événement chaque semaine ;
 *  - `{ ownerId, events: [...] }` : plusieurs (plan de révision IA accepté).
 */
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await rateLimitWithBackoff(`calendar:write:${me.id}`, 120, 60 * 60 * 1000);
    if (!rl.allowed) return NextResponse.json({ error: "Trop d'ajouts, réessaie plus tard." }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const requester = await resolveCalendarUser(me.authId);
    if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const ownerId = Number(body.ownerId);
    if (!(await canAccessOwner(requester, ownerId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const drafts: Record<string, unknown>[] = Array.isArray(body.events) ? body.events.slice(0, MAX_REPEAT) : [body];
    const rows: Record<string, unknown>[] = [];
    for (const draft of drafts) {
      const parsed = parseEventInput(draft, requester.role);
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const base = {
        ...parsed.value,
        owner_id: ownerId,
        created_by: requester.id,
        created_by_role: requester.role,
        all_day: !parsed.value.start_time,
        source: draft.source === "ai" ? "ai" : "manual",
        reason: typeof draft.reason === "string" ? draft.reason.trim().slice(0, 300) || null : null,
      };
      const repeat = Math.min(MAX_REPEAT, Math.max(1, Math.trunc(Number(body.repeatWeeks) || 1)));
      for (let w = 0; w < (Array.isArray(body.events) ? 1 : repeat); w++) {
        rows.push({
          ...base,
          start_date: addDays(base.start_date, w * 7),
          end_date: base.end_date ? addDays(base.end_date, w * 7) : null,
        });
      }
    }

    // Un cours lié doit exister (sinon la contrainte ferait échouer l'ajout).
    const courseIds = [...new Set(rows.map((r) => r.course_id).filter(Boolean))] as number[];
    if (courseIds.length) {
      const { data: known } = await supabaseAdmin.from("courses").select("id").in("id", courseIds);
      const ok = new Set((known ?? []).map((c) => c.id));
      rows.forEach((r) => { if (r.course_id && !ok.has(r.course_id as number)) r.course_id = null; });
    }

    const { data, error } = await supabaseAdmin.from("calendar_events").insert(rows).select(EVENT_COLUMNS);
    if (error) throw error;
    return NextResponse.json({ events: data ?? [], event: data?.[0] ?? null });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
