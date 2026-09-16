import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { generateStructuredContentWithSchema } from "@/lib/llm";
import { caliaSessionSummarySchema } from "@/lib/ai/schemas";
import { mergeCaliaSessionSummary } from "@/lib/calia/studentProfile";

// Genere UNE FOIS, en fin de session (pas a chaque tour) — met a jour la
// memoire pedagogique partagee entre Calia en classe (admin-only pour
// l'instant) et le chatbot Calia normal (ouvert a tous les eleves) : cette
// route doit donc accepter n'importe quel utilisateur authentifie, pas
// seulement les admins.
const SYSTEM_PROMPT = `Tu analyses la transcription d'une session qui vient de se terminer entre Calia (professeure de maths IA) et un eleve, pour mettre a jour son profil pedagogique.

- newMasteredNotions : notions que l'eleve a clairement demontre avoir comprises pendant CETTE session (max 5, noms courts, ex: "developpement simple", "priorites operatoires"). Vide si rien de clair.
- newWeakNotions : notions ou l'eleve a clairement bloque/hesite pendant CETTE session (max 5). Vide si rien de clair.
- methodUsed : la methode pedagogique principale employee par Calia ce tour-ci, parmi exactement : exemples_concrets, etape_par_etape, questions_guidees, essai_erreur, analogie. null si aucune ne domine clairement.
- methodWorked : true si l'eleve a progresse/compris avec cette methode, false si non, null si pas clair.
- behaviorNotes : 1-3 phrases FACTUELLES sur le comportement d'apprentissage (ex: "Se decourage vite face a un blocage, progresse mieux avec des encouragements frequents."). Jamais de jugement de valeur, uniquement utile pour mieux enseigner.
- summary : 1-3 phrases resumant ce qui a ete fait/appris pendant la session.

Reponds UNIQUEMENT via le JSON demande.`;

export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { history } = await req.json();
    if (!Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ error: "history est requis" }, { status: 400 });
    }

    const historyText = (history as { role: string; content: string }[])
      .slice(-30)
      .map((h) => `${h.role === "user" ? "Eleve" : "Calia"}: ${h.content}`)
      .join("\n");

    const result = await generateStructuredContentWithSchema<{
      newMasteredNotions: string[];
      newWeakNotions: string[];
      methodUsed: string | null;
      methodWorked: boolean | null;
      behaviorNotes: string;
      summary: string;
    }>(
      `Transcription de la session :\n${historyText}\n\nReponds avec le JSON attendu.`,
      SYSTEM_PROMPT,
      caliaSessionSummarySchema(),
      0.3,
      600,
      false,
    );

    await mergeCaliaSessionSummary(me.id, result);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
