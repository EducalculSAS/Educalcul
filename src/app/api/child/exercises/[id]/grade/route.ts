import type { Loose } from "@/types/loose";
import { NextResponse, after } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { checkDifficultyAccess } from "@/lib/checkSubscription";
import { gradeFreeAnswer } from "@/lib/gradeFreeAnswer";
import { blockMaxPoints, itemsCorrect } from "@/lib/exerciseScoring";
import { recordResults, type SrsResult } from "@/lib/srs";
import { loadSources, parseReviewKey } from "@/lib/reviewSession";
import { afterActivity } from "@/lib/parentAlerts";
import { recordGrades } from "@/lib/gradedAnswers";

export const maxDuration = 60;

const FREE_TYPES = new Set(["text_input", "coding", "impossible_search"]);
const MAX_ITEMS = 60;
const AI_CONCURRENCY = 4;

interface GradeItem {
  block_id?: string;
  answer: unknown;
  /** Aperçu admin uniquement : la question complète (le contenu n'est pas encore enregistré). */
  block?: Loose;
}

interface GradeResult {
  block_id?: string;
  score: number;
  max_score: number;
  is_correct: boolean;
  feedback: string;
  reveal?: unknown;
  unavailable?: boolean;
  comment_token?: string;
  /** Correction manuelle : la réponse est enregistrée, aucun verdict automatique. */
  pending?: boolean;
}

/** Exécute des tâches avec au plus `limit` en parallèle (appels IA). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** Correction exacte des blocs à choix / à manipuler (pas d'IA). */
function gradeStructured(block: Loose, answer: Loose): boolean {
  const type = block.type;
  if (type === "multiple_choice" || type === "qcm") {
    const correct = Array.isArray(block.correctAnswer) ? block.correctAnswer : [block.correctAnswer];
    const selected = Array.isArray(answer) ? answer : [answer];
    return correct.length === selected.length && correct.every((a: Loose) => selected.includes(a));
  }
  if (type === "single_choice" || type === "true_false") return answer === block.correctAnswer;
  if (type === "fill_in_the_blank") {
    const given: string[] = Array.isArray(answer) ? answer : [];
    const expected: string[] = block.blanks || [];
    return expected.length > 0 && expected.every((exp: string, i: number) => {
      const alts = exp.split("|").map((s) => s.trim().toLowerCase());
      return alts.includes(String(given[i] ?? "").trim().toLowerCase());
    });
  }
  if (type === "matching") {
    const given: string[] = Array.isArray(answer) ? answer : [];
    const pairs = block.pairs || [];
    return pairs.length > 0 && pairs.every((p: Loose, i: number) => given[i] === p.right);
  }
  if (type === "ordering") {
    const given: string[] = Array.isArray(answer) ? answer : [];
    const expected: string[] = block.items || [];
    return expected.length > 0 && given.length === expected.length && expected.every((item, i) => given[i] === item);
  }
  if (type === "categorize") {
    const given: (string | null)[] = Array.isArray(answer) ? answer : [];
    const expected: string[] = (block.categoryItems || []).map((it: Loose) => it.category);
    return expected.length > 0 && given.length === expected.length && expected.every((cat, i) => given[i] === cat);
  }
  if (type === "number_line_point") {
    const given = typeof answer === "number" ? answer : parseFloat(answer);
    const expected = parseFloat(block.correctAnswer);
    return !Number.isNaN(given) && !Number.isNaN(expected) && Math.abs(given - expected) < 1e-6;
  }
  if (type === "click_error") {
    const given = typeof answer === "number" ? answer : parseInt(answer, 10);
    return !Number.isNaN(given) && given === parseInt(block.correctAnswer, 10);
  }
  const expected = block.correctAnswer;
  if (Array.isArray(expected)) {
    const ansArr = Array.isArray(answer) ? answer : [answer];
    return expected.every((e: unknown) => ansArr.includes(e)) && ansArr.length === expected.length;
  }
  return answer === expected;
}

/** Révélation renvoyée APRÈS correction (écran de correction), jamais avant. */
function revealFor(block: Loose) {
  if (block.type === "matching") return { pairs: block.pairs };
  if (block.type === "ordering") return { items: block.items };
  if (block.type === "fill_in_the_blank") return { blanks: block.blanks };
  if (block.type === "categorize") return { categoryItems: block.categoryItems };
  return { correctAnswer: block.correctAnswer };
}

