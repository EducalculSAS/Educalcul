import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { gradeAnswer, gradeImageAnswer } from "@/lib/llm";
import { tryDeterministicMathCheck } from "@/lib/mathAnswerCheck";
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
    const rl = await rateLimitWithBackoff(`ai:grade:${me.authId}`, cfg.maxAttempts, cfg.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de corrections, réessaie plus tard." }, { status: 429 });
    }

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
    let ungraded = false;

    // 2. Grading Logic
    // Force AI if image OR grading_type is ai OR preview
    const isImage =
      typeof answer === "string" && answer.startsWith("data:image");

    if (
      exercise.grading_type === "ai" ||
      isImage ||
      (targetBlock && ["text_input", "coding"].includes(targetBlock.type))
    ) {
      // --- AI GRADING (IA) ---
      console.log(
        "🤖 AI Grading requested for:",
        id === "preview" ? "Preview" : exercise.title
      );

      const questionContent = targetBlock?.content || "Question inconnue";
      const correctAns = targetBlock?.correctAnswer || "Non spécifiée";
      const expl = targetBlock?.explanation || "";
      const studentAnswerText =
        typeof answer === "string" ? answer : JSON.stringify(answer);

      const deterministic =
        !isImage && typeof correctAns === "string"
          ? tryDeterministicMathCheck(correctAns, studentAnswerText)
          : { decided: false as const };

      if (deterministic.decided && deterministic.reason === "incomplete") {
        isCorrect = false;
        score = 0;
        feedback = "Réponse incomplète : remplis tous les emplacements avant de valider.";
      } else {
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
            gradingResult = await gradeAnswer(
              questionContent,
              correctAns,
              studentAnswerText,
              expl,
              level || exercise?.level || "6ème",
              maxPoints,
              deterministic.decided ? deterministic.isCorrect : undefined,
            );
          }

          isCorrect = gradingResult.is_correct;
          score = gradingResult.score;
          feedback = gradingResult.feedback;
        } catch (e) {
          console.error("❌ AI Grading Failed:", e);
          // Le calcul exact reste fiable même sans l'explication pédagogique
          // de l'IA — ne jamais faire retomber une panne réseau sur l'élève
          // en devinant via une égalité de chaînes sur du LaTeX brut.
          if (deterministic.decided) {
            isCorrect = deterministic.isCorrect!;
            score = isCorrect ? maxPoints : 0;
            feedback = isCorrect
              ? "Bonne réponse !"
              : `Ce n'est pas la bonne réponse — la bonne réponse est ${correctAns}.`;
          } else {
            ungraded = true;
            feedback = "Correction indisponible, réessaie.";
          }
        }
      }
    } else if (targetBlock) {
      // Correction manuelle serveur — réplique exactement la logique déjà
      // affichée côté client, mais évaluée ici à partir des données de la
      // base (jamais envoyées au navigateur avant la soumission).
      const type = targetBlock.type;
      if (type === "multiple_choice" || type === "qcm") {
        const correct = Array.isArray(targetBlock.correctAnswer)
          ? targetBlock.correctAnswer
          : [targetBlock.correctAnswer];
        const selected = Array.isArray(answer) ? answer : [answer];
        isCorrect =
          correct.length === selected.length &&
          correct.every((a: any) => selected.includes(a));
      } else if (type === "single_choice" || type === "true_false") {
        isCorrect = answer === targetBlock.correctAnswer;
      } else if (type === "fill_in_the_blank") {
        const given: string[] = Array.isArray(answer) ? answer : [];
        const expected: string[] = targetBlock.blanks || [];
        isCorrect =
          expected.length > 0 &&
          expected.every((exp: string, i: number) => {
            const alts = exp.split("|").map((s) => s.trim().toLowerCase());
            return alts.includes(String(given[i] ?? "").trim().toLowerCase());
          });
      } else if (type === "matching") {
        const given: string[] = Array.isArray(answer) ? answer : [];
        const pairs = targetBlock.pairs || [];
        isCorrect =
          pairs.length > 0 && pairs.every((p: any, i: number) => given[i] === p.right);
      } else if (type === "ordering") {
        const given: string[] = Array.isArray(answer) ? answer : [];
        const expected: string[] = targetBlock.items || [];
        isCorrect =
          expected.length > 0 &&
          given.length === expected.length &&
          expected.every((item: string, i: number) => given[i] === item);
      } else {
        const expected = targetBlock.correctAnswer;
        if (Array.isArray(expected)) {
          const ansArr = Array.isArray(answer) ? answer : [answer];
          isCorrect =
            expected.every((e: any) => ansArr.includes(e)) &&
            ansArr.length === expected.length;
        } else {
          isCorrect = answer === expected;
        }
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

    if (ungraded) {
      // Panne d'infra, pas une vraie tentative : pas de badge-check, pas de
      // verdict — l'élève doit pouvoir resoumettre sans pénalité.
      return NextResponse.json({ unavailable: true, feedback });
    }

    // Révélation sûre à renvoyer APRÈS correction, pour l'écran de correction —
    // jamais envoyée avant que l'élève ait soumis sa réponse.
    let reveal: any = undefined;
    if (targetBlock) {
      const type = targetBlock.type;
      if (type === "matching") reveal = { pairs: targetBlock.pairs };
      else if (type === "ordering") reveal = { items: targetBlock.items };
      else if (type === "fill_in_the_blank") reveal = { blanks: targetBlock.blanks };
      else reveal = { correctAnswer: targetBlock.correctAnswer };
    }

    // 3. Trigger badge check (fire and forget) — la persistance de la tentative
    // (user_exercise_attempts) est gérée par /api/child/activities et
    // /api/child/exercises/[id]/progress, qui résolvent correctement l'auth_id
    // vers l'id interne et utilisent un upsert sur (user_id, exercise_id).
    if (id !== "preview") {
      // Origine serveur réelle (et non l'en-tête Origin du client, falsifiable :
      // on ne veut pas envoyer le jeton de l'utilisateur vers un hôte arbitraire).
      const selfOrigin = new URL(req.url).origin;
      fetch(`${selfOrigin}/api/child/check-badges`, {
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
      reveal,
    });
  } catch (error: any) {
    console.error("Error grading exercise:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
