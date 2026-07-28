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
  type StructuredCourseBlock,
  type StructuredCourseChapter,
  type StructuredCourseExercise,
  type StructuredCourseLesson,
  type StructuredGenerator,
} from "@/lib/ai/structuredContent";
import {
  courseChapterSchema,
  courseLessonPlanSchema,
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
import { runStructuredQualityGuard } from "@/lib/ai/qualityGuard";

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

type CourseLessonPlan = {
  lessons?: Array<{
    title?: string;
    scope?: string;
    visual_focus?: "graph" | "variation_table" | "sign_table" | "table" | "figure";
  }>;
};

type NormalizedLessonPlan = {
  title: string;
  scope: string;
  visualFocus: "graph" | "variation_table" | "sign_table" | "table" | "figure";
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
    return "Style théorique : définitions rigoureuses, propriétés, démonstrations et profondeur conceptuelle, avec quelques applications ciblées.";
  }
  if (style === "practice_heavy") {
    return "Style pratique : méthodes pas à pas et applications immédiates, avec la théorie strictement nécessaire.";
  }
  return "Style équilibré : alterne théorie, méthode, applications et synthèse.";
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
    return `Le tableau "exercises" est exactement []. Aucun bloc de type "exercise" n'est présent.`;
  }
  return `La leçon contient exactement 3 ou 4 exercices. Un exercice respecte exactement :
{
  "question": RICH_TEXT,
  "answer": RICH_TEXT,
  "hint": RICH_TEXT,
  "explanation": RICH_TEXT
}
Les exercices n'ont aucun id. Dans les blocs de la leçon, place un bloc {"type":"exercise","exercise_index":1}, puis 2, 3... juste après la notion correspondante. Chaque index est utilisé une seule fois.
Le champ question contient uniquement l'énoncé : jamais la réponse ni une correction.
Le champ answer contient uniquement la réponse finale attendue. Le champ hint aide sans donner cette réponse. Le champ explanation contient une solution propre et se termine par une conclusion compatible avec answer.
La réponse et la conclusion de l'explication doivent être mathématiquement identiques. Aucune autocorrection visible (« erreur », « recalculons », « en fait »).`;
}

function fallbackVisualFocus(
  lessonIndex: number,
  requireGraph: boolean,
): NormalizedLessonPlan["visualFocus"] {
  if (requireGraph && lessonIndex === 0) return "graph";
  const cycle: NormalizedLessonPlan["visualFocus"][] = [
    "table",
    "variation_table",
    "sign_table",
    "figure",
  ];
  return cycle[lessonIndex % cycle.length];
}

function normalizeLessonPlan(
  raw: CourseLessonPlan,
  lessonCount: number,
  chapterTitle: string,
  chapterScope: string,
  requireGraph: boolean,
): NormalizedLessonPlan[] {
  const source = Array.isArray(raw.lessons) ? raw.lessons : [];
  return Array.from({ length: lessonCount }, (_, index) => {
    const candidate = source[index];
    const visual = candidate?.visual_focus;
    return {
      title: cleanPlain(candidate?.title, `${chapterTitle} — leçon ${index + 1}`),
      scope: cleanPlain(
        candidate?.scope,
        `${chapterScope || chapterTitle}. Partie ${index + 1}/${lessonCount}, sans répéter les autres leçons.`,
      ),
      visualFocus:
        visual === "graph" ||
        visual === "variation_table" ||
        visual === "sign_table" ||
        visual === "table" ||
        visual === "figure"
          ? visual
          : fallbackVisualFocus(index, requireGraph),
    };
  });
}

function visualRequirement(
  focus: NormalizedLessonPlan["visualFocus"],
): string {
  if (focus === "graph") {
    return 'Ajoute obligatoirement un bloc "graph" utile et correctement paramétré.';
  }
  if (focus === "variation_table") {
    return 'Ajoute obligatoirement un bloc "variation_table" cohérent ET un bloc "graph" correspondant.';
  }
  if (focus === "sign_table") {
    return 'Ajoute obligatoirement un bloc "sign_table" cohérent.';
  }
  if (focus === "figure") {
    return 'Ajoute obligatoirement un bloc "figure" réservé à un schéma ou diagramme, jamais à une courbe.';
  }
  return 'Ajoute obligatoirement un bloc "table" utile de valeurs ou de comparaison.';
}

