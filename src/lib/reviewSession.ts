import { z } from "zod";
import { isRecord, parseList } from "@/lib/validate";
import "server-only";
import type { Block, Page } from "@/components/admin/ExerciseBuilder";
import type { Question } from "@/components/admin/QuizBuilder";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripBlockAnswers } from "@/lib/exerciseContent";
import { checkDifficultyAccess } from "@/lib/checkSubscription";
import { deleteSrsItems, dueItems, getSrs, srsKey, type SrsItem, type SrsKind } from "@/lib/srs";

/**
 * Séance « à revoir » : les questions du carnet d'erreurs dont le tour est venu, servies comme un exercice virtuel
 * (identifiant « review »). Chaque question garde sa source : on la retrouve par la clé du carnet
 * (« exercise:<exercice>:<bloc> » ou « quiz:<quiz>:<question> »), jamais par un identifiant envoyé par le navigateur
 * sans contrôle.
 */

/** Lignes lues (les colonnes demandées sont fixes ; le contenu JSON est typé comme dans les éditeurs). */
interface ExerciseRow { id: number | string; title: string; level: string | null; difficulty_level: string | null; course_id: string | number | null; content_json: Page[] | null; grading_type: string | null }
interface QuizRow { id: number | string; title: string; level: string | null; difficulty_level: string | null; course_id: string | number | null; content_json: Question[] | null }

/** Ligne exercice/quiz : identifiant et titre exigés, `content_json` doit être une liste ou vide (colonne JSON libre). */
const isContentRow = (v: unknown): boolean =>
  isRecord(v) && (typeof v.id === "number" || typeof v.id === "string") && typeof v.title === "string" && (v.content_json == null || Array.isArray(v.content_json));

interface Source {
  kind: SrsKind;
  ref: string;
  title: string;
  level: string | null;
  difficulty: string | null;
  courseId: string | number | null;
  /** Bloc complet (avec la bonne réponse) tel qu'un exercice le représente. */
  block: Block;
}

/** Une question de quiz, sous la forme d'un bloc d'exercice (mêmes types de réponse). */
function quizQuestionToBlock(q: Question): Block {
  const base = { id: String(q.id), title: "", content: q.text ?? "", points: q.points || 1, explanation: q.explanation };
  switch (q.type) {
    case "multiple_choice":
      return { ...base, type: "multiple_choice", options: q.options ?? [], correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer] } as Block;
    case "true_false":
      return { ...base, type: "true_false", options: q.options?.length ? q.options : ["Vrai", "Faux"], correctAnswer: q.correctAnswer } as Block;
    case "impossible_search":
      return { ...base, type: "impossible_search", correctAnswer: q.correctAnswer } as Block;
    case "text_input":
      return { ...base, type: "text_input", correctAnswer: q.correctAnswer } as Block;
    default:
      return { ...base, type: "single_choice", options: q.options ?? [], correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer[0] : q.correctAnswer } as Block;
  }
}

/** Retrouve les blocs sources d'une liste de clés du carnet. */
export async function loadSources(keys: { kind: SrsKind; ref: string; block: string }[]): Promise<Map<string, Source>> {
  const out = new Map<string, Source>();
  const exerciseIds = [...new Set(keys.filter((k) => k.kind === "exercise").map((k) => k.ref))];
  const quizIds = [...new Set(keys.filter((k) => k.kind === "quiz").map((k) => k.ref))];
  const [exercises, quizzes] = await Promise.all([
    exerciseIds.length ? supabaseAdmin.from("exercises").select("id, title, level, difficulty_level, course_id, content_json, grading_type").in("id", exerciseIds) : Promise.resolve({ data: [] as ExerciseRow[] }),
    quizIds.length ? supabaseAdmin.from("quizzes").select("id, title, level, difficulty_level, course_id, content_json").in("id", quizIds) : Promise.resolve({ data: [] as QuizRow[] }),
  ]);
  const exById = new Map(parseList(z.custom<ExerciseRow>(isContentRow), exercises.data, "review exercises").map((e) => [String(e.id), e]));
  const qzById = new Map(parseList(z.custom<QuizRow>(isContentRow), quizzes.data, "review quizzes").map((q) => [String(q.id), q]));

  for (const k of keys) {
    if (k.kind === "exercise") {
      const ex = exById.get(k.ref);
      if (!ex) continue;
      let block: Block | null = null;
      for (const page of Array.isArray(ex.content_json) ? ex.content_json : []) {
        block = (page?.blocks ?? []).find((b) => b?.id === k.block) ?? block;
      }
      if (!block) continue;
      if (ex.grading_type === "ai" && !["text_input", "coding", "impossible_search"].includes(block.type)) block = { ...block, type: "text_input" };
      out.set(srsKey(k.kind, k.ref, k.block), { kind: "exercise", ref: k.ref, title: ex.title, level: ex.level, difficulty: ex.difficulty_level, courseId: ex.course_id, block });
    } else {
      const qz = qzById.get(k.ref);
      const q = Array.isArray(qz?.content_json) ? qz.content_json.find((x) => String(x?.id) === k.block) : null;
      if (!qz || !q) continue;
      out.set(srsKey(k.kind, k.ref, k.block), { kind: "quiz", ref: k.ref, title: qz.title, level: qz.level, difficulty: qz.difficulty_level, courseId: qz.course_id, block: quizQuestionToBlock(q) });
    }
  }
  return out;
}

export interface ReviewSession {
  exercise: { id: "review"; title: string; level: string; grading_type: "auto"; content_json: Page[] };
  count: number;
  /** Questions du carnet qui n'existent plus (contenu supprimé ou modifié) : retirées du carnet. */
  dropped: number;
}

/** Prépare la séance du jour (au plus `limit` questions) ; null s'il n'y a rien à revoir. */
export async function buildReviewSession(me: { id: number; authId: string }, level: string | null, limit = 8): Promise<ReviewSession | null> {
  const state = await getSrs(me.id);
  const due = dueItems(state, limit);
  if (!due.length) return null;

  const sources = await loadSources(due);
  const allowedByDifficulty = new Map<string, boolean>();
  const pages: Page[] = [];
  const stale: SrsItem[] = [];

  for (const item of due) {
    const key = srsKey(item.kind, item.ref, item.block);
    const src = sources.get(key);
    if (!src) {
      stale.push(item);
      continue;
    }
    const diffKey = src.difficulty ?? "";
    if (!allowedByDifficulty.has(diffKey)) allowedByDifficulty.set(diffKey, (await checkDifficultyAccess(me.authId, src.difficulty)).allowed);
    if (!allowedByDifficulty.get(diffKey)) continue;
    const safe = stripBlockAnswers({ ...src.block, id: key });
    pages.push({ id: `review-${pages.length + 1}`, title: src.title, blocks: [{ ...safe, title: src.title } as Block] });
  }

  if (stale.length) await deleteSrsItems(me.id, stale.map((s) => srsKey(s.kind, s.ref, s.block)));
  if (!pages.length) return null;
  return { exercise: { id: "review", title: "À revoir", level: level ?? "6eme", grading_type: "auto", content_json: pages }, count: pages.length, dropped: stale.length };
}

/** Clé « exercise:<id>:<bloc> » ou « quiz:<id>:<question> » -> ses trois parties. */
export function parseReviewKey(key: string): { kind: SrsKind; ref: string; block: string } | null {
  const m = /^(exercise|quiz):([^:]+):(.+)$/.exec(key);
  return m ? { kind: m[1] as SrsKind, ref: m[2], block: m[3] } : null;
}
