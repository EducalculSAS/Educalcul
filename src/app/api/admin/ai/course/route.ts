import katex from "katex";
import { generateStructuredContent } from "@/lib/llm";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { getProgrammePromptBlock } from "@/lib/programmes-nationaux";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { requireRole } from "@/lib/apiAuth";
import {
  AI_COURSE_FORMAT_RULES,
  AI_COURSE_PEDAGOGY_RULES,
  normalizeGeneratedCourseChapter,
  repairLessonExercisePlaceholders,
} from "@/lib/aiCourseContent";

type GeneratedCourseLesson = {
  id?: string;
  title?: string;
  type?: string;
  content?: string;
  duration?: number;
  exercises?: unknown[];
} & Record<string, unknown>;

type GeneratedCourseChapter = {
  title?: string;
  lessons?: GeneratedCourseLesson[];
} & Record<string, unknown>;

// Un lesson est "valide" si ses champs de base sont là. Les problèmes de
// LaTeX ne sont plus un motif de rejet de la leçon entière : normalizeGeneratedCourseChapter
// répare déjà les erreurs de délimitation les plus courantes (repairLatex),
// et le rendu client (katexLoader.ts) dégrade proprement toute formule encore
// mal formée (texte brut lisible, jamais d'erreur technique affichée). Rejeter
// toute la leçon pour une seule formule imparfaite perdait un contenu par
// ailleurs correct et déclenchait des relances en cascade, parfois jusqu'à
// l'échec complet de la génération.
function isValidGeneratedCourseLesson(lesson: unknown): lesson is GeneratedCourseLesson {
  if (typeof lesson !== "object" || lesson === null) return false;
  const candidate = lesson as GeneratedCourseLesson;
  if (typeof candidate.title !== "string" || candidate.title.trim().length === 0) return false;
  if (typeof candidate.content !== "string" || candidate.content.trim().length === 0) return false;
  if (typeof candidate.duration !== "number" || candidate.duration <= 0) return false;
  return true;
}

function isRenderableMath(math: string): boolean {
  try {
    katex.renderToString(math.trim(), { throwOnError: true, strict: false });
    return true;
  } catch {
    return false;
  }
}

/** Log un avertissement (sans jamais rejeter la leçon) si une formule $...$/$$...$$
 * reste illisible pour KaTeX après réparation — utile pour surveiller la
 * fréquence réelle du problème sans dégrader la génération pour l'élève. */
function warnIfUnrenderableMath(title: string, html: string): void {
  const blocks: string[] = [];
  html.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => { blocks.push(math); return _; });
  html.replace(/\$([^\$\r\n]+?)\$/g, (_, math) => { blocks.push(math); return _; });
  const bad = blocks.filter((b) => b.trim() && !isRenderableMath(b));
  if (bad.length > 0) {
    console.warn(`[course-ai] Formule(s) LaTeX non rendue(s) par KaTeX dans "${title}" (repli texte brut côté client) :`, bad);
  }
}

function cleanupGeneratedCourseChapter(chapter: GeneratedCourseChapter, expectedLessonCount: number): GeneratedCourseChapter {
  if (!chapter || !Array.isArray(chapter.lessons)) {
    return { ...chapter, lessons: [] };
  }

  const validLessons = chapter.lessons.filter(isValidGeneratedCourseLesson).map((lesson) => {
    if (typeof lesson.content === "string") {
      warnIfUnrenderableMath(lesson.title || "?", lesson.content);
      return { ...lesson, content: repairLessonExercisePlaceholders(lesson.content, getLessonExerciseIds(lesson)) };
    }
    return lesson;
  });

  return { ...chapter, lessons: validLessons.slice(0, expectedLessonCount) };
}

function getLessonExerciseIds(lesson: GeneratedCourseLesson): string[] {
  if (!Array.isArray(lesson.exercises)) return [];
  return lesson.exercises
    .map((exercise) => {
      if (typeof exercise !== "object" || exercise === null) return "";
      const candidate = exercise as Record<string, unknown>;
      return typeof candidate.id === "string" ? candidate.id : "";
    })
    .filter(Boolean);
}

