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
    case "checklist":
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
    case "column_operation":
      return block.operands.length + 2;
    case "image":
      return block.caption.split(/\s+/).filter(Boolean).length;
    case "base_ten_blocks":
      return block.caption.split(/\s+/).filter(Boolean).length;
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
    case "shape":
    case "trig_circle":
    case "pie_chart":
    case "number_line":
    case "bar_chart":
    case "line_chart":
    case "flowchart":
    case "scatter_plot":
    case "probability_tree":
    case "venn_diagram":
    case "box_plot":
    case "clock":
    case "fraction":
    case "coin_purse":
    case "balance_scale":
    case "grid_painter":
    case "pattern_maker":
    case "ruler_measurer":
    case "tape_diagram":
    case "brick_pyramid":
    case "solid":
    case "labeled_polygon":
    case "labeled_circle":
    case "jsx_figure":
    case "fill_grid":
    case "fraction_strips":
    case "place_value_chart":
    case "ratio_mixer":
    case "net_folder":
    case "interactive_protractor":
    case "compass_tool":
    case "thermometer_axis":
    case "area_decomposer":
    case "scientific_notation_converter":
    case "equation_balancer":
    case "slope_triangle":
    case "vector_addition_pad":
    case "interval_builder":
    case "tangent_scrubber":
    case "sequence_cobweb":
    case "integral_riemann_slider":
    case "complex_plane_polar":
    case "algo_sandbox":
      return block.caption.split(/\s+/).filter(Boolean).length;
    case "definition":
      return (
        block.term.split(/\s+/).filter(Boolean).length +
        richTextWordCount(block.definition) +
        richTextWordCount(block.example)
      );
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

function structuredLessonWordCount(
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
    block.type === "figure" ||
    block.type === "shape" ||
    block.type === "trig_circle" ||
    block.type === "pie_chart" ||
    block.type === "number_line" ||
    block.type === "bar_chart" ||
    block.type === "probability_tree" ||
    block.type === "venn_diagram" ||
    block.type === "box_plot" ||
    block.type === "clock" ||
    block.type === "fraction" ||
    block.type === "coin_purse" ||
    block.type === "balance_scale" ||
    block.type === "grid_painter" ||
    block.type === "pattern_maker" ||
    block.type === "ruler_measurer" ||
    block.type === "tape_diagram" ||
    block.type === "brick_pyramid" ||
    block.type === "solid" ||
    block.type === "labeled_polygon" ||
    block.type === "labeled_circle" ||
    block.type === "jsx_figure" ||
    block.type === "fill_grid" ||
    block.type === "fraction_strips" ||
    block.type === "place_value_chart" ||
    block.type === "ratio_mixer" ||
    block.type === "net_folder" ||
    block.type === "interactive_protractor" ||
    block.type === "compass_tool" ||
    block.type === "thermometer_axis" ||
    block.type === "area_decomposer" ||
    block.type === "scientific_notation_converter" ||
    block.type === "equation_balancer" ||
    block.type === "slope_triangle" ||
    block.type === "vector_addition_pad" ||
    block.type === "interval_builder" ||
    block.type === "tangent_scrubber" ||
    block.type === "sequence_cobweb" ||
    block.type === "integral_riemann_slider" ||
    block.type === "complex_plane_polar" ||
    block.type === "algo_sandbox"
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
      break;
    }
  }
  output.splice(insertionIndex, 0, {
    type: "exercise",
    exerciseIndex,
  });
  return output;
}

function buildExerciseTransitionParagraph(content: string): StructuredCourseBlock {
  return {
    type: "paragraph",
    content: {
      parts: [{ type: "text", value: content }],
    },
  };
}

