import type { JsonSchemaContract } from "@/lib/ai/schemas";
import {
  normalizeStructuredLatex,
  normalizeStructuredRichText,
  sanitizeStructuredText,
  structuredRichTextToPlainText,
  type StructuredCourseBlock,
  type StructuredCourseChapter,
  type StructuredCourseExercise,
  type StructuredCourseLesson,
  type StructuredGenerator,
  type StructuredRichText,
} from "@/lib/ai/structuredContent";
import type {
  CourseBlueprint,
  CourseBlueprintLesson,
  CourseCoordinationIssue,
  LessonBoundaryContext,
} from "@/lib/ai/coursePipeline";

type ReviewReference = {
  id: string;
  path: string;
  role: string;
  value: () => string;
  set: (replacement: string) => void;
};

export type CourseLessonReviewReport = {
  patches: number;
  deletedExercises: number;
  unstructuredMathFields: string[];
  warnings: string[];
};

type ReviewOptions = {
  generate: StructuredGenerator;
  courseTitle: string;
  chapterTitle: string;
  lessonPlan: CourseBlueprintLesson;
  boundaries: LessonBoundaryContext;
  level: string;
  subject: string;
};

const noExtra = { additionalProperties: false } as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function richTextToMarkdown(value: StructuredRichText): string {
  return value.parts
    .map((part) =>
      part.type === "text" ? part.value : `$${part.latex}$`,
    )
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function reviewContract(maxPatches: number): JsonSchemaContract {
  return {
    name: "educalcul_course_lesson_review",
    description:
      "Relecture indépendante d'une leçon avec corrections locales uniquement.",
    schema: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["ok", "patched"] },
        summary: { type: "string" },
        patches: {
          type: "array",
          minItems: 0,
          maxItems: Math.max(1, maxPatches),
          items: {
            type: "object",
            properties: {
              id: { type: "string", minLength: 1 },
              replacement: { type: "string", minLength: 1 },
              reason: { type: "string", minLength: 1 },
            },
            required: ["id", "replacement", "reason"],
            ...noExtra,
          },
        },
        delete_exercise_indexes: {
          type: "array",
          minItems: 0,
          maxItems: 1,
          items: { type: "integer", minimum: 1, maximum: 4 },
        },
        warnings: {
          type: "array",
          minItems: 0,
          maxItems: 8,
          items: { type: "string" },
        },
      },
      required: ["verdict", "summary", "patches", "delete_exercise_indexes", "warnings"],
      ...noExtra,
    },
  };
}

function addRichReference(
  references: ReviewReference[],
  id: string,
  path: string,
  role: string,
  get: () => StructuredRichText,
  set: (value: StructuredRichText) => void,
): void {
  references.push({
    id,
    path,
    role,
    value: () => richTextToMarkdown(get()),
    set: (replacement) => set(normalizeStructuredRichText(replacement)),
  });
}

function addLatexReference(
  references: ReviewReference[],
  id: string,
  path: string,
  role: string,
  get: () => string,
  set: (value: string) => void,
): void {
  references.push({
    id,
    path,
    role,
    value: get,
    set: (replacement) => {
      const latex = normalizeStructuredLatex(
        replacement.replace(/^\$\$?|\$\$?$/g, ""),
      );
      if (latex) set(latex);
    },
  });
}

function addPlainReference(
  references: ReviewReference[],
  id: string,
  path: string,
  role: string,
  get: () => string,
  set: (value: string) => void,
): void {
  references.push({
    id,
    path,
    role,
    value: get,
    set: (replacement) => {
      const clean = sanitizeStructuredText(replacement, true);
      if (clean) set(clean);
    },
  });
}

