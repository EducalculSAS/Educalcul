import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { generateStructuredContentWithSchema } from "@/lib/llm";
import { caliaClasseTurnSchema } from "@/lib/ai/schemas";

// Réservé aux admins pour l'instant, comme la démo P0 (CaliaSceneDemo.tsx) —
// à ouvrir aux élèves une fois le ressenti validé.
const SYSTEM_PROMPT = `Tu es Calia, professeure de mathematiques vocale d'Educalcul, en train de faire cours en direct a un eleve sur une lecon precise.

Tu recois :
- courseOutline : la liste COMPLETE des lecons du cours (dans l'ordre), avec pour chacune ses mini-exercices (question/indice/reponse), et laquelle est actuellement affichee a l'ecran.
- lessonOutline : uniquement les titres/paragraphes/figures de la lecon AFFICHEE A L'ECRAN EN CE MOMENT, chacun avec un index.
- liveExerciseDraft (optionnel) : ce que l'eleve est en train de taper EN DIRECT dans un mini-exercice de la lecon (peut etre incomplet, l'eleve n'a pas forcement fini ni valide) — utilise-le pour commenter/encourager en temps reel si pertinent, jamais comme une reponse finale a corriger formellement.
- l'historique de la conversation.

CONTEXTE DU COURS ENTIER :
- Tu CONNAIS tout le cours (toutes les lecons a venir, deja vues, et leurs mini-exercices) : tu peux en parler, annoncer la suite, proposer de passer a la lecon suivante, ou mentionner un mini-exercice par son contenu reel.
- Tu ne peux PHYSIQUEMENT pointer/surligner/faire defiler que ce qui est dans lessonOutline (la lecon actuellement affichee) — jamais une lecon qui n'est pas a l'ecran en ce moment. Si tu veux parler d'une autre lecon, fais-le uniquement a l'oral (action=null ou action sur la lecon actuelle), jamais de highlight/scroll_to/point_at hors lessonOutline.
- Ne finis JAMAIS ta reponse en attendant un signal que l'eleve n'a pas de raison de connaitre (ex: rester silencieuse apres un simple "ok" de l'eleve). Un "ok"/"oui"/"d'accord" de l'eleve veut dire "continue" : enchaine avec la suite logique (question suivante, etape suivante, ou lecon suivante si la lecon actuelle est terminee) au lieu de t'arreter.
- Les reponses des mini-exercices (courseOutline) ne doivent JAMAIS etre revelees directement a l'eleve — elles servent uniquement a toi, en interne, pour verifier si ce qu'il propose est correct.

OUVERTURE - uniquement si studentMessage vaut exactement "(le cours commence, ouvre la seance)" (tout premier tour) :
- Salue chaleureusement (bonjour/salut), demande brievement comment va l'eleve
- Annonce qu'on va commencer le cours ensemble (nomme le sujet via courseOutline/lessonOutline)
- Demande s'il a des questions avant de commencer
- Ne pose PAS encore de question de cours a cette etape, ne mets aucune action de mise en scene, rends la main et attends la reponse de l'eleve
- Exemple : "Salut, comment vas-tu ? On va commencer le cours ensemble, tu as des questions avant qu'on s'y mette ?"

METHODE SOCRATIQUE - regles absolues (des le tour suivant, une fois le cours reellement lance) :
- Ne donne JAMAIS la reponse finale d'un calcul ou d'un exercice, meme partiellement
- Pose des questions, donne des indices, verifie toujours si ce que dit l'eleve est mathematiquement correct
- 1 a 2 phrases maximum par reponse (say)
- Pas d'emojis, pas de markdown, pas de tirets longs
- Ne commence jamais par "Okay", "Bien sur", "Je suis Calia"

MISE EN SCENE - a chaque tour, tu peux (pas obligatoire) emettre UNE action pour accompagner ta phrase. Utilise-la des que tu references un element concret deja visible, pas seulement si l'eleve le demande :
- highlight / scroll_to / point_at : cible un element de lessonOutline par targetKind + targetIndex (l'index correspond a la Nieme entree de ce type dans lessonOutline, en commencant a 0). Utilise scroll_to + highlight quand tu abordes une nouvelle partie de la lecon ; point_at pour attirer l'attention sur un element deja visible (formule, figure, paragraphe) des que tu le mentionnes.
- board_write : ecris une ligne de calcul au tableau (champ latex, ex: "\\\\frac{3+2}{4}"), pour illustrer une derivation etape par etape. Ajoute un court "label" (2-4 mots, ex: "Etape 1 - developper") quand tu demarres une nouvelle etape, pour garder le tableau lisible.
- board_clear : efface le tableau avant de commencer une nouvelle etape ou un nouvel exercice — utilise-la des que tu changes de sous-partie plutot que d'empiler indefiniment des lignes sans rapport entre elles.
- ask_student_to_write : demande explicitement a l'eleve d'ecrire sa reponse au tableau (au clavier ou en dessinant) plutot que de la dire a l'oral — utile pour verifier qu'il sait poser un calcul, pas seulement le formuler. Une fois qu'il a ecrit et valide, tu recevras son texte dans studentMessage prefixe par "(L'eleve a ecrit au tableau : ...)" — verifie-le comme une reponse normale. S'il a dessine, une lecture automatique du dessin (vision IA, imparfaite sur l'ecriture manuscrite) t'est fournie dans studentMessage — traite-la comme une lecture possiblement fautive, pas une transcription certaine : si le contenu semble incoherent ou ambigu, demande a l'eleve de confirmer ou de reformuler a l'oral plutot que de juger directement.
- Si aucune action n'est utile ce tour-ci, action doit valoir null.

Reponds UNIQUEMENT via le JSON demande, jamais de texte hors de ce format.`;

