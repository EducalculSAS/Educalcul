import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { gradeAnswer, gradeImageAnswer } from "@/lib/llm";
import { getAuthenticatedUser } from "@/lib/apiAuth";


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require a valid session: the AI grader costs money — no anonymous calls.
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const {
      user_id,
      answer,
      time_spent,
      block_id,
      question,
      correctAnswer,
      explanation,
      level,
      points,
    } = body;

    let exercise: any = null;
    let targetBlock: any = null;
    let maxPoints = 10;

    // 1. Determine Context (Preview vs DB)
    if (id === "preview") {
      // Preview Mode: Use data passed in body
      exercise = {
        title: "Preview Exercise",
        grading_type: "ai", // Force AI for preview
        points: points || 1,
      };
      targetBlock = {
        content: question,
        correctAnswer: correctAnswer,
        explanation: explanation,
        type: "text_input", // Assume text input for grading
        points: points || 1,
      };
      maxPoints = points || 1;
    } else {
      // DB Mode: Fetch Exercise
      const { data: dbExercise, error: exError } = await supabaseAdmin
        .from("exercises")
        .select("*")
        .eq("id", id)
        .single();

      if (exError || !dbExercise) {
        return NextResponse.json(
          { error: "Exercise not found" },
          { status: 404 }
        );
      }
      exercise = dbExercise;
      maxPoints = exercise.points_reward || 10;

      if (block_id && exercise.content_json) {
        const allBlocks = exercise.content_json.flatMap((p: any) => p.blocks);
        targetBlock = allBlocks.find((b: any) => b.id === block_id);
        if (targetBlock) {
          maxPoints = targetBlock.points || 1;
        }
      }
    }

    let score = 0;
    let isCorrect = false;
    let feedback = "";

    // 2. Grading Logic
    // Force AI if image OR grading_type is ai OR preview
    const isImage =
      typeof answer === "string" && answer.startsWith("data:image");

    if (
      exercise.grading_type === "ai" ||
      isImage ||
      (targetBlock && targetBlock.type === "text_input")
    ) {
      // --- AI GRADING (IA) ---
      console.log(
        "🤖 AI Grading requested for:",
        id === "preview" ? "Preview" : exercise.title
      );

      const questionContent = targetBlock?.content || "Question inconnue";
      const correctAns = targetBlock?.correctAnswer || "Non spécifiée";
      const expl = targetBlock?.explanation || "";

      try {
        let gradingResult;
        if (isImage) {
          gradingResult = await gradeImageAnswer(
            questionContent,
            correctAns,
            answer,
            expl,
            level || exercise?.level || "6ème",
            maxPoints
          );
        } else {
          const studentAnswerText = typeof answer === "string" ? answer : JSON.stringify(answer);
          gradingResult = await gradeAnswer(
            questionContent,
            correctAns,
            studentAnswerText,
            expl,
            level || exercise?.level || "6ème",
            maxPoints
          );
        }

        isCorrect = gradingResult.is_correct;
        score = gradingResult.score;
        feedback = gradingResult.feedback;
      } catch (e) {
        console.error("❌ AI Grading Failed:", e);
        // Fallback for text only
        if (!isImage) {
          const answerText =
            typeof answer === "string" ? answer : JSON.stringify(answer);
          const expected = targetBlock?.correctAnswer;
          if (expected && typeof expected === "string") {
            isCorrect =
              answerText.toLowerCase().trim() === expected.toLowerCase().trim();
            score = isCorrect ? maxPoints : 0;
            feedback = isCorrect
              ? "Correct (Correction automatique de secours)"
              : "Incorrect (Correction automatique de secours)";
          }
        } else {
          const errorMessage =
            e instanceof Error ? e.message : "Erreur inconnue";
          feedback = `Erreur lors de l'analyse. Détails: ${errorMessage}`;
          isCorrect = false;
          score = 0;
        }
      }
    } else {
      // Manual Logic (Keep existing)
      if (targetBlock) {
        const expected = targetBlock.correctAnswer;
        if (Array.isArray(expected)) {
          const ansArr = Array.isArray(answer) ? answer : [answer];
          isCorrect =
            expected.every((e: any) => ansArr.includes(e)) &&
            ansArr.length === expected.length;
        } else {
          isCorrect = answer === expected;
        }
        score = isCorrect ? maxPoints : 0;
        feedback = isCorrect ? "Correct !" : "Incorrect.";
      } else {
        const expected = exercise.correct_answer?.trim().toLowerCase();
        const actual =
          typeof answer === "string" ? answer.trim().toLowerCase() : "";

        if (expected && actual === expected) {
          score = exercise.points || 10;
          isCorrect = true;
          feedback = "Correct !";
        } else {
          feedback = "Incorrect. Essayez encore.";
        }
      }
    }

    // 3. Trigger badge check (fire and forget) — la persistance de la tentative
    // (user_exercise_attempts) est gérée par /api/child/activities et
    // /api/child/exercises/[id]/progress, qui résolvent correctement l'auth_id
    // vers l'id interne et utilisent un upsert sur (user_id, exercise_id).
    if (id !== "preview") {
      fetch(`${req.headers.get("origin") || ""}/api/child/check-badges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.get("authorization") || "",
        },
        body: JSON.stringify({ authId: me.authId }),
      }).catch(() => {});
    }

    return NextResponse.json({
      score,
      max_score: maxPoints,
      is_correct: isCorrect,
      feedback,
    });
  } catch (error: any) {
    console.error("Error grading exercise:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
// Force rebuild timestamp - fixed
