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

function courseReviewTokenLimit(name: string): number {
  const configured = Number(process.env[name]);
  if (!Number.isFinite(configured)) return 128_000;
  return Math.max(8_000, Math.min(128_000, Math.floor(configured)));
}

function boundedIntegerEnv(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const configured = Number(process.env[name]);
  if (!Number.isFinite(configured)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(configured)));
}

function publicationRepairCycleLimit(): number {
  return boundedIntegerEnv(
    "AI_COURSE_PUBLICATION_MAX_REPAIR_CYCLES",
    3,
    1,
    5,
  );
}

function globalPublicationRepairCycleLimit(): number {
  return boundedIntegerEnv(
    "AI_COURSE_GLOBAL_MAX_REPAIR_CYCLES",
    3,
    1,
    5,
  );
}

function publicationExerciseRewriteLimit(): number {
  return boundedIntegerEnv(
    "AI_COURSE_PUBLICATION_EXERCISE_REWRITE_LIMIT",
    3,
    0,
    6,
  );
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

function addEnumArrayReference<T extends string>(
  references: ReviewReference[],
  id: string,
  path: string,
  role: string,
  get: () => T[],
  set: (value: T[]) => void,
  allowed: readonly T[],
): void {
  references.push({
    id,
    path,
    role,
    value: () => get().join(", "),
    set: (replacement) => {
      const parsed = replacement
        .split(/[,;|]/)
        .map((item) => item.trim().toLowerCase())
        .filter((item): item is T => allowed.includes(item as T));
      if (parsed.length > 0) set(parsed);
    },
  });
}

function addNumberReference(
  references: ReviewReference[],
  id: string,
  path: string,
  role: string,
  get: () => number,
  set: (value: number) => void,
): void {
  references.push({
    id,
    path,
    role,
    value: () => String(get()),
    set: (replacement) => {
      const parsed = Number(replacement.replace(",", ".").trim());
      if (Number.isFinite(parsed)) set(parsed);
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
        addEnumArrayReference(
          references,
          `${idPrefix}-interval-signs`,
          `${path}.intervalSigns`,
          "sign_table_interval_signs",
          () => block.intervalSigns,
          (value) => {
            if (value.length === block.boundaries.length + 1) block.intervalSigns = value;
          },
          ["negative", "zero", "positive", "undefined"] as const,
        );
        addEnumArrayReference(
          references,
          `${idPrefix}-boundary-signs`,
          `${path}.boundarySigns`,
          "sign_table_boundary_signs",
          () => block.boundarySigns,
          (value) => {
            if (value.length === block.boundaries.length) block.boundarySigns = value;
          },
          ["negative", "zero", "positive", "undefined"] as const,
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
        addEnumArrayReference(
          references,
          `${idPrefix}-directions`,
          `${path}.directions`,
          "variation_directions",
          () => block.directions,
          (value) => {
            if (value.length === Math.max(1, block.points.length - 1)) block.directions = value;
          },
          ["up", "down", "constant"] as const,
        );
        addEnumArrayReference(
          references,
          `${idPrefix}-derivative-signs`,
          `${path}.derivativeSigns`,
          "variation_derivative_signs",
          () => block.derivativeSigns,
          (value) => {
            if (value.length === Math.max(1, block.points.length - 1)) block.derivativeSigns = value;
          },
          ["negative", "zero", "positive", "undefined"] as const,
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
        addNumberReference(
          references,
          `${idPrefix}-xmin`,
          `${path}.xmin`,
          "graph_xmin",
          () => block.xmin,
          (value) => {
            if (value < block.xmax) block.xmin = value;
          },
        );
        addNumberReference(
          references,
          `${idPrefix}-xmax`,
          `${path}.xmax`,
          "graph_xmax",
          () => block.xmax,
          (value) => {
            if (value > block.xmin) block.xmax = value;
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
    courseReviewTokenLimit("AI_COURSE_LESSON_REVIEW_MAX_TOKENS"),
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
    courseReviewTokenLimit("AI_COURSE_DUPLICATE_REPAIR_MAX_TOKENS"),
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


export type CoursePublicationIssueCategory =
  | "mathematical_error"
  | "answer_explanation_conflict"
  | "numerical_error"
  | "proof_error"
  | "graph_or_table_error"
  | "level_mismatch"
  | "scope_error"
  | "truncated_content"
  | "notation_error";

export type CoursePublicationIssue = {
  id: string;
  severity: "blocking" | "warning";
  category: CoursePublicationIssueCategory;
  message: string;
  expectedFix: string;
  source: "deterministic" | "independent_judge";
};

export type CoursePublicationGateReport = {
  deterministicIssuesBefore: number;
  judgeIssuesBefore: number;
  patches: number;
  repairRounds: number;
  fallbackExerciseRewrites: number;
  deterministicIssuesAfter: number;
  judgeIssuesAfter: number;
  unresolved: CoursePublicationIssue[];
};

type PublicationGateOptions = ReviewOptions & {
  reviewMaxTokens: number;
  repairMaxTokens: number;
};

type ApproximateNumber = {
  value: number;
  decimals: number;
  raw: string;
};

function publicationJudgeContract(maxIssues: number): JsonSchemaContract {
  return {
    name: "educalcul_course_publication_judge",
    description:
      "Audit adversarial indépendant avant publication d'une leçon de mathématiques.",
    schema: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["pass", "fail"] },
        summary: { type: "string" },
        issues: {
          type: "array",
          minItems: 0,
          maxItems: Math.max(1, maxIssues),
          items: {
            type: "object",
            properties: {
              id: { type: "string", minLength: 1 },
              severity: { type: "string", enum: ["blocking", "warning"] },
              category: {
                type: "string",
                enum: [
                  "mathematical_error",
                  "answer_explanation_conflict",
                  "numerical_error",
                  "proof_error",
                  "graph_or_table_error",
                  "level_mismatch",
                  "scope_error",
                  "truncated_content",
                  "notation_error",
                ],
              },
              message: { type: "string", minLength: 5 },
              expected_fix: { type: "string", minLength: 3 },
            },
            required: [
              "id",
              "severity",
              "category",
              "message",
              "expected_fix",
            ],
            ...noExtra,
          },
        },
      },
      required: ["verdict", "summary", "issues"],
      ...noExtra,
    },
  };
}

function publicationRepairContract(
  maxPatches: number,
  requirePatch = false,
): JsonSchemaContract {
  return {
    name: "educalcul_course_publication_repairs",
    description:
      "Corrections locales obligatoires des erreurs bloquantes détectées avant publication.",
    schema: {
      type: "object",
      properties: {
        patches: {
          type: "array",
          minItems: requirePatch ? 1 : 0,
          maxItems: Math.max(1, maxPatches),
          items: {
            type: "object",
            properties: {
              id: { type: "string", minLength: 1 },
              replacement: { type: "string", minLength: 1 },
              reason: { type: "string", minLength: 3 },
            },
            required: ["id", "replacement", "reason"],
            ...noExtra,
          },
        },
      },
      required: ["patches"],
      ...noExtra,
    },
  };
}

function publicationExerciseRewriteContract(): JsonSchemaContract {
  return {
    name: "educalcul_course_publication_exercise_rewrite",
    description:
      "Reconstruction complète et cohérente d'un exercice qui a résisté à une correction locale.",
    schema: {
      type: "object",
      properties: {
        question: { type: "string", minLength: 8 },
        answer: { type: "string", minLength: 1 },
        hint: { type: "string", minLength: 3 },
        explanation: { type: "string", minLength: 12 },
      },
      required: ["question", "answer", "hint", "explanation"],
      ...noExtra,
    },
  };
}

function normalizeIssueCategory(value: unknown): CoursePublicationIssueCategory {
  return value === "answer_explanation_conflict" ||
    value === "numerical_error" ||
    value === "proof_error" ||
    value === "graph_or_table_error" ||
    value === "level_mismatch" ||
    value === "scope_error" ||
    value === "truncated_content" ||
    value === "notation_error"
    ? value
    : "mathematical_error";
}

function parseJudgeIssues(
  raw: unknown,
  validIds: Set<string>,
): CoursePublicationIssue[] {
  const record = asRecord(raw);
  const issues = Array.isArray(record?.issues) ? record.issues : [];
  return issues.flatMap((rawIssue) => {
    const issue = asRecord(rawIssue);
    if (!issue) return [];
    const id = stringValue(issue.id).trim();
    const message = stringValue(issue.message).trim();
    const expectedFix = stringValue(issue.expected_fix).trim();
    if (!id || !message || !expectedFix || !validIds.has(id)) return [];
    return [{
      id,
      severity: issue.severity === "warning" ? "warning" as const : "blocking" as const,
      category: normalizeIssueCategory(issue.category),
      message,
      expectedFix,
      source: "independent_judge" as const,
    }];
  });
}

function extractApproximateNumbers(value: string): ApproximateNumber[] {
  const normalized = value.replace(/\u2212/g, "-");
  const pattern = /(?:\\approx|≈|environ|approximativement|à peu près)\s*([-+]?\d+(?:[.,]\d+)?)/gi;
  const output: ApproximateNumber[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized)) !== null) {
    const raw = match[1] || "";
    const numeric = Number(raw.replace(",", "."));
    if (!Number.isFinite(numeric)) continue;
    const decimalPart = /[.,](\d+)/.exec(raw)?.[1] ?? "";
    output.push({ value: numeric, decimals: decimalPart.length, raw });
  }
  return output;
}

function approximateNumbersMatch(
  left: ApproximateNumber,
  right: ApproximateNumber,
): boolean {
  const precision = Math.min(left.decimals, right.decimals);
  const roundingTolerance = 0.51 * 10 ** -precision;
  const relativeTolerance = Math.max(Math.abs(left.value), Math.abs(right.value)) * 1e-7;
  return Math.abs(left.value - right.value) <= Math.max(roundingTolerance, relativeTolerance);
}

function answerLooksTruncated(value: string): boolean {
  const clean = value.trim();
  return (
    /(?:\.\.\.|…)\s*$/.test(clean) ||
    /\[[^\]]*(?:\.\.\.|…)[^\]]*\]/.test(clean) ||
    /\b(?:todo|à compléter|réponse incomplète|suite à compléter)\b/i.test(clean)
  );
}

function deterministicPublicationIssues(
  lesson: StructuredCourseLesson,
): CoursePublicationIssue[] {
  const issues: CoursePublicationIssue[] = [];
  lesson.exercises.forEach((exercise, exerciseIndex) => {
    const answerId = `e${exerciseIndex}-answer`;
    const explanationId = `e${exerciseIndex}-explanation`;
    const answer = richTextToMarkdown(exercise.answer);
    const explanation = richTextToMarkdown(exercise.explanation);

    if (answerLooksTruncated(answer)) {
      issues.push({
        id: answerId,
        severity: "blocking",
        category: "truncated_content",
        message: "La réponse finale contient une ellipse ou un marqueur de contenu incomplet.",
        expectedFix: "Donner la réponse complète, sans ellipse ni plage tronquée.",
        source: "deterministic",
      });
    }

    const answerApproximations = extractApproximateNumbers(answer);
    const explanationApproximations = extractApproximateNumbers(explanation);
    if (
      answerApproximations.length > 0 &&
      explanationApproximations.length > 0 &&
      answerApproximations.some(
        (candidate) =>
          !explanationApproximations.some((other) =>
            approximateNumbersMatch(candidate, other),
          ),
      )
    ) {
      issues.push({
        id: explanationId,
        severity: "blocking",
        category: "answer_explanation_conflict",
        message: `Les valeurs approchées de answer (${answerApproximations.map((item) => item.raw).join(", ")}) et explanation (${explanationApproximations.map((item) => item.raw).join(", ")}) ne coïncident pas.`,
        expectedFix: "Recalculer puis utiliser exactement les mêmes valeurs finales dans answer et explanation.",
        source: "deterministic",
      });
    }
  });

  courseLessonUnstructuredMathFields(lesson).forEach((id) => {
    issues.push({
      id,
      severity: "blocking",
      category: "notation_error",
      message: "Le champ contient probablement une formule non délimitée ou une commande LaTeX cassée.",
      expectedFix: "Réécrire le champ en Markdown mathématique valide avec $...$.",
      source: "deterministic",
    });
  });

  return issues.filter(
    (issue, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.id === issue.id &&
          candidate.category === issue.category &&
          candidate.message === issue.message,
      ) === index,
  );
}

function publicationJudgePrompt(options: PublicationGateOptions): string {
  return `Tu es le juge mathématique final et adversarial d'Educalcul.
Tu interviens APRÈS un rédacteur et APRÈS un premier relecteur indépendant. Ton rôle n'est pas d'améliorer le style : tu dois empêcher toute erreur pédagogique de passer en production.

Niveau : ${sanitizeStructuredText(options.level)}.
Sujet : ${sanitizeStructuredText(options.subject)}.
Cours : ${sanitizeStructuredText(options.courseTitle)}.
Chapitre : ${sanitizeStructuredText(options.chapterTitle)}.
Leçon : ${sanitizeStructuredText(options.lessonPlan.title)}.
Objectif : ${sanitizeStructuredText(options.lessonPlan.objective)}.
Périmètre : ${sanitizeStructuredText(options.lessonPlan.scope)}.
Notions propriétaires : ${options.boundaries.ownedConcepts.join(" ; ") || "non précisées"}.
Notions interdites ou réservées aux autres leçons : ${options.boundaries.forbiddenDevelopments.join(" ; ") || "aucune"}.
Compétences d'exercices attendues : ${options.lessonPlan.exerciseSkills.join(" ; ") || "non précisées"}.

Audit obligatoire, champ par champ :
• refais indépendamment chaque exercice, sans faire confiance à answer ni explanation ;
• vérifie les calculs exacts ET les valeurs approchées, y compris unités, pourcentages, dates, intérêts, taux continus, suites et changements de variable ;
• vérifie les inégalités numériques et les comparaisons de constantes avant de conclure sur une limite ou une suite ;
• vérifie les dérivées, signes, tableaux, extrema, discriminants, domaines, cas paramétriques, nombre de solutions et sens des implications ;
• vérifie les démonstrations : aucune circularité, hypothèse manquante ou propriété utilisée avant d'être établie ;
• vérifie les graphes et légendes : expression, asymptote, tangente, pente, convexité, demi-vie, limites et paramètres doivent décrire le même objet ;
• vérifie les tableaux : tous les cas particuliers doivent être exacts, notamment quand un paramètre vaut zéro ;
• vérifie que answer et la conclusion de explanation donnent strictement le même résultat ;
• refuse toute réponse tronquée, intervalle avec « ... », formule brute cassée ou notation ambiguë ;
• refuse les définitions non standard présentées comme générales et les notions hors niveau non demandées ;
• distingue croissance, vitesse de croissance et convexité ; minimum et infimum ; taux nominal, périodique et continu ;
• une imprécision qui peut faire apprendre quelque chose de faux est BLOCKING.

Règles de sortie :
• chaque issue cible exactement un id fourni ;
• pour un exercice, cible answer si le résultat final est faux, explanation si le raisonnement est faux, question si l'énoncé est incohérent, hint si l'indice induit en erreur ;
• verdict="pass" seulement s'il ne reste AUCUNE issue blocking ;
• ne signale pas de préférence stylistique ;
• n'invente aucun id.`;
}

async function runPublicationJudge(
  lesson: StructuredCourseLesson,
  options: PublicationGateOptions,
  deterministicIssues: CoursePublicationIssue[],
): Promise<CoursePublicationIssue[]> {
  const references = collectReferences(lesson);
  const payload = references.map((reference) => ({
    id: reference.id,
    path: reference.path,
    role: reference.role,
    content: reference.value(),
  }));
  const validIds = new Set(references.map((reference) => reference.id));
  const raw = await options.generate(
    JSON.stringify({
      deterministic_alerts: deterministicIssues.map((issue) => ({
        id: issue.id,
        category: issue.category,
        message: issue.message,
      })),
      fields: payload,
    }),
    publicationJudgePrompt(options),
    publicationJudgeContract(40),
    0,
    options.reviewMaxTokens,
    true,
  );
  return parseJudgeIssues(raw, validIds);
}

function relatedReferenceIds(issueId: string, allIds: string[]): string[] {
  const exerciseMatch = /^(e\d+)-/.exec(issueId);
  if (exerciseMatch) {
    return allIds.filter((id) => id.startsWith(`${exerciseMatch[1]}-`));
  }
  const blockMatch = /^(lesson(?:-[^\s]+)*-b\d+)/.exec(issueId);
  if (blockMatch) {
    return allIds.filter((id) => id.startsWith(blockMatch[1] as string));
  }
  return allIds.includes(issueId) ? [issueId] : [];
}

type LessonPublicationAudit = {
  deterministic: CoursePublicationIssue[];
  judge: CoursePublicationIssue[];
  unresolved: CoursePublicationIssue[];
};

function dedupeBlockingPublicationIssues(
  issues: CoursePublicationIssue[],
): CoursePublicationIssue[] {
  return issues
    .filter((issue) => issue.severity === "blocking")
    .filter(
      (issue, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.id === issue.id &&
            candidate.category === issue.category &&
            candidate.message === issue.message,
        ) === index,
    );
}

function publicationIssueSignature(issues: CoursePublicationIssue[]): string {
  return issues
    .map((issue) => `${issue.id}:${issue.category}`)
    .sort()
    .join("|");
}

async function auditCourseLessonForPublication(
  lesson: StructuredCourseLesson,
  options: PublicationGateOptions,
): Promise<LessonPublicationAudit> {
  const deterministic = deterministicPublicationIssues(lesson);
  const judge = await runPublicationJudge(lesson, options, deterministic);
  return {
    deterministic,
    judge,
    unresolved: dedupeBlockingPublicationIssues([
      ...deterministic,
      ...judge,
    ]),
  };
}

async function repairPublicationIssues(
  lesson: StructuredCourseLesson,
  options: PublicationGateOptions,
  issues: CoursePublicationIssue[],
  round: number,
  maxRounds: number,
): Promise<{ value: StructuredCourseLesson; patches: number }> {
  const value = clone(lesson);
  const references = collectReferences(value);
  const byId = new Map(references.map((reference) => [reference.id, reference]));
  const allIds = references.map((reference) => reference.id);
  const selectedIds = new Set(
    issues.flatMap((issue) => relatedReferenceIds(issue.id, allIds)),
  );
  const fields = references
    .filter((reference) => selectedIds.has(reference.id))
    .map((reference) => ({
      id: reference.id,
      path: reference.path,
      role: reference.role,
      content: reference.value(),
    }));

  if (fields.length === 0) return { value, patches: 0 };

  const raw = await options.generate(
    JSON.stringify({
      repair_round: round,
      maximum_rounds: maxRounds,
      issues: issues.map((issue) => ({
        id: issue.id,
        category: issue.category,
        message: issue.message,
        expected_fix: issue.expectedFix,
      })),
      editable_fields: fields,
    }),
    `Tu es le correcteur mathématique ciblé d'Educalcul.
Niveau : ${sanitizeStructuredText(options.level)}. Sujet : ${sanitizeStructuredText(options.subject)}.
Leçon : ${sanitizeStructuredText(options.lessonPlan.title)}.
Cycle de réparation ${round}/${maxRounds}.

Corrige TOUTES les erreurs bloquantes listées, uniquement par patches locaux.
• Recalcule chaque exercice depuis l'énoncé avant d'écrire la correction.
• Pour une incohérence d'exercice, harmonise question, answer, hint et explanation. Réécris les quatre champs si cela évite toute ambiguïté.
• answer contient la réponse finale complète ; explanation démontre et conclut avec exactement le même résultat, les mêmes unités, les mêmes signes et les mêmes valeurs approchées.
• Une valeur intermédiaire ne doit jamais être présentée comme réponse finale.
• Pour une affirmation de cours fausse, remplace le champ entier par une version exacte, adaptée au niveau et au périmètre.
• Pour un graphe ou un tableau, la formule, les cas, la légende et les valeurs doivent être cohérents.
• Supprime toute circularité de preuve en donnant un argument valide, sans utiliser le résultat à démontrer.
• Utilise le Markdown mathématique avec $...$ ; un display_math reçoit uniquement le LaTeX sans délimiteurs.
• Ne modifie aucun champ non fourni et n'invente aucun id.
• Chaque patch remplace le champ complet, pas seulement un fragment.
• Ne laisse aucune ellipse, aucun TODO et aucune réponse provisoire.
• Cette passe est obligatoire : renvoie au moins un patch valide lorsque des erreurs sont fournies.`,
    publicationRepairContract(
      Math.min(40, Math.max(8, fields.length)),
      true,
    ),
    0,
    options.repairMaxTokens,
    true,
  );

  const record = asRecord(raw);
  const patches = Array.isArray(record?.patches) ? record.patches : [];
  let applied = 0;
  for (const rawPatch of patches) {
    const patch = asRecord(rawPatch);
    if (!patch) continue;
    const id = stringValue(patch.id).trim();
    const replacement = stringValue(patch.replacement).trim();
    const reference = byId.get(id);
    if (!reference || !selectedIds.has(id) || !replacement) continue;
    const before = reference.value();
    reference.set(replacement);
    if (reference.value() !== before) applied += 1;
  }
  return { value, patches: applied };
}

function exerciseIndexesForPublicationIssues(
  issues: CoursePublicationIssue[],
): number[] {
  return issues
    .map((issue) => /^(?:e)(\d+)-/.exec(issue.id)?.[1])
    .filter((value): value is string => typeof value === "string")
    .map((value) => Number(value))
    .filter((value, index, all) =>
      Number.isInteger(value) && value >= 0 && all.indexOf(value) === index,
    );
}

async function rewritePublicationExercises(
  lesson: StructuredCourseLesson,
  options: PublicationGateOptions,
  issues: CoursePublicationIssue[],
  alreadyRewritten: Set<number>,
): Promise<{
  value: StructuredCourseLesson;
  rewrites: number;
  rewrittenIndexes: number[];
}> {
  const value = clone(lesson);
  const remainingLimit = Math.max(
    0,
    publicationExerciseRewriteLimit() - alreadyRewritten.size,
  );
  if (remainingLimit === 0) {
    return { value, rewrites: 0, rewrittenIndexes: [] };
  }

  const indexes = exerciseIndexesForPublicationIssues(issues)
    .filter((index) => !alreadyRewritten.has(index))
    .filter((index) => Boolean(value.exercises[index]))
    .slice(0, remainingLimit);
  if (indexes.length === 0) {
    return { value, rewrites: 0, rewrittenIndexes: [] };
  }

  const replacements = await Promise.all(
    indexes.map(async (exerciseIndex) => {
      const exercise = value.exercises[exerciseIndex] as StructuredCourseExercise;
      const exerciseIssues = issues.filter((issue) =>
        issue.id.startsWith(`e${exerciseIndex}-`),
      );
      const raw = await options.generate(
        JSON.stringify({
          exercise_index: exerciseIndex + 1,
          expected_skill:
            options.lessonPlan.exerciseSkills[exerciseIndex] ??
            options.lessonPlan.exerciseSkills[0] ??
            "application directe de la leçon",
          blocking_issues: exerciseIssues.map((issue) => ({
            field: issue.id,
            category: issue.category,
            message: issue.message,
            expected_fix: issue.expectedFix,
          })),
          current_exercise: {
            question: richTextToMarkdown(exercise.question),
            answer: richTextToMarkdown(exercise.answer),
            hint: richTextToMarkdown(exercise.hint),
            explanation: richTextToMarkdown(exercise.explanation),
          },
        }),
        `Tu es l'agent de secours de la barrière de publication Educalcul.
L'exercice a résisté à une correction locale. Reconstruis cette mini-unité complète de façon mathématiquement exacte.

Niveau : ${sanitizeStructuredText(options.level)}.
Sujet : ${sanitizeStructuredText(options.subject)}.
Leçon : ${sanitizeStructuredText(options.lessonPlan.title)}.

Règles obligatoires :
• conserve la compétence et la difficulté visées, mais tu peux reformuler l'énoncé pour supprimer toute incohérence ;
• recalcule intégralement depuis l'énoncé ;
• answer donne uniquement la réponse finale complète ;
• explanation fournit un raisonnement vérifiable et se termine par exactement le même résultat que answer ;
• hint aide sans révéler directement la réponse ;
• vérifie les signes, unités, arrondis, intervalles, dates, taux et cas particuliers ;
• utilise du Markdown mathématique avec $...$ ;
• aucune ellipse, aucun TODO, aucun résultat provisoire ;
• retourne les quatre champs, même si un seul semblait incorrect.`,
        publicationExerciseRewriteContract(),
        0,
        options.repairMaxTokens,
        true,
      );
      const record = asRecord(raw);
      const question = stringValue(record?.question).trim();
      const answer = stringValue(record?.answer).trim();
      const hint = stringValue(record?.hint).trim();
      const explanation = stringValue(record?.explanation).trim();
      if (!question || !answer || !hint || !explanation) return null;
      return { exerciseIndex, question, answer, hint, explanation };
    }),
  );

  const rewrittenIndexes: number[] = [];
  for (const replacement of replacements) {
    if (!replacement) continue;
    const exercise = value.exercises[replacement.exerciseIndex];
    if (!exercise) continue;
    exercise.question = normalizeStructuredRichText(replacement.question);
    exercise.answer = normalizeStructuredRichText(replacement.answer);
    exercise.hint = normalizeStructuredRichText(replacement.hint);
    exercise.explanation = normalizeStructuredRichText(
      replacement.explanation,
    );
    rewrittenIndexes.push(replacement.exerciseIndex);
  }

  return {
    value,
    rewrites: rewrittenIndexes.length,
    rewrittenIndexes,
  };
}

/**
 * Barrière finale « fail closed » : jusqu'à trois cycles ciblés
 * check -> repair -> check. Une incohérence persistante dans un exercice
 * déclenche la reconstruction de cette mini-unité uniquement, jamais celle de
 * la leçon entière. Le cours reste refusé si une erreur bloque encore après le
 * nombre maximal de cycles.
 */
export async function verifyCourseLessonForPublication(
  input: StructuredCourseLesson,
  options: PublicationGateOptions,
): Promise<{ value: StructuredCourseLesson; report: CoursePublicationGateReport }> {
  let current = clone(input);
  const maxRounds = publicationRepairCycleLimit();
  const rewrittenExercises = new Set<number>();
  let totalPatches = 0;
  let repairRounds = 0;
  let fallbackExerciseRewrites = 0;

  const before = await auditCourseLessonForPublication(current, options);
  let audit = before;

  if (audit.unresolved.length === 0) {
    return {
      value: current,
      report: {
        deterministicIssuesBefore: before.deterministic.length,
        judgeIssuesBefore: before.judge.length,
        patches: 0,
        repairRounds: 0,
        fallbackExerciseRewrites: 0,
        deterministicIssuesAfter: before.deterministic.length,
        judgeIssuesAfter: before.judge.length,
        unresolved: [],
      },
    };
  }

  let previousSignature = publicationIssueSignature(audit.unresolved);
  let stagnantRounds = 0;

  for (let round = 1; round <= maxRounds; round += 1) {
    repairRounds = round;
    const repaired = await repairPublicationIssues(
      current,
      options,
      audit.unresolved,
      round,
      maxRounds,
    );
    current = repaired.value;
    totalPatches += repaired.patches;
    audit = await auditCourseLessonForPublication(current, options);

    if (audit.unresolved.length === 0) break;

    const exerciseRewrite = await rewritePublicationExercises(
      current,
      options,
      audit.unresolved,
      rewrittenExercises,
    );
    if (exerciseRewrite.rewrites > 0) {
      current = exerciseRewrite.value;
      fallbackExerciseRewrites += exerciseRewrite.rewrites;
      exerciseRewrite.rewrittenIndexes.forEach((index) =>
        rewrittenExercises.add(index),
      );
      audit = await auditCourseLessonForPublication(current, options);
      if (audit.unresolved.length === 0) break;
    }

    const signature = publicationIssueSignature(audit.unresolved);
    const madeProgress =
      repaired.patches > 0 ||
      exerciseRewrite.rewrites > 0 ||
      signature !== previousSignature;
    stagnantRounds = madeProgress ? 0 : stagnantRounds + 1;
    previousSignature = signature;

    // Deux cycles sans aucune modification ni changement d'issue suffisent à
    // conclure que de nouvelles requêtes identiques n'apporteraient rien.
    if (stagnantRounds >= 2) break;
  }

  return {
    value: current,
    report: {
      deterministicIssuesBefore: before.deterministic.length,
      judgeIssuesBefore: before.judge.length,
      patches: totalPatches,
      repairRounds,
      fallbackExerciseRewrites,
      deterministicIssuesAfter: audit.deterministic.length,
      judgeIssuesAfter: audit.judge.length,
      unresolved: audit.unresolved,
    },
  };
}

export type CourseGlobalPublicationGateReport = {
  issuesBefore: number;
  patches: number;
  repairRounds: number;
  issuesAfter: number;
  unresolved: CoursePublicationIssue[];
};

type GlobalPublicationGateOptions = {
  generate: StructuredGenerator;
  blueprint: CourseBlueprint;
  level: string;
  subject: string;
  reviewMaxTokens: number;
  repairMaxTokens: number;
};

function collectCourseReferences(
  chapters: StructuredCourseChapter[],
): ReviewReference[] {
  return chapters.flatMap((chapter, chapterIndex) =>
    chapter.lessons.flatMap((lesson, lessonIndex) =>
      collectReferences(lesson).map((reference) => ({
        id: `c${chapterIndex + 1}-l${lessonIndex + 1}-${reference.id}`,
        path: `chapters[${chapterIndex}].lessons[${lessonIndex}].${reference.path}`,
        role: reference.role,
        value: reference.value,
        set: reference.set,
      })),
    ),
  );
}

function globalDeterministicPublicationIssues(
  chapters: StructuredCourseChapter[],
): CoursePublicationIssue[] {
  return chapters.flatMap((chapter, chapterIndex) =>
    chapter.lessons.flatMap((lesson, lessonIndex) =>
      deterministicPublicationIssues(lesson).map((issue) => ({
        ...issue,
        id: `c${chapterIndex + 1}-l${lessonIndex + 1}-${issue.id}`,
      })),
    ),
  );
}

async function runGlobalPublicationJudge(
  chapters: StructuredCourseChapter[],
  options: GlobalPublicationGateOptions,
): Promise<CoursePublicationIssue[]> {
  const references = collectCourseReferences(chapters);
  const validIds = new Set(references.map((reference) => reference.id));
  const plan = options.blueprint.chapters.map((chapter, chapterIndex) => ({
    chapter: chapterIndex + 1,
    title: chapter.title,
    scope: chapter.scope,
    lessons: chapter.lessons.map((lesson, lessonIndex) => ({
      lesson: lessonIndex + 1,
      title: lesson.title,
      objective: lesson.objective,
      owned_concepts: lesson.coreConcepts,
      forbidden_concepts: lesson.forbiddenConcepts,
    })),
  }));
  const raw = await options.generate(
    JSON.stringify({
      plan,
      fields: references.map((reference) => ({
        id: reference.id,
        path: reference.path,
        role: reference.role,
        content: reference.value(),
      })),
    }),
    `Tu es le dernier comité de publication global d'Educalcul.
Le cours a déjà passé une relecture puis un juge mathématique par leçon. Tu contrôles uniquement les défauts qui nécessitent de voir le cours entier.

Niveau : ${sanitizeStructuredText(options.level)}.
Sujet : ${sanitizeStructuredText(options.subject)}.

Vérifie obligatoirement :
• aucune définition, propriété ou convention ne se contredit entre deux leçons ;
• aucun cas particulier n'est présenté ailleurs comme une définition générale ;
• la progression respecte le plan et le niveau scolaire ;
• une notion réservée à une autre leçon n'est pas redéveloppée de façon contradictoire ;
• les mêmes symboles gardent le même sens ;
• les modèles discret et continu, taux, unités et paramètres restent cohérents d'une leçon à l'autre ;
• les graphes, tableaux et synthèses ne contredisent pas les paragraphes ou exercices ;
• aucune leçon n'introduit une notion hors programme comme indispensable ;
• aucune répétition substantielle n'occupe la place d'un contenu utile ;
• aucune erreur mathématique manifeste n'a échappé aux contrôles précédents.

Ne signale pas une simple préférence de style. Chaque problème susceptible d'enseigner quelque chose de faux ou de rendre le cours non exploitable est blocking.
Chaque issue cible exactement un id fourni. verdict="pass" seulement si aucune issue blocking ne reste.`,
    publicationJudgeContract(60),
    0,
    options.reviewMaxTokens,
    true,
  );
  return parseJudgeIssues(raw, validIds);
}

type GlobalPublicationAudit = {
  deterministic: CoursePublicationIssue[];
  judge: CoursePublicationIssue[];
  unresolved: CoursePublicationIssue[];
};

async function auditCourseGloballyForPublication(
  chapters: StructuredCourseChapter[],
  options: GlobalPublicationGateOptions,
): Promise<GlobalPublicationAudit> {
  const deterministic = globalDeterministicPublicationIssues(chapters);
  const judge = await runGlobalPublicationJudge(chapters, options);
  return {
    deterministic,
    judge,
    unresolved: dedupeBlockingPublicationIssues([
      ...deterministic,
      ...judge,
    ]),
  };
}

async function repairGlobalPublicationIssues(
  chapters: StructuredCourseChapter[],
  options: GlobalPublicationGateOptions,
  issues: CoursePublicationIssue[],
  round: number,
  maxRounds: number,
): Promise<{ value: StructuredCourseChapter[]; patches: number }> {
  const value = clone(chapters);
  const references = collectCourseReferences(value);
  const byId = new Map(references.map((reference) => [reference.id, reference]));
  const selectedIds = new Set(
    issues.flatMap((issue) =>
      relatedReferenceIds(
        issue.id,
        references.map((reference) => reference.id),
      ),
    ),
  );
  // Les ids globaux préfixés ne sont pas reconnus par relatedReferenceIds.
  issues.forEach((issue) => {
    if (byId.has(issue.id)) selectedIds.add(issue.id);
    const exercisePrefix = /^(c\d+-l\d+-e\d+)-/.exec(issue.id)?.[1];
    if (exercisePrefix) {
      references.forEach((reference) => {
        if (reference.id.startsWith(`${exercisePrefix}-`)) {
          selectedIds.add(reference.id);
        }
      });
    }
    const blockPrefix = /^(c\d+-l\d+-lesson(?:-[^\s]+)*-b\d+)/.exec(
      issue.id,
    )?.[1];
    if (blockPrefix) {
      references.forEach((reference) => {
        if (reference.id.startsWith(blockPrefix)) {
          selectedIds.add(reference.id);
        }
      });
    }
  });
  const fields = references
    .filter((reference) => selectedIds.has(reference.id))
    .map((reference) => ({
      id: reference.id,
      path: reference.path,
      role: reference.role,
      content: reference.value(),
    }));

  if (fields.length === 0) return { value, patches: 0 };

  const raw = await options.generate(
    JSON.stringify({
      repair_round: round,
      maximum_rounds: maxRounds,
      issues: issues.map((issue) => ({
        id: issue.id,
        category: issue.category,
        message: issue.message,
        expected_fix: issue.expectedFix,
      })),
      editable_fields: fields,
    }),
    `Tu es le correcteur global final d'Educalcul.
Cycle de réparation ${round}/${maxRounds}.
Corrige uniquement les incohérences inter-leçons listées. Les leçons ont déjà été vérifiées mathématiquement : ne réécris pas le cours et ne modifie aucun champ non fourni.
• conserve le plan, le niveau et le périmètre propriétaire de chaque leçon ;
• remplace toute définition non standard par la définition scolaire correcte ;
• harmonise les unités, symboles, hypothèses, taux et cas particuliers ;
• si un exercice est concerné, recalcule-le et harmonise question, answer, hint et explanation ;
• answer et explanation doivent se terminer par strictement le même résultat ;
• utilise du Markdown mathématique avec $...$ ;
• aucun id inventé, aucune ellipse, aucun contenu provisoire ;
• renvoie au moins un patch valide lorsque des erreurs sont fournies.`,
    publicationRepairContract(
      Math.min(60, Math.max(8, fields.length)),
      true,
    ),
    0,
    options.repairMaxTokens,
    true,
  );
  const record = asRecord(raw);
  const patches = Array.isArray(record?.patches) ? record.patches : [];
  let applied = 0;
  for (const rawPatch of patches) {
    const patch = asRecord(rawPatch);
    if (!patch) continue;
    const id = stringValue(patch.id).trim();
    const replacement = stringValue(patch.replacement).trim();
    const reference = byId.get(id);
    if (!reference || !selectedIds.has(id) || !replacement) continue;
    const before = reference.value();
    reference.set(replacement);
    if (reference.value() !== before) applied += 1;
  }
  return { value, patches: applied };
}

/**
 * Contrôle inter-leçons itératif après les barrières unitaires. Jusqu'à trois
 * cycles check -> repair -> check sont autorisés. Le moindre problème bloquant
 * restant après le dernier cycle empêche toujours l'enregistrement du cours.
 */
export async function verifyCourseGloballyForPublication(
  input: StructuredCourseChapter[],
  options: GlobalPublicationGateOptions,
): Promise<{
  value: StructuredCourseChapter[];
  report: CourseGlobalPublicationGateReport;
}> {
  let current = clone(input);
  const maxRounds = globalPublicationRepairCycleLimit();
  let totalPatches = 0;
  let repairRounds = 0;

  const before = await auditCourseGloballyForPublication(current, options);
  let audit = before;

  if (audit.unresolved.length === 0) {
    return {
      value: current,
      report: {
        issuesBefore: before.deterministic.length + before.judge.length,
        patches: 0,
        repairRounds: 0,
        issuesAfter: 0,
        unresolved: [],
      },
    };
  }

  let previousSignature = publicationIssueSignature(audit.unresolved);
  let stagnantRounds = 0;

  for (let round = 1; round <= maxRounds; round += 1) {
    repairRounds = round;
    const repaired = await repairGlobalPublicationIssues(
      current,
      options,
      audit.unresolved,
      round,
      maxRounds,
    );
    current = repaired.value;
    totalPatches += repaired.patches;
    audit = await auditCourseGloballyForPublication(current, options);
    if (audit.unresolved.length === 0) break;

    const signature = publicationIssueSignature(audit.unresolved);
    const madeProgress =
      repaired.patches > 0 || signature !== previousSignature;
    stagnantRounds = madeProgress ? 0 : stagnantRounds + 1;
    previousSignature = signature;
    if (stagnantRounds >= 2) break;
  }

  return {
    value: current,
    report: {
      issuesBefore: before.deterministic.length + before.judge.length,
      patches: totalPatches,
      repairRounds,
      issuesAfter: audit.deterministic.length + audit.judge.length,
      unresolved: audit.unresolved,
    },
  };
}

