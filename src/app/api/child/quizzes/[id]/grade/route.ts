import { NextResponse } from "next/server";
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
    const {
      question,
      correctAnswer,
      answer,
      explanation,
      level,
      points,
    } = body;

    let maxPoints = points || 1;
    let score = 0;
    let isCorrect = false;
    let feedback = "";

    // --- AI GRADING (IA) ---
    console.log("🤖 AI Grading requested for Quiz Question:", id);

    try {
      const gradingResult = await gradeAnswer(
        question,
        correctAnswer,
        answer,
        explanation,
        level || "6ème",
        maxPoints
      );
      isCorrect = gradingResult.is_correct;
      score = gradingResult.score;
      feedback = gradingResult.feedback;
    } catch (e) {
      console.error("❌ AI Grading Failed:", e);
      // Fallback: Simple string matching
      const answerText = typeof answer === "string" ? answer : JSON.stringify(answer);
      const expected = typeof correctAnswer === "string" ? correctAnswer : JSON.stringify(correctAnswer);
      
      isCorrect = answerText.toLowerCase().trim() === expected.toLowerCase().trim();
      score = isCorrect ? maxPoints : 0;
      feedback = isCorrect
        ? "Correct (Correction automatique de secours)"
        : "Incorrect (Correction automatique de secours)";
    }

    return NextResponse.json({
      score,
      max_score: maxPoints,
      is_correct: isCorrect,
      feedback,
    });
  } catch (error: any) {
    console.error("Error grading quiz question:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
