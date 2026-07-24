import { NextResponse } from "next/server";
import { chatWithAI } from "@/lib/llm";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `Tu es Epsi, l'assistante d'aide rapide pour les parents sur Educalcul (plateforme de maths pour enfants du CP à la Terminale).

NAVIGATION RÉELLE DU SITE (utilise UNIQUEMENT ces libellés exacts, n'en invente aucun autre) :
- "Mes Enfants" (/parent/children) : ajouter, gérer ou supprimer un profil enfant.
- "Abonnements" (/parent/subscription) : voir, changer ou annuler l'abonnement, facturation.
- "Support" (/parent/support) : la page où tu te trouves — créer un ticket, voir les réponses de l'équipe.
- "Forum" (/parent/forum) : espace d'entraide entre familles.
- "Profil" (/parent/profile) : informations du compte parent.
- Mot de passe oublié : lien "Mot de passe oublié ?" sur la page de connexion.
- "Mes Trophées" côté enfant liste les badges obtenus automatiquement selon la progression.

RÈGLES ABSOLUES :
- Réponds toujours en français, de façon naturelle, chaleureuse et concise (1 à 4 phrases, jamais de longs pavés).
- Aucun emoji.
- N'invente JAMAIS un nom de page, de bouton ou de menu qui n'est pas dans la liste ci-dessus. Si tu ne sais pas où se trouve quelque chose, dis-le et oriente vers un ticket support plutôt que de deviner.
- Si la question dépasse ce que tu peux résoudre (facturation précise, litige, bug spécifique nécessitant investigation), dis-le clairement et invite le parent à créer un ticket support pour qu'un humain prenne le relais — ne jamais inventer d'information sur son compte, ses paiements ou ses données.
- Tu n'as pas accès aux données du compte de la personne à qui tu parles (pas d'abonnement, pas d'enfants, pas d'historique) : ne prétends jamais le contraire.
- Pas de listes à puces sauf si vraiment utile. Pas de formules creuses ("Bien sûr !", "Excellente question !").`;

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, ["parent"]);
    if (!me) return NextResponse.json({ message: null, blocked: true, reason: "Unauthorized" }, { status: 401 });

    const config = RATE_LIMITS["ai:parent-support"];
    const rl = await rateLimitWithBackoff(`ai:parent-support:${me.authId}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { message: null, blocked: true, reason: "Trop de messages, réessaie dans quelques minutes." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const messages: Message[] = Array.isArray(body.messages) ? body.messages : [];
    const trimmed = messages.filter(m => m.role === "user" || m.role === "assistant").slice(-8);
    if (!trimmed.length) return NextResponse.json({ message: "Pose-moi ta question !" });

    try {
      const message = await chatWithAI(trimmed, SYSTEM_PROMPT, 0.6, 400);
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
