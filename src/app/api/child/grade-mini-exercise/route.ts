import { NextResponse } from "next/server";
import { gradeAnswer, gradeImageAnswer } from "@/lib/llm";
import { getAuthenticatedUser } from "@/lib/apiAuth";

export const maxDuration = 60;

export async function POST(req: Request) {
  const me = await getAuthenticatedUser(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, answer, studentAnswer, level } = await req.json();
  try {
    const result = typeof studentAnswer === "string" && studentAnswer.startsWith("data:image")
      ? await gradeImageAnswer(question, answer, studentAnswer, undefined, level || "collège", 1)
      : await gradeAnswer(question, answer, studentAnswer, undefined, level || "collège", 1);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[grade-mini-exercise] error:", e?.message || e);
    return NextResponse.json({
      is_correct: false,
      score: 0,
      feedback: "Impossible de corriger pour l'instant.",
    });
  }
}
