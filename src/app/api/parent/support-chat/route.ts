import { NextResponse } from "next/server";
import { chatWithAIPlain } from "@/lib/llm";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { buildSupportSystemPrompt } from "@/lib/supportChatPrompt";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, ["parent"]);
    if (!me) return NextResponse.json({ message: null, blocked: true, reason: "Unauthorized" }, { status: 401 });

    // Garde-fou anti-abus généreux : la vraie limite ressentie par
    // l'utilisateur est la relance vers un ticket après 5 messages
    // (ci-dessous), pas ce plafond technique.
    const config = RATE_LIMITS["ai:parent-support"];
    const rl = await rateLimitWithBackoff(`ai:parent-support:${me.authId}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { message: null, blocked: true, reason: "Trop de messages, réessayez dans quelques minutes." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const messages: Message[] = Array.isArray(body.messages) ? body.messages : [];
    const trimmed = messages.filter(m => m.role === "user" || m.role === "assistant").slice(-8);
    if (!trimmed.length) return NextResponse.json({ message: "Pose-moi ta question !" });

    const userTurnCount = trimmed.filter(m => m.role === "user").length;

    try {
      // Température basse : un bot support doit être fiable/factuel plutôt
      // que créatif, et suit mieux les instructions de formatage strictes
      // (relance vers un ticket après 5 messages).
      const message = await chatWithAIPlain(
        trimmed,
        buildSupportSystemPrompt("parent", userTurnCount),
        0.2,
        1_000,
      );
      return NextResponse.json({ message });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[parent-support-chat] error:", msg);
      return NextResponse.json({ message: `[Erreur IA] ${sanitizeErrorMessage(msg)}` }, { status: 200 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[parent-support-chat] error:", msg);
    return NextResponse.json({ message: `[Erreur] ${sanitizeErrorMessage(msg)}` }, { status: 200 });
  }
}