/** Seule règle dure qui reste sur les exercices : si includeExercises est
 * vrai, chaque leçon doit avoir AU MOINS un exercice. Le nombre exact
 * (3 à 6 dans la consigne) et la correspondance avec les placeholders ne
 * sont plus des motifs de rejet — repairLessonExercisePlaceholders répare
 * déjà les décalages (placeholder manquant ajouté, orphelin retiré). */
function chapterExercisesAreValid(chapter: GeneratedCourseChapter, includeExercises: boolean): boolean {
  if (!chapter || !Array.isArray(chapter.lessons) || chapter.lessons.length === 0) return false;
  if (!includeExercises) return true;
  return chapter.lessons.every((lesson) => getLessonExerciseIds(lesson).length > 0);
}

/** Compte approximatif de mots d'un contenu HTML : retire les balises et les
 * commandes LaTeX (qui gonflent artificiellement le nombre de "mots" sans
 * ajouter de texte réellement lu par l'élève). */
function approximateWordCount(html: string): number {
  const withoutTags = html.replace(/<[^>]+>/g, " ");
  const withoutLatexCommands = withoutTags.replace(/\\[a-zA-Z]+|\$/g, " ");
  const words = withoutLatexCommands.split(/\s+/).filter(Boolean);
  return words.length;
}

/** Le prompt demande un minimum de 600 mots par leçon, mais un modèle plus
 * faible ne le respecte pas toujours de lui-même (observé : leçons à moins de
 * 300-450 mots). Un contenu significativement en dessous du minimum déclenche
 * la même relance qu'un problème structurel, quel que soit le thème du cours —
 * ce n'est pas au prompt seul de garantir la longueur. */
const MIN_LESSON_WORDS = 450;
function chapterLessonsAreLongEnough(chapter: GeneratedCourseChapter): boolean {
  if (!chapter || !Array.isArray(chapter.lessons) || chapter.lessons.length === 0) return false;
  return chapter.lessons.every(
    (lesson) => typeof lesson.content === "string" && approximateWordCount(lesson.content) >= MIN_LESSON_WORDS,
  );
}

export const maxDuration = 300; // 5 min — génération de cours complète

export async function POST(request: Request) {
  // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const config = RATE_LIMITS["ai:admin"];
  const rl = await rateLimitWithBackoff(
    `ai:admin:${ip}`,
    config.maxAttempts,
    config.windowMs,
  );
  if (!rl.allowed) {
    return Response.json(
      { error: "Trop de générations IA, réessaie dans quelques minutes." },
      { status: 429 },
    );
  }

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
      { status: 400 },
    );
  }

  const clampNumber = (
    value: string | number | undefined,
    fallback: number,
    min: number,
    max: number,
  ) => {
    const parsed = typeof value === "string" ? parseInt(value, 10) : typeof value === "number" ? value : NaN;
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };
 
  const nbChapitres = clampNumber(page_count, 4, 1, 8);
  const lessonsPerChapter = clampNumber(lessons_per_chapter, 3, 1, 6);
  const durationPerLesson = clampNumber(duration_per_lesson, 30, 5, 90);
  const includeExercises = include_exercises !== false;
  const style: "balanced" | "theory_heavy" | "practice_heavy" =
    content_style || "balanced";
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
• RÉPARTIS DANS LE COURS (pas regroupés à la fin) : dès qu'une notion/définition/méthode est expliquée dans "content", insère IMMÉDIATEMENT APRÈS un placeholder <div class="lesson-exercise" data-exercise-id="ex-1"></div> qui référence l'exercice correspondant par son "id", pour une application immédiate. Le premier exercice ne doit JAMAIS apparaître avant une explication ou un exemple guidé.
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
  const teacherDirective =
    additional_info && String(additional_info).trim()
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
• Ne génère jamais plus ou moins de leçons que demandé. Si une leçon n'a pas de titre, de contenu ou de durée valide, considère-la invalide et ne la crée pas.
• Si une représentation visuelle est utile (fractions, signes, variations, droites, aires), insère au moins un tableau ou un SVG explicatif sobre dans le chapitre.
• Si includeExercises est vrai, chaque leçon doit avoir 3 à 6 mini-exercices réels dans "exercises" ; ne laisse jamais ce tableau vide.

