import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { gradeAnswer } from "@/lib/llm";
import { tryDeterministicMathCheck } from "@/lib/mathAnswerCheck";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { checkDifficultyAccess } from "@/lib/checkSubscription";

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

    let targetQuestion: any = null;
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
        .select("content_json, level, difficulty_level")
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
      dbLevel = quiz.level || null;

      // Verrou de difficulté par plan — même règle que la page du quiz
      // (src/app/child/quiz/[id]/page.tsx), refaite ici car cette route est
      // appelable indépendamment de la page.
      const { allowed } = await checkDifficultyAccess(me.authId, (quiz as any).difficulty_level);
      if (!allowed) {
        return NextResponse.json({ error: "Ce contenu est réservé aux plans payants." }, { status: 403 });
      }
    }

    let score = 0;
    let isCorrect = false;
    let feedback = "";

    if (targetQuestion.type === "text_input" || targetQuestion.type === "impossible_search") {
      // --- AI GRADING (IA) ---
      const answerText = typeof answer === "string" ? answer : JSON.stringify(answer);
      // "recherche impossible" : pas de pré-check numérique, la bonne réponse
      // est une justification (voir même logique dans exercises/[id]/grade).
      const deterministic =
        typeof targetQuestion.correctAnswer === "string" && targetQuestion.type !== "impossible_search"
          ? tryDeterministicMathCheck(targetQuestion.correctAnswer, answerText)
          : { decided: false as const };

      if (deterministic.decided && deterministic.reason === "incomplete") {
        isCorrect = false;
        score = 0;
        feedback = "Réponse incomplète : remplis tous les emplacements avant de valider.";
      } else {
        try {
          const gradingResult = await gradeAnswer(
            targetQuestion.text,
            targetQuestion.correctAnswer,
            answer,
            targetQuestion.explanation,
            // Niveau BDD prioritaire sur le client pour un vrai quiz (voir
            // meme correctif sur exercises/[id]/grade) — evite qu'un
            // parametre client n'influence le verdict via le prompt IA.
            dbLevel || level || "6ème",
            maxPoints,
            deterministic.decided ? deterministic.isCorrect : undefined,
            targetQuestion.type === "impossible_search" ? "justification" : "numeric",
          );
          isCorrect = gradingResult.is_correct;
          score = gradingResult.score;
          feedback = gradingResult.feedback;
        } catch (e) {
          console.error("❌ AI Grading Failed:", e);
          // Le calcul exact reste fiable même sans l'explication pédagogique
          // de l'IA — jamais de fallback par égalité de chaînes sur du
          // LaTeX brut, ça échoue presque toujours pour une vraie réponse.
          if (deterministic.decided) {
            isCorrect = deterministic.isCorrect!;
            score = isCorrect ? maxPoints : 0;
            feedback = isCorrect
              ? "Bonne réponse !"
              : `Ce n'est pas la bonne réponse — la bonne réponse est ${targetQuestion.correctAnswer}.`;
          } else {
            return NextResponse.json({
              unavailable: true,
              feedback: "Correction indisponible, réessaie.",
            });
          }
        }
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
