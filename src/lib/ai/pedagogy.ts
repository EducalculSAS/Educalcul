import {
  mathToReadableText,
  structuredRichTextToPlainText,
  type StructuredCourseBlock,
  type StructuredCourseChapter,
  type StructuredCourseLesson,
  type StructuredExerciseDraft,
  type StructuredExerciseQuestion,
  type StructuredQuizDraft,
  type StructuredQuizQuestion,
  type StructuredRichText,
  type StructuredRichTextPart,
} from "@/lib/ai/structuredContent";

export type StructuredQualityIssue = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

export function courseTargetWordRange(duration: number): {
  min: number;
  max: number;
} {
  if (duration <= 20) return { min: 340, max: 560 };
  if (duration <= 30) return { min: 480, max: 760 };
  if (duration <= 45) return { min: 680, max: 1_000 };
  return { min: 880, max: 1_280 };
}

export function topicRequiresFunctionGraph(...values: string[]): boolean {
  const source = values.join(" ").toLocaleLowerCase("fr");
  return /\b(fonction|courbe|variation|dériv|derive|exponent|logarith|trigonom|sinus|cosinus|tangente|parabole|polyn[oô]me|affine|quadratique|homographique)\b/.test(
    source,
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyRichText(): StructuredRichText {
  return { parts: [] };
}

function canonical(value: string): string {
  return value
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, " ")
    .replace(/[^a-z0-9à-ÿ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function richTextPartPlain(part: StructuredRichTextPart): string {
  return part.type === "text"
    ? part.value
    : mathToReadableText(part.latex) || part.latex;
}

function richTextWordCount(value: StructuredRichText | undefined): number {
  if (!value) return 0;
  return structuredRichTextToPlainText(value)
    .split(/\s+/)
    .filter(Boolean).length;
}

function blockWordCount(block: StructuredCourseBlock): number {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return richTextWordCount(block.content);
    case "display_math":
      return Math.max(1, mathToReadableText(block.latex).split(/\s+/).filter(Boolean).length);
    case "list":
      return block.items.reduce((sum, item) => sum + richTextWordCount(item), 0);
    case "callout":
      return (
        richTextWordCount(block.title) +
        block.paragraphs.reduce(
          (sum, paragraph) => sum + richTextWordCount(paragraph),
          0,
        )
      );
    case "table":
      return (
        block.headers.reduce((sum, cell) => sum + richTextWordCount(cell), 0) +
        block.rows.reduce(
          (sum, row) =>
            sum + row.reduce((rowSum, cell) => rowSum + richTextWordCount(cell), 0),
          0,
        )
      );
    case "sign_table":
      return (
        richTextWordCount(block.expression) +
        block.boundaries.reduce((sum, item) => sum + richTextWordCount(item), 0)
      );
    case "variation_table":
      return (
        richTextWordCount(block.variable) +
        richTextWordCount(block.functionName) +
        block.points.reduce((sum, item) => sum + richTextWordCount(item), 0) +
        block.values.reduce((sum, item) => sum + richTextWordCount(item), 0)
      );
    case "graph":
    case "figure":
      return block.caption.split(/\s+/).filter(Boolean).length;
    case "steps":
      return block.steps.reduce(
        (sum, step) =>
          sum +
          richTextWordCount(step.title) +
          step.blocks.reduce(
            (stepSum, nestedBlock) => stepSum + blockWordCount(nestedBlock),
            0,
          ),
        0,
      );
    case "exercise":
      return 0;
  }
}

export function structuredLessonWordCount(
  lesson: StructuredCourseLesson,
): number {
  return lesson.blocks.reduce((sum, block) => sum + blockWordCount(block), 0);
}

function isSubstantiveBlock(block: StructuredCourseBlock): boolean {
  return block.type !== "heading" && block.type !== "exercise";
}

function isVisualBlock(block: StructuredCourseBlock): boolean {
  return (
    block.type === "table" ||
    block.type === "sign_table" ||
    block.type === "variation_table" ||
    block.type === "graph" ||
    block.type === "figure"
  );
}

function insertExerciseAfterSubstantive(
  blocks: StructuredCourseBlock[],
  exerciseIndex: number,
  targetSubstantive: number,
): StructuredCourseBlock[] {
  const output = [...blocks];
  let substantive = 0;
  let insertionIndex = output.length;
  for (let index = 0; index < output.length; index += 1) {
    if (isSubstantiveBlock(output[index])) substantive += 1;
    if (substantive >= targetSubstantive) {
      insertionIndex = index + 1;
      while (
        insertionIndex < output.length &&
        output[insertionIndex].type === "exercise"
      ) {
        insertionIndex += 1;
      }
      break;
    }
  }
  output.splice(insertionIndex, 0, {
    type: "exercise",
    exerciseIndex,
  });
  return output;
}

function normalizeLessonExercisePlacement(
  lesson: StructuredCourseLesson,
): StructuredCourseLesson {
  const expectedCount = lesson.exercises.length;
  if (expectedCount === 0) {
    return {
      ...lesson,
      blocks: lesson.blocks.filter((block) => block.type !== "exercise"),
    };
  }

  const used = new Set<number>();
  const queued: number[] = [];
  const kept: StructuredCourseBlock[] = [];
  let substantiveCount = 0;

  for (const block of lesson.blocks) {
    if (block.type !== "exercise") {
      kept.push(block);
      if (isSubstantiveBlock(block)) substantiveCount += 1;
      continue;
    }
    const index = block.exerciseIndex;
    if (index < 1 || index > expectedCount || used.has(index)) continue;
    used.add(index);
    if (substantiveCount >= 2) kept.push(block);
    else queued.push(index);
  }

  for (let index = 1; index <= expectedCount; index += 1) {
    if (!used.has(index)) queued.push(index);
  }

  let output = kept;
  const totalSubstantive = Math.max(
    3,
    output.filter(isSubstantiveBlock).length,
  );
  queued.forEach((exerciseIndex, queueIndex) => {
    const target = Math.max(
      3,
      Math.round(
        ((queueIndex + 1) * totalSubstantive) / (queued.length + 1),
      ),
    );
    output = insertExerciseAfterSubstantive(output, exerciseIndex, target);
  });

  if (output[0]?.type === "exercise") {
    const first = output.shift();
    if (first?.type === "exercise") {
      output = insertExerciseAfterSubstantive(output, first.exerciseIndex, 2);
    }
  }

  return { ...lesson, blocks: output };
}

function flattenSteps(block: Extract<StructuredCourseBlock, { type: "steps" }>): StructuredCourseBlock[] {
  return block.steps.flatMap((step) => {
    const titleBlock: StructuredCourseBlock[] = step.title?.parts.length
      ? [{ type: "heading", level: 4, content: step.title }]
      : [];
    return [...titleBlock, ...step.blocks];
  });
}

export function normalizeStructuredCoursePedagogy(
  input: StructuredCourseChapter,
): StructuredCourseChapter {
  const chapter = clone(input);
  let stepCount = 0;

  chapter.lessons = chapter.lessons.map((lesson) => {
    const expanded: StructuredCourseBlock[] = [];
    for (const block of lesson.blocks) {
      if (block.type === "steps") {
        stepCount += 1;
        if (stepCount > 2) {
          expanded.push(...flattenSteps(block));
          continue;
        }
      }
      expanded.push(block);
    }
    return normalizeLessonExercisePlacement({ ...lesson, blocks: expanded });
  });

  return chapter;
}

export function auditStructuredCoursePedagogy(
  chapter: StructuredCourseChapter,
  options: {
    expectedLessonCount: number;
    includeExercises: boolean;
    minWordsPerLesson: number;
    requireGraph: boolean;
  },
): StructuredQualityIssue[] {
  const issues: StructuredQualityIssue[] = [];
  if (chapter.lessons.length !== options.expectedLessonCount) {
    issues.push({
      severity: "error",
      code: "lesson_count",
      path: "lessons",
      message: `Le chapitre contient ${chapter.lessons.length} leçon(s) au lieu de ${options.expectedLessonCount}.`,
    });
  }

  let visualCount = 0;
  let graphCount = 0;
  let variationCount = 0;
  let stepsCount = 0;

  chapter.lessons.forEach((lesson, lessonIndex) => {
    const path = `lessons[${lessonIndex}]`;
    const forbiddenSolvedHeading = lesson.blocks.some((block) => {
      if (block.type !== "heading") return false;
      const title = canonical(structuredRichTextToPlainText(block.content));
      return /(exercice|probleme) (resolu|corrige)|exemple guide/.test(title);
    });
    if (forbiddenSolvedHeading) {
      issues.push({
        severity: "error",
        code: "solved_exercise_in_lesson",
        path: `${path}.blocks`,
        message: "La leçon ne doit pas présenter un exercice résolu juste avant un exercice élève. Utiliser une explication de méthode ou une dérivation, sans format d'exercice corrigé.",
      });
    }
    const words = structuredLessonWordCount(lesson);
    if (words < options.minWordsPerLesson) {
      issues.push({
        severity: "error",
        code: "lesson_too_short",
        path: `${path}.blocks`,
        message: `La leçon contient environ ${words} mots utiles ; minimum attendu : ${options.minWordsPerLesson}.`,
      });
    }
    if (lesson.blocks.filter(isSubstantiveBlock).length < 5) {
      issues.push({
        severity: "error",
        code: "lesson_too_sparse",
        path: `${path}.blocks`,
        message: "La leçon ne contient pas assez de blocs pédagogiques utiles.",
      });
    }

    const exerciseRefs = lesson.blocks.filter(
      (block): block is Extract<StructuredCourseBlock, { type: "exercise" }> =>
        block.type === "exercise",
    );
    if (options.includeExercises) {
      if (lesson.exercises.length < 3 || lesson.exercises.length > 4) {
        issues.push({
          severity: "error",
          code: "exercise_count",
          path: `${path}.exercises`,
          message: `La leçon doit contenir 3 à 4 exercices ; reçu : ${lesson.exercises.length}.`,
        });
      }
      const referenced = new Set(exerciseRefs.map((block) => block.exerciseIndex));
      if (
        referenced.size !== lesson.exercises.length ||
        [...referenced].some(
          (index) => index < 1 || index > lesson.exercises.length,
        )
      ) {
        issues.push({
          severity: "error",
          code: "exercise_references",
          path: `${path}.blocks`,
          message:
            "Chaque exercice doit être référencé exactement une fois par un bloc exercise valide.",
        });
      }
      let substantiveBefore = 0;
      for (const block of lesson.blocks) {
        if (block.type === "exercise") {
          if (substantiveBefore < 3) {
            issues.push({
              severity: "error",
              code: "exercise_before_explanation",
              path: `${path}.blocks`,
              message:
                "Un exercice apparaît avant une explication, une méthode et un développement suffisants.",
            });
            break;
          }
        } else if (isSubstantiveBlock(block)) {
          substantiveBefore += 1;
        }
      }
    } else if (lesson.exercises.length > 0 || exerciseRefs.length > 0) {
      issues.push({
        severity: "error",
        code: "unexpected_exercises",
        path,
        message: "Les exercices sont désactivés mais la leçon en contient.",
      });
    }

    for (const block of lesson.blocks) {
      if (isVisualBlock(block)) visualCount += 1;
      if (block.type === "graph") graphCount += 1;
      if (block.type === "variation_table") variationCount += 1;
      if (block.type === "steps") stepsCount += 1;
    }
  });

  if (visualCount === 0) {
    issues.push({
      severity: "error",
      code: "missing_visual",
      path: "lessons[*].blocks",
      message:
        "Le chapitre doit contenir au moins un élément visuel utile : tableau, graphique ou figure.",
    });
  }
  if ((options.requireGraph || variationCount > 0) && graphCount === 0) {
    issues.push({
      severity: "error",
      code: "missing_graph",
      path: "lessons[*].blocks",
      message:
        "Le chapitre étudie une fonction ou contient un tableau de variations, mais aucun bloc graph n'est présent.",
    });
  }
  if (stepsCount > 2) {
    issues.push({
      severity: "warning",
      code: "too_many_steps",
      path: "lessons[*].blocks",
      message: "Limite recommandée : un ou deux blocs steps par chapitre.",
    });
  }
  return issues;
}

export function structuredCourseQualityScore(
  chapter: StructuredCourseChapter,
  options: {
    expectedLessonCount: number;
    includeExercises: boolean;
    minWordsPerLesson: number;
    requireGraph: boolean;
  },
): number {
  const issues = auditStructuredCoursePedagogy(chapter, options);
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  const words = chapter.lessons.reduce(
    (sum, lesson) => sum + Math.min(structuredLessonWordCount(lesson), 1_200),
    0,
  );
  const exercises = chapter.lessons.reduce(
    (sum, lesson) => sum + lesson.exercises.length,
    0,
  );
  const visuals = chapter.lessons.reduce(
    (sum, lesson) => sum + lesson.blocks.filter(isVisualBlock).length,
    0,
  );
  return (
    chapter.lessons.length * 10_000 +
    words * 4 +
    exercises * 250 +
    visuals * 300 -
    errors * 20_000 -
    warnings * 500
  );
}

export function formatStructuredQualityIssues(
  issues: StructuredQualityIssue[],
): string {
  return issues
    .slice(0, 20)
    .map(
      (issue, index) =>
        `${index + 1}. [${issue.code}] ${issue.path} — ${issue.message}`,
    )
    .join("\n");
}

function stripLeadingChoiceLabel(value: StructuredRichText): StructuredRichText {
  const parts = clone(value.parts);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part.type !== "text") continue;
    part.value = part.value.replace(
      /^\s*(?:[A-Ha-h]|[1-8])\s*[.)\-:]\s*/,
      "",
    );
    if (!part.value) parts.splice(index, 1);
    break;
  }
  return { parts };
}

