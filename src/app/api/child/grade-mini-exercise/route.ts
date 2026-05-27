import { NextResponse } from "next/server";
import { gradeAnswer } from "@/lib/llm";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { question, answer, studentAnswer, level } = await req.json();
  try {
    const result = await gradeAnswer(
      question,
      answer,
      studentAnswer,
      undefined,
      level || "collège",
      1
    );
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({
      is_correct: false,
      score: 0,
      feedback: "Impossible de corriger pour l'instant.",
    });
  }
}
