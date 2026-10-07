import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getUserData, setUserData } from "@/lib/userData";
import { addDays, parisDay } from "@/lib/studentStats";

/**
 * Cahier d'erreurs et révisions espacées (système de Leitner) : une question ratée entre dans le carnet, revient le
 * lendemain, puis 3, 7, 14 et 30 jours plus tard tant qu'elle est réussie ; ratée à nouveau, elle repart du début.
 * Réussie après le dernier palier, elle est « maîtrisée » et quitte le carnet.
 *
 * Stockage : une ligne par question (`u:<élève>:srs:i:<clé>` dans app_settings) — les corrections d'un quiz arrivent en
 * parallèle, des lignes séparées évitent qu'elles s'écrasent — et une ligne de compteurs (`u:<élève>:srs`).
 */

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

export interface SrsMeta {
  /** Séances de révision par jour (compte dans l'objectif du jour et la série). */
  reviewDays: Record<string, number>;
  mastered: number;
}

export interface SrsState extends SrsMeta {
  items: Record<string, SrsItem>;
}

export const SRS_INTERVALS = [1, 3, 7, 14, 30];

export const srsKey = (kind: SrsKind, ref: string, block: string) => `${kind}:${ref}:${block}`;

const itemRowKey = (userId: number, key: string) => `u:${userId}:srs:i:${key}`;
const EMPTY_META: SrsMeta = { reviewDays: {}, mastered: 0 };

export async function getSrs(userId: number): Promise<SrsState> {
  const [meta, rows] = await Promise.all([
    getUserData<SrsMeta>(userId, "srs", EMPTY_META),
    supabaseAdmin.from("app_settings").select("key, value").like("key", `u:${userId}:srs:i:%`).limit(1000),
  ]);
  const prefix = `u:${userId}:srs:i:`;
  const items: Record<string, SrsItem> = {};
  for (const r of rows.data ?? []) items[(r.key as string).slice(prefix.length)] = r.value as SrsItem;
  return { ...meta, items };
}

export interface SrsResult {
  kind: SrsKind;
  ref: string;
  block: string;
  correct: boolean;
}

/** Fonction pure : applique des résultats à l'état (testable sans base). */
export function applyResults(state: SrsState, results: SrsResult[], opts: { review: boolean; today?: string }): SrsState {
  const today = opts.today ?? parisDay();
  const items = { ...(state.items ?? {}) };
  let mastered = state.mastered ?? 0;
  const reviewDays = { ...(state.reviewDays ?? {}) };

  for (const r of results) {
    const k = srsKey(r.kind, r.ref, r.block);
    const existing = items[k];
    if (!r.correct) {
      items[k] = { kind: r.kind, ref: r.ref, block: r.block, box: 0, due: addDays(today, SRS_INTERVALS[0]), misses: (existing?.misses ?? 0) + 1, last: today };
    } else if (existing && (opts.review || existing.due <= today)) {
      const box = existing.box + 1;
      if (box >= SRS_INTERVALS.length) {
        delete items[k];
        mastered++;
      } else {
        items[k] = { ...existing, box, due: addDays(today, SRS_INTERVALS[box]), last: today };
      }
    }
    if (opts.review) reviewDays[today] = (reviewDays[today] ?? 0) + 1;
  }

  // Journal limité à 70 jours.
  const cutoff = addDays(today, -70);
  for (const d of Object.keys(reviewDays)) if (d < cutoff) delete reviewDays[d];
  return { items, reviewDays, mastered };
}

/** Enregistre des résultats : n'écrit que les questions touchées (et les compteurs en cas de séance ou de maîtrise). */
export async function recordResults(userId: number, results: SrsResult[], opts: { review: boolean }): Promise<void> {
  if (!results.length) return;
  const keys = [...new Set(results.map((r) => srsKey(r.kind, r.ref, r.block)))];
  const { data } = await supabaseAdmin.from("app_settings").select("key, value").in("key", keys.map((k) => itemRowKey(userId, k)));
  const existing: Record<string, SrsItem> = {};
  for (const r of data ?? []) existing[(r.key as string).slice(`u:${userId}:srs:i:`.length)] = r.value as SrsItem;

  const next = applyResults({ items: existing, reviewDays: {}, mastered: 0 }, results, opts);

  const upserts = keys
    .filter((k) => next.items[k] && JSON.stringify(next.items[k]) !== JSON.stringify(existing[k]))
    .map((k) => ({ key: itemRowKey(userId, k), value: next.items[k], updated_at: new Date().toISOString() }));
  const removals = keys.filter((k) => existing[k] && !next.items[k]).map((k) => itemRowKey(userId, k));
  if (upserts.length) {
    const { error } = await supabaseAdmin.from("app_settings").upsert(upserts, { onConflict: "key" });
    if (error) throw new Error(error.message);
  }
  if (removals.length) await supabaseAdmin.from("app_settings").delete().in("key", removals);

  if (opts.review || next.mastered > 0) {
    const meta = await getUserData<SrsMeta>(userId, "srs", EMPTY_META);
    const merged = applyResults({ items: {}, reviewDays: meta.reviewDays, mastered: meta.mastered }, [], { review: false });
    for (const [day, n] of Object.entries(next.reviewDays)) merged.reviewDays[day] = (merged.reviewDays[day] ?? 0) + n;
    await setUserData(userId, "srs", { reviewDays: merged.reviewDays, mastered: (meta.mastered ?? 0) + next.mastered });
  }
}

/** Retire des questions du carnet (contenu disparu). */
export async function deleteSrsItems(userId: number, keys: string[]): Promise<void> {
  if (!keys.length) return;
  await supabaseAdmin.from("app_settings").delete().in("key", keys.map((k) => itemRowKey(userId, k)));
}

/** Questions à revoir aujourd'hui, les plus anciennes d'abord. */
export function dueItems(state: SrsState, limit: number, today = parisDay()): SrsItem[] {
  return Object.values(state.items ?? {})
    .filter((i) => i.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due) || a.box - b.box)
    .slice(0, limit);
}

export const itemCount = (state: SrsState) => Object.keys(state.items ?? {}).length;
