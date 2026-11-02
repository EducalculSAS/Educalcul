import type { Loose } from "@/types/loose";
import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { gradeFreeAnswer } from "@/lib/gradeFreeAnswer";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { checkDifficultyAccess } from "@/lib/checkSubscription";
import { recordResults } from "@/lib/srs";
import { recordGrades } from "@/lib/gradedAnswers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require a valid session: the AI grader costs money — no anonymous calls.
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Limite anti-abus (la correction IA coûte des crédits)
    const cfg = RATE_LIMITS["ai:grade"];
    const rl = await rateLimitWithBackoff(`ai:grade:${me.authId}`, cfg.maxAttempts, cfg.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de corrections, réessaie plus tard." }, { status: 429 });
    }

    const { id } = await params;
    const body = await req.json();
    const { question_id, answer, level } = body;

    let targetQuestion: Loose = null;
    let maxPoints = 1;
    let dbLevel: string | null = null;

    if (id === "preview") {
      // Prévisualisation admin : les données de la question viennent du corps
      // (pas encore enregistrées en base), on leur fait confiance ici.
      const { question, correctAnswer, explanation, points } = body;
      targetQuestion = { text: question, correctAnswer, explanation, points: points || 1, type: "text_input" };
      maxPoints = points || 1;
    } else {
      const { data: quiz, error: qzError } = await supabaseAdmin
        .from("quizzes")
        .select("content_json, level, difficulty_level, status")
        .eq("id", id)
        .single();
      if (qzError || !quiz) {
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
      }
      if (me.role !== "admin" && quiz.status !== "published") {
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
      }
      const questions: Loose[] = Array.isArray(quiz.content_json) ? quiz.content_json : [];
      targetQuestion = questions.find((q) => q.id === question_id) || null;
      if (!targetQuestion) {
        return NextResponse.json({ error: "Question not found" }, { status: 404 });
      }
      maxPoints = targetQuestion.points || 1;
      dbLevel = quiz.level || null;

      // Verrou de difficulté par plan — même règle que la page du quiz
      // (src/app/child/quiz/[id]/page.tsx), refaite ici car cette route est
      // appelable indépendamment de la page.
      const { allowed } = await checkDifficultyAccess(me.authId, quiz.difficulty_level);
      if (!allowed) {
        return NextResponse.json({ error: "Ce contenu est réservé aux plans payants." }, { status: 403 });
      }
    }

    let score = 0;
    let isCorrect = false;
    let feedback = "";
    let commentToken: string | undefined;

    if (targetQuestion.type === "text_input" || targetQuestion.type === "impossible_search") {
      // Même correction que les exercices et les mini-exercices (gradeFreeAnswer).
      const r = await gradeFreeAnswer({
        question: targetQuestion.text || "",
        correctAnswer: targetQuestion.correctAnswer ?? "",
        studentAnswer: answer,
        explanation: targetQuestion.explanation,
        // Niveau BDD prioritaire sur le client pour un vrai quiz.
        level: dbLevel || level || "6ème",
        maxPoints,
        mode: targetQuestion.type === "impossible_search" ? "justification" : "numeric",
      });
      if (r.unavailable) return NextResponse.json({ unavailable: true, feedback: r.feedback });
      isCorrect = r.is_correct;
      score = r.score;
      feedback = r.feedback;
      commentToken = r.comment_token;
    } else if (targetQuestion.type === "multiple_choice") {
      const correct = Array.isArray(targetQuestion.correctAnswer)
        ? targetQuestion.correctAnswer
        : [targetQuestion.correctAnswer];
      const selected = Array.isArray(answer) ? answer : [answer];
      isCorrect = correct.length === selected.length && correct.every((a: Loose) => selected.includes(String(a)));
      score = isCorrect ? maxPoints : 0;
      feedback = isCorrect ? "Bonne réponse !" : "Ce n'est pas la bonne réponse.";
    } else {
      isCorrect = String(answer) === String(targetQuestion.correctAnswer);
      score = isCorrect ? maxPoints : 0;
      feedback = isCorrect ? "Bonne réponse !" : "Ce n'est pas la bonne réponse.";
    }

    // Verdict gardé côté serveur : la note de la tentative en est la somme (voir /api/child/activities).
    if (id !== "preview" && question_id !== undefined && question_id !== null) {
      await recordGrades(me.id, "quiz", id, [{ blockId: String(question_id), score, maxScore: maxPoints, isCorrect }]);
    }

    // Carnet d'erreurs : une question de quiz ratée y entre aussi (jamais pour l'aperçu admin).
    if (id !== "preview" && question_id !== undefined && question_id !== null) {
      await recordResults(me.id, [{ kind: "quiz", ref: id, block: String(question_id), correct: isCorrect }], { review: false }).catch(() => {});
    }

    return NextResponse.json({
      score,
      max_score: maxPoints,
      is_correct: isCorrect,
      feedback,
      comment_token: commentToken,
      reveal: { correctAnswer: targetQuestion.correctAnswer, explanation: targetQuestion.explanation },
    });
  } catch (error: unknown) {
    console.error("Error grading quiz question:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
