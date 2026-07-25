import { NextResponse } from "next/server";
import { AITutorPageContext } from "@/contexts/AITutorContext";
import { chatWithAI } from "@/lib/llm";
import { checkAIAccess } from "@/lib/checkSubscription";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { validateString } from "@/lib/validation";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { buildSupportSystemPrompt } from "@/lib/supportChatPrompt";

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
- N'écris JAMAIS de symbole mathématique en caractère Unicode brut (², ³, ≠, ≤, ≥, √, π...) en dehors d'un bloc $...$ : écris $x^2$ (jamais "x²"), $a \\neq 0$ (jamais "a≠0"), $\\sqrt{2}$ (jamais "√2"). Même si le passage cité contient déjà du LaTeX entre $, conserve cette notation telle quelle dans ta réponse, ne la reformule jamais en texte brut.
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
    // Identity from the verified JWT — gating can no longer be bypassed by
    // omitting/spoofing a client header, and anonymous calls are rejected.
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ message: null, blocked: true, reason: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const messages: Message[] = body.messages ?? [];
    const context: AITutorPageContext = body.context ?? { page: "other" };
    const isSupportMode = context.page === "support";

    // ✓ Rate limiting on expensive AI endpoint, keyed on the real user.
    // Bucket séparé pour le mode support : une conversation support ne doit
    // jamais entamer le quota du vrai tuteur de maths, ni l'inverse.
    const config = RATE_LIMITS[isSupportMode ? "ai:child-support" : "ai:tutor"];
    const rl = await rateLimitWithBackoff(`${isSupportMode ? "ai:child-support" : "ai:tutor"}:${me.authId}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { message: null, blocked: true, reason: "Too many AI requests. Please wait before trying again." },
        { status: 429 }
      );
    }

    // ── Subscription gate — pas de restriction en mode support : l'aide au
    // compte/support doit rester accessible à tous, contrairement au tuteur
    // de maths qui est une fonctionnalité payante. ─────────────────────────
    if (!isSupportMode) {
      const access = await checkAIAccess(me.authId);
      if (!access.allowed) {
        return NextResponse.json({ message: null, blocked: true, reason: access.reason }, { status: 403 });
      }
    }
    // Record usage without blocking the AI response (fire-and-forget)
    supabaseAdmin
      .from("user_ai_interactions")
      .insert({ user_id: me.id, feature_type: isSupportMode ? "ai_support" : "ai_tutor" })
      .then(undefined, (e) => console.error("[ai-tutor] usage log failed:", e?.message));
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
    const userTurnCount = trimmed.filter(m => m.role === "user").length;

    const systemPrompt = isSupportMode ? buildSupportSystemPrompt("child", userTurnCount) : buildSystemPrompt(context);

    try {
      // Mode support : température basse pour un ton factuel/fiable et un
      // meilleur respect du formatage imposé (relance vers un ticket).
      const message = await chatWithAI(trimmed, systemPrompt, isSupportMode ? 0.3 : 0.65, 800);
      return NextResponse.json({ message });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("❌ AI Tutor Error:", message);
      return NextResponse.json(
        { message: `[Erreur IA] ${sanitizeErrorMessage(message)}` },
        { status: 200 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ ai-tutor error:", message);
    return NextResponse.json(
      { message: `[Erreur] ${sanitizeErrorMessage(message)}` },
      { status: 200 }
    );
  }
}
