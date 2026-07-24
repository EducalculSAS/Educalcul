import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { gradeAnswer } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

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
    const rl = rateLimitWithBackoff(`ai:grade:${me.authId}`, cfg.maxAttempts, cfg.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de corrections, réessaie plus tard." }, { status: 429 });
    }

    const { id } = await params;
    const body = await req.json();
    const { question_id, answer, level } = body;

    let targetQuestion: any = null;
    let maxPoints = 1;

    if (id === "preview") {
      // Prévisualisation admin : les données de la question viennent du corps
      // (pas encore enregistrées en base), on leur fait confiance ici.
      const { question, correctAnswer, explanation, points } = body;
      targetQuestion = { text: question, correctAnswer, explanation, points: points || 1, type: "text_input" };
      maxPoints = points || 1;
    } else {
      const { data: quiz, error: qzError } = await supabaseAdmin
        .from("quizzes")
        .select("content_json")
        .eq("id", id)
        .single();
      if (qzError || !quiz) {
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
      }
      const questions: any[] = Array.isArray(quiz.content_json) ? quiz.content_json : [];
      targetQuestion = questions.find((q) => q.id === question_id) || null;
      if (!targetQuestion) {
        return NextResponse.json({ error: "Question not found" }, { status: 404 });
      }
      maxPoints = targetQuestion.points || 1;
    }

    let score = 0;
    let isCorrect = false;
    let feedback = "";

    if (targetQuestion.type === "text_input") {
      // --- AI GRADING (IA) ---
      try {
        const gradingResult = await gradeAnswer(
          targetQuestion.text,
          targetQuestion.correctAnswer,
          answer,
          targetQuestion.explanation,
          level || "6ème",
          maxPoints
        );
        isCorrect = gradingResult.is_correct;
        score = gradingResult.score;
        feedback = gradingResult.feedback;
      } catch (e) {
        console.error("❌ AI Grading Failed:", e);
        const answerText = typeof answer === "string" ? answer : JSON.stringify(answer);
        const expected = typeof targetQuestion.correctAnswer === "string"
          ? targetQuestion.correctAnswer
          : JSON.stringify(targetQuestion.correctAnswer);

        isCorrect = answerText.toLowerCase().trim() === expected.toLowerCase().trim();
        score = isCorrect ? maxPoints : 0;
        feedback = isCorrect
          ? "Correct (Correction automatique de secours)"
          : "Incorrect (Correction automatique de secours)";
      }
    } else if (targetQuestion.type === "multiple_choice") {
      const correct = Array.isArray(targetQuestion.correctAnswer)
        ? targetQuestion.correctAnswer
        : [targetQuestion.correctAnswer];
      const selected = Array.isArray(answer) ? answer : [answer];
      isCorrect = correct.length === selected.length && correct.every((a: any) => selected.includes(String(a)));
      score = isCorrect ? maxPoints : 0;
      feedback = isCorrect ? "Correct !" : "Incorrect.";
    } else {
      isCorrect = String(answer) === String(targetQuestion.correctAnswer);
      score = isCorrect ? maxPoints : 0;
      feedback = isCorrect ? "Correct !" : "Incorrect.";
    }

    return NextResponse.json({
      score,
      max_score: maxPoints,
      is_correct: isCorrect,
      feedback,
      reveal: { correctAnswer: targetQuestion.correctAnswer, explanation: targetQuestion.explanation },
    });
  } catch (error: any) {
    console.error("Error grading quiz question:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
