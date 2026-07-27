import {
  structuredCourseWordCount,
  structuredRichTextToPlainText,
  type StructuredCourseBlock,
  type StructuredCourseChapter,
  type StructuredCourseLesson,
  type StructuredRichText,
} from "@/lib/ai/structuredContent";

export type LessonWordRange = {
  min: number;
  target: number;
  max: number;
};

export type CoursePedagogyOptions = {
  expectedLessonCount: number;
  includeExercises: boolean;
  minExercises: number;
  maxExercises: number;
  durationPerLesson: number;
  subject: string;
  chapterTitle: string;
};

export type CoursePedagogyIssue = {
  code: string;
  path: string;
  message: string;
};

const TEACHING_BLOCK_TYPES = new Set<StructuredCourseBlock["type"]>([
  "paragraph",
  "display_math",
  "list",
  "callout",
  "table",
  "sign_table",
  "variation_table",
  "graph",
  "geometry_diagram",
  "fraction_model",
  "steps",
  "interactive_vectors",
]);

const VISUAL_BLOCK_TYPES = new Set<StructuredCourseBlock["type"]>([
  "table",
  "sign_table",
  "variation_table",
  "graph",
  "geometry_diagram",
  "fraction_model",
  "interactive_vectors",
]);

export const STRUCTURED_COURSE_PEDAGOGY_RULES = `═══ PÉDAGOGIE ET VISUELS — CONTRAT VÉRIFIABLE ═══
• Chaque leçon suit cet ordre vérifiable : définition ou mise en contexte claire ; une section explicitement nommée « Exemple guidé », « Application guidée » ou « Méthode » ; développement pas à pas ; section finale « Points-clés à retenir » ou « Synthèse ».
• Le premier mini-exercice arrive seulement après l’explication ET après la section explicitement nommée « Exemple guidé », « Application guidée » ou « Méthode ». Aucun exercice en tout début de leçon.
• Chaque mini-exercice vérifie la notion expliquée juste avant lui. Ne place jamais deux blocs exercise consécutifs.
• Une démonstration comportant trois étapes ou plus utilise un bloc steps. Limite steps et interactive_vectors à un ou deux usages au total par chapitre.
• Le chapitre contient au moins un visuel réellement utile : table, sign_table, variation_table, graph, geometry_diagram, fraction_model ou interactive_vectors.
• Si le chapitre étudie une fonction, ses variations, son signe, ses racines, son extremum ou sa courbe, il contient obligatoirement un bloc graph. Un tableau de variation ne remplace jamais la courbe correspondante.
• Une courbe de fonction utilise toujours graph. N'utilise jamais geometry_diagram pour dessiner une courbe.
• geometry_diagram est réservé aux figures géométriques et schémas d'énoncé. fraction_model est réservé aux fractions et proportions.
• Tous les visuels possèdent une légende courte et utile. Aucun visuel décoratif ou sans lien direct avec la notion.
• Varie les outils lorsque le chapitre s'y prête, sans multiplier artificiellement les interactions.
• Les exemples restent mathématiques et adaptés au niveau ; pas de physique, chimie, biologie ou informatique sauf demande explicite de l'enseignant.
• Le ton est scolaire, clair, rigoureux et uniquement en français.`;

export function getLessonWordRange(durationMinutes: number): LessonWordRange {
  if (durationMinutes <= 20) return { min: 300, target: 430, max: 580 };
  if (durationMinutes <= 30) return { min: 430, target: 580, max: 760 };
  if (durationMinutes <= 45) return { min: 620, target: 800, max: 1_000 };
  return { min: 800, target: 1_000, max: 1_250 };
}

export function isFunctionStudyTopic(value: string): boolean {
  const source = value.toLowerCase();
  return /(?:fonction|courbe|variation|dériv|derive|racine|zéro|zero|extremum|maximum|minimum|affine|linéaire|lineaire|second degré|polyn[oô]me|exponentielle|logarithm|trigonom|sinus|cosinus|tangente|parabole)/.test(
    source,
  );
}

