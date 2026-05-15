import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { gradeWithQwen } from "@/lib/qwen-service";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // --- AI GRADING (Qwen2.5vl:7b Local) ---
    console.log("🤖 AI Grading requested for Quiz Question:", id);

    try {
      const gradingResult = await gradeWithQwen(
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
