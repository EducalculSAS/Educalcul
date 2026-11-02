import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * Accès aux tables des fonctions d'engagement (migration student_engagement_tables) : objectifs et règles
 * (student_prefs), compteurs et mémoire des alertes (student_meta), carnet d'erreurs (srs_items, student_review_days),
 * réglages d'alertes des parents (parent_alert_prefs). Toutes liées à users avec suppression en cascade, fermées au
 * navigateur : seules les routes serveur y accèdent.
 */

/* ------------------------------------------------------------------ */
/*  Objectifs et règles de l'élève                                      */
/* ------------------------------------------------------------------ */

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

interface PrefsRow {
  user_id: number;
  daily_goal: number;
  weekly_target: number | null;
  quiet_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  quiet_override_until: string | null;
  exam_date: string | null;
}

const PREFS_COLUMNS = "user_id, daily_goal, weekly_target, quiet_enabled, quiet_start, quiet_end, quiet_override_until, exam_date";

const prefsFromRow = (r: PrefsRow): ChildPrefs => ({
  dailyGoal: r.daily_goal,
  weeklyTarget: r.weekly_target,
  quiet: { enabled: r.quiet_enabled, start: r.quiet_start, end: r.quiet_end },
  quietOverrideUntil: r.quiet_override_until,
  examDate: r.exam_date,
});

export async function getChildPrefsMany(childIds: number[]): Promise<Map<string, ChildPrefs>> {
  const out = new Map<string, ChildPrefs>();
  for (const id of childIds) out.set(String(id), DEFAULT_CHILD_PREFS);
  if (!childIds.length) return out;
  for (let i = 0; i < childIds.length; i += 200) {
    const { data } = await supabaseAdmin.from("student_prefs").select(PREFS_COLUMNS).in("user_id", childIds.slice(i, i + 200));
    for (const r of (data ?? []) as PrefsRow[]) out.set(String(r.user_id), prefsFromRow(r));
  }
  return out;
}

export async function getChildPrefs(childId: number): Promise<ChildPrefs> {
  const { data } = await supabaseAdmin.from("student_prefs").select(PREFS_COLUMNS).eq("user_id", childId).maybeSingle();
  return data ? prefsFromRow(data as PrefsRow) : DEFAULT_CHILD_PREFS;
}