function collectBlockReferences(
  blocks: StructuredCourseBlock[],
  references: ReviewReference[],
  prefix: string,
): void {
  blocks.forEach((block, blockIndex) => {
    const idPrefix = `${prefix}-b${blockIndex}`;
    const path = `${prefix}.blocks[${blockIndex}]`;
    switch (block.type) {
      case "heading":
      case "paragraph":
        addRichReference(
          references,
          `${idPrefix}-content`,
          `${path}.content`,
          block.type,
          () => block.content,
          (value) => {
            block.content = value;
          },
        );
        break;
      case "display_math":
        addLatexReference(
          references,
          `${idPrefix}-latex`,
          `${path}.latex`,
          "display_math",
          () => block.latex,
          (value) => {
            block.latex = value;
          },
        );
        break;
      case "list":
        block.items.forEach((item, itemIndex) =>
          addRichReference(
            references,
            `${idPrefix}-item${itemIndex}`,
            `${path}.items[${itemIndex}]`,
            "list_item",
            () => block.items[itemIndex] as StructuredRichText,
            (value) => {
              block.items[itemIndex] = value;
            },
          ),
        );
        break;
      case "callout":
        if (block.title) {
          addRichReference(
            references,
            `${idPrefix}-title`,
            `${path}.title`,
            "callout_title",
            () => block.title as StructuredRichText,
            (value) => {
              block.title = value;
            },
          );
        }
        block.paragraphs.forEach((_paragraph, paragraphIndex) =>
          addRichReference(
            references,
            `${idPrefix}-p${paragraphIndex}`,
            `${path}.paragraphs[${paragraphIndex}]`,
            "callout_paragraph",
            () => block.paragraphs[paragraphIndex] as StructuredRichText,
            (value) => {
              block.paragraphs[paragraphIndex] = value;
            },
          ),
        );
        break;
      case "table":
        block.headers.forEach((_header, headerIndex) =>
          addRichReference(
            references,
            `${idPrefix}-h${headerIndex}`,
            `${path}.headers[${headerIndex}]`,
            "table_header",
            () => block.headers[headerIndex] as StructuredRichText,
            (value) => {
              block.headers[headerIndex] = value;
            },
          ),
        );
        block.rows.forEach((row, rowIndex) =>
          row.forEach((_cell, cellIndex) =>
            addRichReference(
              references,
              `${idPrefix}-r${rowIndex}c${cellIndex}`,
              `${path}.rows[${rowIndex}][${cellIndex}]`,
              "table_cell",
              () => block.rows[rowIndex]?.[cellIndex] as StructuredRichText,
              (value) => {
                if (block.rows[rowIndex]) block.rows[rowIndex][cellIndex] = value;
              },
            ),
          ),
        );
        break;
      case "sign_table":
        addRichReference(
          references,
          `${idPrefix}-expression`,
          `${path}.expression`,
          "sign_table_expression",
          () => block.expression,
          (value) => {
            block.expression = value;
          },
        );
        block.boundaries.forEach((_boundary, boundaryIndex) =>
          addRichReference(
            references,
            `${idPrefix}-boundary${boundaryIndex}`,
            `${path}.boundaries[${boundaryIndex}]`,
            "sign_table_boundary",
            () => block.boundaries[boundaryIndex] as StructuredRichText,
            (value) => {
              block.boundaries[boundaryIndex] = value;
            },
          ),
        );
        break;
      case "variation_table":
        addRichReference(
          references,
          `${idPrefix}-variable`,
          `${path}.variable`,
          "variation_variable",
          () => block.variable,
          (value) => {
            block.variable = value;
          },
        );
        addRichReference(
          references,
          `${idPrefix}-function`,
          `${path}.functionName`,
          "variation_function",
          () => block.functionName,
          (value) => {
            block.functionName = value;
          },
        );
        block.points.forEach((_point, pointIndex) =>
          addRichReference(
            references,
            `${idPrefix}-point${pointIndex}`,
            `${path}.points[${pointIndex}]`,
            "variation_point",
            () => block.points[pointIndex] as StructuredRichText,
            (value) => {
              block.points[pointIndex] = value;
            },
          ),
        );
        block.values.forEach((_value, valueIndex) =>
          addRichReference(
            references,
            `${idPrefix}-value${valueIndex}`,
            `${path}.values[${valueIndex}]`,
            "variation_value",
            () => block.values[valueIndex] as StructuredRichText,
            (value) => {
              block.values[valueIndex] = value;
            },
          ),
        );
        break;
      case "graph":
        addPlainReference(
          references,
          `${idPrefix}-expression`,
          `${path}.expression`,
          "graph_expression",
          () => block.expression,
          (value) => {
            block.expression = value;
          },
        );
        addPlainReference(
          references,
          `${idPrefix}-caption`,
          `${path}.caption`,
          "graph_caption",
          () => block.caption,
          (value) => {
            block.caption = value;
          },
        );
        break;
      case "figure":
        addPlainReference(
          references,
          `${idPrefix}-caption`,
          `${path}.caption`,
          "figure_caption",
          () => block.caption,
          (value) => {
            block.caption = value;
          },
        );
        block.elements.forEach((element, elementIndex) => {
          if (!element.label) return;
          addRichReference(
            references,
            `${idPrefix}-element${elementIndex}-label`,
            `${path}.elements[${elementIndex}].label`,
            "figure_label",
            () => element.label as StructuredRichText,
            (value) => {
              element.label = value;
            },
          );
        });
        break;
      case "steps":
        block.steps.forEach((step, stepIndex) => {
          if (step.title) {
            addRichReference(
              references,
              `${idPrefix}-step${stepIndex}-title`,
              `${path}.steps[${stepIndex}].title`,
              "step_title",
              () => step.title as StructuredRichText,
              (value) => {
                step.title = value;
              },
            );
          }
          collectBlockReferences(
            step.blocks,
            references,
            `${idPrefix}-step${stepIndex}`,
          );
        });
        break;
      case "exercise":
        break;
    }
  });
}

