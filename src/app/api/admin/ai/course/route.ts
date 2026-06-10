import { generateStructuredContent } from "@/lib/llm";
import { getProgrammePromptBlock } from "@/lib/programmes-nationaux";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const maxDuration = 300; // 5 min — génération de cours complète

export async function POST(request: Request) {
  const data = await request.json();
  const {
    grade_level,
    subject,
    additional_info,
    page_count,
    lessons_per_chapter,
    content_style, // balanced | theory_heavy | practice_heavy
    include_exercises,
    language_level, // simple | standard | academic
    subject_area,
    duration_per_lesson,
    difficulty,
  } = data;

  if (!grade_level || !subject) {
    return Response.json(
      { success: false, message: "Le niveau et le sujet sont requis" },
      { status: 400 }
    );
  }

  const nbChapitres = page_count ? parseInt(page_count) : 4;
  const lessonsPerChapter = lessons_per_chapter ? parseInt(lessons_per_chapter) : 3;
  const durationPerLesson = duration_per_lesson ? parseInt(duration_per_lesson) : 30;
  const includeExercises = include_exercises !== false;
  const style: "balanced" | "theory_heavy" | "practice_heavy" = content_style || "balanced";
  const lang: "simple" | "standard" | "academic" = language_level || "standard";

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

  const contextBlock = `═══ DOMAINE & NIVEAU ═══
• Domaine mathématique : ${subject_area || "Mathématiques générales"}
• Niveau scolaire visé : ${grade_level}
• Difficulté globale : ${difficulty || "medium"}

${programmeBlock ? programmeBlock + "\n" : ""}
═══ STYLE PÉDAGOGIQUE ═══
• ${styleInstruction}
• ${languageInstruction}`;

  const lessonFormatBlock = `═══ EXIGENCES DE LONGUEUR (NON NÉGOCIABLES) ═══
• Chaque leçon doit contenir MINIMUM 600 mots, idéalement 800-1200 mots.
• Le chapitre doit contenir EXACTEMENT ${lessonsPerChapter} leçon(s).
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
• N'utilise JAMAIS de retour à la ligne littéral à l'intérieur d'une chaîne JSON : écris le HTML sur une seule ligne (utilise <br> ou des balises pour la mise en forme, pas de \\n).
• DOUBLE-ÉCHAPPE les backslashes JSON : \\\\frac{a}{b} → donne \\frac{a}{b} dans le rendu

${exercisesInstruction}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      try {
        // ── Étape 1 : plan du cours (titre, description, titres des chapitres) ──
        send({ type: "progress", step: "outline", current: 0, total: nbChapitres, message: "Élaboration du plan du cours..." });

        const outlineSystem = `Tu es un expert pédagogue en mathématiques pour Educalcul, une plateforme éducative française.
Ta mission : élaborer le PLAN d'un cours magistral COMPLET sur "${subject}".

${contextBlock}

═══ JSON STRICT ═══
Réponds UNIQUEMENT avec le JSON ci-dessous, sans texte avant ni après.
{
  "title": "Titre complet et précis du cours",
  "description": "Description pédagogique détaillée (3-4 phrases)",
  "chapters": [
    { "title": "Titre du chapitre 1" }
  ]
}
Le tableau "chapters" doit contenir EXACTEMENT ${nbChapitres} chapitre(s), avec une progression pédagogique cohérente (du plus simple au plus complexe).`;

        const outlineUser = `Crée le plan d'un cours de mathématiques sur "${subject}" pour le niveau ${grade_level}, avec ${nbChapitres} chapitre(s).
${additional_info ? `Instructions spécifiques de l'enseignant : ${additional_info}` : ""}`;

        const outline = (await generateStructuredContent(outlineUser, outlineSystem, 0.6)) as {
          title?: string;
          description?: string;
          chapters?: { title?: string }[];
        };

        const courseTitle = outline?.title || subject;
        const courseDescription = outline?.description || "";
        let chapterTitles = (outline?.chapters || [])
          .map((c) => c?.title)
          .filter((t): t is string => !!t)
          .slice(0, nbChapitres);

        // Sécurité : si l'IA n'a pas renvoyé assez de chapitres, on complète
        while (chapterTitles.length < nbChapitres) {
          chapterTitles.push(`${subject} — partie ${chapterTitles.length + 1}`);
        }

        send({
          type: "outline",
          title: courseTitle,
          description: courseDescription,
          chapterTitles,
        });

        // ── Étape 2 : génération de tous les chapitres EN PARALLÈLE (gros gain de temps) ──
        send({
          type: "progress",
          step: "chapter",
          current: 0,
          total: chapterTitles.length,
          message: `Rédaction des ${chapterTitles.length} chapitre(s) en parallèle...`,
        });

        let completed = 0;
        await Promise.all(chapterTitles.map(async (chapterTitle, i) => {
          const chapterSystem = `Tu es un expert pédagogue en mathématiques pour Educalcul, une plateforme éducative française.
Ta mission : rédiger un chapitre COMPLET, RIGOUREUX et APPROFONDI d'un cours magistral, comme un manuel scolaire de référence.

${contextBlock}

═══ CONTEXTE DU COURS ═══
• Cours : "${courseTitle}"
• ${courseDescription}
• Ce chapitre (${i + 1}/${chapterTitles.length}) : "${chapterTitle}"
• Ensemble des chapitres du cours : ${chapterTitles.map((t, idx) => `${idx + 1}. ${t}`).join(", ")} — évite les répétitions inutiles entre chapitres.

${lessonFormatBlock}

═══ JSON STRICT ═══
Réponds UNIQUEMENT avec le JSON ci-dessous, sans texte avant ni après.
{
  "title": "${chapterTitle.replace(/"/g, '\\"')}",
  "lessons": [
    {
      "title": "Titre précis de la leçon",
      "type": "text",
      "content": "Contenu HTML très riche (600-1200 mots minimum)",
      "duration": ${durationPerLesson}${exercisesSchemaSnippet}
    }
  ]
}`;

          const chapterUser = `Rédige le chapitre "${chapterTitle}" du cours "${courseTitle}" (niveau ${grade_level}).
Le tableau "lessons" doit contenir EXACTEMENT ${lessonsPerChapter} leçon(s), chacune ${durationPerLesson} minutes, 600-1200 mots minimum.
${includeExercises ? `Chaque leçon doit inclure 2-3 mini-exercices interactifs (type "short_answer") dans le tableau "exercises".` : `N'inclus pas de mini-exercices.`}
${additional_info ? `Instructions spécifiques de l'enseignant : ${additional_info}` : ""}
Chaque leçon doit être un vrai cours magistral, pas un résumé.`;

          const chapterData = (await generateStructuredContent(chapterUser, chapterSystem, 0.65)) as {
            title?: string;
            lessons?: unknown[];
          };

          completed++;
          send({
            type: "progress",
            step: "chapter",
            current: completed,
            total: chapterTitles.length,
            message: `Chapitre ${i + 1}/${chapterTitles.length} terminé : ${chapterTitle}`,
          });

          send({
            type: "chapter",
            index: i,
            chapter: {
              title: chapterData?.title || chapterTitle,
              lessons: chapterData?.lessons || [],
            },
          });
        }));

        send({
          type: "done",
          course: { title: courseTitle, description: courseDescription },
        });
      } catch (error: any) {
        console.error("❌ Erreur génération cours IA:", error.message);
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
