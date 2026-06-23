import { NextRequest } from "next/server";
import { generateStructuredContent } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getProgrammePromptBlock } from "@/lib/programmes-nationaux";

export const maxDuration = 120;

const BATCH_SIZE = 3;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    exerciseType,
    linkedCourseId,
    subject,
    level,
    difficulty,
    questionCount,
    subjectArea,
    instructions,
  } = body;

  if (!subject || !difficulty || !level || !exerciseType) {
    return Response.json(
      { error: "Missing required fields (subject, difficulty, level, exerciseType)" },
      { status: 400 }
    );
  }

  const totalQuestions = questionCount || 5;
  const batches: number[] = [];
  let remaining = totalQuestions;
  while (remaining > 0) {
    const n = Math.min(BATCH_SIZE, remaining);
    batches.push(n);
    remaining -= n;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      try {
        send({ type: "progress", step: "outline", current: 0, total: batches.length, message: "Préparation de l'exercice..." });

        let courseContext = "";
        if (linkedCourseId) {
          const { data: course } = await supabaseAdmin
            .from("courses")
            .select("title, content_json")
            .eq("id", linkedCourseId)
            .single();
          if (course) {
            const summary = JSON.stringify(course.content_json || "").slice(0, 2000);
            courseContext = `\n\nL'exercice doit être lié au cours "${course.title}". Voici un extrait du contenu du cours pour t'aider à rester cohérent :\n${summary}\n`;
          }
        }

        const typeInstruction =
          exerciseType === "simple"
            ? "Crée un exercice de calcul direct. Chaque question est autonome, courte, avec une consigne claire. Pas de contexte narratif."
            : "Crée un exercice long avec une introduction narrative (mise en situation), puis des questions numérotées qui se suivent logiquement. Chaque question a une consigne explicite.";

        const programmeBlock = getProgrammePromptBlock(level);

        send({
          type: "progress",
          step: "chapter",
          current: 0,
          total: batches.length,
          message: `Rédaction des ${totalQuestions} question(s) en parallèle...`,
        });

        let completed = 0;
        const results = await Promise.all(batches.map(async (count, batchIndex) => {
          const isFirst = batchIndex === 0;
          const firstBlockHint =
            isFirst && exerciseType === "contextual"
              ? `Pour un exercice contextuel, le premier bloc de la page doit être de type "text" avec une introduction HTML (mise en situation, contexte narratif). Puis viennent les blocs questions.`
              : `Ne mets PAS de bloc d'introduction, uniquement des blocs questions.`;

          const systemPrompt = `Tu es un professeur de mathématiques expert qui crée des exercices pour le niveau scolaire "${level}".
${programmeBlock ? programmeBlock + "\n" : ""}${typeInstruction}

Domaine : ${subjectArea || "Mathématiques"}.
Difficulté : ${difficulty}.

${firstBlockHint}
${isFirst ? `Donne aussi un titre et une description globale pour l'exercice complet (qui contiendra ${totalQuestions} questions au total, réparties en plusieurs parties).` : `Ne te préoccupe pas du titre/description globaux, concentre-toi uniquement sur les questions de cette partie.`}

Tu DOIS répondre UNIQUEMENT avec un objet JSON valide respectant exactement cette structure :
{
  "title": "Titre de l'exercice",
  "description": "Description courte",
  "type": "standard",
  "grading_type": "ai",
  "difficulty_level": "${difficulty}",
  "time_limit": 20,
  "max_attempts": 3,
  "blocks": [
    ${
      isFirst && exerciseType === "contextual"
        ? `{ "id": "block-intro", "type": "text", "content": "<p>Texte d'introduction et mise en situation...</p>" },`
        : ""
    }
    {
      "id": "block-1",
      "type": "text_input",
      "title": "Consigne explicite de la question",
      "content": "Texte optionnel d'aide ou reformulation",
      "points": 2,
      "correctAnswer": "réponse attendue",
      "explanation": "explication de la correction"
    }
  ]
}

═══ TABLEAUX & GRAPHIQUES (à utiliser SI PERTINENT, sans en abuser) ═══
• Si l'exercice s'y prête (étude de fonction, signe, variations, tableau de valeurs), tu peux insérer dans le "content" d'un bloc "text" un tableau au format :
  <table class="math-table math-table-sign"><thead><tr><th>x</th>...</tr></thead><tbody><tr><td>...</td></tr></tbody></table>
  (classes possibles : math-table-value, math-table-sign, math-table-variation). Utilise ↗, ↘, +, -, 0, ∞, ‖ pour les signes/variations.
• Pour une courbe simple, insère un placeholder de graphique au format :
  <div class="math-graph-placeholder" data-function="x^2 - 2*x + 1" data-xmin="-5" data-xmax="5"></div>
• N'insère ces éléments QUE quand ils apportent une vraie valeur pédagogique pour ce type d'exercice.

Génère exactement ${count} question(s) de type "text_input" dans "blocks". Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`;

          const userPrompt = `Sujet : ${subject}
Niveau : ${level}
Difficulté : ${difficulty}
Domaine : ${subjectArea || "Mathématiques"}
Cette partie doit contenir ${count} question(s) (sur un total de ${totalQuestions} pour l'exercice entier, réparti en ${batches.length} partie(s)).
${instructions && String(instructions).trim() ? `
═══ ⚠️ INSTRUCTIONS PRIORITAIRES DE L'ENSEIGNANT — À RESPECTER À LA LETTRE ═══
Ces consignes PRIMENT sur tout choix par défaut. Génère les questions en couvrant EXACTEMENT les notions/contenus demandés ci-dessous, sans rien ajouter hors-programme ni omettre :
«««
${String(instructions).trim()}
»»»
` : ""}${courseContext}`;

          const generated = (await generateStructuredContent(userPrompt, systemPrompt, 0.7)) as any;

          completed++;
          send({
            type: "progress",
            step: "chapter",
            current: completed,
            total: batches.length,
            message: `Partie ${batchIndex + 1}/${batches.length} terminée (${count} question(s))`,
          });

          return { batchIndex, generated };
        }));

        results.sort((a, b) => a.batchIndex - b.batchIndex);

        const first = results[0]?.generated || {};
        const blocks = results.flatMap((r) => r.generated?.blocks || []);

        send({
          type: "done",
          data: {
            content: [
              {
                id: "page-1",
                title: exerciseType === "contextual" ? "Présentation" : "Questions",
                blocks,
              },
            ],
            metadata: {
              title: first.title,
              description: first.description,
              type: first.type || "standard",
              grading_type: first.grading_type || "ai",
              difficulty_level: first.difficulty_level || difficulty,
              level,
              time_limit: first.time_limit || 20,
              max_attempts: first.max_attempts || 3,
            },
          },
        });
      } catch (error: any) {
        console.error("❌ Erreur génération exercice IA:", error.message);
        send({ type: "error", message: error.message || "Erreur de génération" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