═══ PÉDAGOGIE ═══
${AI_COURSE_PEDAGOGY_RULES}

Commence toujours par une définition claire, avec un exemple simple, en expliquant au maximum. Utilise une méthodologie "pas à pas", interactive et ludique. Chaque méthode d'exercice doit être expliquée clairement, simplement, et idéalement illustrée d'un mini-exercice d'application direct. Ne parle jamais d'une notion mathématique hors-programme, et n'utilise pas en début de chapitre une notion difficile ou une notion qui ne sera vue qu'en fin de chapitre. Utilise les outils visuels du cours : tableaux, graphiques, figures, encadrés et placeholders, lorsque cela clarifie la notion. Le design doit rester sobre et mathématique.

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

${AI_COURSE_FORMAT_RULES}

${exercisesInstruction}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      try {
        // ── Étape 1 : plan du cours (titre, description, titres des chapitres) ──
        send({
          type: "progress",
          step: "outline",
          current: 0,
          total: nbChapitres,
          message: "Élaboration du plan du cours...",
        });

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

        const outline = (await generateStructuredContent(
          outlineUser,
          outlineSystem,
          0.6,
        )) as {
          title?: string;
          description?: string;
          chapters?: { title?: string; scope?: string }[];
        };

        const courseTitle = outline?.title || subject;
        const courseDescription = outline?.description || "";
        const rawChapters = (outline?.chapters || [])
          .filter((c) => !!c?.title)
          .slice(0, nbChapitres);
        const chapterTitles = rawChapters.map((c) => c!.title as string);
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
        const chapterResults = await Promise.allSettled(
          chapterTitles.map(async (chapterTitle, i) => {
            const chapterSystem = `Tu es un expert pédagogue en mathématiques pour Educalcul, une plateforme éducative française.
Ta mission : rédiger un chapitre COMPLET, RIGOUREUX et APPROFONDI d'un cours magistral, comme un manuel scolaire de référence.

${contextBlock}

═══ CONTEXTE DU COURS ═══
• Cours : "${courseTitle}"
• ${courseDescription}
• Ce chapitre (${i + 1}/${chapterTitles.length}) : "${chapterTitle}"
${chapterScopes[i] ? `• ⚠️ PÉRIMÈTRE DE CE CHAPITRE (traite UNIQUEMENT ces notions) : ${chapterScopes[i]}` : ""}
• Périmètre des AUTRES chapitres — NE LES RÉ-EXPLIQUE PAS, n'empiète pas dessus :
${chapterTitles
  .map((t, idx) =>
    idx === i
      ? null
      : `   ${idx + 1}. ${t}${chapterScopes[idx] ? ` → ${chapterScopes[idx]}` : ""}`,
  )
  .filter(Boolean)
  .join("\n")}
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
Ne génère jamais de leçons vides ou incomplètes : chaque leçon doit avoir un titre, un contenu et une durée valides.
Si includeExercises est vrai, ne laisse jamais le tableau "exercises" vide et assure-toi que chaque placeholder corresponde à un "id" réel.
${additional_info ? "⚠️ Respecte IMPÉRATIVEMENT les INSTRUCTIONS PRIORITAIRES DE L'ENSEIGNANT ci-dessus : couvre exactement le programme demandé, notion par notion." : ""}
Chaque leçon doit être un vrai cours magistral, pas un résumé.`;

            type GeneratedChapter = {
              title?: string;
              lessons?: Array<{ content?: string } & Record<string, unknown>>;
            };

            const rawChapterData = normalizeGeneratedCourseChapter((await generateStructuredContent(
              chapterUser,
              chapterSystem,
              0.65,
              28000,
            )) as GeneratedChapter);
            let chapterData = cleanupGeneratedCourseChapter(rawChapterData, lessonsPerChapter);

            // Une seule relance, si le nombre de leçons, les exercices ou la
            // longueur ne sont pas conformes. Au-delà, on publie le meilleur
            // résultat obtenu plutôt que de faire échouer tout le cours : une
            // leçon manquante, un exercice en moins ou une leçon un peu courte
            // n'empêche pas de publier les autres, et le rendu client dégrade
            // déjà proprement toute formule mal formée résiduelle (jamais
            // d'erreur affichée).
            const lessonsTooShort = !chapterLessonsAreLongEnough(chapterData);
            const needsRetry =
              (chapterData.lessons?.length || 0) < lessonsPerChapter ||
              !chapterExercisesAreValid(chapterData, includeExercises) ||
              lessonsTooShort;
            if (needsRetry) {
              const retryHint = `La réponse précédente ne respectait pas exactement ce qui était demandé (nombre de leçons, leçons vides, mini-exercices manquants, ou leçons trop courtes). Renvoie un chapitre JSON valide avec EXACTEMENT ${lessonsPerChapter} leçon(s) valides (titre, contenu, durée)${includeExercises ? ", chacune avec 3 à 6 mini-exercices réels dans \"exercises\" et leurs placeholders correspondants dans \"content\"" : ""}.${lessonsTooShort ? " IMPORTANT : chaque leçon doit contenir AU MOINS 600 mots de contenu réel (hors code HTML/LaTeX) — développe davantage les explications, exemples et démonstrations." : ""}`;
              const retryChapterData = normalizeGeneratedCourseChapter((await generateStructuredContent(
                `${chapterUser}\n\n${retryHint}`,
                chapterSystem,
                0.65,
                28000,
              )) as GeneratedChapter);
              const retried = cleanupGeneratedCourseChapter(retryChapterData, lessonsPerChapter);
              // On garde la relance si elle a au moins autant de leçons ET
              // (elle règle le problème de longueur, ou l'essai initial
              // n'avait de toute façon pas ce problème à régler).
              const retriedLongEnough = chapterLessonsAreLongEnough(retried);
              if (
                (retried.lessons?.length || 0) >= (chapterData.lessons?.length || 0) &&
                (retriedLongEnough || !lessonsTooShort)
              ) {
                chapterData = retried;
              }
            }

            if ((chapterData.lessons?.length || 0) === 0) {
              throw new Error(`Le chapitre "${chapterTitle}" n'a produit aucune leçon valide.`);
            }

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
            return true;
          }),
        );

        // Un chapitre en échec ne doit pas emporter tout le cours : avec
        // Promise.all, la première erreur rejetait l'ensemble et le cours
        // n'arrivait qu'avec les chapitres déjà émis (d'où "2 chapitres
        // demandés, 1 seul reçu"). On isole donc chaque chapitre et on
        // signale précisément ceux qui ont échoué, une fois les autres livrés.
        const failed = chapterResults
          .map((r, idx) => (r.status === "rejected" ? chapterTitles[idx] : null))
          .filter(Boolean) as string[];

        if (failed.length === chapterTitles.length) {
          throw new Error(
            `Aucun chapitre n'a pu être généré. Réessaie, éventuellement avec moins de leçons par chapitre.`,
          );
        }

        send({
          type: "done",
          course: { title: courseTitle, description: courseDescription },
          ...(failed.length > 0
            ? {
                warning: `${failed.length} chapitre(s) n'ont pas pu être générés et sont absents : ${failed.join(", ")}. Les autres ont bien été créés — tu peux relancer la génération ou les ajouter à la main.`,
              }
            : {}),
        });
      } catch (error: unknown) {
        console.error("❌ Erreur génération cours IA:", error);
        send({
          type: "error",
          message: sanitizeErrorMessage(
            error instanceof Error ? error.message : "Erreur de génération",
          ),
        });
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
