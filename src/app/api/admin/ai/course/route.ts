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

  const exercisesInstruction = includeExercises
    ? `═══ MINI-EXERCICES (OBLIGATOIRES) ═══
• Chaque leçon doit contenir 3 à 6 mini-exercices interactifs dans le tableau "exercises", au format : { "id": "ex-1", "question": "Énoncé clair (peut contenir du LaTeX inline avec $...$)", "type": "short_answer", "answer": "réponse exacte attendue (normalisée, simple, ex: \\"5/4\\", \\"12\\", \\"x=3\\")", "hint": "Indice utile sans donner la réponse", "explanation": "Explication courte de la solution avec les étapes" }.
• RÉPARTIS DANS LE COURS (pas regroupés à la fin) : dès qu'une notion/définition/méthode est expliquée dans "content", insère IMMÉDIATEMENT APRÈS un placeholder <div class="lesson-exercise" data-exercise-id="ex-1"></div> qui référence l'exercice correspondant par son "id", pour une application immédiate.
• Chaque placeholder doit correspondre à un "id" présent dans "exercises".`
    : `═══ MINI-EXERCICES ═══
• Laisse le tableau "exercises" vide ([]) et n'insère aucun placeholder "lesson-exercise".`;

  const programmeBlock = getProgrammePromptBlock(grade_level);

  const contextBlock = `═══ DOMAINE & NIVEAU ═══
• Domaine mathématique : ${subject_area || "Mathématiques générales"}
• Niveau scolaire visé : ${grade_level}
• Difficulté globale : ${difficulty || "medium"}

${programmeBlock ? programmeBlock + "\n" : ""}
═══ STYLE PÉDAGOGIQUE ═══
• ${styleInstruction}
• ${languageInstruction}`;

  // Instructions de l'enseignant = AUTORITÉ MAXIMALE. Placées en évidence pour
  // que l'IA couvre exactement le programme/contenu demandé.
  const teacherDirective = (additional_info && String(additional_info).trim())
    ? `═══ ⚠️ INSTRUCTIONS PRIORITAIRES DE L'ENSEIGNANT — À RESPECTER À LA LETTRE ═══
Ces consignes PRIMENT sur tout choix par défaut. Tu DOIS couvrir EXACTEMENT les notions, contenus, capacités attendues et démonstrations listés ci-dessous — sans rien ajouter hors-programme, sans rien omettre. Organise le cours et les chapitres pour traiter précisément, point par point, ce programme :

«««
${String(additional_info).trim()}
»»»

Vérifie en fin de rédaction que CHAQUE notion citée ci-dessus apparaît bien dans le cours.`
    : "";

  const lessonFormatBlock = `═══ EXIGENCES DE LONGUEUR (NON NÉGOCIABLES) ═══
• Chaque leçon doit contenir MINIMUM 600 mots, idéalement 800-1200 mots.
• Le chapitre doit contenir EXACTEMENT ${lessonsPerChapter} leçon(s).
• Chaque leçon doit inclure : théorie, exemples détaillés étape par étape, contre-exemples, erreurs fréquentes, exercices d'application résolus.
• duration = ${durationPerLesson} minutes pour chaque leçon.

═══ PÉDAGOGIE ═══
Commence toujours par une définition claire, avec un exemple simple, en expliquant au maximum. Utilise une méthodologie "pas à pas", interactive et ludique. Chaque méthode d'exercice doit être expliquée clairement, simplement, et idéalement illustrée d'un mini-exercice d'application direct. Ne parle jamais d'une notion mathématique hors-programme, et n'utilise pas en début de chapitre une notion difficile ou une notion qui ne sera vue qu'en fin de chapitre. Illustre ton contenu avec des schémas simples, des graphiques ou tableaux pour les fonctions.

⚠️ DÈS QU'UNE NOTION, UNE DÉFINITION OU UNE MÉTHODE EST EXPLIQUÉE dans "content", insère IMMÉDIATEMENT APRÈS un placeholder <div class="lesson-exercise" data-exercise-id="ex-N"></div> référençant un exercice du tableau "exercises", pour que l'élève s'exerce avant de passer à la suite. Ne regroupe PAS tous les exercices à la fin : répartis-les tout au long du "content", juste après chaque notion vue.

═══ STRUCTURE D'UNE LEÇON MODÈLE (chaque point = une section du "content", suivie d'un placeholder exercice si une notion vient d'être introduite) ═══
1. Introduction et contexte (pourquoi ce concept est important)
2. Définition(s) formelle(s) avec explications accessibles → placeholder exercice d'application immédiate
3. Propriétés et théorèmes avec démonstrations ou justifications → placeholder exercice
4. Exemples progressifs (simple → complexe) avec TOUTES les étapes de calcul → placeholder exercice après chaque exemple
5. Contre-exemples et pièges courants à éviter
6. Méthode de résolution pas à pas → placeholder exercice
7. Exercices d'application résolus (au moins 2)
8. Points-clés à retenir (résumé en bullets)

═══ DÉMONSTRATIONS (OBLIGATOIRE si listées au programme) ═══
Si le programme de l'enseignant mentionne une rubrique « Démonstrations » (ou des preuves à connaître), tu DOIS RÉDIGER CHAQUE DÉMONSTRATION INTÉGRALEMENT : preuve complète, rigoureuse, étape par étape, dans une section dédiée (<h4>Démonstration : …</h4>) de la leçon concernée. Ne te contente jamais d'énoncer le résultat ou de dire « on peut démontrer que » — écris la preuve en entier.

═══ FORMAT HTML + LATEX ═══
• HTML : <h3>, <h4>, <p>, <ul>/<li>, <strong>, <em>, <blockquote>, <table>
• LaTeX OBLIGATOIRE pour toutes les formules mathématiques.
• Inline : $formule$ — Bloc : $$formule$$
• N'utilise JAMAIS de retour à la ligne littéral à l'intérieur d'une chaîne JSON : écris le HTML sur une seule ligne (utilise <br> ou des balises pour la mise en forme, pas de \\n).
• DOUBLE-ÉCHAPPE les backslashes JSON : \\\\frac{a}{b} → donne \\frac{a}{b} dans le rendu
• N'utilise QUE des commandes LaTeX standards (lettres latines a-z/A-Z dans \\frac, \\sqrt, \\infty, \\theta, etc.) — n'écris JAMAIS de caractères cyrilliques ou non-latins à l'intérieur d'une formule $...$ ou $$...$$.
• Rédige UNIQUEMENT en français correct : relis chaque phrase, n'utilise aucun mot d'une autre langue (espagnol, anglais, etc.) ni de mot inventé/déformé.
• Chaque formule $...$ ou $$...$$ doit être correctement fermée AVANT toute balise HTML (<td>, </tr>, etc.) : ne mélange jamais du HTML à l'intérieur d'une formule LaTeX.

═══ TABLEAUX & GRAPHIQUES (à utiliser SI PERTINENT, sans en abuser) ═══
• Si la notion s'y prête (étude de fonction, signe, variations, tableau de valeurs, etc.), insère DIRECTEMENT dans "content" un tableau au format :
  <table class="math-table math-table-sign"><thead><tr><th>x</th>...</tr></thead><tbody><tr><td>...</td></tr></tbody></table>
  (classes possibles : math-table-value, math-table-sign, math-table-variation). Utilise ↗, ↘, +, -, 0, ∞, ‖ pour les signes/variations.
• Pour une courbe simple (fonction affine, second degré, etc.), insère un placeholder de graphique au format :
  <div class="math-graph-placeholder" data-function="x^2 - 2*x + 1" data-xmin="-5" data-xmax="5"></div>
  (un seul par leçon maximum, uniquement si visualiser la courbe aide vraiment à comprendre).
• N'insère ces éléments QUE quand ils apportent une vraie valeur pédagogique — la majorité des leçons n'en ont pas besoin.

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

${teacherDirective}

═══ RÉPARTITION DU CONTENU (ANTI-RÉPÉTITION) ═══
Découpe le sujet en chapitres aux PÉRIMÈTRES DISTINCTS et COMPLÉMENTAIRES : chaque notion n'est traitée que dans UN seul chapitre. Pour chaque chapitre, précise dans "scope" la liste EXACTE des notions/contenus qu'il couvre (et lui seul).
Tu dois répartir l'INTÉGRALITÉ du programme demandé entre les chapitres SANS rien oublier ni dupliquer : les Contenus, les Capacités attendues, les Démonstrations, les Exemples d'algorithme et les Approfondissements éventuels doivent TOUS être assignés à un chapitre via son "scope".

═══ JSON STRICT ═══
Réponds UNIQUEMENT avec le JSON ci-dessous, sans texte avant ni après.
{
  "title": "Titre complet et précis du cours",
  "description": "Description pédagogique détaillée (3-4 phrases)",
  "chapters": [
    { "title": "Titre du chapitre 1", "scope": "Notions précises traitées dans CE chapitre uniquement (distinctes des autres), incl. les démonstrations et algorithmes assignés à ce chapitre" }
  ]
}
Le tableau "chapters" doit contenir EXACTEMENT ${nbChapitres} chapitre(s), avec une progression pédagogique cohérente (du plus simple au plus complexe).`;

        const outlineUser = `Crée le plan d'un cours de mathématiques sur "${subject}" pour le niveau ${grade_level}, avec ${nbChapitres} chapitre(s).
${additional_info ? "⚠️ Respecte IMPÉRATIVEMENT les INSTRUCTIONS PRIORITAIRES DE L'ENSEIGNANT ci-dessus : couvre exactement le programme demandé, notion par notion." : ""}`;

        const outline = (await generateStructuredContent(outlineUser, outlineSystem, 0.6)) as {
          title?: string;
          description?: string;
          chapters?: { title?: string; scope?: string }[];
        };

        const courseTitle = outline?.title || subject;
        const courseDescription = outline?.description || "";
        const rawChapters = (outline?.chapters || [])
          .filter((c) => !!c?.title)
          .slice(0, nbChapitres);
        let chapterTitles = rawChapters.map((c) => c!.title as string);
        const chapterScopes = rawChapters.map((c) => c?.scope || "");

        // Sécurité : si l'IA n'a pas renvoyé assez de chapitres, on complète
        while (chapterTitles.length < nbChapitres) {
          chapterTitles.push(`${subject} — partie ${chapterTitles.length + 1}`);
          chapterScopes.push("");
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
${chapterScopes[i] ? `• ⚠️ PÉRIMÈTRE DE CE CHAPITRE (traite UNIQUEMENT ces notions) : ${chapterScopes[i]}` : ""}
• Périmètre des AUTRES chapitres — NE LES RÉ-EXPLIQUE PAS, n'empiète pas dessus :
${chapterTitles.map((t, idx) => idx === i ? null : `   ${idx + 1}. ${t}${chapterScopes[idx] ? ` → ${chapterScopes[idx]}` : ""}`).filter(Boolean).join("\n")}
• RÈGLE ANTI-RÉPÉTITION STRICTE : ne traite QUE les notions de TON périmètre. Si une notion relève d'un autre chapitre, fais-y au plus une brève référence sans la redévelopper. Ne réintroduis pas les définitions/propriétés déjà attribuées à un autre chapitre.

${lessonFormatBlock}

${teacherDirective}

═══ JSON STRICT ═══
Réponds UNIQUEMENT avec le JSON ci-dessous, sans texte avant ni après.
{
  "title": "${chapterTitle.replace(/"/g, '\\"')}",
  "lessons": [
    {
      "title": "Titre précis de la leçon",
      "type": "text",
      "content": "Contenu HTML très riche (600-1200 mots), avec des placeholders <div class=\\"lesson-exercise\\" data-exercise-id=\\"ex-N\\"></div> insérés juste après chaque notion/définition/méthode",
      "duration": ${durationPerLesson},
      "exercises": [
        { "id": "ex-1", "question": "Énoncé (LaTeX inline $...$ possible)", "type": "short_answer", "answer": "réponse courte normalisée", "hint": "Indice", "explanation": "Explication avec étapes" }
      ]
    }
  ]
}`;

          const chapterUser = `Rédige le chapitre "${chapterTitle}" du cours "${courseTitle}" (niveau ${grade_level}).
Le tableau "lessons" doit contenir EXACTEMENT ${lessonsPerChapter} leçon(s), chacune ${durationPerLesson} minutes.
Chaque leçon doit avoir un "content" HTML riche (600-1200 mots au total), ${includeExercises ? `et un tableau "exercises" de 3 à 6 mini-exercices (type "short_answer"), avec un placeholder <div class="lesson-exercise" data-exercise-id="..."></div> inséré dans "content" juste après chaque notion expliquée` : `et un tableau "exercises" vide`}.
${additional_info ? "⚠️ Respecte IMPÉRATIVEMENT les INSTRUCTIONS PRIORITAIRES DE L'ENSEIGNANT ci-dessus : couvre exactement le programme demandé, notion par notion." : ""}
Chaque leçon doit être un vrai cours magistral, pas un résumé.`;

          const chapterData = (await generateStructuredContent(chapterUser, chapterSystem, 0.65, 16000)) as {
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