export function isVisualCourseBlock(block: StructuredCourseBlock): boolean {
  return VISUAL_BLOCK_TYPES.has(block.type);
}

function lessonWordCount(lesson: StructuredCourseLesson): number {
  return structuredCourseWordCount({ title: "", lessons: [lesson] });
}

function richTextHasContent(value: StructuredRichText): boolean {
  return structuredRichTextToPlainText(value).trim().length > 0;
}

function exerciseIsComplete(lesson: StructuredCourseLesson, index: number): boolean {
  const exercise = lesson.exercises[index];
  return Boolean(
    exercise &&
      richTextHasContent(exercise.question) &&
      richTextHasContent(exercise.answer) &&
      richTextHasContent(exercise.hint) &&
      richTextHasContent(exercise.explanation),
  );
}


function comparableText(value: string): string {
  return value
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function blockPlainText(block: StructuredCourseBlock): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return structuredRichTextToPlainText(block.content);
    case "list":
      return block.items.map(structuredRichTextToPlainText).join(" ");
    case "callout":
      return [
        block.title ? structuredRichTextToPlainText(block.title) : "",
        ...block.paragraphs.map(structuredRichTextToPlainText),
      ].join(" ");
    case "steps":
      return block.steps
        .map((step) =>
          [
            step.title ? structuredRichTextToPlainText(step.title) : "",
            ...step.blocks.map(blockPlainText),
          ].join(" "),
        )
        .join(" ");
    default:
      return "";
  }
}

function hasGuidedExample(blocks: StructuredCourseBlock[]): boolean {
  const text = comparableText(blocks.map(blockPlainText).join(" "));
  return /(?:^| )(?:exemple|application|methode|calcul guide|exercice guide|demonstration)(?: |$)/.test(
    text,
  );
}

function hasFinalSynthesis(blocks: StructuredCourseBlock[]): boolean {
  const tail = blocks.filter((block) => block.type !== "exercise").slice(-4);
  const text = comparableText(tail.map(blockPlainText).join(" "));
  return /(?:synthese|points cles|a retenir|bilan|resume)/.test(text);
}

function exerciseQuestionLeaksAnswer(lesson: StructuredCourseLesson, index: number): boolean {
  const exercise = lesson.exercises[index];
  if (!exercise) return false;
  const question = comparableText(structuredRichTextToPlainText(exercise.question));
  const answer = comparableText(structuredRichTextToPlainText(exercise.answer));
  if (!question || !answer || answer.length < 2) return false;
  return question.length > answer.length + 12 && question.endsWith(answer);
}

