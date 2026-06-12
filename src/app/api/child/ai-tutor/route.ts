import { NextResponse } from "next/server";
import { AITutorPageContext } from "@/contexts/AITutorContext";
import { chatWithAI } from "@/lib/llm";
import { checkAIAccess } from "@/lib/checkSubscription";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { validateString } from "@/lib/validation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function buildSystemPrompt(ctx: AITutorPageContext): string {
  let extra = "";

  if (ctx.page === "cours_detail" && ctx.courseContent) {
    extra += `\n\nCONTENU DU COURS (ta référence):\n${ctx.courseContent}`;
  }
  if (ctx.page === "exercise_detail") {
    if (ctx.exerciseQuestion) {
      extra += `\n\nÉNONCÉ:\n${ctx.exerciseQuestion.split("\n").map(l => l.trim()).filter(Boolean).join("\n")}`;
    }
    if (ctx.userAnswer) extra += `\n\nRÉPONSE ACTUELLE DE L'ÉLÈVE:\n${ctx.userAnswer}`;
  }
  if (ctx.page === "quiz_detail" && ctx.currentQuestionText) {
    extra += `\n\nQUESTION EN COURS: ${ctx.currentQuestionText}`;
  }

  const contextLine = ctx.courseTitle || ctx.exerciseTitle || ctx.quizTitle || "le site Educalcul";

  const isCours = ctx.page === "cours_detail";

  return `Tu es Epsi, tuteur IA de mathématiques pour élèves de primaire et collège sur Educalcul.

RÈGLES ABSOLUES:
- Réponds toujours en français, de façon naturelle et bienveillante, comme un bon professeur particulier.
- Réponses courtes : 1 à 3 phrases maximum. Jamais de longs pavés.
- AUCUN emoji dans tes réponses. Zéro.
- Pour les formules mathématiques, utilise TOUJOURS la notation LaTeX entre $ : par exemple $\\frac{1}{2}$, $x^2$, $\\sqrt{3}$. Jamais de backticks autour du LaTeX.
- Pas de listes à puces sauf si vraiment nécessaire.
- Ton registre : direct, clair, chaleureux. Pas de formules creuses comme "Bien sûr !" ou "Excellente question !".

CONTEXTE: L'élève travaille sur ${contextLine}.${extra}

${isCours
  ? `COMPORTEMENT pour un cours:
- Tu peux expliquer et clarifier les notions du cours.
- Appuie-toi sur le contenu ci-dessus.
- Si tu ne sais pas, dis-le simplement.
- Encourage l'élève à relire le cours et à poser d'autres questions.`
  : `COMPORTEMENT pour un exercice ou quiz:
- Ne donne JAMAIS la réponse directement.
- Guide l'élève avec une question ou un indice ciblé.
- Si l'élève donne une réponse, demande-lui d'expliquer son raisonnement plutôt que de valider.
- Si l'élève est vraiment bloqué après plusieurs échanges, donne un indice plus précis, mais jamais la réponse finale.`}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: Message[] = body.messages ?? [];
    const context: AITutorPageContext = body.context ?? { page: "other" };

    // ✓ HIGH PRIORITY FIX: Rate limiting on expensive AI endpoint
    const authHeader = req.headers.get("x-user-auth-id");
    const rateLimitKey = authHeader || (req.headers.get("x-forwarded-for") ?? "unknown");
    const config = RATE_LIMITS["ai:tutor"];
    const rl = rateLimitWithBackoff(`ai:tutor:${rateLimitKey}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { message: null, blocked: true, reason: "Too many AI requests. Please wait before trying again." },
        { status: 429 }
      );
    }

    // ── Subscription gate ──────────────────────────────────────────────────
    if (authHeader) {
      const access = await checkAIAccess(authHeader);
      if (!access.allowed) {
        return NextResponse.json({ message: null, blocked: true, reason: access.reason }, { status: 403 });
      }
      // Record usage without blocking the AI response (fire-and-forget)
      supabaseAdmin
        .from("users")
        .select("id")
        .eq("auth_id", authHeader)
        .maybeSingle()
        .then(({ data: userData }) =>
          userData
            ? supabaseAdmin
                .from("user_ai_interactions")
                .insert({ user_id: userData.id, feature_type: "ai_tutor" })
            : undefined
        )
        .then(undefined, (e) => console.error("[ai-tutor] usage log failed:", e?.message));
    }
    // ──────────────────────────────────────────────────────────────────────

    // Keep only last user/assistant messages
    const userOnly = messages.filter((m) => m.role === "user" || m.role === "assistant");
    const lastUserMessages = userOnly.slice(-8); // last 8 turns max

    // Find first user message index
    const firstUser = lastUserMessages.findIndex((m) => m.role === "user");
    if (firstUser === -1) {
      return NextResponse.json({ message: "Pose-moi une question ! 💡" });
    }
    const trimmed = lastUserMessages.slice(firstUser);

    const systemPrompt = buildSystemPrompt(context);

    try {
      const message = await chatWithAI(trimmed, systemPrompt, 0.65, 800);
      return NextResponse.json({ message });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("❌ AI Tutor Error:", message);
      // Retourner l'erreur réelle pour diagnostic
      return NextResponse.json(
        { message: `[Erreur IA] ${message || "Inconnu"}` },
        { status: 200 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ ai-tutor error:", message);
    return NextResponse.json(
      { message: `[Erreur] ${message || "Inconnu"}` },
      { status: 200 }
    );
  }
}
