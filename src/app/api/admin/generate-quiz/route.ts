import { NextRequest, NextResponse } from "next/server";
import { generateStructuredContent } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getProgrammePromptBlock } from "@/lib/programmes-nationaux";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json(
        { error: "Missing required fields (subject, difficulty, level)" },
        { status: 400 }
      );
    }

    // Fetch linked course content
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

    const systemPrompt = `Tu es un professeur de mathématiques expert qui crée des quiz QCM pour le niveau scolaire "${level}".
${programmeBlock ? programmeBlock + "\n" : ""}${dbProgrammeContent}
Crée un quiz de QCM (questions à choix unique) avec des distracteurs pertinents.
Difficulté : ${difficulty}.

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

Génère exactement ${questionCount || 7} questions. Chaque question doit être de type "single_choice" avec exactement 4 options et une seule bonne réponse (correctAnswer doit être identique à une des options). Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`;

    const userPrompt = `Sujet : ${subject}
Niveau : ${level}
Difficulté : ${difficulty}
Nombre de questions : ${questionCount || 7}
${instructions ? `Instructions supplémentaires : ${instructions}` : ""}${courseContext}`;

    const generated = (await generateStructuredContent(
      userPrompt,
      systemPrompt,
      0.7
    )) as any;

    return NextResponse.json({
      success: true,
      data: {
        content: generated.questions || [],
        metadata: {
          title: generated.title,
          description: generated.description,
          type: generated.type || "standard",
          grading_type: generated.grading_type || "auto",
          difficulty_level: generated.difficulty_level || difficulty,
          level: level,
          time_limit: generated.time_limit || 10,
          max_attempts: generated.max_attempts || 3,
        },
      },
    });
  } catch (error: any) {
    console.error("Error generating quiz:", error);
    return NextResponse.json(
      { error: "Failed to generate quiz", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}
