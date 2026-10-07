import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getUserData, getUserDataMany } from "@/lib/userData";

/**
 * Activité d'un élève, calculée à partir de ce qui existe déjà (tentatives d'exercices et de quiz, progression des cours,
 * mini-jeux, séances « à revoir ») : aucune table de plus, aucun compteur à tenir à jour. Sert aux objectifs du jour, aux
 * séries, aux alertes des parents et au bulletin.
 */

export interface ChildPrefs {
  /** Objectif du jour, en activités terminées (exercice, quiz, cours, mini-jeu, séance à revoir). */
  dailyGoal: number;
  /** Cible de la semaine fixée par le parent (activités), ou null. */
  weeklyTarget: number | null;
  /** Plage de repos (accès fermé à l'élève) fixée par le parent. */
  quiet: { enabled: boolean; start: string; end: string };
  /** Levée exceptionnelle du repos, jusqu'à cet instant (ISO). */
  quietOverrideUntil: string | null;
  /** Date de l'examen visé (brevet, bac), AAAA-MM-JJ. */
  examDate: string | null;
}

export const DEFAULT_CHILD_PREFS: ChildPrefs = {
  dailyGoal: 2,
  weeklyTarget: null,
  quiet: { enabled: false, start: "21:00", end: "07:00" },
  quietOverrideUntil: null,
  examDate: null,
};

export const getChildPrefs = (childId: number) => getUserData<ChildPrefs>(childId, "prefs", DEFAULT_CHILD_PREFS);
export const getChildPrefsMany = (childIds: number[]) => getUserDataMany<ChildPrefs>(childIds, "prefs", DEFAULT_CHILD_PREFS);

/* ------------------------------------------------------------------ */
/*  Jours (heure de Paris)                                              */
/* ------------------------------------------------------------------ */

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
const hourFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false });

export const parisDay = (d: Date | string | number = new Date()): string => dayFormatter.format(new Date(d));

/** « HH:MM » à Paris. */
export const parisTime = (d: Date | string | number = new Date()): string => hourFormatter.format(new Date(d)).replace(/^24:/, "00:");

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Lundi de la semaine du jour donné. */
export function mondayOf(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = dimanche
  return addDays(day, -((dow + 6) % 7));
}

/** Nombre de jours (entiers) entre deux jours AAAA-MM-JJ. */
export const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000);

/* ------------------------------------------------------------------ */
/*  Activité                                                            */
/* ------------------------------------------------------------------ */

export interface Activity {
  /** Nombre d'activités par jour (AAAA-MM-JJ, heure de Paris). */
  perDay: Record<string, number>;
  /** Dernier instant d'activité (ISO) ou null. */
  last: string | null;
}

interface AttemptRow {
  completed_at: string | null;
  status: string | null;
  attempts_history: { completed_at?: string }[] | null;
}

/** Activités des `days` derniers jours d'un ou plusieurs élèves. */
export async function loadActivityMany(childIds: number[], days = 70): Promise<Map<number, Activity>> {
  const result = new Map<number, Activity>();
  for (const id of childIds) result.set(id, { perDay: {}, last: null });
  if (!childIds.length) return result;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const bump = (id: number, when: string | null | undefined) => {
    if (!when) return;
    const t = new Date(when);
    if (Number.isNaN(t.getTime()) || t.toISOString() < since) return;
    const a = result.get(id)!;
    const day = parisDay(t);
    a.perDay[day] = (a.perDay[day] ?? 0) + 1;
    if (!a.last || t.toISOString() > a.last) a.last = t.toISOString();
  };

  const attemptRows = async (table: "user_exercise_attempts" | "user_quiz_attempts") => {
    const { data } = await supabaseAdmin
      .from(table)
      .select("user_id, completed_at, status, attempts_history")
      .in("user_id", childIds)
      .gte("completed_at", since)
      .limit(5000);
    return (data ?? []) as (AttemptRow & { user_id: number })[];
  };

  const [exo, quiz, courses, games, srsStates] = await Promise.all([
    attemptRows("user_exercise_attempts"),
    attemptRows("user_quiz_attempts"),
    supabaseAdmin.from("user_course_progress").select("user_id, completed_at").in("user_id", childIds).gte("completed_at", since).limit(5000),
    supabaseAdmin.from("minigame_sessions").select("user_id, completed_at").in("user_id", childIds).eq("status", "completed").gte("completed_at", since).limit(5000),
    getUserDataMany<{ reviewDays: Record<string, number> }>(childIds, "srs", { reviewDays: {} }),
  ]);

  for (const row of [...exo, ...quiz]) {
    const history = (row.attempts_history ?? []).map((h) => h?.completed_at).filter(Boolean) as string[];
    if (history.length) history.forEach((h) => bump(row.user_id, h));
    else if (row.status === "completed") bump(row.user_id, row.completed_at);
  }
  for (const c of courses.data ?? []) bump(c.user_id, c.completed_at);
  for (const g of games.data ?? []) bump(g.user_id, g.completed_at);
  for (const id of childIds) {
    const a = result.get(id)!;
    for (const [day, n] of Object.entries(srsStates.get(String(id))?.reviewDays ?? {})) {
      if (day >= parisDay(since)) a.perDay[day] = (a.perDay[day] ?? 0) + (Number(n) || 0);
    }
  }
  return result;
}

