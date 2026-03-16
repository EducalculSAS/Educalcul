import { NextRequest, NextResponse } from "next/server";
import { AI } from "@/lib/ai-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, difficulty, level, count, instructions } = body;

    if (!topic || !difficulty || !level) {
      return NextResponse.json(
        { error: "Missing required fields (topic, difficulty, level)" },
        { status: 400 }
      );
    }

    const content = await AI.generateExercise({
      topic,
      difficulty,
      level,
      count,
      instructions
    });

    return NextResponse.json({ success: true, data: content });
  } catch (error) {
    console.error("Error generating exercise:", error);
    return NextResponse.json(
      { error: "Failed to generate exercise" },
      { status: 500 }
    );
  }
}
