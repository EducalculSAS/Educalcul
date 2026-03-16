import { NextRequest, NextResponse } from "next/server";
import { AI } from "@/lib/ai-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, difficulty, level, instructions, count } = body;

    if (!topic || !difficulty || !level) {
      return NextResponse.json(
        { error: "Missing required fields (topic, difficulty, level)" },
        { status: 400 }
      );
    }

    const content = await AI.generateQuiz({
      topic,
      difficulty,
      level,
      instructions,
      count: count || 5
    });

    return NextResponse.json({ success: true, data: content });
  } catch (error) {
    console.error("Error generating quiz:", error);
    return NextResponse.json(
      { error: "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
