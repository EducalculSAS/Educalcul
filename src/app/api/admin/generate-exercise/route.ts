import { NextRequest, NextResponse } from "next/server";
import { generateStructuredContent } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getProgrammePromptBlock } from "@/lib/programmes-nationaux";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json(
        { error: "Missing required fields (subject, difficulty, level, exerciseType)" },
        { status: 400 }
      );
    }

    // Fetch linked course content if provided
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

    const firstBlockHint =
      exerciseType === "contextual"
        ? `Pour un exercice contextuel, le premier bloc de la page doit être de type "text" avec une introduction HTML (mise en situation, contexte narratif). Puis viennent les blocs questions.`
        : `Pour un exercice simple, mets directement les blocs questions sans bloc d'introduction.`;

    const programmeBlock = getProgrammePromptBlock(level);

    let dbProgrammeContent = "";
    try {
      const { data: dbProg } = await supabaseAdmin
        .from("programme_pdfs")
        .select("custom_content")
        .eq("level", level)
        .maybeSingle();
      if (dbProg?.custom_content) {
        dbProgrammeContent = `\n═══ CONTENU PERSONNALISÉ DU PROGRAMME (admin) ═══\n${dbProg.custom_content}\n`;
      }
    } catch {}

    const systemPrompt = `Tu es un professeur de mathématiques expert qui crée des exercices pour le niveau scolaire "${level}".
${programmeBlock ? programmeBlock + "\n" : ""}${dbProgrammeContent}${typeInstruction}

Domaine : ${subjectArea || "Mathématiques"}.
Difficulté : ${difficulty}.

${firstBlockHint}

Tu DOIS répondre UNIQUEMENT avec un objet JSON valide respectant exactement cette structure :
{
  "title": "Titre de l'exercice",
  "description": "Description courte",
  "type": "standard",
  "grading_type": "ai",
  "difficulty_level": "${difficulty}",
  "time_limit": 20,
  "max_attempts": 3,
  "pages": [
    {
      "id": "page-1",
      "title": "${exerciseType === "contextual" ? "Présentation" : "Questions"}",
      "blocks": [
        ${
          exerciseType === "contextual"
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
  ]
}

Génère exactement ${questionCount || 5} questions de type "text_input". Toutes les questions sont dans la même page. Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`;

    const userPrompt = `Sujet : ${subject}
Niveau : ${level}
Difficulté : ${difficulty}
Domaine : ${subjectArea || "Mathématiques"}
Nombre de questions : ${questionCount || 5}
${instructions ? `Instructions supplémentaires : ${instructions}` : ""}${courseContext}`;

    const generated = (await generateStructuredContent(
      userPrompt,
      systemPrompt,
      0.7
    )) as any;

    return NextResponse.json({
      success: true,
      data: {
        content: generated.pages || [],
        metadata: {
          title: generated.title,
          description: generated.description,
          type: generated.type || "standard",
          grading_type: generated.grading_type || "ai",
          difficulty_level: generated.difficulty_level || difficulty,
          level: level,
          time_limit: generated.time_limit || 20,
          max_attempts: generated.max_attempts || 3,
        },
      },
    });
  } catch (error: any) {
    console.error("Error generating exercise:", error);
    return NextResponse.json(
      { error: "Failed to generate exercise", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}