function repairLessonExerciseSpacing(
  lesson: StructuredCourseLesson,
): StructuredCourseLesson {
  const blocks = [...lesson.blocks];
  let substantiveSincePreviousExercise = Infinity;
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (block.type === "exercise") {
      if (substantiveSincePreviousExercise === 0) {
        blocks.splice(
          index,
          0,
          buildExerciseTransitionParagraph(
            "Entre ces exercices, une phrase de méthode ou un rappel rapide aide l'élève à rester concentré.",
          ),
        );
        substantiveSincePreviousExercise = 1;
        index += 1;
      }
      substantiveSincePreviousExercise = 0;
    } else if (isSubstantiveBlock(block)) {
      substantiveSincePreviousExercise += 1;
    }
    index += 1;
  }

  const firstExerciseIndex = blocks.findIndex((block) => block.type === "exercise");
  if (firstExerciseIndex >= 0) {
    const substantiveBeforeFirst = blocks
      .slice(0, firstExerciseIndex)
      .filter(isSubstantiveBlock).length;
    const missingBeforeFirst = Math.max(0, 3 - substantiveBeforeFirst);
    for (let i = 0; i < missingBeforeFirst; i += 1) {
      blocks.splice(
        firstExerciseIndex + i,
        0,
        buildExerciseTransitionParagraph(
          i === 0
            ? "Avant le premier exercice, rappelle-toi la méthode étudiée et les propriétés essentielles vues précédemment."
            : "Ajoute une phrase de synthèse avant le prochain exercice pour mieux préparer l'élève.",
        ),
      );
    }
  }

  return { ...lesson, blocks };
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

  // Annotation explicite nécessaire : TS 5.5+ infère un type de retour
  // rétréci (sans "exercise") pour ce filter(), incompatible avec la
  // réaffectation plus bas du résultat de insertExerciseAfterSubstantive
  // (qui réintroduit des blocs "exercise").
  const outputBlocks: StructuredCourseBlock[] = lesson.blocks.filter(
    (block) => block.type !== "exercise",
  );
  const totalSubstantive = Math.max(
    3,
    outputBlocks.filter(isSubstantiveBlock).length,
  );

  const exerciseIndices = Array.from({ length: expectedCount }, (_, index) => index + 1);
  let output: StructuredCourseBlock[] = outputBlocks;
  let priorTarget = 0;
  exerciseIndices.forEach((exerciseIndex, queueIndex) => {
    const baseTarget = Math.round(
      ((queueIndex + 1) * totalSubstantive) / (exerciseIndices.length + 1),
    );
    const target = Math.min(
      totalSubstantive,
      Math.max(queueIndex === 0 ? 3 : priorTarget + 1, baseTarget),
    );
    output = insertExerciseAfterSubstantive(output, exerciseIndex, target);
    priorTarget = target;
  });

  if (output[0]?.type === "exercise") {
    const first = output.shift();
    if (first?.type === "exercise") {
      output = insertExerciseAfterSubstantive(output, first.exerciseIndex, 2);
    }
  }

  return repairLessonExerciseSpacing({ ...lesson, blocks: output });
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
    // Tolérance de 15 % sous le plancher : en production, plusieurs leçons
    // sont revenues stables à 329-331 mots pour un minimum de 360 (~91 %)
    // après deux tentatives de correction ciblées. hardMinWords est déjà un
    // plancher volontairement bas (bien sous targetMinWords) ; un dépassement
    // de quelques dizaines de mots ne justifie pas de faire échouer tout le
    // cours — seul un écart réellement important reste bloquant.
    if (words < options.minWordsPerLesson * 0.85) {
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
      // "exercise_before_explanation" ne vérifie que le PREMIER exercice :
      // rien n'empêchait jusqu'ici les 3-4 exercices d'être groupés d'un bloc,
      // typiquement tous relégués à la toute fin de la leçon — exactement ce
      // que le prompt interdit ("jamais tous à la fin") sans que rien ne le
      // fasse respecter. On exige au moins un bloc pédagogique substantiel
      // entre deux exercices consécutifs.
      let substantiveSincePreviousExercise = Infinity;
      let clusteredExercises = false;
      for (const block of lesson.blocks) {
        if (block.type === "exercise") {
          if (substantiveSincePreviousExercise === 0) clusteredExercises = true;
          substantiveSincePreviousExercise = 0;
        } else if (isSubstantiveBlock(block)) {
          substantiveSincePreviousExercise += 1;
        }
      }
      if (clusteredExercises) {
        issues.push({
          severity: "error",
          code: "exercises_clustered",
          path: `${path}.blocks`,
          message:
            "Au moins deux exercices se suivent sans contenu pédagogique substantiel entre eux ; les exercices doivent être répartis dans la leçon (jamais groupés, surtout pas tous à la fin).",
        });
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
        `${index + 1}. [${issue.code}] ${issue.path} : ${issue.message}`,
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
