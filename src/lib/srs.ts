import "server-only";
import { addDays, parisDay } from "@/lib/studentStats";
import {
  bumpMastered,
  bumpReviewDay,
  deleteSrsItemsByKeys,
  getReviewDays,
  getSrsItems,
  getSrsItemsByKeys,
  getStudentMeta,
  srsKey,
  upsertSrsItems,
  type SrsItem,
  type SrsKind,
} from "@/lib/studentStore";

/**
 * Cahier d'erreurs et révisions espacées (système de Leitner) : une question ratée entre dans le carnet, revient le
 * lendemain, puis 3, 7, 14 et 30 jours plus tard tant qu'elle est réussie ; ratée à nouveau, elle repart du début.
 * Réussie après le dernier palier, elle est « maîtrisée » et quitte le carnet.
 *
 * Les données vivent dans les tables srs_items (une ligne par question, donc les corrections d'un quiz qui arrivent en
 * parallèle ne s'écrasent pas) et student_review_days ; voir studentStore.ts.
 */

export type { SrsItem, SrsKind };
export { srsKey };

interface SrsMeta {
  /** Séances de révision par jour (compte dans l'objectif du jour et la série). */
  reviewDays: Record<string, number>;
  mastered: number;
}

export interface SrsState extends SrsMeta {
  items: Record<string, SrsItem>;
}

export const SRS_INTERVALS = [1, 3, 7, 14, 30];

export async function getSrs(userId: number): Promise<SrsState> {
  const today = parisDay();
  const [items, meta, reviewDays] = await Promise.all([getSrsItems(userId), getStudentMeta(userId), getReviewDays([userId], addDays(today, -70))]);
  const byKey: Record<string, SrsItem> = {};
  for (const i of items) byKey[srsKey(i.kind, i.ref, i.block)] = i;
  return { items: byKey, mastered: meta.srsMastered, reviewDays: reviewDays.get(userId) ?? {} };
}

export interface SrsResult {
  kind: SrsKind;
  ref: string;
  block: string;
  correct: boolean;
}

/** Fonction pure : applique des résultats à l'état (testable sans base). */
function applyResults(state: SrsState, results: SrsResult[], opts: { review: boolean; today?: string }): SrsState {
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
  const today = parisDay();
  const existing: Record<string, SrsItem> = {};
  for (const i of await getSrsItemsByKeys(userId, results)) existing[srsKey(i.kind, i.ref, i.block)] = i;

  const next = applyResults({ items: existing, reviewDays: {}, mastered: 0 }, results, { ...opts, today });
  const keys = [...new Set(results.map((r) => srsKey(r.kind, r.ref, r.block)))];

  const changed = keys.filter((k) => next.items[k] && JSON.stringify(next.items[k]) !== JSON.stringify(existing[k])).map((k) => next.items[k]);
  const removed = keys.filter((k) => existing[k] && !next.items[k]).map((k) => existing[k]);
  await upsertSrsItems(userId, changed);
  await deleteSrsItemsByKeys(userId, removed);
  if (opts.review) await bumpReviewDay(userId, today, next.reviewDays[today] ?? 0);
  await bumpMastered(userId, next.mastered);
}

/** Retire des questions du carnet (contenu disparu). */
export async function deleteSrsItems(userId: number, keys: string[]): Promise<void> {
  const parsed = keys
    .map((k) => /^(exercise|quiz):([^:]+):(.+)$/.exec(k))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ kind: m[1] as SrsKind, ref: m[2], block: m[3] }));
  await deleteSrsItemsByKeys(userId, parsed);
}

/** Questions à revoir aujourd'hui, les plus anciennes d'abord. */
export function dueItems(state: SrsState, limit: number, today = parisDay()): SrsItem[] {
  return Object.values(state.items ?? {})
    .filter((i) => i.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due) || a.box - b.box)
    .slice(0, limit);
}
