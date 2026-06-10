import { NextRequest } from "next/server";
import { generateStructuredContent } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getProgrammePromptBlock } from "@/lib/programmes-nationaux";

export const maxDuration = 120;

const BATCH_SIZE = 4;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    linkedCourseId,
    subject,
    level,
    difficulty,
    questionCount,
    instructions,
  } = body;

  if (!subject || !difficulty || !level) {
    return Response.json(
      { error: "Missing required fields (subject, difficulty, level)" },
      { status: 400 }
    );
  }

  const totalQuestions = questionCount || 7;
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
        send({ type: "progress", step: "outline", current: 0, total: batches.length, message: "Préparation du quiz..." });

        let courseContext = "";
        if (linkedCourseId) {
          const { data: course } = await supabaseAdmin
            .from("courses")
            .select("title, content_json")
            .eq("id", linkedCourseId)
            .single();
          if (course) {
            const summary = JSON.stringify(course.content_json || "").slice(0, 2000);
            courseContext = `\n\nLe quiz porte sur le cours "${course.title}". Voici un extrait du contenu :\n${summary}\n`;
          }
        }

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

          const systemPrompt = `Tu es un professeur de mathématiques expert qui crée des quiz QCM pour le niveau scolaire "${level}".
${programmeBlock ? programmeBlock + "\n" : ""}
Crée un quiz de QCM (questions à choix unique) avec des distracteurs pertinents.
Difficulté : ${difficulty}.
${isFirst ? `Donne aussi un titre et une description globale pour le quiz complet (qui contiendra ${totalQuestions} questions au total, réparties en plusieurs parties).` : `Ne te préoccupe pas du titre/description globaux, concentre-toi uniquement sur les questions de cette partie.`}

Tu DOIS répondre UNIQUEMENT avec un objet JSON valide respectant exactement cette structure :
{
  "title": "Titre du quiz",
  "description": "Description courte",
  "type": "standard",
  "grading_type": "auto",
  "difficulty_level": "${difficulty}",
  "time_limit": 10,
  "max_attempts": 3,
  "questions": [
    {
      "id": "q-1",
      "text": "Texte de la question",
      "type": "single_choice",
      "points": 1,
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Pourquoi cette réponse est correcte"
    }
  ]
}

Génère exactement ${count} question(s) dans "questions". Chaque question doit être de type "single_choice" avec exactement 4 options et une seule bonne réponse (correctAnswer doit être identique à une des options). Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`;

          const userPrompt = `Sujet : ${subject}
Niveau : ${level}
Difficulté : ${difficulty}
Cette partie doit contenir ${count} question(s) (sur un total de ${totalQuestions} pour le quiz entier, réparti en ${batches.length} partie(s)). Évite les répétitions avec les autres parties.
${instructions ? `Instructions supplémentaires : ${instructions}` : ""}${courseContext}`;

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
        const questions = results.flatMap((r) => r.generated?.questions || []);

        send({
          type: "done",
          data: {
            content: questions,
            metadata: {
              title: first.title,
              description: first.description,
              type: first.type || "standard",
              grading_type: first.grading_type || "auto",
              difficulty_level: first.difficulty_level || difficulty,
              level,
              time_limit: first.time_limit || 10,
              max_attempts: first.max_attempts || 3,
            },
          },
        });
      } catch (error: any) {
        console.error("❌ Erreur génération quiz IA:", error.message);
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
