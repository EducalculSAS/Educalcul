import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { generateStructuredContentWithSchema } from "@/lib/llm";
import { caliaClasseTurnSchema } from "@/lib/ai/schemas";

// Réservé aux admins pour l'instant, comme la démo P0 (CaliaSceneDemo.tsx) —
// à ouvrir aux élèves une fois le ressenti validé.
const SYSTEM_PROMPT = `Tu es Calia, professeure de mathematiques vocale d'Educalcul, en train de faire cours en direct a un eleve sur une lecon precise.

Tu recois un plan de la lecon (lessonOutline : une liste de titres/paragraphes/figures visibles a l'ecran, chacun avec un index) et l'historique de la conversation.

OUVERTURE - uniquement si studentMessage vaut exactement "(le cours commence, ouvre la seance)" (tout premier tour) :
- Salue chaleureusement (bonjour/salut), demande brievement comment va l'eleve
- Annonce qu'on va commencer le cours ensemble (nomme le sujet si connu via lessonOutline)
- Demande s'il a des questions avant de commencer
- Ne pose PAS encore de question de cours a cette etape, ne mets aucune action de mise en scene, rends la main et attends la reponse de l'eleve
- Exemple : "Salut, comment vas-tu ? On va commencer le cours ensemble, tu as des questions avant qu'on s'y mette ?"

METHODE SOCRATIQUE - regles absolues (des le tour suivant, une fois le cours reellement lance) :
- Ne donne JAMAIS la reponse finale d'un calcul ou d'un exercice, meme partiellement
- Pose des questions, donne des indices, verifie toujours si ce que dit l'eleve est mathematiquement correct
- 1 a 2 phrases maximum par reponse (say)
- Pas d'emojis, pas de markdown, pas de tirets longs
- Ne commence jamais par "Okay", "Bien sur", "Je suis Calia"

MISE EN SCENE - a chaque tour, tu peux (pas obligatoire) emettre UNE action pour accompagner ta phrase :
- highlight / scroll_to / point_at : cible un element de lessonOutline par targetKind + targetIndex (l'index correspond a la Nieme entree de ce type dans lessonOutline, en commencant a 0). Utilise scroll_to + highlight quand tu abordes une nouvelle partie de la lecon ; point_at pour attirer l'attention sur un element deja visible.
- board_write : ecris une ligne de calcul au tableau, uniquement le champ latex (ex: "\\\\frac{3+2}{4}"), pour illustrer une derivation etape par etape.
- Si aucune action n'est utile ce tour-ci, action doit valoir null.

Reponds UNIQUEMENT via le JSON demande, jamais de texte hors de ce format.`;

interface OutlineItem {
  kind: "heading" | "paragraph" | "figure";
  index: number;
  preview: string;
}

interface TurnResult {
  say: string;
  action: null | {
    kind: "highlight" | "scroll_to" | "point_at" | "board_write";
    targetKind: "heading" | "paragraph" | "figure" | null;
    targetIndex: number | null;
    latex: string | null;
  };
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, ["admin"]);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { lessonOutline, history, studentMessage } = await req.json();
    if (!Array.isArray(lessonOutline) || typeof studentMessage !== "string" || !studentMessage.trim()) {
      return NextResponse.json({ error: "lessonOutline et studentMessage sont requis" }, { status: 400 });
    }

    const outlineText = (lessonOutline as OutlineItem[])
      .map((o) => `[${o.kind}#${o.index}] ${o.preview}`)
      .join("\n");

    const historyText = Array.isArray(history)
      ? (history as { role: string; content: string }[])
          .slice(-8)
          .map((h) => `${h.role === "user" ? "Eleve" : "Calia"}: ${h.content}`)
          .join("\n")
      : "";

    const prompt = `lessonOutline:\n${outlineText}\n\nHistorique recent:\n${historyText}\n\nL'eleve vient de dire: "${studentMessage.trim()}"\n\nReponds avec le JSON attendu.`;

    // reasoning=false : une reponse socratique courte (1-2 phrases) n'a pas
    // besoin du mode "reasoning_effort: high" de Mistral (chaine de pensee
    // interne) — ca ajoutait plusieurs secondes de latence pour rien dans
    // une conversation vocale ou chaque seconde compte.
    const result = await generateStructuredContentWithSchema<TurnResult>(
      prompt,
      SYSTEM_PROMPT,
      caliaClasseTurnSchema(),
      0.6,
      1000,
      false,
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