function truncateRichTextAtPlainIndex(
  value: StructuredRichText,
  cutIndex: number,
): StructuredRichText {
  if (cutIndex <= 0) return emptyRichText();
  const output: StructuredRichTextPart[] = [];
  let consumed = 0;
  for (const part of value.parts) {
    const plain = richTextPartPlain(part);
    if (consumed + plain.length <= cutIndex) {
      output.push(clone(part));
      consumed += plain.length;
      continue;
    }
    if (part.type === "text") {
      const remaining = Math.max(0, cutIndex - consumed);
      const sliced = part.value.slice(0, remaining).trimEnd();
      if (sliced) output.push({ type: "text", value: sliced });
    }
    break;
  }
  const last = output.at(-1);
  if (last?.type === "text") {
    last.value = last.value.replace(/\s+$/, "");
  }
  return { parts: output };
}

function removeEmbeddedOptionsFromQuestion(
  question: StructuredRichText,
  options: StructuredRichText[],
): StructuredRichText {
  const plainQuestion = structuredRichTextToPlainText(question);
  if (!plainQuestion) return question;
  let cut = plainQuestion.length;

  const labelMatch = plainQuestion.match(/(?:\?|:|;)\s*A\s*[.)\-:]\s*/i);
  if (labelMatch?.index !== undefined) cut = Math.min(cut, labelMatch.index + 1);

  const firstOption = canonical(
    structuredRichTextToPlainText(options[0] ?? emptyRichText()),
  );
  if (firstOption.length >= 2) {
    const canonicalQuestion = canonical(plainQuestion);
    const canonicalIndex = canonicalQuestion.indexOf(firstOption);
    if (canonicalIndex > 3) {
      const rawNeedle = structuredRichTextToPlainText(options[0]).trim();
      const rawIndex = plainQuestion.indexOf(rawNeedle);
      if (rawIndex > 3) cut = Math.min(cut, rawIndex);
    }
  }

  return cut < plainQuestion.length
    ? truncateRichTextAtPlainIndex(question, cut)
    : question;
}