export async function loadActivity(childId: number, days = 70): Promise<Activity> {
  return (await loadActivityMany([childId], days)).get(childId)!;
}

/** Série en cours : jours consécutifs avec au moins une activité. Aujourd'hui sans activité ne casse pas la série. */
export function currentStreak(perDay: Record<string, number>, today: string): number {
  let day = (perDay[today] ?? 0) > 0 ? today : addDays(today, -1);
  let streak = 0;
  while ((perDay[day] ?? 0) > 0) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function longestStreak(perDay: Record<string, number>): number {
  const days = Object.keys(perDay).filter((d) => perDay[d] > 0).sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface StudentSummary {
  today: number;
  dailyGoal: number;
  goalReached: boolean;
  streak: number;
  longest: number;
  /** 7 derniers jours, du plus ancien au plus récent. */
  last7: { day: string; count: number }[];
  /** Activités de la semaine en cours (lundi à aujourd'hui). */
  weekTotal: number;
  weeklyTarget: number | null;
  last: string | null;
  /** Jours sans activité (0 = actif aujourd'hui, null = jamais). */
  daysSinceActive: number | null;
}

export function summarize(activity: Activity, prefs: ChildPrefs, now = new Date()): StudentSummary {
  const today = parisDay(now);
  const monday = mondayOf(today);
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return { day, count: activity.perDay[day] ?? 0 };
  });
  let weekTotal = 0;
  for (let d = monday; d <= today; d = addDays(d, 1)) weekTotal += activity.perDay[d] ?? 0;
  const lastDay = activity.last ? parisDay(activity.last) : null;
  return {
    today: activity.perDay[today] ?? 0,
    dailyGoal: prefs.dailyGoal,
    goalReached: (activity.perDay[today] ?? 0) >= prefs.dailyGoal,
    streak: currentStreak(activity.perDay, today),
    longest: longestStreak(activity.perDay),
    last7,
    weekTotal,
    weeklyTarget: prefs.weeklyTarget,
    last: activity.last,
    daysSinceActive: lastDay ? Math.max(0, daysBetween(lastDay, today)) : null,
  };
}

export async function studentSummary(childId: number): Promise<StudentSummary> {
  const [activity, prefs] = await Promise.all([loadActivity(childId), getChildPrefs(childId)]);
  return summarize(activity, prefs);
}

export async function studentSummaries(childIds: number[]): Promise<Map<number, StudentSummary>> {
  const [activities, prefs] = await Promise.all([loadActivityMany(childIds), getChildPrefsMany(childIds)]);
  const out = new Map<number, StudentSummary>();
  for (const id of childIds) out.set(id, summarize(activities.get(id)!, prefs.get(String(id)) ?? DEFAULT_CHILD_PREFS));
  return out;
}

/** Plage de repos : l'élève est-il dans une plage fermée par son parent en ce moment ? */
export function isQuietNow(prefs: ChildPrefs, now = new Date()): boolean {
  if (!prefs.quiet.enabled) return false;
  if (prefs.quietOverrideUntil && new Date(prefs.quietOverrideUntil).getTime() > now.getTime()) return false;
  const t = parisTime(now);
  const { start, end } = prefs.quiet;
  return start <= end ? t >= start && t < end : t >= start || t < end;
}
