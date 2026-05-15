import { NextResponse } from "next/server";
import { AITutorPageContext } from "@/contexts/AITutorContext";
import { chatWithQwen } from "@/lib/qwen-service";
import { checkAIAccess } from "@/lib/checkSubscription";
import { supabaseAdmin } from "@/lib/supabaseClient";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function buildSystemPrompt(ctx: AITutorPageContext): string {
  const pageLabel: Record<string, string> = {
    cours_detail: `le cours "${ctx.courseTitle || "?"}" (${ctx.courseSubject || "Maths"}, niveau ${ctx.courseLevel || "?"})`,
    exercise_detail: `l'exercice "${ctx.exerciseTitle || "?"}" (difficulté: ${ctx.exerciseDifficulty || "?"})`,
    quiz_detail: `le quiz "${ctx.quizTitle || "?"}"`,
    cours: "la liste des cours",
    exercises: "la liste des exercices",
    quiz: "la liste des quiz",
    dashboard: "le tableau de bord",
    forum: "le forum",
    badges: "la page des badges",
    profile: "le profil",
    other: "le site Educalcul",
  };

  let extra = "";
  
  // Course details
  if (ctx.page === "cours_detail" && ctx.courseContent) {
    // Pass the FULL course content so AI can understand the lesson completely
    extra += `\n\n📖 CONTENU DU COURS:\n${ctx.courseContent}`;
  }
  
  // Exercise details (the main focus)
  if (ctx.page === "exercise_detail") {
    if (ctx.exerciseQuestion) {
      // Format the exercise content nicely
      const formattedQuestion = ctx.exerciseQuestion
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join("\n");
      
      extra += `\n\n📝 ÉNONCÉ DE L'EXERCICE:\n${formattedQuestion}`;
    } else {
      extra += `\n\n⚠️ Contexte d'exercice détecté mais l'énoncé n'a pas pu être chargé. Demande à l'élève de réessayer ou de rafraîchir la page.`;
    }
    if (ctx.userAnswer) {
      extra += `\n\n✏️ RÉPONSE ACTUELLE DE L'ÉLÈVE:\n${ctx.userAnswer}`;
    }
    if (ctx.exerciseType) {
      const typeLabel: Record<string, string> = {
        "text": "Texte libre",
        "text_input": "Réponse courte",
        "single_choice": "Choix unique (QCM)",
        "multiple_choice": "Choix multiples",
        "true_false": "Vrai/Faux",
        "image": "Analyse d'image",
        "standard": "Exercice standard",
      };
      extra += `\n\n🎯 TYPE D'EXERCICE: ${typeLabel[ctx.exerciseType] || ctx.exerciseType}`;
    }
    if (ctx.exerciseHints && ctx.exerciseHints.length > 0) {
      extra += `\n\n💡 INDICES DISPONIBLES:\n${ctx.exerciseHints.slice(0, 3).map((h, i) => `${i + 1}. ${h}`).join("\n")}`;
    }
  }
  
  // Quiz details
  if (ctx.page === "quiz_detail" && ctx.currentQuestionText) {
    extra += `\n\n❓ QUESTION EN COURS: ${ctx.currentQuestionText}`;
    if (ctx.userScore !== undefined) {
      extra += `\n\n📊 SCORE ACTUEL: ${ctx.userScore}`;
    }
  }
  
  // Session context for continuity
  let sessionContext = "";
  if (ctx.previousExercises && ctx.previousExercises.length > 0) {
    sessionContext += `\n\n📚 EXERCICES RÉCENTS COMPLÉTÉS: ${ctx.previousExercises.slice(0, 3).join(", ")}`;
  }
  if (ctx.recentMistakes && ctx.recentMistakes.length > 0) {
    sessionContext += `\n\n⚠️ SUJETS OÙ L'ÉLÈVE A EU DES DIFFICULTÉS: ${ctx.recentMistakes.slice(0, 2).join(", ")}. Sois particulièrement attentif à ces domaines.`;
  }
  if (ctx.studentLevel) {
    sessionContext += `\n\n🎓 NIVEAU DE L'ÉLÈVE: ${ctx.studentLevel}`;
  }

  // Build the appropriate rules section based on context
  let rulesSection = "";
  let strategySection = "";
  let examplesSection = "";
  
  if (ctx.page === "cours_detail") {
    // Rules for COURSE TUTORING - Can explain concepts
    rulesSection = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TES RÈGLES POUR LE COURS (EXPLIQUE BRIÈVEMENT!):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏺️ CONCISION STRICTE: MAX 2 PHRASES COURTES! Pas de pavé!
📖 LIS LE CONTENU DU COURS - C'est ta référence
💡 EXPLIQUE SIMPLEMENT la partie que l'élève ne comprend pas
🧮 Utilise le LaTeX pour les formules: $x$, $e^x$, $\frac{a}{b}$
⚠️ SOIS PRUDENT avec les maths - vérife avant d'affirmer!
😊 Encourage l'élève à chercher lui-même la suite
🚫 PAS DE LONGS TEXTES - Explique en 2 phrases maximum!`;

    strategySection = `▶ Lire la question
▶ Trouver la réponse DIRECTE dans le cours
▶ Répondre en MAX 2 PHRASES COURTES
▶ Une phrase = une idée
▶ Encourager l'élève à poser d'autres questions`;

    examplesSection = `MAUVAIS (générique):
❌ "Voici la définition formelle..."
❌ "Le théorème de Rolle stipule..."

BON (basé sur le cours):
✅ "D'après le cours, la fonction exponentielle naît d'un problème: trouver une fonction égale à sa dérivée. C'est comme chercher une fonction qui 'se reproduit' d'elle-même!"
✅ "Le cours montre que $e^a × e^b = e^{a+b}$ - c'est la GRANDE propriété! Ça marche parce que..."`;
  } else {
    // Rules for EXERCISES/QUIZZES - Never give the answer
    rulesSection = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TES RÈGLES (NON NÉGOCIABLE):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 CONCISION: Max 2-3 phrases courtes par réponse. Les enfants se fatiguent vite.
🚫 JAMAIS donner la réponse. Poser UNE seule question pour que l'enfant réfléchisse.
🚫 JAMAIS confirmer/valider une réponse que l'enfant donne. Dire plutôt: "Explique-moi pourquoi tu penses ça?"
💡 Langage super simple. Phrases courtes. Mots faciles.
😊 Sympa et encourageant, comme un grand frère/grande sœur.
🧮 Pour les maths: utiliser le LaTeX proprement ($x$, $\frac{a}{b}$, $\sqrt{x}$).
🔍 Si l'enfant ne comprend pas: RE-EXPLIQUER avec des mots plus simples, PAS continuer.

RÈGLE STRICTE - NE JAMAIS CONFIRMER LES RÉPONSES:
Si l'élève dit: "La réponse est 42"
❌ N'ÉCRIS PAS: "Oui c'est exact! La réponse est 42"
❌ N'ÉCRIS PAS: "Corriger! La bonne réponse est..."
✅ ÉCRIS: "Comment tu es arrivé à ce résultat? Explique-moi chaque étape."`;

    strategySection = `▶ Lire la question avec attention
▶ Poser 1 SEULE question guidée (simple et claire)
▶ Encourager l'enfant à chercher SA réponse
▶ Si erreur: pointer doucement (pas dire la réponse), donner un indice
▶ Si l'enfant partage une réponse: demander sa démarche, pas confirmer/valider`;

    examplesSection = `❌ "Pour résoudre ce problème, nous devons d'abord comprendre que..."
✅ "Commençons simple: tu peux me montrer le calcul que tu ferais?"

❌ "L'énoncé nous dit que nous devons multiplier par 6 et ajouter 6..."
✅ "Si tu choisis 6, quelle est la première étape du programme?"

❌ "Voyons ensemble comment exprimer cela en fonction de x..."
✅ "Au lieu de 6, appelle le nombre choisi '$x$'. Qu'est-ce que tu obtiens?"`;
  }

  return `Tu es ATHÉNA, tutrice IA pour les enfants (8-14 ans) sur Educalcul. 🌟

${rulesSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
L'élève travaille sur: ${pageLabel[ctx.page] || "le site"}.${extra}${sessionContext}

STRATÉGIE:
${strategySection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXEMPLES DE BONS DÉBUTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${examplesSection}

RAPPEL: Tu es là pour que l'enfant PENSE et COMPRENNE par lui-même. C'est comme ça qu'il apprend. 🧠`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: Message[] = body.messages ?? [];
    const context: AITutorPageContext = body.context ?? { page: "other" };

    // ── Subscription gate ──────────────────────────────────────────────────
    const authHeader = req.headers.get("x-user-auth-id");
    if (authHeader) {
      const access = await checkAIAccess(authHeader);
      if (!access.allowed) {
        return NextResponse.json({ message: null, blocked: true, reason: access.reason }, { status: 403 });
      }
      // Record usage
      const { data: userData } = await supabaseAdmin.from("users").select("id").eq("auth_id", authHeader).maybeSingle();
      if (userData) {
        await supabaseAdmin.from("user_ai_interactions").insert({ user_id: userData.id, feature_type: "ai_tutor" });
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    // Log received context for debugging
    console.log("📥 AI Tutor received context:", {
      page: context.page,
      exerciseTitle: context.exerciseTitle,
      exerciseQuestion: context.exerciseQuestion?.slice(0, 100) || "NO QUESTION",
      hasQuestion: !!context.exerciseQuestion,
      questionLength: context.exerciseQuestion?.length || 0,
      courseTitle: context.courseTitle,
      exerciseType: context.exerciseType,
    });

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
    console.log("🤖 System prompt length:", systemPrompt.length, "chars");
    console.log("🤖 System prompt excerpt:", systemPrompt.slice(0, 300) + "...");

    try {
      // 🤖 Use Qwen2.5vl:7b via Ollama
      console.log("🤖 AI Tutor: Calling Qwen model...");
      
      // Adjust token limit based on context
      // Courses: STRICT concision (50 tokens = ~1-2 phrases)
      // Exercises/Quizzes: More tokens for guidance (150 tokens)
      const maxTokens = context.page === "cours_detail" ? 50 : 150;
      
      const message = await chatWithQwen(trimmed, systemPrompt, 0.65, maxTokens);
      console.log("✅ AI Tutor response received");
      return NextResponse.json({ message });
    } catch (error) {
      console.error("❌ Qwen AI Tutor Error:", error);
      return NextResponse.json(
        { message: "Je n'ai pas pu répondre. Réessaie ! 🙏" },
        { status: 200 }
      );
    }
  } catch (err: any) {
    console.error("❌ ai-tutor error:", err);
    return NextResponse.json(
      { message: "Oups, une erreur s'est produite. Réessaie ! 🙏" },
      { status: 200 }
    );
  }
}
