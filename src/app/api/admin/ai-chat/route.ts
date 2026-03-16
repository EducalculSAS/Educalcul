import { NextRequest, NextResponse } from "next/server";
import { AI } from "@/lib/ai-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, type, level } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Missing required fields (messages array)" },
        { status: 400 }
      );
    }

    const response = await AI.chatWithAgent(
      messages,
      type || "exercise",
      level
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in AI Chat:", error);
    return NextResponse.json(
      { error: "Failed to process chat" },
      { status: 500 }
    );
  }
}
