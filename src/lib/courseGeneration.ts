import { getProgrammePromptBlock } from "@/lib/programmes-nationaux";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { auditLog, AuditAction } from "@/lib/auditLog";
import {
  createGenerationTracker,
  createLlmStartGate,
  DEFAULT_LLM_MIN_START_INTERVAL_MS,
  GenerationCancelledError,
} from "@/lib/backgroundGeneration";
import {
  COURSE_BLOCK_SCHEMA_PROMPT,
  RICH_TEXT_SCHEMA_PROMPT,
  STRUCTURED_MATH_OUTPUT_RULES,
  normalizeStructuredCourseChapter,
  repairInvalidStructuredMath,
  type StructuredCourseChapter,
  type StructuredCourseExercise,
} from "@/lib/ai/structuredContent";
import {
  courseChapterSchema,
  courseOutlineSchema,
} from "@/lib/ai/schemas";
import {
  compileStructuredCourseChapter,
  type CompiledCourseChapter,
  type CompiledCourseLesson,
} from "@/lib/ai/compiler";
import {
  auditStructuredCoursePedagogy,
  courseTargetWordRange,
  formatStructuredQualityIssues,
  normalizeStructuredCoursePedagogy,
  structuredCourseQualityScore,
  structuredLessonWordCount,
  topicRequiresFunctionGraph,
} from "@/lib/ai/pedagogy";

export type CourseGenerationParams = {
  grade_level: string;
  subject: string;
  additional_info?: string;
  page_count?: string | number;
  chapter_count?: string | number;
  lessons_per_chapter?: string | number;
  lesson_count?: string | number;
  content_style?: "balanced" | "theory_heavy" | "practice_heavy";
  include_exercises?: boolean;
  language_level?: "simple" | "standard" | "academic";
  subject_area?: string;
  duration_per_lesson?: string | number;
  difficulty?: string;
  quality_mode?: "fast" | "balanced" | "strict";
  folder_id?: number | null;
};

export type GenerationProgress = {
  step: "outline" | "chapter" | "final-check";
  current: number;
  total: number;
  message: string;
  chapterTitles?: string[];
  chapters?: Record<number, { title: string; lessons: CompiledCourseLesson[] }>;
};

type CourseOutline = {
  title?: string;
  description?: string;
  chapters?: Array<{ title?: string; scope?: string }>;
};

function clampNumber(
  value: string | number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, Math.trunc(parsed)))
    : fallback;
}

function cleanPlain(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim()
    ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    : fallback;
}

function isCompleteCourseExercise(exercise: StructuredCourseExercise): boolean {
  return (
    exercise.question.parts.length > 0 &&
    exercise.answer.parts.length > 0 &&
    exercise.hint.parts.length > 0 &&
    exercise.explanation.parts.length > 0
  );
}

function hasEnoughStructuredLessons(
  chapter: StructuredCourseChapter,
  expectedLessons: number,
  includeExercises: boolean,
): boolean {
  if (chapter.lessons.length !== expectedLessons) return false;
  return chapter.lessons.every(
    (lesson) =>
      lesson.blocks.length > 0 &&
      (!includeExercises ||
        (lesson.exercises.length >= 3 &&
          lesson.exercises.every(isCompleteCourseExercise))),
  );
}

function styleInstruction(
  style: CourseGenerationParams["content_style"],
): string {
  if (style === "theory_heavy") {
    return "Style théorique : définitions rigoureuses, propriétés, démonstrations et profondeur conceptuelle, avec quelques exemples ciblés.";
  }
  if (style === "practice_heavy") {
    return "Style pratique : méthodes pas à pas, exemples nombreux et applications immédiates, avec la théorie strictement nécessaire.";
  }
  return "Style équilibré : alterne théorie, exemples guidés et applications de façon régulière.";
}

function languageInstruction(
  level: CourseGenerationParams["language_level"],
): string {
  if (level === "simple") {
    return "Vocabulaire simple : phrases courtes, chaque terme technique expliqué au premier emploi.";
  }
  if (level === "academic") {
    return "Vocabulaire académique : terminologie mathématique précise, style formel et démonstrations explicites.";
  }
  return "Vocabulaire scolaire standard : rigoureux, clair et accessible.";
}