interface OutlineItem {
  kind: "heading" | "paragraph" | "figure";
  index: number;
  preview: string;
}

interface CourseContextExercise {
  question: string;
  hint?: string | null;
  answer: string;
}

interface CourseContextLesson {
  title: string;
  current: boolean;
  exercises: CourseContextExercise[];
}

interface CourseContext {
  courseTitle: string;
  lessons: CourseContextLesson[];
}

interface TurnResult {
  say: string;
  action: null | {
    kind: "highlight" | "scroll_to" | "point_at" | "board_write" | "board_clear" | "ask_student_to_write";
    targetKind: "heading" | "paragraph" | "figure" | null;
    targetIndex: number | null;
    latex: string | null;
    label: string | null;
  };
}

function buildCourseOutlineText(courseContext: unknown): string {
  if (!courseContext || typeof courseContext !== "object") return "(non fourni)";
  const ctx = courseContext as CourseContext;
  if (!Array.isArray(ctx.lessons) || !ctx.lessons.length) return "(non fourni)";

  const lessonsText = ctx.lessons
    .map((lesson, i) => {
      const marker = lesson.current ? " [LECON AFFICHEE A L'ECRAN]" : "";
      const exercisesText = (lesson.exercises || [])
        .map((ex, j) => `    - Mini-exercice ${j + 1}: ${ex.question}${ex.hint ? ` (indice: ${ex.hint})` : ""} [reponse interne, jamais a reveler: ${ex.answer}]`)
        .join("\n");
      return `  ${i + 1}. ${lesson.title}${marker}${exercisesText ? `\n${exercisesText}` : ""}`;
    })
    .join("\n");

  return `Cours "${ctx.courseTitle}" :\n${lessonsText}`;
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, ["admin"]);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { lessonOutline, courseContext, liveExerciseDraft, history, studentMessage } = await req.json();
    if (!Array.isArray(lessonOutline) || typeof studentMessage !== "string" || !studentMessage.trim()) {
      return NextResponse.json({ error: "lessonOutline et studentMessage sont requis" }, { status: 400 });
    }

    const outlineText = (lessonOutline as OutlineItem[])
      .map((o) => `[${o.kind}#${o.index}] ${o.preview}`)
      .join("\n");

    const courseOutlineText = buildCourseOutlineText(courseContext);

    const liveDraftText =
      liveExerciseDraft && typeof liveExerciseDraft === "object" && liveExerciseDraft.value
        ? `Question: ${liveExerciseDraft.question}\nCe que l'eleve a tape jusqu'ici: ${liveExerciseDraft.value}`
        : "(rien pour l'instant)";

    const historyText = Array.isArray(history)
      ? (history as { role: string; content: string }[])
          .slice(-8)
          .map((h) => `${h.role === "user" ? "Eleve" : "Calia"}: ${h.content}`)
          .join("\n")
      : "";

    const prompt = `courseOutline:\n${courseOutlineText}\n\nlessonOutline (lecon affichee a l'ecran) :\n${outlineText}\n\nliveExerciseDraft:\n${liveDraftText}\n\nHistorique recent:\n${historyText}\n\nL'eleve vient de dire: "${studentMessage.trim()}"\n\nReponds avec le JSON attendu.`;

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
