/** Dates du calendrier : TOUJOURS en heure locale (AAAA-MM-JJ). Jamais
 * toISOString() pour un jour affiché : en France, minuit local converti en
 * UTC recule d'un jour. */

export interface CalendarEventItem {
  id: string;
  title: string;
  description?: string | null;
  event_type: string;
  start_date: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  visible_to_child?: boolean;
  completed_at?: string | null;
  course_id?: number | null;
  course?: { title: string } | { title: string }[] | null;
  source?: "manual" | "ai";
  reason?: string | null;
  owner_id?: number;
  created_by?: number | null;
  created_by_role?: string | null;
  /** Vacances scolaires, échéance d'abonnement : non modifiables. */
  isVirtual?: boolean;
  /** Vue famille : prénom de l'enfant concerné. */
  ownerName?: string;
}

export const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAYS_LONG = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export const toIso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const toLocalIso = (date: Date) => toIso(date.getFullYear(), date.getMonth(), date.getDate());
export const fromIso = (iso: string) => new Date(`${iso}T00:00:00`);
export const todayIso = () => toLocalIso(new Date());

export function addDaysIso(iso: string, n: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toLocalIso(d);
}

export function daysUntil(iso: string): number {
  return Math.round((fromIso(iso).getTime() - fromIso(todayIso()).getTime()) / 86400000);
}

/** Lundi de la semaine qui contient `iso`. */
export function weekStart(iso: string): string {
  const d = fromIso(iso);
  return addDaysIso(iso, -((d.getDay() + 6) % 7));
}

/** « mercredi 24 septembre » (+ année si différente de l'année en cours). */
export function longDate(iso: string): string {
  const d = fromIso(iso);
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${DAYS_LONG[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
}

export function relativeDay(iso: string): string {
  const n = daysUntil(iso);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  if (n > 1 && n < 7) return `dans ${n} jours`;
  return longDate(iso);
}

export const timeLabel = (ev: CalendarEventItem) =>
  ev.start_time ? `${ev.start_time.slice(0, 5)}${ev.end_time ? ` – ${ev.end_time.slice(0, 5)}` : ""}` : "Toute la journée";

export const courseTitle = (ev: CalendarEventItem) => {
  const c = Array.isArray(ev.course) ? ev.course[0] : ev.course;
  return c?.title ?? null;
};

/** Événements triés par jour (un événement sur plusieurs jours apparaît chaque jour). */
export function groupByDay(events: CalendarEventItem[]): Map<string, CalendarEventItem[]> {
  const map = new Map<string, CalendarEventItem[]>();
  for (const ev of events) {
    const end = ev.end_date && ev.end_date >= ev.start_date ? ev.end_date : ev.start_date;
    let cursor = ev.start_date;
    let guard = 0;
    while (cursor <= end && guard++ < 370) {
      const list = map.get(cursor) ?? [];
      list.push(ev);
      map.set(cursor, list);
      cursor = addDaysIso(cursor, 1);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "") || a.title.localeCompare(b.title));
  }
  return map;
}

/** Cases d'une grille mensuelle (semaines complètes, lundi en premier). */
export function monthCells(year: number, month: number): { iso: string; inMonth: boolean }[] {
  const first = toIso(year, month, 1);
  const start = weekStart(first);
  const last = toIso(year, month, new Date(year, month + 1, 0).getDate());
  const cells: { iso: string; inMonth: boolean }[] = [];
  let cursor = start;
  while (cells.length < 42) {
    cells.push({ iso: cursor, inMonth: cursor >= first && cursor <= last });
    cursor = addDaysIso(cursor, 1);
    if (cells.length % 7 === 0 && cursor > last) break;
  }
  return cells;
}
