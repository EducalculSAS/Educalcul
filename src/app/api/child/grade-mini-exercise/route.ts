import { NextResponse } from "next/server";
import { gradeAnswer, gradeImageAnswer } from "@/lib/llm";
import { tryDeterministicMathCheck } from "@/lib/mathAnswerCheck";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

export const maxDuration = 60;

// Borne la taille d'une image envoyée pour éviter d'engorger le modèle de vision.
const MAX_IMAGE_CHARS = 8 * 1024 * 1024; // ~8 Mo de base64

export async function POST(req: Request) {
  const me = await getAuthenticatedUser(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Limite anti-abus (la correction IA coûte des crédits)
  const cfg = RATE_LIMITS["ai:grade"];
  const rl = await rateLimitWithBackoff(`ai:grade:${me.authId}`, cfg.maxAttempts, cfg.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Trop de corrections, réessaie plus tard." }, { status: 429 });
  }

  const { question, answer, studentAnswer, level } = await req.json();
  if (typeof studentAnswer === "string" && studentAnswer.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "Réponse trop volumineuse." }, { status: 413 });
  }

  const isImage = typeof studentAnswer === "string" && studentAnswer.startsWith("data:image");
  const deterministic =
    !isImage && typeof answer === "string" && typeof studentAnswer === "string"
      ? tryDeterministicMathCheck(answer, studentAnswer)
      : { decided: false as const };

  if (deterministic.decided && deterministic.reason === "incomplete") {
    return NextResponse.json({
      is_correct: false,
      score: 0,
      feedback: "Réponse incomplète : remplis tous les emplacements avant de valider.",
    });
  }

  try {
    const result = isImage
      ? await gradeImageAnswer(question, answer, studentAnswer, undefined, level || "collège", 1)
      : await gradeAnswer(
          question,
          answer,
          studentAnswer,
          undefined,
          level || "collège",
          1,
          deterministic.decided ? deterministic.isCorrect : undefined,
        );
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[grade-mini-exercise] error:", e?.message || e);
    // Le calcul exact reste fiable même sans l'explication pédagogique de
    // l'IA — ne jamais faire retomber une panne réseau sur le dos de l'élève.
    if (deterministic.decided) {
      return NextResponse.json({
        is_correct: deterministic.isCorrect,
        score: deterministic.isCorrect ? 1 : 0,
        feedback: deterministic.isCorrect
          ? "Bonne réponse !"
          : `Ce n'est pas la bonne réponse — la bonne réponse est ${answer}.`,
      });
    }
    return NextResponse.json({
      unavailable: true,
      feedback: "Correction indisponible, réessaie.",
    });
  }
}
