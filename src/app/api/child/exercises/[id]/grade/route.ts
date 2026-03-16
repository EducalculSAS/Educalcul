import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      maxPoints = exercise.points || 10;

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
      // --- AI GRADING (Gemini 1.5 Flash) ---
      console.log(
        "AI Grading requested for:",
        id === "preview" ? "Preview" : exercise.title
      );

      const questionContent = targetBlock?.content || "Question inconnue";
      const correctAns = targetBlock?.correctAnswer || "Non spécifiée";
      const expl = targetBlock?.explanation || "";

      // Construct Gemini Request
      const systemPrompt = `Tu es un professeur de mathématiques bienveillant qui corrige un élève de niveau "${level || exercise?.level || "6ème"}".
RÉGLES STRICTES POUR LE FEEDBACK :
1. Adapte ton vocabulaire et tes explications au niveau "${level || exercise?.level || "6ème"}".
2. Analyse précisément la réponse (texte ou image) : si la méthode est bonne mais qu'il y a une erreur d'étourderie ou de calcul, dis-lui explicitement qu'il y était presque et valorise son raisonnement.
3. INTERDIT d'utiliser des tournures banales ou répétitives (ex: évite de commencer tes phrases par "Car", "En effet", "C'est incorrect car").
4. Sois original, direct, et encourageant dans tes corrections.
5. Sois souple sur la forme mais rigoureux sur le fond mathématique. Si c'est une image, lis-la attentivement.
Réponds UNIQUEMENT au format JSON : { "is_correct": boolean, "score": number, "feedback": string }.
Le score doit être entre 0 et ${maxPoints}.`;

      const userPrompt = `Question : ${questionContent}
Réponse attendue : ${correctAns}
Explication : ${expl}

Voici la réponse de l'élève :`;

      const parts: any[] = [{ text: userPrompt }];

      if (isImage) {
        // Extract base64
        const base64Data = answer.split(",")[1];
        const mimeType = answer.split(";")[0].split(":")[1];
        console.log(
          `Processing image: ${mimeType}, size: ${base64Data.length} chars`
        );
        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Data,
          },
        });
      } else {
        parts.push({
          text: typeof answer === "string" ? answer : JSON.stringify(answer),
        });
      }

      try {
        const geminiBody = {
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: parts,
            },
          ],
          generationConfig: {
            response_mime_type: "application/json",
          },
        };

        const aiResponse = await fetch(GEMINI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(geminiBody),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error("Gemini API Error (Image Analysis):", errText);
          throw new Error(
            `Gemini API responded with ${aiResponse.status}: ${errText}`
          );
        }

        const aiData = await aiResponse.json();
        let content = aiData.candidates[0].content.parts[0].text;
        console.log("AI Response:", content);

        // Clean markdown code blocks if present
        content = content
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const result = JSON.parse(content);
        isCorrect = result.is_correct;
        score = result.score;
        feedback = result.feedback;
      } catch (e) {
        console.error("AI Grading Failed:", e);
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
          feedback = `Erreur lors de l'analyse de l'image. Détails: ${errorMessage}`;
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

    // 3. Save Attempt (Only if not preview)
    if (id !== "preview" && user_id) {
      const { error: attemptError } = await supabaseAdmin
        .from("user_exercise_attempts")
        .insert({
          user_id,
          exercise_id: id,
          score,
          max_score: maxPoints,
          is_correct: isCorrect,
          duration_seconds: time_spent || 0,
          attempt_data: {
            answer: isImage ? "image_data_hidden" : answer,
            feedback,
          },
        });

      if (attemptError) {
        console.error("Error saving attempt:", attemptError);
      }
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
