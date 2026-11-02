import type { Loose } from "@/types/loose";
import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { blockMaxPoints } from "@/lib/exerciseScoring";
import { passThreshold } from "@/lib/scorePercent";
import { auditLog, AuditAction } from "@/lib/auditLog";

type Kind = "exercise" | "quiz";

const TABLE: Record<Kind, string> = {
  exercise: "user_exercise_attempts",
  quiz: "user_quiz_attempts",
};
const ITEM_COLUMN: Record<Kind, string> = {
  exercise: "exercise_id",
  quiz: "quiz_id",
};
const CONTENT_TABLE: Record<Kind, string> = {
  exercise: "exercises",
  quiz: "quizzes",
};

/** Ré-évalue une réponse d'exercice sans IA — même logique déterministe que
 * /api/child/exercises/[id]/grade pour les types objectifs ; pour
 * text_input/coding (corrigés par IA à l'origine), pas de nouvel appel IA
 * pour une simple édition admin ponctuelle — repli en comparaison texte,
 * même filet de secours que la route de correction en cas d'échec IA. */
function gradeExerciseBlock(block: Loose, answer: Loose): boolean {
  const type = block?.type;
  if (type === "multiple_choice" || type === "qcm") {
    const correct = Array.isArray(block.correctAnswer) ? block.correctAnswer : [block.correctAnswer];
    const selected = Array.isArray(answer) ? answer : [answer];
    return correct.length === selected.length && correct.every((a: Loose) => selected.includes(a));
  }
  if (type === "single_choice" || type === "true_false") {
    return answer === block.correctAnswer;
  }
  if (type === "fill_in_the_blank") {
    const given: string[] = Array.isArray(answer) ? answer : [];
    const expected: string[] = block.blanks || [];
    return expected.length > 0 && expected.every((exp: string, i: number) => {
      const alts = exp.split("|").map((s: string) => s.trim().toLowerCase());
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
    return expected.length > 0 && given.length === expected.length && expected.every((item: string, i: number) => given[i] === item);
  }
  const expected = block?.correctAnswer;
  if (Array.isArray(expected)) {
    const ansArr = Array.isArray(answer) ? answer : [answer];
    return expected.every((e: unknown) => ansArr.includes(e)) && ansArr.length === expected.length;
  }
  if (typeof expected === "string" && typeof answer === "string") {
    return answer.trim().toLowerCase() === expected.trim().toLowerCase();
  }
  return answer === expected;
}

function gradeQuizQuestion(question: Loose, answer: Loose): boolean {
  if (question?.type === "multiple_choice") {
    const correct = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
    const selected = Array.isArray(answer) ? answer : [answer];
    return correct.length === selected.length && correct.every((a: Loose) => selected.includes(String(a)));
  }
  if (question?.type === "text_input") {
    const expected = typeof question.correctAnswer === "string" ? question.correctAnswer : JSON.stringify(question.correctAnswer);
    const actual = typeof answer === "string" ? answer : JSON.stringify(answer);
    return actual.trim().toLowerCase() === expected.trim().toLowerCase();
  }
  return String(answer) === String(question?.correctAnswer);
}

function allExerciseBlocks(contentJson: Loose): Loose[] {
  return Array.isArray(contentJson) ? contentJson.flatMap((p: Loose) => p.blocks || []) : [];
}

/** Points totaux gagnés vu les résultats question par question, pour
 * recalculer score/total_points après une édition admin sur une seule
 * question — évite que le score global reste incohérent avec le détail. */
function recomputeExerciseScore(contentJson: Loose, results: Record<string, boolean>) {
  const blocks = allExerciseBlocks(contentJson).filter((b: Loose) => b.type !== "text");
  let score = 0, total = 0;
  for (const b of blocks) {
    const pts = blockMaxPoints(b, 1);
    total += pts;
    if (results[b.id]) score += pts;
  }
  return { score, total };
}
function recomputeQuizScore(contentJson: Loose, results: Record<number, boolean>) {
  const questions = Array.isArray(contentJson) ? contentJson : [];
  let score = 0, total = 0;
  questions.forEach((q: Loose, i: number) => {
    const pts = q.points || 1;
    total += pts;
    if (results[i]) score += pts;
  });
  return { score, total };
}

export async function GET(req: Request) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind") as Kind | null;
    const userId = searchParams.get("userId");
    const itemId = searchParams.get("itemId");
    if (!kind || !["exercise", "quiz"].includes(kind) || !userId || !itemId) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const [{ data: attempt }, { data: item }] = await Promise.all([
      supabaseAdmin
        .from(TABLE[kind])
        .select("id, progress_json, attempts_history, score, total_points")
        .eq("user_id", userId)
        .eq(ITEM_COLUMN[kind], itemId)
        .maybeSingle(),
      supabaseAdmin
        .from(CONTENT_TABLE[kind])
        .select("id, title, content_json, min_score_percent")
        .eq("id", itemId)
        .maybeSingle(),
    ]);

    if (!item) return NextResponse.json({ error: "Contenu introuvable" }, { status: 404 });
    if (!attempt) return NextResponse.json({ error: "Aucune tentative pour cet élève" }, { status: 404 });

    return NextResponse.json({ item, attempt });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { kind, userId, itemId, attemptRef, key, comment, editedAnswer, verdict } = body as {
      kind: Kind; userId: number; itemId: string; attemptRef: "latest" | number; key: string;
      comment?: string; editedAnswer?: Loose;
      /** Correction manuelle d'une question d'exercice : true = juste, false = fausse. */
      verdict?: boolean;
    };
    if (!kind || !["exercise", "quiz"].includes(kind) || !userId || !itemId || attemptRef === undefined || key === undefined) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }
    if (comment === undefined && editedAnswer === undefined && verdict === undefined) {
      return NextResponse.json({ error: "Rien à enregistrer" }, { status: 400 });
    }

    const [{ data: attempt }, { data: item }] = await Promise.all([
      supabaseAdmin
        .from(TABLE[kind])
        .select("id, progress_json, attempts_history")
        .eq("user_id", userId)
        .eq(ITEM_COLUMN[kind], itemId)
        .maybeSingle(),
      supabaseAdmin.from(CONTENT_TABLE[kind]).select("id, content_json, min_score_percent").eq("id", itemId).maybeSingle(),
    ]);
    if (!attempt) return NextResponse.json({ error: "Tentative introuvable" }, { status: 404 });
    if (!item) return NextResponse.json({ error: "Contenu introuvable" }, { status: 404 });

    const isLatest = attemptRef === "latest";
    const history: Loose[] = Array.isArray(attempt.attempts_history) ? [...attempt.attempts_history] : [];
    let target: Loose;
    if (isLatest) {
      target = { ...(attempt.progress_json || {}) };
    } else {
      const idx = Number(attemptRef);
      if (!Number.isInteger(idx) || !history[idx] || !history[idx].detail) {
        return NextResponse.json({ error: "Détail indisponible pour cette tentative" }, { status: 400 });
      }
      target = { ...history[idx], detail: { ...history[idx].detail } };
    }
    const detailHolder = isLatest ? target : target.detail;

    detailHolder.adminComments = { ...(detailHolder.adminComments || {}) };
    detailHolder.adminEditedAnswers = { ...(detailHolder.adminEditedAnswers || {}) };
    if (comment !== undefined) detailHolder.adminComments[key] = comment;

    let newScore: number | undefined;
    let newTotal: number | undefined;
    // Correction manuelle : une note n'est « définitive » (plus en attente) que quand CHAQUE question a reçu un verdict.
    let stillPending: boolean | undefined;
    if (verdict !== undefined && kind === "exercise") {
      detailHolder.results = { ...(detailHolder.results || {}), [key]: !!verdict };
      detailHolder.manualVerdicts = { ...(detailHolder.manualVerdicts || {}), [key]: true };
      const { score, total } = recomputeExerciseScore(item.content_json, detailHolder.results);
      newScore = score; newTotal = total;
      const gradable = allExerciseBlocks(item.content_json).filter((b) => b.type !== "text" && b.type !== "image");
      stillPending = !gradable.every((b) => detailHolder.manualVerdicts[b.id]);
    }
    if (editedAnswer !== undefined) {
      detailHolder.adminEditedAnswers[key] = editedAnswer;

      if (kind === "exercise") {
        const block = allExerciseBlocks(item.content_json).find((b) => b.id === key);
        const isCorrect = gradeExerciseBlock(block, editedAnswer);
        detailHolder.results = { ...(detailHolder.results || {}), [key]: isCorrect };
        const { score, total } = recomputeExerciseScore(item.content_json, detailHolder.results);
        newScore = score; newTotal = total;
      } else {
        const idx = Number(key);
        const question = Array.isArray(item.content_json) ? item.content_json[idx] : null;
        const isCorrect = gradeQuizQuestion(question, editedAnswer);
        detailHolder.questionResults = { ...(detailHolder.questionResults || {}), [idx]: isCorrect };
        const { score, total } = recomputeQuizScore(item.content_json, detailHolder.questionResults);
        newScore = score; newTotal = total;
      }
    }

    const pctOf = (s: number, t: number) => (t ? Math.round((s / t) * 100) : 0);
    const passedOf = (pct: number) => pct >= passThreshold((item as { min_score_percent?: number | null }).min_score_percent);
    if (isLatest) {
      const update: Record<string, Loose> = { progress_json: target };
      if (newScore !== undefined) {
        update.score = newScore;
        update.total_points = newTotal;
        update.score_percent = pctOf(newScore, newTotal!);
        if (stillPending === false) update.passed = passedOf(update.score_percent);
        // La dernière entrée de l'historique est cette même tentative : elle reste alignée sur la note.
        const last = history.length - 1;
        if (stillPending !== undefined && last >= 0) {
          history[last] = {
            ...history[last],
            score: newScore,
            total_points: newTotal,
            score_percent: update.score_percent,
            pending: stillPending,
            ...(stillPending === false ? { passed: update.passed } : {}),
          };
          update.attempts_history = history;
        }
      }
      const { error } = await supabaseAdmin.from(TABLE[kind]).update(update).eq("id", attempt.id);
      if (error) throw error;
    } else {
      const idx = Number(attemptRef);
      history[idx] = {
        ...history[idx],
        detail: target.detail,
        ...(newScore !== undefined ? {
          score: newScore,
          total_points: newTotal,
          score_percent: newTotal ? Math.round((newScore / newTotal) * 100) : 0,
          ...(stillPending !== undefined ? { pending: stillPending } : {}),
          ...(stillPending === false ? { passed: passedOf(pctOf(newScore, newTotal!)) } : {}),
        } : {}),
      };
      const { error } = await supabaseAdmin.from(TABLE[kind]).update({ attempts_history: history }).eq("id", attempt.id);
      if (error) throw error;
    }

    if (comment !== undefined && comment.trim()) {
      // "info" — le type "attempt_comment" n'existe pas dans la contrainte
      // CHECK de la table (mêmes valeurs que /api/admin/user-detail :
      // ban/info/message/warning), pas de migration pour ce chantier.
      await supabaseAdmin.from("admin_notifications").insert({
        user_id: userId,
        type: "info",
        title: kind === "exercise" ? "Commentaire sur un exercice" : "Commentaire sur un quiz",
        content: comment,
      });
    }

    await auditLog({
      action: AuditAction.ADMIN_EDIT_ATTEMPT,
      adminId: admin.id,
      targetUserId: userId,
      targetType: kind,
      targetId: String(itemId),
      details: { attemptRef, key, hasComment: comment !== undefined, hasEditedAnswer: editedAnswer !== undefined, verdict },
    }, req);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
