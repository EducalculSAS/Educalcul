import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { selectAllPages } from "@/lib/selectAllPages";
import { EVENT_TYPE_OPTIONS, PARENT_ONLY_EVENT_TYPE_OPTIONS } from "@/lib/calendarEventTypes";
import { ZONE_OPTIONS } from "@/lib/calendarZones";

/**
 * Règles du calendrier, communes à toutes ses routes :
 * - un parent gère son calendrier et ceux de SES enfants ;
 * - un élève gère son calendrier, mais ne peut ni modifier ni supprimer un
 *   événement posé par son parent (il peut seulement le marquer « fait ») ;
 * - toute saisie est validée (dates réelles, heures, longueurs).
 */

export const CHILD_ALLOWED_TYPES = new Set<string>(EVENT_TYPE_OPTIONS.map((o) => o.value));
export const PARENT_ALLOWED_TYPES = new Set<string>(PARENT_ONLY_EVENT_TYPE_OPTIONS.map((o) => o.value));

export interface CalendarRequester {
  id: number;
  role: string;
  parent_id: number | null;
  school_zone: string | null;
}

export async function resolveCalendarUser(authId: string): Promise<CalendarRequester | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, role, parent_id, school_zone")
    .eq("auth_id", authId)
    .maybeSingle();
  return data;
}

export async function canAccessOwner(requester: CalendarRequester, ownerId: number): Promise<boolean> {
  if (!Number.isInteger(ownerId) || ownerId <= 0) return false;
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export function isRealDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function cleanTime(value: unknown): string | null {
  return typeof value === "string" && TIME.test(value) ? value.slice(0, 5) : null;
}

export interface EventInput {
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  visible_to_child: boolean;
  course_id: number | null;
}

/** Valide un événement saisi (création). Renvoie un message d'erreur ou l'objet propre. */
export function parseEventInput(body: Record<string, unknown>, role: string): { error: string } | { value: EventInput } {
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title) return { error: "Donne un titre à l'événement." };
  if (!isRealDate(body.start_date)) return { error: "Date de début invalide." };
  const end = body.end_date && isRealDate(body.end_date) ? body.end_date : null;
  if (end && end < (body.start_date as string)) return { error: "La date de fin précède la date de début." };
  const start_time = cleanTime(body.start_time);
  const end_time = start_time ? cleanTime(body.end_time) : null;
  if (start_time && end_time && !end && end_time <= start_time) return { error: "L'heure de fin précède l'heure de début." };
  const allowed = role === "parent" ? PARENT_ALLOWED_TYPES : CHILD_ALLOWED_TYPES;
  const type = typeof body.event_type === "string" && allowed.has(body.event_type) ? body.event_type : "event";
  const courseId = Number(body.course_id);
  return {
    value: {
      title,
      description: typeof body.description === "string" ? body.description.trim().slice(0, 1000) || null : null,
      event_type: type,
      start_date: body.start_date as string,
      end_date: end,
      start_time,
      end_time,
      visible_to_child: body.visible_to_child !== false,
      course_id: Number.isInteger(courseId) && courseId > 0 ? courseId : null,
    },
  };
}

const ZONES = new Set(ZONE_OPTIONS.map((z) => z.value));
const STUDENT_ZONES = new Set(ZONE_OPTIONS.filter((z) => z.value !== "all").map((z) => z.value));

/** Zone d'un utilisateur, ramenée à une valeur connue avant d'entrer dans un
 * filtre PostgREST (`.or(...)`) — jamais de texte libre dans la requête. */
export const safeZone = (zone: unknown): string => (typeof zone === "string" && STUDENT_ZONES.has(zone) ? zone : "C");

const GLOBAL_TYPES = new Set(["vacances", "event", "controle", "devoir", "revision"]);

export interface GlobalEventInput {
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
}

/** Événement global (admin) : mêmes règles de saisie que les calendriers. */
export function parseGlobalEventInput(body: Record<string, unknown>): { error: string } | { value: GlobalEventInput; zones: string[] } {
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title) return { error: "Donne un titre à l'événement." };
  if (!isRealDate(body.start_date)) return { error: "Date de début invalide." };
  const end = body.end_date && isRealDate(body.end_date) ? body.end_date : null;
  if (end && end < (body.start_date as string)) return { error: "La date de fin précède la date de début." };
  const rawZones = Array.isArray(body.zones) ? body.zones : [body.zone ?? "all"];
  const zones = [...new Set(rawZones.filter((z): z is string => typeof z === "string" && ZONES.has(z)))];
  if (zones.length === 0) return { error: "Choisis au moins une zone." };
  return {
    zones: zones.includes("all") ? ["all"] : zones,
    value: {
      title,
      description: typeof body.description === "string" ? body.description.trim().slice(0, 1000) || null : null,
      event_type: typeof body.event_type === "string" && GLOBAL_TYPES.has(body.event_type) ? body.event_type : "vacances",
      start_date: body.start_date as string,
      end_date: end && end !== body.start_date ? end : null,
    },
  };
}

export const GLOBAL_EVENT_COLUMNS = "id, title, description, event_type, start_date, end_date, zone, import_key";

/** Colonnes renvoyées au navigateur. */
export const EVENT_COLUMNS =
  "id, owner_id, created_by, created_by_role, title, description, event_type, start_date, end_date, start_time, end_time, visible_to_child, completed_at, course_id, source, reason, course:courses(title)";

/** Chargement initial d'un calendrier (pages serveur) : événements (masqués
 * exclus pour l'élève) + vacances de la zone, tout paginé. */
export async function loadCalendar(ownerId: number, opts: { childView: boolean; zone: string }) {
  const [events, globalEvents] = await Promise.all([
    selectAllPages<any>((from, to) => {
      let q = supabaseAdmin.from("calendar_events").select(EVENT_COLUMNS).eq("owner_id", ownerId);
      if (opts.childView) q = q.eq("visible_to_child", true);
      return q.order("start_date", { ascending: true }).order("id").range(from, to);
    }),
    selectAllPages<any>((from, to) =>
      supabaseAdmin
        .from("global_calendar_events")
        .select("id, title, description, event_type, start_date, end_date, zone")
        .or(`zone.eq.all,zone.eq.${safeZone(opts.zone)}`)
        .order("start_date", { ascending: true })
        .order("id")
        .range(from, to),
    ),
  ]);
  return { events, globalEvents };
}