/**
 * Correction d'un exercice. Deux formes :
 * - { block_id, answer } : un bloc (bouton « Vérifier » d'une question) ;
 * - { items: [{ block_id, answer }, …] } : toute la copie en UNE requête
 *   (bouton « Valider »). Avant, chaque question partait l'une après l'autre,
 *   relisait l'exercice, revérifiait l'abonnement et relançait le calcul des
 *   badges : 10 questions = 10 allers-retours en file.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cfg = RATE_LIMITS["ai:grade"];
    const rl = await rateLimitWithBackoff(`ai:grade:${me.authId}`, cfg.maxAttempts, cfg.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Tu as envoyé beaucoup de corrections d'un coup : attends quelques minutes." }, { status: 429 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const batch = Array.isArray(body.items);
    const items: GradeItem[] = (batch ? body.items : [{ block_id: body.block_id, answer: body.answer, block: body.block }]).slice(0, MAX_ITEMS);

    let level = "6ème";
    let blockFor: (blockId?: string) => Loose;
    let defaultPoints = 1;
    let manual = false;

    if (id === "preview") {
      // Aperçu admin (contenu pas encore enregistré) : réservé aux admins, la question vient du corps.
      if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      level = body.level || level;
      manual = body.grading_type === "manual";
      const forceAiPreview = body.grading_type === "ai";
      // Chaque question part avec son bloc COMPLET : elle est corrigée comme dans l'exercice enregistré (association,
      // catégories, QCM… ). Avant, tout était traité comme une réponse libre, donc une question « catégoriser » ou
      // « relier » ne pouvait jamais être juste dans l'aperçu.
      const previewBlocks = new Map<string, Loose>();
      for (const it of items) {
        const b = it.block && typeof it.block === "object" ? it.block : null;
        const bid = String(it.block_id ?? b?.id ?? "");
        if (b && bid) previewBlocks.set(bid, b);
      }
      const legacy = { content: body.question, correctAnswer: body.correctAnswer, explanation: body.explanation, type: "text_input", points: body.points || 1 };
      blockFor = (blockId) => {
        const b = blockId ? previewBlocks.get(String(blockId)) : undefined;
        if (!b) return legacy;
        return forceAiPreview && !FREE_TYPES.has(b.type) ? { ...b, type: "text_input" } : b;
      };
      defaultPoints = legacy.points;
    } else if (id === "review") {
      // Séance « à revoir » : chaque question est retrouvée par sa clé du carnet d'erreurs, dans sa source d'origine.
      const keys = items.map((i) => parseReviewKey(String(i.block_id ?? ""))).filter((k): k is NonNullable<typeof k> => !!k);
      const sources = await loadSources(keys);
      const diffOk = new Map<string, boolean>();
      const blocks = new Map<string, Loose>();
      for (const [key, src] of sources) {
        const d = src.difficulty ?? "";
        if (!diffOk.has(d)) diffOk.set(d, (await checkDifficultyAccess(me.authId, src.difficulty)).allowed);
        if (diffOk.get(d)) blocks.set(key, src.block);
        if (src.level) level = src.level;
      }
      blockFor = (blockId) => (blockId ? blocks.get(blockId) : undefined);
    } else {
      const { data: exercise, error } = await supabaseAdmin
        .from("exercises")
        .select("id, level, difficulty_level, grading_type, points_reward, content_json, status")
        .eq("id", id)
        .maybeSingle();
      if (error || !exercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
      if (me.role !== "admin" && exercise.status !== "published") return NextResponse.json({ error: "Exercise not found" }, { status: 404 });

      const { allowed } = await checkDifficultyAccess(me.authId, exercise.difficulty_level);
      if (!allowed) return NextResponse.json({ error: "Ce contenu est réservé aux plans payants." }, { status: 403 });

      // Niveau de la base, jamais du client : il ne doit pas pouvoir influencer le verdict.
      level = exercise.level || level;
      const blocks = new Map<string, Loose>();
      for (const page of Array.isArray(exercise.content_json) ? exercise.content_json : []) {
        for (const b of page?.blocks ?? []) if (b?.id) blocks.set(b.id, b);
      }
      const forceAi = exercise.grading_type === "ai";
      manual = exercise.grading_type === "manual";
      blockFor = (blockId) => {
        const b = blockId ? blocks.get(blockId) : undefined;
        return b && forceAi && !FREE_TYPES.has(b.type) ? { ...b, type: "text_input" } : b;
      };
      defaultPoints = exercise.points_reward || 1;
    }

    const results = await mapLimit(items, AI_CONCURRENCY, async (item): Promise<GradeResult> => {
      const block = blockFor(item.block_id);
      if (!block) {
        return { block_id: item.block_id, score: 0, max_score: 0, is_correct: false, feedback: "Question introuvable." };
      }
      const maxPoints = blockMaxPoints(block, defaultPoints);
      const isImage = typeof item.answer === "string" && item.answer.startsWith("data:image");

      // Correction manuelle : la réponse est conservée telle quelle, sans verdict ni révélation de la solution.
      if (manual) {
        return { block_id: item.block_id, score: 0, max_score: maxPoints, is_correct: false, pending: true, feedback: "Réponse enregistrée : elle sera corrigée par ton professeur." };
      }

      if (FREE_TYPES.has(block.type) || isImage) {
        const r = await gradeFreeAnswer({
          question: block.content || "",
          correctAnswer: block.correctAnswer ?? "",
          studentAnswer: item.answer,
          explanation: block.explanation,
          level,
          maxPoints,
          mode: block.type === "impossible_search" ? "justification" : "numeric",
        });
        return { block_id: item.block_id, score: r.score, max_score: maxPoints, is_correct: r.is_correct, feedback: r.feedback, comment_token: r.comment_token, unavailable: r.unavailable, reveal: r.unavailable ? undefined : revealFor(block) };
      }

      // Associations, catégories, trous : un point par élément bien placé (pas de « tout ou rien »).
      const partial = itemsCorrect(block, item.answer);
      if (partial) {
        const all = partial.correct === partial.total;
        const score = Math.round(((maxPoints * partial.correct) / partial.total) * 100) / 100;
        const unit = block.type === "matching" ? "association" : block.type === "categorize" ? "élément bien classé" : "réponse";
        return {
          block_id: item.block_id,
          score,
          max_score: maxPoints,
          is_correct: all,
          feedback: all ? "Bonne réponse !" : partial.correct === 0 ? "Aucune bonne réponse cette fois." : `${partial.correct} sur ${partial.total} : ${partial.correct} ${unit}${partial.correct > 1 && unit !== "élément bien classé" ? "s" : ""} correct${partial.correct > 1 ? "s" : ""}.`,
          reveal: revealFor(block),
        };
      }

      const ok = gradeStructured(block, item.answer);
      return {
        block_id: item.block_id,
        score: ok ? maxPoints : 0,
        max_score: maxPoints,
        is_correct: ok,
        feedback: ok ? "Bonne réponse !" : "Ce n'est pas la bonne réponse.",
        reveal: revealFor(block),
      };
    });

    // Verdicts gardés côté serveur : la note de la tentative en est la somme (voir /api/child/activities).
    if (id !== "preview" && id !== "review" && !manual) {
      await recordGrades(me.id, "exercise", id, results.filter((r) => r.block_id && !r.unavailable && !r.pending).map((r) => ({ blockId: String(r.block_id), score: r.score, maxScore: r.max_score, isCorrect: r.is_correct })));
    }

    // Carnet d'erreurs : une question ratée y entre, une question revue y avance (une seule écriture par envoi).
    if (id !== "preview" && !manual) {
      const srsResults: SrsResult[] = [];
      for (const r of results) {
        if (r.unavailable || !r.block_id || !blockFor(r.block_id)) continue;
        const key = id === "review" ? parseReviewKey(r.block_id) : { kind: "exercise" as const, ref: id, block: r.block_id };
        if (key) srsResults.push({ ...key, correct: r.is_correct });
      }
      await recordResults(me.id, srsResults, { review: id === "review" }).catch((e) => console.error("[srs]", e instanceof Error ? e.message : e));
      // Une séance « à revoir » compte dans l'objectif du jour et la série.
      if (id === "review" && srsResults.length) after(() => afterActivity(me.id).catch(() => {}));
    }

    // Badges : une seule vérification par envoi (en arrière-plan).
    if (id !== "preview" && id !== "review" && !manual && results.some((r) => !r.unavailable)) {
      const selfOrigin = new URL(req.url).origin;
      fetch(`${selfOrigin}/api/child/check-badges`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("authorization") || "" },
        body: JSON.stringify({ authId: me.authId }),
      }).catch(() => {});
    }

    if (batch) return NextResponse.json({ results });
    const r = results[0];
    if (r.unavailable) return NextResponse.json({ unavailable: true, feedback: r.feedback });
    return NextResponse.json(r);
  } catch (error: unknown) {
    console.error("Error grading exercise:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