export async function setChildPrefs(childId: number, p: ChildPrefs): Promise<void> {
  const { error } = await supabaseAdmin.from("student_prefs").upsert(
    {
      user_id: childId,
      daily_goal: p.dailyGoal,
      weekly_target: p.weeklyTarget,
      quiet_enabled: p.quiet.enabled,
      quiet_start: p.quiet.start,
      quiet_end: p.quiet.end,
      quiet_override_until: p.quietOverrideUntil,
      exam_date: p.examDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/*  Compteurs, version du lien de suivi, mémoire des alertes            */
/* ------------------------------------------------------------------ */

export interface StudentMeta {
  srsMastered: number;
  shareVersion: number;
  alertGoalDay: string | null;
  alertWeeklyTargetWeek: string | null;
  alertStreakMilestone: number;
  alertInactiveSince: string | null;
}

const DEFAULT_META: StudentMeta = { srsMastered: 0, shareVersion: 1, alertGoalDay: null, alertWeeklyTargetWeek: null, alertStreakMilestone: 0, alertInactiveSince: null };

interface MetaRow {
  user_id: number;
  srs_mastered: number;
  share_version: number;
  alert_goal_day: string | null;
  alert_weekly_target_week: string | null;
  alert_streak_milestone: number;
  alert_inactive_since: string | null;
}

const META_COLUMNS = "user_id, srs_mastered, share_version, alert_goal_day, alert_weekly_target_week, alert_streak_milestone, alert_inactive_since";

const metaFromRow = (r: MetaRow): StudentMeta => ({
  srsMastered: r.srs_mastered,
  shareVersion: r.share_version,
  alertGoalDay: r.alert_goal_day,
  alertWeeklyTargetWeek: r.alert_weekly_target_week,
  alertStreakMilestone: r.alert_streak_milestone,
  alertInactiveSince: r.alert_inactive_since,
});

export async function getStudentMetaMany(ids: number[]): Promise<Map<string, StudentMeta>> {
  const out = new Map<string, StudentMeta>();
  for (const id of ids) out.set(String(id), DEFAULT_META);
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabaseAdmin.from("student_meta").select(META_COLUMNS).in("user_id", ids.slice(i, i + 200));
    for (const r of (data ?? []) as MetaRow[]) out.set(String(r.user_id), metaFromRow(r));
  }
  return out;
}

export async function getStudentMeta(id: number): Promise<StudentMeta> {
  const { data } = await supabaseAdmin.from("student_meta").select(META_COLUMNS).eq("user_id", id).maybeSingle();
  return data ? metaFromRow(data as MetaRow) : DEFAULT_META;
}

/** Met à jour seulement les champs donnés (les compteurs srs_mastered et share_version ont leurs propres fonctions). */
export async function saveAlertMemory(id: number, m: Pick<StudentMeta, "alertGoalDay" | "alertWeeklyTargetWeek" | "alertStreakMilestone" | "alertInactiveSince">): Promise<void> {
  const { error } = await supabaseAdmin.from("student_meta").upsert(
    {
      user_id: id,
      alert_goal_day: m.alertGoalDay,
      alert_weekly_target_week: m.alertWeeklyTargetWeek,
      alert_streak_milestone: m.alertStreakMilestone,
      alert_inactive_since: m.alertInactiveSince,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

export async function bumpShareVersion(id: number): Promise<void> {
  const current = await getStudentMeta(id);
  const { error } = await supabaseAdmin.from("student_meta").upsert({ user_id: id, share_version: current.shareVersion + 1, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function bumpMastered(id: number, n: number): Promise<void> {
  if (n <= 0) return;
  const { error } = await supabaseAdmin.rpc("bump_srs_mastered", { p_user: id, p_n: n });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/*  Cahier d'erreurs                                                    */
/* ------------------------------------------------------------------ */

export type SrsKind = "exercise" | "quiz";

export interface SrsItem {
  kind: SrsKind;
  /** Identifiant de l'exercice ou du quiz. */
  ref: string;
  /** Identifiant du bloc (exercice) ou de la question (quiz). */
  block: string;
  /** Palier 0 à 4 (0 = vient d'être raté). */
  box: number;
  /** Prochain passage, AAAA-MM-JJ. */
  due: string;
  misses: number;
  last: string;
}

interface SrsRow {
  kind: SrsKind;
  ref: string;
  block: string;
  box: number;
  due: string;
  misses: number;
  last_day: string;
}

const SRS_COLUMNS = "kind, ref, block, box, due, misses, last_day";
const itemFromRow = (r: SrsRow): SrsItem => ({ kind: r.kind, ref: r.ref, block: r.block, box: r.box, due: r.due, misses: r.misses, last: r.last_day });

export const srsKey = (kind: SrsKind, ref: string, block: string) => `${kind}:${ref}:${block}`;

export async function getSrsItems(userId: number): Promise<SrsItem[]> {
  const { data } = await supabaseAdmin.from("srs_items").select(SRS_COLUMNS).eq("user_id", userId).limit(2000);
  return ((data ?? []) as SrsRow[]).map(itemFromRow);
}

/** Les questions du carnet parmi une liste de clés (une seule requête par séance de correction). */
export async function getSrsItemsByKeys(userId: number, keys: { kind: SrsKind; ref: string; block: string }[]): Promise<SrsItem[]> {
  if (!keys.length) return [];
  const refs = [...new Set(keys.map((k) => k.ref))];
  const { data } = await supabaseAdmin.from("srs_items").select(SRS_COLUMNS).eq("user_id", userId).in("ref", refs);
  const wanted = new Set(keys.map((k) => srsKey(k.kind, k.ref, k.block)));
  return ((data ?? []) as SrsRow[]).map(itemFromRow).filter((i) => wanted.has(srsKey(i.kind, i.ref, i.block)));
}

export async function upsertSrsItems(userId: number, items: SrsItem[]): Promise<void> {
  if (!items.length) return;
  const { error } = await supabaseAdmin.from("srs_items").upsert(
    items.map((i) => ({ user_id: userId, kind: i.kind, ref: i.ref, block: i.block, box: i.box, due: i.due, misses: i.misses, last_day: i.last })),
    { onConflict: "user_id,kind,ref,block" },
  );
  if (error) throw new Error(error.message);
}

export async function deleteSrsItemsByKeys(userId: number, keys: { kind: SrsKind; ref: string; block: string }[]): Promise<void> {
  for (const k of keys) {
    await supabaseAdmin.from("srs_items").delete().eq("user_id", userId).eq("kind", k.kind).eq("ref", k.ref).eq("block", k.block);
  }
}

export async function bumpReviewDay(userId: number, day: string, n: number): Promise<void> {
  if (n <= 0) return;
  const { error } = await supabaseAdmin.rpc("bump_review_day", { p_user: userId, p_day: day, p_n: n });
  if (error) throw new Error(error.message);
}

/** Séances de révision par jour depuis `sinceDay` (compte dans l'objectif du jour et la série). */
export async function getReviewDays(userIds: number[], sinceDay: string): Promise<Map<number, Record<string, number>>> {
  const out = new Map<number, Record<string, number>>();
  for (const id of userIds) out.set(id, {});
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await supabaseAdmin.from("student_review_days").select("user_id, day, count").in("user_id", userIds.slice(i, i + 200)).gte("day", sinceDay);
    for (const r of data ?? []) out.get(r.user_id as number)![r.day as string] = r.count as number;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Alertes du parent                                                   */
/* ------------------------------------------------------------------ */

export interface ParentAlertPrefs {
  /** Prévenir quand l'enfant n'a plus rien fait depuis `inactivityDays` jours. */
  inactivity: boolean;
  inactivityDays: number;
  /** Chapitre terminé. */
  chapter: boolean;
  /** Cible de la semaine atteinte, cap de série. */
  goals: boolean;
  /** En plus de la cloche, envoyer un e-mail pour l'inactivité. */
  email: boolean;
}

export const DEFAULT_ALERT_PREFS: ParentAlertPrefs = { inactivity: true, inactivityDays: 4, chapter: true, goals: true, email: true };

interface AlertRow {
  user_id: number;
  inactivity: boolean;
  inactivity_days: number;
  chapter: boolean;
  goals: boolean;
  email: boolean;
}

const alertFromRow = (r: AlertRow): ParentAlertPrefs => ({ inactivity: r.inactivity, inactivityDays: r.inactivity_days, chapter: r.chapter, goals: r.goals, email: r.email });

export async function getAlertPrefsMany(parentIds: number[]): Promise<Map<string, ParentAlertPrefs>> {
  const out = new Map<string, ParentAlertPrefs>();
  for (const id of parentIds) out.set(String(id), DEFAULT_ALERT_PREFS);
  for (let i = 0; i < parentIds.length; i += 200) {
    const { data } = await supabaseAdmin.from("parent_alert_prefs").select("user_id, inactivity, inactivity_days, chapter, goals, email").in("user_id", parentIds.slice(i, i + 200));
    for (const r of (data ?? []) as AlertRow[]) out.set(String(r.user_id), alertFromRow(r));
  }
  return out;
}

export async function getAlertPrefs(parentId: number): Promise<ParentAlertPrefs> {
  return (await getAlertPrefsMany([parentId])).get(String(parentId)) ?? DEFAULT_ALERT_PREFS;
}

export async function setAlertPrefs(parentId: number, p: ParentAlertPrefs): Promise<void> {
  const { error } = await supabaseAdmin.from("parent_alert_prefs").upsert(
    { user_id: parentId, inactivity: p.inactivity, inactivity_days: p.inactivityDays, chapter: p.chapter, goals: p.goals, email: p.email, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/*  Droit à la portabilité                                              */
/* ------------------------------------------------------------------ */

/** Toutes les données d'engagement d'un utilisateur (objectifs, carnet d'erreurs, réglages d'alertes). */
export async function exportStudentData(userId: number): Promise<Record<string, unknown>> {
  const [prefs, srs, reviewDays, meta, alertPrefs] = await Promise.all([
    supabaseAdmin.from("student_prefs").select("daily_goal, weekly_target, quiet_enabled, quiet_start, quiet_end, exam_date").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("srs_items").select("kind, ref, block, box, due, misses, last_day").eq("user_id", userId),
    supabaseAdmin.from("student_review_days").select("day, count").eq("user_id", userId).order("day"),
    supabaseAdmin.from("student_meta").select("srs_mastered").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("parent_alert_prefs").select("inactivity, inactivity_days, chapter, goals, email").eq("user_id", userId).maybeSingle(),
  ]);
  const out: Record<string, unknown> = {};
  if (prefs.data) out.objectifs_et_regles = prefs.data;
  if (srs.data?.length) out.cahier_d_erreurs = srs.data;
  if (reviewDays.data?.length) out.seances_a_revoir = reviewDays.data;
  if (meta.data && meta.data.srs_mastered) out.questions_maitrisees = meta.data.srs_mastered;
  if (alertPrefs.data) out.reglages_alertes = alertPrefs.data;
  return out;
}