function buildLessonSystemPrompt(options: {
  courseTitle: string;
  chapterTitle: string;
  chapterScope: string;
  chapterIndex: number;
  chapterCount: number;
  chapterTitles: string[];
  lessonTitle: string;
  lessonScope: string;
  lessonIndex: number;
  lessonCount: number;
  lessonPlan: NormalizedLessonPlan[];
  visualFocus: NormalizedLessonPlan["visualFocus"];
  gradeLevel: string;
  subject: string;
  subjectArea: string;
  difficulty: string;
  durationPerLesson: number;
  includeExercises: boolean;
  style: CourseGenerationParams["content_style"];
  language: CourseGenerationParams["language_level"];
  programmeBlock: string;
  teacherDirective: string;
  targetWords: { min: number; max: number };
  requireGraph: boolean;
}): string {
  const allChapters = options.chapterTitles
    .map((title, index) => `${index + 1}. ${title}`)
    .join("\n");
  const allLessons = options.lessonPlan
    .map(
      (lesson, index) =>
        `${index + 1}. ${lesson.title} — ${lesson.scope} — visuel prévu : ${lesson.visualFocus}`,
    )
    .join("\n");

  return `Tu es un professeur de mathématiques expert pour Educalcul.
Tu rédiges UNE SEULE leçon du cours « ${options.courseTitle} ».
Niveau : ${options.gradeLevel}.
Matière : ${options.subjectArea || options.subject}.
Difficulté : ${options.difficulty}.
Chapitre ${options.chapterIndex + 1}/${options.chapterCount} : ${options.chapterTitle}.
Périmètre du chapitre : ${options.chapterScope || options.chapterTitle}.
Leçon ${options.lessonIndex + 1}/${options.lessonCount} à rédiger : ${options.lessonTitle}.
Périmètre strict de cette leçon : ${options.lessonScope}.

Plan complet du cours — ne duplique pas les autres chapitres :
${allChapters}

Plan du chapitre — ne traite que la leçon attribuée :
${allLessons}

${options.programmeBlock}
${styleInstruction(options.style)}
${languageInstruction(options.language)}
${options.teacherDirective}

${STRUCTURED_MATH_OUTPUT_RULES}

${RICH_TEXT_SCHEMA_PROMPT}

${COURSE_BLOCK_SCHEMA_PROMPT}

═══ CONTRAT BLOQUANT DE CETTE LEÇON ═══
• Retourne exactement un objet chapitre contenant exactement UNE leçon, ni plus ni moins.
• Le titre du chapitre est « ${options.chapterTitle} » et le titre de la leçon est « ${options.lessonTitle} ».
• duration vaut exactement ${options.durationPerLesson}.
• La leçon contient entre ${options.targetWords.min} et ${options.targetWords.max} mots utiles hors exercices. Développe les explications au lieu d'ajouter une autre leçon.
• Ordre pédagogique : définition ou mise en contexte → explication approfondie → méthode ou dérivation expliquée → application élève → approfondissement → synthèse.
• N'écris aucune section intitulée « exercice résolu », « exercice corrigé » ou « exemple guidé ». Une méthode peut contenir des calculs expliqués, sans adopter le format énoncé puis correction.
• Le premier bloc exercise arrive seulement après au moins trois blocs pédagogiques substantiels.
• Chaque exercice vérifie une notion expliquée juste avant lui ; ne regroupe pas tous les exercices à la fin.
• Une démonstration de 3 étapes ou plus utilise un bloc steps.
• Cette leçon contient au moins un vrai visuel structuré. ${visualRequirement(options.visualFocus)}
• ${options.requireGraph ? 'Cette leçon contient obligatoirement un bloc "graph" rendu par mathGraph.' : 'Un bloc graph est utilisé uniquement pour une vraie courbe mathématique.'}
• Une courbe de fonction utilise exclusivement "graph", jamais "figure".
• Un tableau de variations utilise exclusivement "variation_table". Un tableau de signes utilise exclusivement "sign_table".
• "figure" sert uniquement à un schéma, camembert, diagramme, aire, fraction, frise ou processus ; jamais à une courbe.
• Aucune phrase complète dans un champ latex. Aucun HTML, Markdown, $ ou $$.
• Recalcule tous les exemples et exercices avant de répondre.
• Limite la sortie au contenu demandé : pas de préface, pas de répétition du programme, pas de leçon supplémentaire.

${exerciseSchema(options.includeExercises)}

Structure JSON exacte :
{
  "title": "${options.chapterTitle}",
  "lessons": [
    {
      "title": "${options.lessonTitle}",
      "duration": ${options.durationPerLesson},
      "blocks": [BLOCS_STRUCTURÉS],
      "exercises": [EXERCICES_STRUCTURÉS]
    }
  ]
}

Réponds uniquement avec ce JSON.`;
}