function exerciseSchema(includeExercises: boolean): string {
  if (!includeExercises) {
    return `Le tableau "exercises" de chaque leçon est exactement []. Aucun bloc de type "exercise" n'est présent.`;
  }
  return `Chaque leçon contient 3 à 4 exercices. Un exercice respecte exactement :
{
  "question": RICH_TEXT,
  "answer": RICH_TEXT,
  "hint": RICH_TEXT,
  "explanation": RICH_TEXT
}
Les exercices n'ont aucun id. Dans les blocs de la leçon, place un bloc {"type":"exercise","exercise_index":1}, puis 2, 3... juste après la notion correspondante. Chaque index est utilisé une seule fois.
Le champ question contient uniquement l'énoncé : jamais la réponse, jamais une correction, jamais une phrase qui donne directement le résultat attendu.
Le champ answer contient uniquement la réponse finale attendue. Le champ hint aide sans donner cette réponse. Le champ explanation contient une solution propre et se termine par une conclusion compatible avec answer.
La réponse et la dernière conclusion de l'explication doivent être mathématiquement identiques. Ne conserve jamais une autocorrection du type « erreur », « recalculons », « en fait » ou « réponse correcte ».`;
}

function buildChapterSystemPrompt(options: {
  courseTitle: string;
  chapterTitle: string;
  chapterScope: string;
  chapterIndex: number;
  chapterCount: number;
  chapterTitles: string[];
  gradeLevel: string;
  subject: string;
  subjectArea: string;
  difficulty: string;
  lessonsPerChapter: number;
  durationPerLesson: number;
  includeExercises: boolean;
  style: CourseGenerationParams["content_style"];
  language: CourseGenerationParams["language_level"];
  programmeBlock: string;
  teacherDirective: string;
  targetWords: { min: number; max: number };
  requireGraph: boolean;
}): string {
  const otherChapters = options.chapterTitles
    .map((title, index) => `${index + 1}. ${title}`)
    .join("\n");

  return `Tu es un professeur de mathématiques expert pour Educalcul.
Tu rédiges le chapitre ${options.chapterIndex + 1}/${options.chapterCount} du cours « ${options.courseTitle} ».
Niveau : ${options.gradeLevel}.
Matière : ${options.subjectArea || options.subject}.
Difficulté : ${options.difficulty}.
Chapitre à rédiger : ${options.chapterTitle}.
${options.chapterScope ? `Périmètre strict de ce chapitre : ${options.chapterScope}.` : ""}

Plan complet du cours — ne duplique pas les notions réservées aux autres chapitres :
${otherChapters}

${options.programmeBlock}
${styleInstruction(options.style)}
${languageInstruction(options.language)}
${options.teacherDirective}

${STRUCTURED_MATH_OUTPUT_RULES}

${RICH_TEXT_SCHEMA_PROMPT}

${COURSE_BLOCK_SCHEMA_PROMPT}

═══ EXIGENCES PÉDAGOGIQUES ═══
• CONTRAINTE BLOQUANTE : retourne exactement ${options.lessonsPerChapter} leçon(s), ni plus ni moins, chacune avec duration = ${options.durationPerLesson}. Ne crée jamais un chapitre ou une leçon supplémentaire pour augmenter la longueur : développe les leçons demandées.
• Chaque leçon contient entre ${options.targetWords.min} et ${options.targetWords.max} mots utiles de contenu pédagogique, hors exercices. Une leçon courte ou réduite à un tableau est interdite.
• Ordre obligatoire dans chaque leçon : définition ou mise en contexte claire → explication approfondie → méthode ou dérivation expliquée → application élève → approfondissement → synthèse.
• N'écris jamais de section intitulée « exercice résolu », « exercice corrigé » ou « exemple guidé » juste avant un exercice élève. Une méthode peut être expliquée avec des calculs, mais sans reproduire le format question puis correction.
• Le premier bloc exercise arrive seulement après au moins trois vrais blocs pédagogiques. Jamais d'exercice en ouverture.
• Chaque exercice vérifie immédiatement une notion expliquée juste avant lui ; ne regroupe pas tous les exercices à la fin.
• Une démonstration de 3 étapes ou plus utilise un bloc "steps". Limite : un ou deux blocs steps par chapitre.
• Le chapitre contient au moins un vrai élément visuel structuré et utile parmi "table", "sign_table", "variation_table", "graph" ou "figure".
• Utilise un visuel dans chaque leçon quand la notion s'y prête, sans en ajouter artificiellement. Varie les outils au lieu de répéter le même type.
• Une courbe de fonction passe toujours par un bloc "graph", jamais par un bloc "figure".
• ${options.requireGraph ? 'Ce sujet étudie une fonction ou ses variations : le chapitre contient obligatoirement au moins un bloc "graph".' : 'Si le chapitre étudie une fonction, une famille de fonctions, une dérivée ou des variations, ajoute au moins un bloc "graph".'}
• Un tableau de variations utilise exclusivement "variation_table" et s'accompagne d'un bloc "graph" dans le chapitre. N'utilise jamais un tableau générique pour représenter des variations.
• Un tableau de signes utilise exclusivement "sign_table". Un tableau générique "table" sert seulement aux valeurs et comparaisons.
• Le bloc "figure" produit uniquement un SVG d'illustration : schéma géométrique, camembert, diagramme, aire, fraction, frise ou processus. Il ne trace jamais une courbe, un repère fonctionnel ou une famille de fonctions.
• Toute courbe mathématique utilise exclusivement "graph" afin d'être rendue par mathGraph.
• Réserve les callouts aux définitions, résultats clés et mises en garde.
• N'utilise aucun exemple de physique, chimie, biologie ou informatique sauf demande explicite de l'enseignant.
• Aucune phrase complète ne doit être stockée dans un champ latex.
• Recalcule tous les exemples et tous les exercices avant de répondre.

${exerciseSchema(options.includeExercises)}

Structure JSON exacte :
{
  "title": "Titre du chapitre",
  "lessons": [
    {
      "title": "Titre de la leçon",
      "duration": ${options.durationPerLesson},
      "blocks": [BLOCS_STRUCTURÉS],
      "exercises": [EXERCICES_STRUCTURÉS]
    }
  ]
}

Réponds uniquement avec ce JSON, sans HTML, sans Markdown et sans commentaire.`;
}

