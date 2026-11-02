import { readJsonBody } from "@/lib/apiJson";
import { NextResponse } from "next/server";
import { gradeFreeAnswer } from "@/lib/gradeFreeAnswer";
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

  const { question, answer, studentAnswer, level, explanation } = await readJsonBody(req).catch(() => ({}));
  if (typeof studentAnswer === "string" && studentAnswer.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "Réponse trop volumineuse." }, { status: 413 });
  }

  // Même correction que les exercices et les quiz (gradeFreeAnswer).
  const r = await gradeFreeAnswer({
    question: String(question ?? ""),
    correctAnswer: answer ?? "",
    studentAnswer,
    explanation: typeof explanation === "string" ? explanation : undefined,
    level: level || "collège",
    maxPoints: 1,
  });
  return NextResponse.json(r);
}