function substantiveBlockCount(lesson: StructuredCourseLesson): number {
  return lesson.blocks.filter(
    (block) => block.type !== "heading" && block.type !== "exercise",
  ).length;
}

function isSynthesisHeading(block: StructuredCourseBlock): boolean {
  if (block.type !== "heading") return false;
  const source = JSON.stringify(block.content)
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /synthese|points?[- ]?cles?|a retenir|conclusion/.test(source);
}

function mergeLessonExpansion(
  chapter: StructuredCourseChapter,
  expansion: StructuredCourseChapter,
): StructuredCourseChapter {
  const baseLesson = chapter.lessons[0];
  const expansionLesson = expansion.lessons[0];
  if (!baseLesson || !expansionLesson) return chapter;

  const baseBlocks = baseLesson.blocks.filter(
    (block) => block.type !== "exercise",
  );
  const seen = new Set(baseBlocks.map((block) => JSON.stringify(block)));
  const additions = expansionLesson.blocks.filter((block) => {
    if (block.type === "exercise") return false;
    const key = JSON.stringify(block);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (additions.length === 0) return chapter;

  const synthesisIndex = baseBlocks.findIndex(isSynthesisHeading);
  const insertionIndex = synthesisIndex >= 0 ? synthesisIndex : baseBlocks.length;
  const mergedLesson: StructuredCourseLesson = {
    ...baseLesson,
    blocks: [
      ...baseBlocks.slice(0, insertionIndex),
      ...additions,
      ...baseBlocks.slice(insertionIndex),
    ],
  };

  return normalizeStructuredCoursePedagogy({
    ...chapter,
    lessons: [mergedLesson],
  });
}

async function enrichLessonToMinimum(options: {
  chapter: StructuredCourseChapter;
  generate: StructuredGenerator;
  chapterTitle: string;
  lessonTitle: string;
  lessonScope: string;
  durationPerLesson: number;
  minWords: number;
  maxWords: number;
}): Promise<StructuredCourseChapter> {
  let current = options.chapter;
  const expansionContract = courseChapterSchema({
    lessonCount: 1,
    includeExercises: false,
    minExercises: 0,
    maxExercises: 0,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const lesson = current.lessons[0];
    if (!lesson) return current;

    const currentWords = structuredLessonWordCount(lesson);
    const currentSubstantiveBlocks = substantiveBlockCount(lesson);
    if (currentWords >= options.minWords && currentSubstantiveBlocks >= 5) {
      return current;
    }

    const missingWords = Math.max(0, options.minWords - currentWords);
    const remainingCapacity = Math.max(120, options.maxWords - currentWords);
    const additionalTarget = Math.min(
      360,
      remainingCapacity,
      Math.max(180, missingWords + 110),
    );
    const existingBlocksJson = JSON.stringify(
      lesson.blocks.filter((block) => block.type !== "exercise"),
    );

    const expansionSystem = `Tu complètes une leçon de mathématiques Educalcul déjà générée.
Tu ne réécris pas la leçon entière : tu produis uniquement des blocs pédagogiques NOUVEAUX et complémentaires.
Chapitre : ${options.chapterTitle}.
Leçon : ${options.lessonTitle}.
Périmètre strict : ${options.lessonScope}.

${STRUCTURED_MATH_OUTPUT_RULES}

${RICH_TEXT_SCHEMA_PROMPT}

${COURSE_BLOCK_SCHEMA_PROMPT}

CONTRAT BLOQUANT :
• Retourne exactement un objet chapitre avec exactement une leçon.
• La leçon contient uniquement 4 à 9 blocs nouveaux, environ ${additionalTarget} mots utiles au total.
• exercises vaut exactement []. Aucun bloc exercise.
• Approfondis les explications, ajoute une justification, une méthode ou une application conceptuelle utile.
• Ne répète aucune définition, propriété, formule, exemple ou conclusion déjà présents.
• N'ajoute pas de nouvelle leçon, pas de préface, pas de HTML, pas de Markdown, pas de $ ou $$.
• N'ajoute pas de courbe ou de figure supplémentaire sauf nécessité absolue.
• Le contenu doit pouvoir être inséré directement avant la synthèse existante.

Structure exacte :
{
  "title": "${options.chapterTitle}",
  "lessons": [
    {
      "title": "${options.lessonTitle}",
      "duration": ${options.durationPerLesson},
      "blocks": [BLOCS_NOUVEAUX],
      "exercises": []
    }
  ]
}

Réponds uniquement avec ce JSON.`;

    try {
      const expansionRaw = await options.generate(
        `La leçon existante contient environ ${currentWords} mots utiles et ${currentSubstantiveBlocks} blocs substantiels. Le minimum est ${options.minWords} mots et 5 blocs substantiels.\nIl manque au moins ${missingWords} mots utiles.\nVoici les blocs existants, à ne pas répéter :\n${existingBlocksJson}`,
        expansionSystem,
        expansionContract,
        0.12,
        5_000,
        false,
      );
      const expansion = normalizeStructuredCourseChapter(expansionRaw, {
        expectedLessonCount: 1,
        durationPerLesson: options.durationPerLesson,
        includeExercises: false,
        maxExercisesPerLesson: 0,
      });
      const merged = mergeLessonExpansion(current, expansion);
      const mergedLesson = merged.lessons[0];
      if (
        mergedLesson &&
        structuredLessonWordCount(mergedLesson) > currentWords
      ) {
        current = merged;
      }
    } catch (error) {
      console.warn(
        `[course-ai] Enrichissement ciblé impossible pour « ${options.lessonTitle} » (tentative ${attempt + 1}/2).`,
        error,
      );
    }
  }

  return current;
}

function isTruncationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /tronqu|token|length|max_tokens/i.test(error.message)
  );
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
  const lessonsPerChapter = clampNumber(
    lessons_per_chapter ?? lesson_count,
    3,
    1,
    6,
  );
  const durationPerLesson = clampNumber(duration_per_lesson, 30, 5, 90);
  const targetWords = courseTargetWordRange(durationPerLesson);
  const shouldIncludeExercises = include_exercises !== false;
  const configuredInterval = Number(process.env.MISTRAL_MIN_REQUEST_INTERVAL_MS);
  const minInterval =
    Number.isFinite(configuredInterval) && configuredInterval >= 0
      ? configuredInterval
      : DEFAULT_LLM_MIN_START_INTERVAL_MS;
  const generate = createLlmStartGate(
    minInterval,
    () => tracker.isCancelRequested(),
  );
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
      chapterScopes.push(cleanPlain(candidate?.scope, chapterTitles[index]));
    }

    await tracker.updateProgress({
      step: "chapter",
      current: 0,
      total: chapterCount,
      message: `Rédaction de ${chapterCount} chapitre(s), leçon par leçon...`,
      chapterTitles,
    });

    let completedChapters = 0;
    const lessonMaxTokens = Math.min(
      14_000,
      Math.max(
        10_000,
        Math.ceil(targetWords.max * 6) +
          (shouldIncludeExercises ? 4_500 : 1_500),
      ),
    );

    const chapterResults = await Promise.allSettled(
      chapterTitles.map(async (chapterTitle, chapterIndex) => {
        const chapterScope = chapterScopes[chapterIndex];
        const chapterRequireGraph = topicRequiresFunctionGraph(
          subject,
          subject_area || "",
          chapterTitle,
          chapterScope,
        );

        const lessonPlanSystem = `Tu découpes le chapitre « ${chapterTitle} » du cours « ${courseTitle} » en exactement ${lessonsPerChapter} leçons complémentaires.
Périmètre du chapitre : ${chapterScope}.
Retourne uniquement :
{"lessons":[{"title":"titre court","scope":"notions exactes sans chevauchement","visual_focus":"graph|variation_table|sign_table|table|figure"}]}
Règles : exactement ${lessonsPerChapter} éléments ; progression logique ; aucune répétition ; graph pour les courbes ; figure uniquement pour schémas/diagrammes, jamais pour une courbe.${chapterRequireGraph ? ' Au moins une leçon a visual_focus="graph".' : ""}`;
        let lessonPlanRaw: CourseLessonPlan = {};
        try {
          lessonPlanRaw = (await generate(
            `Niveau : ${grade_level}\nSujet : ${subject}\nChapitre : ${chapterTitle}`,
            lessonPlanSystem,
            courseLessonPlanSchema(lessonsPerChapter),
            0.2,
            3_000,
            false,
          )) as CourseLessonPlan;
        } catch (error) {
          console.warn(
            `[course-ai] Plan des leçons indisponible pour « ${chapterTitle} », utilisation d'un plan déterministe.`,
            error,
          );
        }

        const lessonPlan = normalizeLessonPlan(
          lessonPlanRaw,
          lessonsPerChapter,
          chapterTitle,
          chapterScope,
          chapterRequireGraph,
        );
        if (
          chapterRequireGraph &&
          !lessonPlan.some((lesson) => lesson.visualFocus === "graph")
        ) {
          lessonPlan[0].visualFocus = "graph";
        }

        const lessonResults = await Promise.allSettled(
          lessonPlan.map(async (plan, lessonIndex) => {
            const requireGraph =
              plan.visualFocus === "graph" ||
              (chapterRequireGraph && lessonIndex === 0);
            const qualityOptions = {
              expectedLessonCount: 1,
              includeExercises: shouldIncludeExercises,
              minWordsPerLesson: targetWords.min,
              requireGraph,
            };
            const systemPrompt = buildLessonSystemPrompt({
              courseTitle,
              chapterTitle,
              chapterScope,
              chapterIndex,
              chapterCount,
              chapterTitles,
              lessonTitle: plan.title,
              lessonScope: plan.scope,
              lessonIndex,
              lessonCount: lessonsPerChapter,
              lessonPlan,
              visualFocus: plan.visualFocus,
              gradeLevel: String(grade_level),
              subject,
              subjectArea: subject_area || "Mathématiques",
              difficulty,
              durationPerLesson,
              includeExercises: shouldIncludeExercises,
              style: content_style,
              language: language_level,
              programmeBlock,
              teacherDirective,
              targetWords,
              requireGraph,
            });
            const userPrompt = `Rédige uniquement la leçon ${lessonIndex + 1}/${lessonsPerChapter} « ${plan.title} » du chapitre « ${chapterTitle} ». Respecte son périmètre : ${plan.scope}`;
            const contract = courseChapterSchema({
              lessonCount: 1,
              includeExercises: shouldIncludeExercises,
              minExercises: 3,
              maxExercises: 4,
            });

            let raw: unknown;
            try {
              raw = await generate(
                userPrompt,
                systemPrompt,
                contract,
                0.18,
                lessonMaxTokens,
                false,
              );
            } catch (error) {
              if (!isTruncationError(error)) throw error;
              raw = await generate(
                `${userPrompt}\n\nLa sortie précédente a dépassé la limite. Sois plus compact : ${targetWords.min} à ${targetWords.max} mots hors exercices, 3 exercices courts, aucune répétition, un seul visuel utile et exactement une leçon.`,
                systemPrompt,
                contract,
                0.05,
                lessonMaxTokens,
                false,
              );
            }

            let structured = normalizeStructuredCoursePedagogy(
              normalizeStructuredCourseChapter(raw, {
                expectedLessonCount: 1,
                durationPerLesson,
                includeExercises: shouldIncludeExercises,
                maxExercisesPerLesson: 4,
              }),
            );
            if (structured.lessons[0]) {
              structured.title = chapterTitle;
              structured.lessons[0].title = plan.title;
              structured.lessons[0].duration = durationPerLesson;
            }

            let issues = auditStructuredCoursePedagogy(
              structured,
              qualityOptions,
            );
            let bestScore = structuredCourseQualityScore(
              structured,
              qualityOptions,
            );

            const blockingBeforeRetry = issues.filter(
              (issue) => issue.severity === "error",
            );
            const onlyEnrichmentIssues =
              blockingBeforeRetry.length > 0 &&
              blockingBeforeRetry.every(
                (issue) =>
                  issue.code === "lesson_too_short" ||
                  issue.code === "lesson_too_sparse",
              );

            if (
              !hasEnoughStructuredLessons(
                structured,
                1,
                shouldIncludeExercises,
              ) ||
              (blockingBeforeRetry.length > 0 && !onlyEnrichmentIssues)
            ) {
              const issueSummary = formatStructuredQualityIssues(issues);
              const retryRaw = await generate(
                `${userPrompt}\n\nCorrige la leçon complète sans ajouter de leçon. Points à corriger :\n${issueSummary || "Structure incomplète."}\nConserve le périmètre, la longueur et le visuel demandé.`,
                systemPrompt,
                contract,
                0.05,
                lessonMaxTokens,
                false,
              );
              const retry = normalizeStructuredCoursePedagogy(
                normalizeStructuredCourseChapter(retryRaw, {
                  expectedLessonCount: 1,
                  durationPerLesson,
                  includeExercises: shouldIncludeExercises,
                  maxExercisesPerLesson: 4,
                }),
              );
              if (retry.lessons[0]) {
                retry.title = chapterTitle;
                retry.lessons[0].title = plan.title;
                retry.lessons[0].duration = durationPerLesson;
              }
              const retryScore = structuredCourseQualityScore(
                retry,
                qualityOptions,
              );
              if (retryScore >= bestScore) {
                structured = retry;
                bestScore = retryScore;
                issues = auditStructuredCoursePedagogy(
                  structured,
                  qualityOptions,
                );
              }
            }

            if (structured.lessons.length !== 1) {
              throw new Error(
                `La leçon « ${plan.title} » n'a pas produit exactement une leçon.`,
              );
            }

            structured = await enrichLessonToMinimum({
              chapter: structured,
              generate,
              chapterTitle,
              lessonTitle: plan.title,
              lessonScope: plan.scope,
              durationPerLesson,
              minWords: targetWords.min,
              maxWords: targetWords.max,
            });

            const guarded = await runStructuredQualityGuard(structured, {
              generate,
              label: `cours ${courseTitle}, chapitre ${chapterTitle}, leçon ${plan.title}`,
              level: String(grade_level),
              subject,
              semanticAudit: true,
            });
            structured = normalizeStructuredCoursePedagogy(guarded.value);
            if (
              guarded.report.semanticPatches > 0 ||
              guarded.report.mathTextRepairs > 0 ||
              guarded.report.removedCurveFigures > 0
            ) {
              console.info(
                `[course-ai] ${plan.title}: ${guarded.report.semanticPatches} correction(s) mathématique(s), ${guarded.report.mathTextRepairs} restructuration(s) LaTeX, ${guarded.report.removedCurveFigures} figure(s) de courbe supprimée(s).`,
              );
            }

            const repaired = await repairInvalidStructuredMath(structured, {
              generate,
              label: `cours ${courseTitle}, chapitre ${chapterTitle}, leçon ${plan.title}`,
              enableModelRepair: true,
            });
            structured = normalizeStructuredCoursePedagogy(repaired.value);
            issues = auditStructuredCoursePedagogy(
              structured,
              qualityOptions,
            );
            const blockingIssues = issues.filter(
              (issue) => issue.severity === "error",
            );
            if (blockingIssues.length > 0) {
              throw new Error(
                `La leçon « ${plan.title} » reste non conforme :\n${formatStructuredQualityIssues(blockingIssues)}`,
              );
            }
            if (repaired.report.invalidBefore > 0) {
              console.info(
                `[course-ai] ${plan.title}: ${repaired.report.invalidBefore} formule(s) invalides, ${repaired.report.repairedByModel} corrigée(s), ${repaired.report.fallbackCount} repli(s).`,
              );
            }
            return structured.lessons[0] as StructuredCourseLesson;
          }),
        );

        const failedLessons = lessonResults
          .map((result, index) =>
            result.status === "rejected" ? lessonPlan[index].title : null,
          )
          .filter((title): title is string => Boolean(title));
        lessonResults.forEach((result, index) => {
          if (result.status === "rejected") {
            console.error(
              `[course-ai] Échec de la leçon « ${lessonPlan[index].title} » :`,
              result.reason,
            );
          }
        });
        if (failedLessons.length > 0) {
          throw new Error(
            `Le chapitre « ${chapterTitle} » est incomplet : ${failedLessons.join(", ")}.`,
          );
        }

        let structuredChapter = normalizeStructuredCoursePedagogy({
          title: chapterTitle,
          lessons: lessonResults.map(
            (result) =>
              (result as PromiseFulfilledResult<StructuredCourseLesson>).value,
          ),
        });
        const chapterQualityOptions = {
          expectedLessonCount: lessonsPerChapter,
          includeExercises: shouldIncludeExercises,
          minWordsPerLesson: targetWords.min,
          requireGraph: chapterRequireGraph,
        };
        const chapterIssues = auditStructuredCoursePedagogy(
          structuredChapter,
          chapterQualityOptions,
        );
        const blockingChapterIssues = chapterIssues.filter(
          (issue) => issue.severity === "error",
        );
        if (blockingChapterIssues.length > 0) {
          throw new Error(
            `Le chapitre « ${chapterTitle} » reste non conforme :\n${formatStructuredQualityIssues(blockingChapterIssues)}`,
          );
        }
        structuredChapter = {
          ...structuredChapter,
          title: chapterTitle,
        };

        const compiled = compileStructuredCourseChapter(structuredChapter, {
          chapterIndex,
          durationPerLesson,
        });
        completedChapters += 1;
        await tracker.updateProgress({
          step: "chapter",
          current: completedChapters,
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

    chapterResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `[course-ai] Échec du chapitre « ${chapterTitles[index]} » :`,
          result.reason,
        );
      }
    });
    const failedChapters = chapterResults
      .map((result, index) =>
        result.status === "rejected" ? chapterTitles[index] : null,
      )
      .filter((title): title is string => Boolean(title));
    if (failedChapters.length > 0) {
      throw new Error(
        `Le cours n'a pas été enregistré car ${failedChapters.length} chapitre(s) sont incomplets : ${failedChapters.join(", ")}.`,
      );
    }

    const contentJson = chapterResults.map(
      (result) =>
        (result as PromiseFulfilledResult<CompiledCourseChapter>).value,
    );
    if (contentJson.length !== chapterCount) {
      throw new Error("Le nombre final de chapitres ne correspond pas à la demande.");
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
        source: "ai_structured_v2_3_chunked",
      },
    });

    await tracker.updateProgress({
      step: "final-check",
      current: chapterCount + 1,
      total: chapterCount + 1,
      message: "Cours enregistré.",
    });
    await tracker.setStatus("done", { course_id: courseRow.id });
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