function normalizeExercisePlacement(lesson: StructuredCourseLesson): StructuredCourseLesson {
  const exerciseCount = lesson.exercises.length;
  if (exerciseCount === 0) {
    return {
      ...lesson,
      blocks: lesson.blocks.filter((block) => block.type !== "exercise"),
    };
  }

  const source = lesson.blocks;
  const baseBlocks = source.filter((block) => block.type !== "exercise");
  const provided = source
    .map((block, sourceIndex) => ({ block, sourceIndex }))
    .filter(
      (entry): entry is {
        block: Extract<StructuredCourseBlock, { type: "exercise" }>;
        sourceIndex: number;
      } => entry.block.type === "exercise",
    );

  const validProvided = new Map<number, number>();
  const usedIndexes = new Set<number>();
  for (const entry of provided) {
    const zeroBased = entry.block.exerciseIndex - 1;
    const teachingBefore = source
      .slice(0, entry.sourceIndex)
      .filter((block) => TEACHING_BLOCK_TYPES.has(block.type)).length;
    const previous = source[entry.sourceIndex - 1];
    if (
      zeroBased >= 0 &&
      zeroBased < exerciseCount &&
      !usedIndexes.has(zeroBased) &&
      teachingBefore >= 2 &&
      previous?.type !== "exercise"
    ) {
      usedIndexes.add(zeroBased);
      const baseIndex = source
        .slice(0, entry.sourceIndex)
        .filter((block) => block.type !== "exercise").length;
      validProvided.set(zeroBased, baseIndex);
    }
  }

  const guidedAnchors = baseBlocks
    .map((block, index) => ({ block, index }))
    .filter(({ index }) => index >= 1 && hasGuidedExample(baseBlocks.slice(0, index + 1)))
    .map(({ index }) => index + 1);
  const anchors = baseBlocks
    .map((block, index) => ({ block, index }))
    .filter(
      ({ block, index }) =>
        index >= 1 &&
        TEACHING_BLOCK_TYPES.has(block.type) &&
        block.type !== "graph" &&
        block.type !== "interactive_vectors",
    )
    .map(({ index }) => index + 1);
  const fallbackAnchors = baseBlocks
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) => index >= 1 && TEACHING_BLOCK_TYPES.has(block.type))
    .map(({ index }) => index + 1);
  const availableAnchors =
    guidedAnchors.length > 0
      ? guidedAnchors
      : anchors.length > 0
        ? anchors
        : fallbackAnchors;

  const placements = new Map<number, number[]>();
  for (let exerciseIndex = 0; exerciseIndex < exerciseCount; exerciseIndex += 1) {
    let insertion = validProvided.get(exerciseIndex);
    if (insertion === undefined) {
      if (availableAnchors.length > 0) {
        const position = Math.min(
          availableAnchors.length - 1,
          Math.floor(((exerciseIndex + 1) * availableAnchors.length) / exerciseCount) - 1,
        );
        insertion = availableAnchors[Math.max(0, position)];
      } else {
        insertion = baseBlocks.length;
      }
    }
    const queue = placements.get(insertion) ?? [];
    queue.push(exerciseIndex + 1);
    placements.set(insertion, queue);
  }

  const blocks: StructuredCourseBlock[] = [];
  for (let index = 0; index <= baseBlocks.length; index += 1) {
    if (index > 0) blocks.push(baseBlocks[index - 1]);
    const indexes = placements.get(index) ?? [];
    indexes.forEach((exerciseIndex) => {
      blocks.push({ type: "exercise", exerciseIndex });
    });
  }

  return { ...lesson, blocks };
}

function limitImmersiveBlocks(chapter: StructuredCourseChapter): StructuredCourseChapter {
  let immersiveCount = 0;
  const lessons = chapter.lessons.map((lesson) => ({
    ...lesson,
    blocks: lesson.blocks.filter((block) => {
      if (block.type !== "steps" && block.type !== "interactive_vectors") return true;
      immersiveCount += 1;
      return immersiveCount <= 2;
    }),
  }));
  return { ...chapter, lessons };
}

export function normalizeStructuredCoursePedagogy(
  chapter: StructuredCourseChapter,
): StructuredCourseChapter {
  const placed = {
    ...chapter,
    lessons: chapter.lessons.map(normalizeExercisePlacement),
  };
  return limitImmersiveBlocks(placed);
}