function collectExerciseReferences(
  exercises: StructuredCourseExercise[],
  references: ReviewReference[],
): void {
  exercises.forEach((exercise, exerciseIndex) => {
    const prefix = `e${exerciseIndex}`;
    const fields: Array<{
      key: keyof StructuredCourseExercise;
      role: string;
    }> = [
      { key: "question", role: "exercise_question" },
      { key: "answer", role: "exercise_answer" },
      { key: "hint", role: "exercise_hint" },
      { key: "explanation", role: "exercise_explanation" },
    ];
    fields.forEach(({ key, role }) =>
      addRichReference(
        references,
        `${prefix}-${key}`,
        `lesson.exercises[${exerciseIndex}].${key}`,
        role,
        () => exercise[key],
        (value) => {
          exercise[key] = value;
        },
      ),
    );
  });
}

function collectReferences(lesson: StructuredCourseLesson): ReviewReference[] {
  const references: ReviewReference[] = [];
  collectBlockReferences(lesson.blocks, references, "lesson");
  collectExerciseReferences(lesson.exercises, references);
  return references;
}


function likelyUndelimitedMath(value: string): boolean {
  const text = value
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$\n]+\$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return false;
  const strongPatterns = [
    /(?:^|\s)(?:d\s*\/\s*d[xt]|lim\s*_|frac\s*\{|sqrt\s*\{|mathbb\s*\{|begin\s*\{|end\s*\{)/i,
    /(?:^|\s)(?:left|right|ight)\s*[()\]}]/i,
    /\b(?:sin|cos|tan|exp|ln)\s*\([^)]*\)\s*[=<>]/i,
    /\b[a-zA-Z]\s*\([^)]*\)\s*=\s*[^,.!?]{3,}/,
    /\b(?:e|x|y|u|v|f|g)\s*\^\s*(?:\{|\(?[-+a-zA-Z0-9])/,
    /(?:\\(?:frac|sqrt|mathbb|lim|to|infty|cdot|left|right))|(?:-\+\s*∞)/,
  ];
  if (strongPatterns.some((pattern) => pattern.test(text))) return true;
  const hasEquation = /[=<>≤≥]/.test(text);
  const mathTokens = text.match(/(?:\b[a-zA-Z]\b|\d+|\^|\+|-|=|<|>|\(|\)|\[|\])/g)?.length ?? 0;
  const words = text.split(/\s+/).length;
  return hasEquation && mathTokens >= 8 && words <= 28;
}

function suspiciousReferenceIds(references: ReviewReference[]): string[] {
  return references
    .filter((reference) =>
      reference.role !== "display_math" &&
      reference.role !== "graph_expression" &&
      reference.role !== "graph_caption" &&
      reference.role !== "figure_caption" &&
      likelyUndelimitedMath(reference.value()),
    )
    .map((reference) => reference.id);
}

function removeExerciseAndReindex(
  lesson: StructuredCourseLesson,
  oneBasedIndex: number,
): boolean {
  const index = oneBasedIndex - 1;
  if (index < 0 || index >= lesson.exercises.length || lesson.exercises.length <= 3) {
    return false;
  }
  lesson.exercises.splice(index, 1);
  const rewriteBlocks = (blocks: StructuredCourseBlock[]): StructuredCourseBlock[] =>
    blocks.reduce<StructuredCourseBlock[]>((output, block) => {
      if (block.type === "exercise") {
        if (block.exerciseIndex === oneBasedIndex) return output;
        output.push(
          block.exerciseIndex > oneBasedIndex
            ? { ...block, exerciseIndex: block.exerciseIndex - 1 }
            : block,
        );
        return output;
      }
      if (block.type === "steps") {
        output.push({
          ...block,
          steps: block.steps.map((step) => ({
            ...step,
            blocks: rewriteBlocks(step.blocks),
          })),
        });
        return output;
      }
      output.push(block);
      return output;
    }, []);
  lesson.blocks = rewriteBlocks(lesson.blocks);
  return true;
}

export function courseLessonUnstructuredMathFields(
  lesson: StructuredCourseLesson,
): string[] {
  return suspiciousReferenceIds(collectReferences(lesson));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function reviewCourseLesson(
  input: StructuredCourseLesson,
  options: ReviewOptions,
): Promise<{ value: StructuredCourseLesson; report: CourseLessonReviewReport }> {
  const value = clone(input);
  const references = collectReferences(value);
  const payload = references.map((reference) => ({
    id: reference.id,
    path: reference.path,
    role: reference.role,
    content: reference.value(),
  }));
  const byId = new Map(references.map((reference) => [reference.id, reference]));
  const suspiciousIds = suspiciousReferenceIds(references);

  const systemPrompt = `Tu es l'agent relecteur indépendant d'Educalcul.
Un agent rédacteur a produit une leçon de mathématiques. Tu la vérifies UNE SEULE FOIS et tu renvoies uniquement des corrections locales.

Niveau : ${sanitizeStructuredText(options.level)}.
Sujet : ${sanitizeStructuredText(options.subject)}.
Cours : ${sanitizeStructuredText(options.courseTitle)}.
Chapitre : ${sanitizeStructuredText(options.chapterTitle)}.
Leçon : ${sanitizeStructuredText(options.lessonPlan.title)}.
Objectif : ${sanitizeStructuredText(options.lessonPlan.objective)}.
Périmètre : ${sanitizeStructuredText(options.lessonPlan.scope)}.
Notions dont cette leçon est propriétaire : ${options.boundaries.ownedConcepts.join(" ; ") || "non précisées"}.
Rappels courts autorisés : ${options.boundaries.allowedRecall.join(" ; ") || "aucun"}.
Notions à ne pas développer car attribuées aux autres agents : ${options.boundaries.forbiddenDevelopments.join(" ; ") || "aucune"}.
Sections prévues par le plan : ${options.lessonPlan.requiredSections.join(" ; ") || "non précisées"}.
Compétences réservées aux exercices : ${options.lessonPlan.exerciseSkills.join(" ; ") || "non précisées"}.
Champs détectés localement comme mathématiques probablement non délimitées : ${suspiciousIds.join(" ; ") || "aucun"}.

Contrôle obligatoirement :
• exactitude des définitions, calculs, limites, dérivées, signes, intervalles, extrema et preuves ;
• cohérence entre chaque question, answer et explanation ;
• légendes de graphiques : pente, tangente, asymptote, variations et convexité doivent être exactes ;
• tableaux : chaque cellule et chaque cas doivent être cohérents avec les hypothèses ;
• aucune affirmation plus forte que ce qui est démontré ;
• aucune confusion entre minimum et infimum, implication et équivalence, croissance et convexité ;
• aucune répétition développée d'une notion interdite. Un rappel autorisé tient en une phrase ;
• chaque exercice correspond à une compétence réservée dans le plan et ne duplique pas un exercice déjà décrit dans la leçon ;
• refais les calculs de manière indépendante, surtout pour les paramètres, discriminants, changements de signe, extrema, limites et cas particuliers ;
• tout champ signalé comme mathématiques probablement non délimitées doit être patché en Markdown avec $...$ ou en texte scolaire sans formule brute ;
• si un exercice est faux, hors périmètre ou redondant, corrige ses quatre champs. Tu peux demander sa suppression uniquement si la leçon contient 4 exercices et qu'il en restera au moins 3.

Règles de sortie :
• ne réécris jamais toute la leçon ;
• renvoie au maximum 18 patches ;
• chaque patch remplace UN champ existant, identifié par id ;
• replacement conserve le rôle du champ et utilise du Markdown mathématique avec $...$ ;
• pour un champ display_math, replacement contient seulement le LaTeX sans $ ;
• pour graph_expression, replacement contient uniquement l'expression compatible mathGraph ;
• ne corrige pas le style si le contenu est juste ;
• delete_exercise_indexes contient au plus un index 1-based, seulement dans le cas autorisé ci-dessus ;
• verdict="ok" si aucune erreur importante ; verdict="patched" si tu fournis au moins un patch ou une suppression ;
• ne retourne jamais verdict reject : une difficulté non corrigeable va dans warnings.`;

  const raw = await options.generate(
    `Voici les champs de la leçon à contrôler :\n${JSON.stringify({ fields: payload })}`,
    systemPrompt,
    reviewContract(18),
    0,
    5_000,
    true,
  );

  const record = asRecord(raw);
  const rawPatches = Array.isArray(record?.patches) ? record.patches : [];
  const rawDeleteIndexes = Array.isArray(record?.delete_exercise_indexes)
    ? record.delete_exercise_indexes
    : [];
  const rawWarnings = Array.isArray(record?.warnings) ? record.warnings : [];
  let patches = 0;
  let deletedExercises = 0;

  for (const rawPatch of rawPatches) {
    const patch = asRecord(rawPatch);
    if (!patch) continue;
    const id = stringValue(patch.id);
    const replacement = stringValue(patch.replacement).trim();
    const reference = byId.get(id);
    if (!reference || !replacement) continue;
    const before = reference.value();
    reference.set(replacement);
    if (reference.value() !== before) patches += 1;
  }

  for (const rawIndex of rawDeleteIndexes) {
    const index = Number(rawIndex);
    if (Number.isInteger(index) && removeExerciseAndReindex(value, index)) {
      deletedExercises += 1;
    }
  }
  const remainingUnstructuredMath = courseLessonUnstructuredMathFields(value);

  return {
    value,
    report: {
      patches,
      deletedExercises,
      unstructuredMathFields: remainingUnstructuredMath,
      warnings: rawWarnings
        .map((warning) => sanitizeStructuredText(warning))
        .filter(Boolean)
        .slice(0, 8),
    },
  };
}

type DuplicateExerciseRepairOptions = {
  generate: StructuredGenerator;
  blueprint: CourseBlueprint;
  level: string;
  subject: string;
  issues: CourseCoordinationIssue[];
};

function duplicateExerciseRepairContract(maxItems: number): JsonSchemaContract {
  return {
    name: "educalcul_duplicate_exercise_repairs",
    description:
      "Remplacement local des exercices inter-leçons dupliqués, sans réécriture du cours.",
    schema: {
      type: "object",
      properties: {
        replacements: {
          type: "array",
          minItems: 0,
          maxItems: Math.max(1, maxItems),
          items: {
            type: "object",
            properties: {
              id: { type: "string", minLength: 1, maxLength: 40 },
              question: { type: "string", minLength: 8 },
              answer: { type: "string", minLength: 1 },
              hint: { type: "string", minLength: 3 },
              explanation: { type: "string", minLength: 8 },
            },
            required: ["id", "question", "answer", "hint", "explanation"],
            ...noExtra,
          },
        },
      },
      required: ["replacements"],
      ...noExtra,
    },
  };
}

function locateExercise(
  chapters: StructuredCourseChapter[],
  id: string,
): { exercise: StructuredCourseExercise; chapterIndex: number; lessonIndex: number; exerciseIndex: number } | null {
  const match = /^c(\d+)-l(\d+)-e(\d+)$/.exec(id);
  if (!match) return null;
  const chapterIndex = Number(match[1]) - 1;
  const lessonIndex = Number(match[2]) - 1;
  const exerciseIndex = Number(match[3]) - 1;
  const exercise = chapters[chapterIndex]?.lessons[lessonIndex]?.exercises[exerciseIndex];
  return exercise ? { exercise, chapterIndex, lessonIndex, exerciseIndex } : null;
}

/**
 * Une seule passe finale, uniquement lorsqu'un audit local a trouvé deux
 * exercices quasi identiques. L'agent remplace le second exercice en utilisant
 * la compétence explicitement réservée par le plan.
 */
export async function replaceDuplicateCourseExercises(
  input: StructuredCourseChapter[],
  options: DuplicateExerciseRepairOptions,
): Promise<{ value: StructuredCourseChapter[]; replacements: number }> {
  const targets = options.issues
    .filter((issue) => issue.code === "duplicate_exercise")
    .map((issue) => issue.second)
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, 8);
  if (targets.length === 0) return { value: clone(input), replacements: 0 };

  const value = clone(input);
  const allExerciseSummaries = value.flatMap((chapter, chapterIndex) =>
    chapter.lessons.flatMap((lesson, lessonIndex) =>
      lesson.exercises.map((exercise, exerciseIndex) => ({
        id: `c${chapterIndex + 1}-l${lessonIndex + 1}-e${exerciseIndex + 1}`,
        lesson: lesson.title,
        question: structuredRichTextToPlainText(exercise.question),
        answer: structuredRichTextToPlainText(exercise.answer),
      })),
    ),
  );
  const targetPayload = targets.flatMap((id) => {
    const located = locateExercise(value, id);
    if (!located) return [];
    const lessonPlan = options.blueprint.chapters[located.chapterIndex]?.lessons[located.lessonIndex];
    return [{
      id,
      lesson_title: value[located.chapterIndex]?.lessons[located.lessonIndex]?.title || "",
      owned_concepts: lessonPlan?.coreConcepts ?? [],
      exercise_skills: lessonPlan?.exerciseSkills ?? [],
      forbidden_concepts: [
        ...(lessonPlan?.forbiddenConcepts ?? []),
        ...options.blueprint.chapters.flatMap((chapter, chapterIndex) =>
          chapter.lessons.flatMap((lesson, lessonIndex) =>
            chapterIndex === located.chapterIndex && lessonIndex === located.lessonIndex
              ? []
              : lesson.coreConcepts,
          ),
        ),
      ],
      current: {
        question: structuredRichTextToPlainText(located.exercise.question),
        answer: structuredRichTextToPlainText(located.exercise.answer),
        hint: structuredRichTextToPlainText(located.exercise.hint),
        explanation: structuredRichTextToPlainText(located.exercise.explanation),
      },
    }];
  });

  const raw = await options.generate(
    JSON.stringify({
      duplicates_to_replace: targetPayload,
      all_existing_exercises: allExerciseSummaries,
    }),
    `Tu es le coordinateur final des exercices Educalcul.
Niveau : ${sanitizeStructuredText(options.level)}. Sujet : ${sanitizeStructuredText(options.subject)}.
Plusieurs agents ont produit des exercices presque identiques. Remplace UNIQUEMENT les exercices ciblés.

Pour chaque id :
• choisis une compétence encore peu utilisée parmi exercise_skills ;
• reste strictement dans owned_concepts et évite forbidden_concepts ;
• crée un énoncé réellement différent des autres questions fournies ;
• recalcule la réponse de manière indépendante ;
• answer et la conclusion de explanation doivent coïncider exactement ;
• utilise du Markdown mathématique avec $...$ ;
• difficulté cohérente avec le niveau ;
• ne modifie aucun autre contenu et conserve exactement le même id.

Réponds uniquement avec le JSON demandé.`,
    duplicateExerciseRepairContract(targets.length),
    0,
    4_500,
    true,
  );

  const record = asRecord(raw);
  const replacements = Array.isArray(record?.replacements) ? record.replacements : [];
  let applied = 0;
  for (const rawReplacement of replacements) {
    const replacement = asRecord(rawReplacement);
    if (!replacement) continue;
    const id = stringValue(replacement.id);
    const located = locateExercise(value, id);
    if (!located || !targets.includes(id)) continue;
    const question = stringValue(replacement.question).trim();
    const answer = stringValue(replacement.answer).trim();
    const hint = stringValue(replacement.hint).trim();
    const explanation = stringValue(replacement.explanation).trim();
    if (!question || !answer || !hint || !explanation) continue;
    located.exercise.question = normalizeStructuredRichText(question);
    located.exercise.answer = normalizeStructuredRichText(answer);
    located.exercise.hint = normalizeStructuredRichText(hint);
    located.exercise.explanation = normalizeStructuredRichText(explanation);
    applied += 1;
  }
  return { value, replacements: applied };
}