export async function runCourseGeneration(
  generationId: string,
  params: CourseGenerationParams,
  adminId: number,
): Promise<void> {
  const tracker = createGenerationTracker("course_generations", generationId);
  const {
    grade_level,
    subject,
    additional_info,
    page_count,
    chapter_count,
    lessons_per_chapter,
    lesson_count,
    content_style = "balanced",
    include_exercises,
    language_level = "standard",
    subject_area,
    duration_per_lesson,
    difficulty = "medium",
    quality_mode = "balanced",
    folder_id,
  } = params;

  const chapterCount = clampNumber(page_count ?? chapter_count, 4, 1, 8);
  const lessonsPerChapter = clampNumber(lessons_per_chapter ?? lesson_count, 3, 1, 6);
  const durationPerLesson = clampNumber(duration_per_lesson, 30, 5, 90);
  const targetWords = courseTargetWordRange(durationPerLesson);
  const includeExercises = include_exercises !== false;
  const configuredInterval = Number(process.env.MISTRAL_MIN_REQUEST_INTERVAL_MS);
  const minInterval =
    Number.isFinite(configuredInterval) && configuredInterval >= 0
      ? configuredInterval
      : DEFAULT_LLM_MIN_START_INTERVAL_MS;
  const generate = createLlmStartGate(minInterval, () => tracker.isCancelRequested());
  const programmeBlock = getProgrammePromptBlock(String(grade_level));
  const teacherDirective = additional_info?.trim()
    ? `Instructions prioritaires de l'enseignant :\n${additional_info.trim()}`
    : "";

  try {
    await tracker.setStatus("running");
    await tracker.updateProgress({
      step: "outline",
      current: 0,
      total: chapterCount,
      message: "Élaboration du plan du cours...",
    });

    const outlineSystem = `Tu conçois le plan d'un cours de mathématiques français pour le niveau ${grade_level}.
${programmeBlock}
Retourne uniquement un JSON valide sans HTML, sans Markdown et sans LaTeX :
{"title":"...","description":"...","chapters":[{"title":"...","scope":"notions exactes de ce chapitre"}]}
Le tableau chapters contient exactement ${chapterCount} chapitres distincts, progressifs et sans répétition.`;
    const outlineUser = `Sujet : ${subject}
Domaine : ${subject_area || "Mathématiques"}
Difficulté : ${difficulty}
${teacherDirective}`;
    const outline = (await generate(
      outlineUser,
      outlineSystem,
      courseOutlineSchema(chapterCount),
      0.3,
      4_000,
      false,
    )) as CourseOutline;

    const courseTitle = cleanPlain(outline.title, `Cours : ${subject}`);
    const courseDescription = cleanPlain(
      outline.description,
      `Cours complet sur ${subject}.`,
    );
    const rawChapters = Array.isArray(outline.chapters) ? outline.chapters : [];
    const chapterTitles: string[] = [];
    const chapterScopes: string[] = [];
    for (let index = 0; index < chapterCount; index += 1) {
      const candidate = rawChapters[index];
      chapterTitles.push(
        cleanPlain(candidate?.title, `${subject} — partie ${index + 1}`),
      );
      chapterScopes.push(cleanPlain(candidate?.scope));
    }

    await tracker.updateProgress({
      step: "chapter",
      current: 0,
      total: chapterCount,
      message: `Rédaction des ${chapterCount} chapitre(s) en parallèle...`,
      chapterTitles,
    });

    let completed = 0;
    const chapterMaxTokens = Math.min(
      24_000,
      Math.max(
        12_000,
        lessonsPerChapter * 5_200 + (includeExercises ? 2_800 : 0),
      ),
    );

    const results = await Promise.allSettled(
      chapterTitles.map(async (chapterTitle, chapterIndex) => {
        const requireGraph = topicRequiresFunctionGraph(
          subject,
          subject_area || "",
          chapterTitle,
          chapterScopes[chapterIndex],
        );
        const qualityOptions = {
          expectedLessonCount: lessonsPerChapter,
          includeExercises,
          minWordsPerLesson: targetWords.min,
          requireGraph,
        };
        const systemPrompt = buildChapterSystemPrompt({
          courseTitle,
          chapterTitle,
          chapterScope: chapterScopes[chapterIndex],
          chapterIndex,
          chapterCount,
          chapterTitles,
          gradeLevel: String(grade_level),
          subject,
          subjectArea: subject_area || "Mathématiques",
          difficulty,
          lessonsPerChapter,
          durationPerLesson,
          includeExercises,
          style: content_style,
          language: language_level,
          programmeBlock,
          teacherDirective,
          targetWords,
          requireGraph,
        });
        const userPrompt = `Rédige maintenant le chapitre « ${chapterTitle} » du cours « ${courseTitle} ».
Respecte exactement le format structuré demandé et le périmètre de ce chapitre.`;

        let raw = await generate(
          userPrompt,
          systemPrompt,
          courseChapterSchema({
            lessonCount: lessonsPerChapter,
            includeExercises,
            minExercises: 3,
            maxExercises: 4,
          }),
          0.2,
          chapterMaxTokens,
          false,
        );
        let structured = normalizeStructuredCoursePedagogy(
          normalizeStructuredCourseChapter(raw, {
            expectedLessonCount: lessonsPerChapter,
            durationPerLesson,
            includeExercises,
            maxExercisesPerLesson: 4,
          }),
        );
        let issues = auditStructuredCoursePedagogy(structured, qualityOptions);
        let bestScore = structuredCourseQualityScore(structured, qualityOptions);

        if (
          !hasEnoughStructuredLessons(
            structured,
            lessonsPerChapter,
            includeExercises,
          ) ||
          issues.some((issue) => issue.severity === "error")
        ) {
          const issueSummary = formatStructuredQualityIssues(issues);
          raw = await generate(
            `${userPrompt}\n\nLa sortie précédente ne respecte pas le contrat de qualité. Corrige TOUS les points suivants sans raccourcir les autres parties :\n${issueSummary || "Structure incomplète."}\n\nRenvoie de nouveau le chapitre complet : exactement ${lessonsPerChapter} leçons, chacune entre ${targetWords.min} et ${targetWords.max} mots utiles${includeExercises ? ", avec 3 à 4 exercices placés après les notions expliquées" : ", sans exercice"}. Utilise les blocs structurés dédiés aux tableaux de signes, variations, graphes et figures.`,
            systemPrompt,
            courseChapterSchema({
              lessonCount: lessonsPerChapter,
              includeExercises,
              minExercises: 3,
              maxExercises: 4,
            }),
            0.08,
            chapterMaxTokens,
            false,
          );
          const retry = normalizeStructuredCoursePedagogy(
            normalizeStructuredCourseChapter(raw, {
              expectedLessonCount: lessonsPerChapter,
              durationPerLesson,
              includeExercises,
              maxExercisesPerLesson: 4,
            }),
          );
          const retryScore = structuredCourseQualityScore(retry, qualityOptions);
          if (retryScore > bestScore) {
            structured = retry;
            bestScore = retryScore;
            issues = auditStructuredCoursePedagogy(structured, qualityOptions);
          }
        }

        if (structured.lessons.length === 0) {
          throw new Error(`Le chapitre « ${chapterTitle} » n'a produit aucune leçon.`);
        }

        const repaired = await repairInvalidStructuredMath(structured, {
          generate,
          label: `cours ${courseTitle}, chapitre ${chapterTitle}`,
          enableModelRepair: quality_mode !== "fast",
        });
        structured = normalizeStructuredCoursePedagogy(repaired.value);
        issues = auditStructuredCoursePedagogy(structured, qualityOptions);
        if (repaired.report.invalidBefore > 0) {
          console.info(
            `[course-ai] ${chapterTitle}: ${repaired.report.invalidBefore} formule(s) invalides, ${repaired.report.repairedByModel} corrigée(s), ${repaired.report.fallbackCount} repli(s).`,
          );
        }
        const blockingIssues = issues.filter((issue) => issue.severity === "error");
        if (blockingIssues.length > 0) {
          throw new Error(
            `Le chapitre « ${chapterTitle} » reste non conforme après correction :\n${formatStructuredQualityIssues(blockingIssues)}`,
          );
        }
        if (issues.length > 0) {
          console.warn(
            `[course-ai] Avertissements résiduels pour « ${chapterTitle} » :\n${formatStructuredQualityIssues(issues)}`,
          );
        }
        structured.lessons.forEach((lesson) => {
          const words = structuredLessonWordCount(lesson);
          if (words < targetWords.min) {
            console.warn(
              `[course-ai] Leçon « ${lesson.title} » courte (${words} mots utiles).`,
            );
          }
        });

        const compiled = compileStructuredCourseChapter(structured, {
          chapterIndex,
          durationPerLesson,
        });

        completed += 1;
        await tracker.updateProgress({
          step: "chapter",
          current: completed,
          total: chapterCount,
          message: `Chapitre ${chapterIndex + 1}/${chapterCount} terminé : ${chapterTitle}`,
          chapters: { [chapterIndex]: compiled },
        });
        return compiled;
      }),
    );

    if (await tracker.isCancelRequested()) {
      await tracker.setStatus("cancelled");
      return;
    }

    const failed = results
      .map((result, index) =>
        result.status === "rejected" ? chapterTitles[index] : null,
      )
      .filter((title): title is string => Boolean(title));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `[course-ai] Échec du chapitre « ${chapterTitles[index]} » :`,
          result.reason,
        );
      }
    });

    const contentJson = results
      .filter(
        (result): result is PromiseFulfilledResult<CompiledCourseChapter> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);

    if (contentJson.length === 0) {
      throw new Error("Aucun chapitre n'a pu être généré.");
    }

    await tracker.updateProgress({
      step: "final-check",
      current: chapterCount,
      total: chapterCount + 1,
      message: "Enregistrement du cours...",
    });

    const { data: courseRow, error: insertError } = await supabaseAdmin
      .from("courses")
      .insert({
        title: courseTitle,
        description: courseDescription,
        subject,
        level: String(grade_level) || "6eme",
        status: "draft",
        thumbnail_url: "",
        folder_id: folder_id || null,
        content_json: contentJson,
        estimated_time:
          chapterCount * lessonsPerChapter * (durationPerLesson / 60),
        is_published: false,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await auditLog({
      action: AuditAction.CONTENT_CREATED,
      adminId,
      targetType: "course",
      targetId: String(courseRow.id),
      details: {
        title: courseRow.title,
        status: courseRow.status,
        source: "ai_structured_v2_clean",
      },
    });

    await tracker.updateProgress({
      step: "final-check",
      current: chapterCount + 1,
      total: chapterCount + 1,
      message: "Cours enregistré.",
    });
    await tracker.setStatus("done", {
      course_id: courseRow.id,
      ...(failed.length > 0
        ? {
            error: `${failed.length} chapitre(s) absent(s) : ${failed.join(", ")}.`,
          }
        : {}),
    });
  } catch (error: unknown) {
    if (error instanceof GenerationCancelledError) {
      await tracker.setStatus("cancelled");
      return;
    }
    console.error("❌ Erreur génération cours IA structurée:", error);
    await tracker.setStatus("error", {
      error: error instanceof Error ? error.message : "Erreur de génération",
    });
  }
}