export function auditStructuredCoursePedagogy(
  chapter: StructuredCourseChapter,
  options: CoursePedagogyOptions,
): CoursePedagogyIssue[] {
  const issues: CoursePedagogyIssue[] = [];
  const wordRange = getLessonWordRange(options.durationPerLesson);

  if (chapter.lessons.length !== options.expectedLessonCount) {
    issues.push({
      code: "lesson_count",
      path: "lessons",
      message: `${chapter.lessons.length} leçon(s) reçue(s), ${options.expectedLessonCount} attendue(s).`,
    });
  }

  chapter.lessons.forEach((lesson, lessonIndex) => {
    const path = `lessons[${lessonIndex}]`;
    const words = lessonWordCount(lesson);
    if (words < wordRange.min) {
      issues.push({
        code: "lesson_too_short",
        path: `${path}.blocks`,
        message: `${words} mots utiles ; minimum ${wordRange.min} pour ${options.durationPerLesson} minutes.`,
      });
    }
    if (lesson.blocks.length < 7) {
      issues.push({
        code: "lesson_too_few_blocks",
        path: `${path}.blocks`,
        message: `${lesson.blocks.length} blocs utiles ; minimum 7.`,
      });
    }

    if (!hasFinalSynthesis(lesson.blocks)) {
      issues.push({
        code: "missing_synthesis",
        path: `${path}.blocks`,
        message: "La leçon doit se terminer par une synthèse, un bilan ou des points-clés.",
      });
    }

    const exerciseCount = lesson.exercises.length;
    if (options.includeExercises) {
      if (
        exerciseCount < options.minExercises ||
        exerciseCount > options.maxExercises
      ) {
        issues.push({
          code: "exercise_count",
          path: `${path}.exercises`,
          message: `${exerciseCount} exercice(s) ; attendu entre ${options.minExercises} et ${options.maxExercises}.`,
        });
      }
      lesson.exercises.forEach((_exercise, index) => {
        if (!exerciseIsComplete(lesson, index)) {
          issues.push({
            code: "incomplete_exercise",
            path: `${path}.exercises[${index}]`,
            message: "Question, réponse, indice et explication doivent être remplis.",
          });
        }
        if (exerciseQuestionLeaksAnswer(lesson, index)) {
          issues.push({
            code: "exercise_answer_leak",
            path: `${path}.exercises[${index}].question`,
            message: "La question semble contenir la réponse attendue.",
          });
        }
      });
    } else if (exerciseCount !== 0) {
      issues.push({
        code: "unexpected_exercises",
        path: `${path}.exercises`,
        message: "Les exercices sont désactivés.",
      });
    }

    const refs = lesson.blocks.filter(
      (block): block is Extract<StructuredCourseBlock, { type: "exercise" }> =>
        block.type === "exercise",
    );
    if (refs.length !== exerciseCount) {
      issues.push({
        code: "exercise_reference_count",
        path: `${path}.blocks`,
        message: `${refs.length} emplacement(s) pour ${exerciseCount} exercice(s).`,
      });
    }
    const seen = new Set<number>();
    refs.forEach((ref) => {
      const zeroBased = ref.exerciseIndex - 1;
      if (zeroBased < 0 || zeroBased >= exerciseCount || seen.has(zeroBased)) {
        issues.push({
          code: "invalid_exercise_reference",
          path: `${path}.blocks`,
          message: `exercise_index ${ref.exerciseIndex} est invalide ou dupliqué.`,
        });
      }
      seen.add(zeroBased);
    });

    const firstRef = lesson.blocks.findIndex((block) => block.type === "exercise");
    if (firstRef >= 0) {
      const teachingBefore = lesson.blocks
        .slice(0, firstRef)
        .filter((block) => TEACHING_BLOCK_TYPES.has(block.type)).length;
      if (teachingBefore < 2) {
        issues.push({
          code: "exercise_before_explanation",
          path: `${path}.blocks[${firstRef}]`,
          message: "Le premier exercice arrive avant une explication et un exemple guidé.",
        });
      }
      if (!hasGuidedExample(lesson.blocks.slice(0, firstRef))) {
        issues.push({
          code: "missing_guided_example_before_exercise",
          path: `${path}.blocks[${firstRef}]`,
          message: "Le premier exercice doit être précédé d'un exemple, d'une application ou d'un calcul guidé explicite.",
        });
      }
    }
    for (let index = 1; index < lesson.blocks.length; index += 1) {
      if (
        lesson.blocks[index - 1].type === "exercise" &&
        lesson.blocks[index].type === "exercise"
      ) {
        issues.push({
          code: "consecutive_exercises",
          path: `${path}.blocks[${index}]`,
          message: "Deux mini-exercices sont consécutifs.",
        });
      }
    }
  });

  const allBlocks = chapter.lessons.flatMap((lesson) => lesson.blocks);
  const visualCount = allBlocks.filter(isVisualCourseBlock).length;
  if (visualCount === 0) {
    issues.push({
      code: "missing_visual",
      path: "lessons[*].blocks",
      message: "Le chapitre ne contient aucun visuel structuré utile.",
    });
  }

  allBlocks.forEach((block, index) => {
    if (
      (block.type === "graph" ||
        block.type === "geometry_diagram" ||
        block.type === "fraction_model" ||
        block.type === "interactive_vectors") &&
      !block.caption.trim()
    ) {
      issues.push({
        code: "missing_visual_caption",
        path: `lessons[*].blocks[${index}]`,
        message: "Chaque visuel doit avoir une légende utile.",
      });
    }
    if (block.type === "variation_table" && block.intervals.length === 0) {
      issues.push({
        code: "empty_variation_table",
        path: `lessons[*].blocks[${index}]`,
        message: "Le tableau de variations ne contient aucun intervalle.",
      });
    }
    if (block.type === "sign_table" && block.entries.length < 2) {
      issues.push({
        code: "empty_sign_table",
        path: `lessons[*].blocks[${index}]`,
        message: "Le tableau de signes ne contient pas assez d'entrées.",
      });
    }
  });

  const functionStudy = isFunctionStudyTopic(
    `${options.subject} ${options.chapterTitle}`,
  );
  const graphCount = allBlocks.filter((block) => block.type === "graph").length;
  const variationCount = allBlocks.filter(
    (block) => block.type === "variation_table",
  ).length;
  if ((functionStudy || variationCount > 0) && graphCount === 0) {
    issues.push({
      code: "missing_graph",
      path: "lessons[*].blocks",
      message: "Une étude de fonction ou un tableau de variation exige un graphique.",
    });
  }

  const immersiveCount = allBlocks.filter(
    (block) => block.type === "steps" || block.type === "interactive_vectors",
  ).length;
  if (immersiveCount > 2) {
    issues.push({
      code: "too_many_immersive_blocks",
      path: "lessons[*].blocks",
      message: `${immersiveCount} blocs immersifs ; maximum 2 par chapitre.`,
    });
  }

  return issues;
}

