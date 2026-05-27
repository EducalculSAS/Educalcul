import { NextResponse } from "next/server";
import { generateStructuredContent } from "@/lib/llm";
import { getProgrammePromptBlock } from "@/lib/programmes-nationaux";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const maxDuration = 300; // 5 min — génération de cours complète

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const {
      grade_level,
      subject,
      additional_info,
      page_count,
      // New params
      lessons_per_chapter,
      content_style, // balanced | theory_heavy | practice_heavy
      include_exercises,
      language_level, // simple | standard | academic
      subject_area,
      duration_per_lesson,
      difficulty,
    } = data;

    if (!grade_level || !subject) {
      return NextResponse.json(
        { success: false, message: "Le niveau et le sujet sont requis" },
        { status: 400 }
      );
    }

    const nbChapitres = page_count ? parseInt(page_count) : 4;
    const lessonsPerChapter = lessons_per_chapter
      ? parseInt(lessons_per_chapter)
      : 3;
    const durationPerLesson = duration_per_lesson
      ? parseInt(duration_per_lesson)
      : 30;
    const includeExercises = include_exercises !== false;
    const style: "balanced" | "theory_heavy" | "practice_heavy" =
      content_style || "balanced";
    const lang: "simple" | "standard" | "academic" =
      language_level || "standard";

    const styleInstruction =
      style === "theory_heavy"
        ? "Style THÉORIQUE : privilégie le cours magistral, les définitions formelles, les démonstrations rigoureuses et les propriétés générales. Moins d'exemples, plus de profondeur conceptuelle."
        : style === "practice_heavy"
        ? "Style PRATIQUE : privilégie les exemples concrets, les méthodes pas à pas, les applications de la vie quotidienne et la résolution d'exercices. Théorie minimale, beaucoup d'exemples."
        : "Style ÉQUILIBRÉ : alterne théorie et pratique de manière harmonieuse, avec autant d'exemples que d'explications conceptuelles.";

    const languageInstruction =
      lang === "simple"
        ? "Vocabulaire SIMPLE : phrases courtes, mots du quotidien, expliquer chaque terme technique. Adapté à un élève qui découvre la notion."
        : lang === "academic"
        ? "Vocabulaire ACADÉMIQUE : terminologie mathématique précise et rigoureuse, formulations formelles, style de manuel universitaire."
        : "Vocabulaire STANDARD : registre scolaire usuel, équilibre entre rigueur et accessibilité.";

    const exercisesSchemaSnippet = includeExercises
      ? `,
          "exercises": [
            {
              "id": "ex-1",
              "question": "Énoncé clair (peut contenir du LaTeX inline avec $...$)",
              "type": "short_answer",
              "answer": "réponse exacte attendue (normalisée, simple)",
              "hint": "Indice utile sans donner la réponse",
              "explanation": "Explication courte de la solution avec les étapes"
            }
          ]`
      : "";

    const exercisesInstruction = includeExercises
      ? `═══ MINI-EXERCICES (OBLIGATOIRES) ═══
• Chaque leçon doit contenir 2 à 3 mini-exercices interactifs dans le tableau "exercises".
• Type unique supporté : "short_answer" (réponse courte texte).
• La "answer" doit être une chaîne courte et normalisée (ex: "5/4", "12", "x=3"). Évite les espaces inutiles.
• Fournis un "hint" pédagogique et une "explanation" courte avec les étapes.
• Les exercices doivent porter sur le contenu spécifique de la leçon.`
      : `═══ MINI-EXERCICES ═══
• N'inclus PAS de tableau "exercises" dans les leçons (ou laisse-le vide).`;

    const programmeBlock = getProgrammePromptBlock(grade_level);

    let dbProgrammeContent = "";
    try {
      const { data: dbProg } = await supabaseAdmin
        .from("programme_pdfs")
        .select("custom_content")
        .eq("level", grade_level)
        .maybeSingle();
      if (dbProg?.custom_content) {
        dbProgrammeContent = `\n═══ CONTENU PERSONNALISÉ DU PROGRAMME (admin) ═══\n${dbProg.custom_content}\n`;
      }
    } catch {}

    const systemMessage = `Tu es un expert pédagogue en mathématiques pour Educalcul, une plateforme éducative française.
Ta mission : créer un cours magistral COMPLET, RIGOUREUX et APPROFONDI, comme un manuel scolaire de référence.

═══ DOMAINE & NIVEAU ═══
• Domaine mathématique : ${subject_area || "Mathématiques générales"}
• Niveau scolaire visé : ${grade_level}
• Difficulté globale : ${difficulty || "medium"}

${programmeBlock ? programmeBlock + "\n" : ""}${dbProgrammeContent}
═══ STYLE PÉDAGOGIQUE ═══
• ${styleInstruction}
• ${languageInstruction}

═══ EXIGENCES DE LONGUEUR (NON NÉGOCIABLES) ═══
• Chaque leçon doit contenir MINIMUM 600 mots, idéalement 800-1200 mots.
• Chaque chapitre doit contenir EXACTEMENT ${lessonsPerChapter} leçon(s).
• Chaque leçon doit inclure : théorie, exemples détaillés étape par étape, contre-exemples, erreurs fréquentes, exercices d'application résolus.
• duration = ${durationPerLesson} minutes pour chaque leçon.

═══ STRUCTURE D'UNE LEÇON MODÈLE ═══
1. Introduction et contexte (pourquoi ce concept est important)
2. Définition(s) formelle(s) avec explications accessibles
3. Propriétés et théorèmes avec démonstrations ou justifications
4. Exemples progressifs (simple → complexe) avec TOUTES les étapes de calcul
5. Contre-exemples et pièges courants à éviter
6. Méthode de résolution pas à pas
7. Exercices d'application résolus (au moins 2)
8. Points-clés à retenir (résumé en bullets)

═══ FORMAT HTML + LATEX ═══
• HTML : <h3>, <h4>, <p>, <ul>/<li>, <strong>, <em>, <blockquote>, <table>
• LaTeX OBLIGATOIRE pour toutes les formules mathématiques.
• Inline : $formule$ — Bloc : $$formule$$
• DOUBLE-ÉCHAPPE les backslashes JSON : \\\\frac{a}{b} → donne \\frac{a}{b} dans le rendu

${exercisesInstruction}

═══ JSON STRICT ═══
Réponds UNIQUEMENT avec le JSON ci-dessous, sans texte avant ni après.
Double-échappe tous les backslashes LaTeX.

{
  "title": "Titre complet et précis du cours",
  "description": "Description pédagogique détaillée (3-4 phrases)",
  "chapters": [
    {
      "title": "Titre du chapitre",
      "lessons": [
        {
          "title": "Titre précis de la leçon",
          "type": "text",
          "content": "Contenu HTML très riche (600-1200 mots minimum)",
          "duration": ${durationPerLesson}${exercisesSchemaSnippet}
        }
      ]
    }
  ]
}`;

    const userMessage = `Crée un cours de mathématiques COMPLET et DÉTAILLÉ sur "${subject}" pour le niveau ${grade_level}.
Domaine : ${subject_area || "non spécifié"}.
Nombre de chapitres : ${nbChapitres}.
Leçons par chapitre : ${lessonsPerChapter} (chacune ${durationPerLesson} minutes, 600-1200 mots minimum).
${includeExercises ? `Chaque leçon doit inclure 2-3 mini-exercices interactifs (type "short_answer") dans le tableau "exercises".` : `N'inclus pas de mini-exercices.`}
${additional_info ? `Instructions spécifiques de l'enseignant : ${additional_info}` : ""}
Chaque leçon doit être un vrai cours magistral, pas un résumé.`;

    let courseData;
    try {
      courseData = await generateStructuredContent(
        userMessage,
        systemMessage,
        0.65
      );
    } catch (error: any) {
      console.error("❌ Erreur génération cours IA:", error.message);
      return NextResponse.json(
        { success: false, message: `Erreur de génération: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, course: courseData });
  } catch (error: any) {
    console.error("Erreur cours IA:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}
