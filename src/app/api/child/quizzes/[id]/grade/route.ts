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

    // --- AI GRADING (Gemini 1.5 Flash) ---
    console.log("AI Grading requested for Quiz Question:", id);

    // Construct Gemini Request
    const systemPrompt = `Tu es un professeur de mathématiques bienveillant qui corrige un élève de niveau "${level || "6ème"}".
RÉGLES STRICTES POUR LE FEEDBACK :
1. Adapte ton vocabulaire et tes explications au niveau "${level || "6ème"}".
2. Analyse précisément la réponse : si la méthode est bonne mais qu'il y a une erreur d'étourderie ou de calcul, dis-lui explicitement qu'il y était presque et valorise son raisonnement.
3. INTERDIT d'utiliser des tournures banales ou répétitives (ex: évite de commencer tes phrases par "Car", "En effet", "C'est incorrect car").
4. Sois original, direct, et encourageant dans tes corrections.
5. Sois souple sur la forme (orthographe, casse) mais rigoureux sur le fond mathématique.
Réponds UNIQUEMENT au format JSON : { "is_correct": boolean, "score": number, "feedback": string }.
Le score doit être 0 (incorrect) ou ${maxPoints} (correct).`;

    const userPrompt = `Question : ${question}
Réponse attendue : ${correctAnswer}
Explication : ${explanation || "Aucune"}

Voici la réponse de l'élève : ${answer}`;

    try {
      const geminiBody = {
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
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
        console.error("Gemini API Error (Quiz Grading):", errText);
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