export function sanitizeStructuredQuizDraft(
  input: StructuredQuizDraft,
): StructuredQuizDraft {
  const draft = clone(input);
  draft.questions = draft.questions.map((question) => {
    const options = question.options.map(stripLeadingChoiceLabel);
    return {
      ...question,
      options,
      text: removeEmbeddedOptionsFromQuestion(question.text, options),
    };
  });
  return draft;
}

export function quizQuestionContainsEmbeddedOptions(
  question: StructuredQuizQuestion,
): boolean {
  const stem = canonical(structuredRichTextToPlainText(question.text));
  return question.options.some((option) => {
    const optionText = canonical(structuredRichTextToPlainText(option));
    return optionText.length >= 2 && stem.includes(optionText);
  });
}

export function sanitizeStructuredExerciseDraft(
  input: StructuredExerciseDraft,
  options: {
    blockType: string;
    exerciseType: "simple" | "contextual";
  },
): StructuredExerciseDraft {
  const draft = clone(input);
  if (options.exerciseType === "simple") draft.introduction = [];

  draft.questions = draft.questions.map((question) => {
    const clean: StructuredExerciseQuestion = { ...question };
    if (
      options.exerciseType === "simple" &&
      options.blockType !== "fill_in_the_blank" &&
      options.blockType !== "coding"
    ) {
      clean.content = emptyRichText();
    } else {
      const answer = canonical(structuredRichTextToPlainText(clean.answer));
      const support = canonical(structuredRichTextToPlainText(clean.content));
      if (
        answer.length >= 3 &&
        support.includes(answer) &&
        support.length < answer.length * 5
      ) {
        clean.content = emptyRichText();
      }
    }
    return clean;
  });
  return draft;
}