export function scoreStructuredCourseChapter(
  chapter: StructuredCourseChapter,
  options: CoursePedagogyOptions,
): number {
  const issues = auditStructuredCoursePedagogy(chapter, options);
  let score = chapter.lessons.length * 10_000;
  score += chapter.lessons.reduce((sum, lesson) => sum + lessonWordCount(lesson), 0);
  score += chapter.lessons.reduce(
    (sum, lesson) => sum + lesson.exercises.length * 500 + lesson.blocks.length * 20,
    0,
  );
  score -= issues.length * 4_000;
  return score;
}

export function mergeBestCourseChapters(
  first: StructuredCourseChapter,
  second: StructuredCourseChapter,
  options: CoursePedagogyOptions,
): StructuredCourseChapter {
  const lessons: StructuredCourseLesson[] = [];
  for (let index = 0; index < options.expectedLessonCount; index += 1) {
    const a = first.lessons[index];
    const b = second.lessons[index];
    if (!a && b) lessons.push(b);
    else if (a && !b) lessons.push(a);
    else if (a && b) {
      const aChapter = { title: first.title, lessons: [a] };
      const bChapter = { title: second.title, lessons: [b] };
      const lessonOptions = { ...options, expectedLessonCount: 1 };
      lessons.push(
        scoreStructuredCourseChapter(bChapter, lessonOptions) >=
        scoreStructuredCourseChapter(aChapter, lessonOptions)
          ? b
          : a,
      );
    }
  }
  return normalizeStructuredCoursePedagogy({
    title: second.title || first.title,
    lessons,
  });
}
