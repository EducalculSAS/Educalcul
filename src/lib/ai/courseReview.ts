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
  curriculumContext?: string;
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
  // Une seule réparation complète par leçon suffit en environnement
  // serverless. Si elle échoue, on refuse proprement au lieu d'épuiser les
  // 800 secondes de la fonction Vercel avec des relectures identiques.
  return boundedIntegerEnv("AI_COURSE_PUBLICATION_MAX_REPAIR_CYCLES", 1, 1, 2);
}

function globalPublicationRepairCycleLimit(): number {
  return boundedIntegerEnv("AI_COURSE_GLOBAL_MAX_REPAIR_CYCLES", 1, 1, 2);
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
    .map((part) => (part.type === "text" ? part.value : `$${part.latex}$`))
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
      required: [
        "verdict",
        "summary",
        "patches",
        "delete_exercise_indexes",
        "warnings",
      ],
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
                if (block.rows[rowIndex])
                  block.rows[rowIndex][cellIndex] = value;
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
            if (value.length === block.boundaries.length + 1)
              block.intervalSigns = value;
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
            if (value.length === block.boundaries.length)
              block.boundarySigns = value;
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
            if (value.length === Math.max(1, block.points.length - 1))
              block.directions = value;
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
            if (value.length === Math.max(1, block.points.length - 1))
              block.derivativeSigns = value;
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
  addPlainReference(
    references,
    "lesson-title",
    "lesson.title",
    "lesson_title",
    () => lesson.title,
    (value) => {
      lesson.title = value;
    },
  );
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
  const mathTokens =
    text.match(/(?:\b[a-zA-Z]\b|\d+|\^|\+|-|=|<|>|\(|\)|\[|\])/g)?.length ?? 0;
  const words = text.split(/\s+/).length;
  return hasEquation && mathTokens >= 8 && words <= 28;
}

function suspiciousReferenceIds(references: ReviewReference[]): string[] {
  return references
    .filter(
      (reference) =>
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
  if (
    index < 0 ||
    index >= lesson.exercises.length ||
    lesson.exercises.length <= 3
  ) {
    return false;
  }
  lesson.exercises.splice(index, 1);
  const rewriteBlocks = (
    blocks: StructuredCourseBlock[],
  ): StructuredCourseBlock[] =>
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

type CurriculumAwareOptions = {
  curriculumContext?: string;
};

function curriculumPromptFragment(options: CurriculumAwareOptions): string {
  const curriculum = options.curriculumContext?.trim();
  if (!curriculum) {
    return "RÉFÉRENCE DE PROGRAMME : non fournie. Reste strictement dans le niveau, le plan et le périmètre annoncés.";
  }
  return `RÉFÉRENCE DE PROGRAMME À RESPECTER STRICTEMENT :
${curriculum}`;
}

export async function reviewCourseLesson(
  input: StructuredCourseLesson,
  options: ReviewOptions,
): Promise<{
  value: StructuredCourseLesson;
  report: CourseLessonReviewReport;
}> {
  const value = clone(input);
  const references = collectReferences(value);
  const payload = references.map((reference) => ({
    id: reference.id,
    path: reference.path,
    role: reference.role,
    content: reference.value(),
  }));
  const byId = new Map(
    references.map((reference) => [reference.id, reference]),
  );
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
${curriculumPromptFragment(options)}
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
• avant d'accepter une affirmation universelle ou une inégalité, cherche activement un contre-exemple et teste plusieurs valeurs simples ;
• si une question demande de démontrer une affirmation fausse, corrige l'énoncé et ses quatre champs au lieu de tenter de justifier le faux ;
• refuse tout brouillon visible, autocorrection, « erreur, reprenons », calcul abandonné ou raisonnement contradictoire laissé dans le contenu final ;
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
): {
  exercise: StructuredCourseExercise;
  chapterIndex: number;
  lessonIndex: number;
  exerciseIndex: number;
} | null {
  const match = /^c(\d+)-l(\d+)-e(\d+)$/.exec(id);
  if (!match) return null;
  const chapterIndex = Number(match[1]) - 1;
  const lessonIndex = Number(match[2]) - 1;
  const exerciseIndex = Number(match[3]) - 1;
  const exercise =
    chapters[chapterIndex]?.lessons[lessonIndex]?.exercises[exerciseIndex];
  return exercise
    ? { exercise, chapterIndex, lessonIndex, exerciseIndex }
    : null;
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
    const lessonPlan =
      options.blueprint.chapters[located.chapterIndex]?.lessons[
        located.lessonIndex
      ];
    return [
      {
        id,
        lesson_title:
          value[located.chapterIndex]?.lessons[located.lessonIndex]?.title ||
          "",
        owned_concepts: lessonPlan?.coreConcepts ?? [],
        exercise_skills: lessonPlan?.exerciseSkills ?? [],
        forbidden_concepts: [
          ...(lessonPlan?.forbiddenConcepts ?? []),
          ...options.blueprint.chapters.flatMap((chapter, chapterIndex) =>
            chapter.lessons.flatMap((lesson, lessonIndex) =>
              chapterIndex === located.chapterIndex &&
              lessonIndex === located.lessonIndex
                ? []
                : lesson.coreConcepts,
            ),
          ),
        ],
        current: {
          question: structuredRichTextToPlainText(located.exercise.question),
          answer: structuredRichTextToPlainText(located.exercise.answer),
          hint: structuredRichTextToPlainText(located.exercise.hint),
          explanation: structuredRichTextToPlainText(
            located.exercise.explanation,
          ),
        },
      },
    ];
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
  const replacements = Array.isArray(record?.replacements)
    ? record.replacements
    : [];
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

function publicationJudgeContract(
  maxIssues: number,
  name = "educalcul_course_publication_judge",
  description =
    "Audit adversarial indépendant avant publication d'une leçon de mathématiques.",
): JsonSchemaContract {
  return {
    name,
    description,
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
            required: ["id", "severity", "category", "message", "expected_fix"],
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

function normalizeIssueCategory(
  value: unknown,
): CoursePublicationIssueCategory {
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
  const fallbackId = validIds.values().next().value as string | undefined;
  const failClosed = (message: string): CoursePublicationIssue[] =>
    fallbackId
      ? [
          {
            id: fallbackId,
            severity: "blocking",
            category: "mathematical_error",
            message,
            expectedFix:
              "Relancer la certification et obtenir un verdict structuré avec des issues ciblées valides avant toute publication.",
            source: "independent_judge",
          },
        ]
      : [];

  const record = asRecord(raw);
  if (!record) {
    return failClosed(
      "Le certificateur indépendant a renvoyé une réponse inexploitable ; la publication est refusée par sécurité.",
    );
  }
  const verdict = record.verdict;
  if (verdict !== "pass" && verdict !== "fail") {
    return failClosed(
      "Le certificateur indépendant n'a pas fourni de verdict pass/fail valide ; la publication est refusée par sécurité.",
    );
  }

  const issues = Array.isArray(record.issues) ? record.issues : [];
  const parsed = issues.flatMap((rawIssue) => {
    const issue = asRecord(rawIssue);
    if (!issue) return [];
    const id = stringValue(issue.id).trim();
    const message = stringValue(issue.message).trim();
    const expectedFix = stringValue(issue.expected_fix).trim();
    if (!id || !message || !expectedFix || !validIds.has(id)) return [];
    return [
      {
        id,
        severity:
          issue.severity === "warning"
            ? ("warning" as const)
            : ("blocking" as const),
        category: normalizeIssueCategory(issue.category),
        message,
        expectedFix,
        source: "independent_judge" as const,
      },
    ];
  });

  if (verdict === "fail" && !parsed.some((issue) => issue.severity === "blocking")) {
    return [
      ...parsed,
      ...failClosed(
        "Le certificateur a rendu verdict=fail sans fournir d'erreur bloquante ciblée valide ; la publication reste refusée.",
      ),
    ];
  }
  return parsed;
}

function extractApproximateNumbers(value: string): ApproximateNumber[] {
  const normalized = value.replace(/\u2212/g, "-");
  const pattern =
    /(?:\\approx|≈|environ|approximativement|à peu près)\s*([-+]?\d+(?:[.,]\d+)?)/gi;
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
  const relativeTolerance =
    Math.max(Math.abs(left.value), Math.abs(right.value)) * 1e-7;
  return (
    Math.abs(left.value - right.value) <=
    Math.max(roundingTolerance, relativeTolerance)
  );
}

function answerLooksTruncated(value: string): boolean {
  const clean = value.trim();
  return (
    /(?:\.\.\.|…)\s*$/.test(clean) ||
    /\[[^\]]*(?:\.\.\.|…)[^\]]*\]/.test(clean) ||
    /\b(?:todo|à compléter|réponse incomplète|suite à compléter)\b/i.test(clean)
  );
}

type FinalApproximationResult = {
  segment: string;
  values: ApproximateNumber[];
};

const FINAL_RESULT_PATTERN =
  /\b(?:donc|ainsi|finalement|en conclusion|par conséquent|d['’]où|on (?:obtient|trouve|conclut)|la réponse est|le résultat est|ce qui donne)\b|(?:≈|\\approx|\\simeq)/i;

function splitResultSegments(value: string): string[] {
  return (
    value
      .replace(/\r\n?/g, "\n")
      // Ne coupe pas les nombres décimaux comme 20.5.
      .split(/\n+|[.!?](?=\s|$)/)
      .map((segment) => segment.trim())
      .filter(Boolean)
  );
}

function finalApproximationResult(
  value: string,
): FinalApproximationResult | null {
  const segments = splitResultSegments(value);

  // On privilégie le dernier segment annonçant explicitement un résultat.
  const explicitFinalSegment = [...segments]
    .reverse()
    .find(
      (segment) =>
        FINAL_RESULT_PATTERN.test(segment) &&
        extractApproximateNumbers(segment).length > 0,
    );

  // À défaut, on prend uniquement le dernier segment contenant des valeurs.
  // Les valeurs intermédiaires plus anciennes sont donc ignorées.
  const lastNumericSegment = [...segments]
    .reverse()
    .find((segment) => extractApproximateNumbers(segment).length > 0);

  const segment = explicitFinalSegment ?? lastNumericSegment;
  if (!segment) return null;

  const values = extractApproximateNumbers(segment);
  if (values.length === 0) return null;

  return { segment, values };
}

function allApproximateNumbersArePresent(
  expected: ApproximateNumber[],
  actual: ApproximateNumber[],
): boolean {
  return expected.every((candidate) =>
    actual.some((other) => approximateNumbersMatch(candidate, other)),
  );
}

function usesPercentNotation(value: string): boolean {
  return /(?:%|\\%)/.test(value);
}

function normalizeForSemanticDetection(value: string): string {
  return value
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\(?:left|right|,|;|!)/g, "")
    .replace(/\\(?:gt|geq|ge)/g, ">")
    .replace(/\\(?:lt|leq|le)/g, "<")
    .replace(/\\cdot/g, "*")
    .replace(/\\(exp|ln|sin|cos|tan)/g, "$1")
    .replace(/\\to/g, " -> ")
    .replace(/\\infty/g, " infini ")
    .replace(/\\in/g, " in ")
    .replace(/−/g, "-")
    .replace(/[${}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const VISIBLE_SCRATCHPAD_PATTERN =
  /\b(?:recalculons|reprenons|je me suis trompe|j['’]ai fait une erreur|attendez|oups|oops|erreur[.!:]\s*(?:reprenons|recalculons|correction)|ce resultat est faux)\b/i;
const FALSE_PREMISE_PATTERN =
  /\b(?:n['’]est pas toujours vra(?:i|ie)|est fausse?|contre-exemple|l['’]enonce est faux|ne peut pas etre demontre|affirmation fausse)\b/i;
const PROOF_REQUEST_PATTERN =
  /\b(?:demontrer|montrer|prouver|etablir|en deduire|justifier que)\b/i;

function isStrictFirstExponentContext(
  options?: Pick<PublicationGateOptions, "level" | "subject">,
): boolean {
  if (!options || options.level !== "1ere-generale-maths") return false;
  return normalizeForSemanticDetection(options.subject).includes("exponent");
}

function deterministicSemanticRedFlags(
  lesson: StructuredCourseLesson,
  options?: Pick<PublicationGateOptions, "level" | "subject">,
): CoursePublicationIssue[] {
  const issues: CoursePublicationIssue[] = [];
  const references = collectReferences(lesson);
  const strictFirstExponent = isStrictFirstExponentContext(options);

  references.forEach((reference) => {
    const raw = reference.value();
    const normalized = normalizeForSemanticDetection(raw);

    if (VISIBLE_SCRATCHPAD_PATTERN.test(normalized)) {
      issues.push({
        id: reference.id,
        severity: "blocking",
        category: "proof_error",
        message:
          "Le champ contient un brouillon visible, une autocorrection ou un raisonnement abandonné qui ne doit jamais être présenté à l'élève.",
        expectedFix:
          "Réécrire le champ avec un raisonnement final propre, linéaire et vérifié, sans trace d'essais ni d'erreurs intermédiaires.",
        source: "deterministic",
      });
    }

    const compact = normalized.replace(/\s+/g, "");
    const statesGeneralExpConvexity =
      compact.includes("e^u(x)") &&
      compact.includes("f''(x)=e^u(x)(u'(x))^2") &&
      !compact.includes("u''(x)");
    if (statesGeneralExpConvexity) {
      issues.push({
        id: reference.id,
        severity: "blocking",
        category: "mathematical_error",
        message:
          "La dérivée seconde de $e^{u(x)}$ est incomplète : le terme en $u''(x)$ manque, donc la convexité générale annoncée est fausse.",
        expectedFix:
          "Utiliser $f''(x)=e^{u(x)}((u'(x))^2+u''(x))$ et ne conclure à la convexité qu'avec des hypothèses suffisantes.",
        source: "deterministic",
      });
    }

    const assertsUniqueComposedSolution =
      compact.includes("e^u(x)=k") &&
      compact.includes("admetuneuniquesolution") &&
      !/(injective|strictementmonotone|bijection)/.test(compact);
    if (assertsUniqueComposedSolution) {
      issues.push({
        id: reference.id,
        severity: "blocking",
        category: "mathematical_error",
        message:
          "Le champ affirme à tort que $e^{u(x)}=k$ possède toujours une unique solution ; le nombre de solutions dépend de l'équation $u(x)=\\ln(k)$.",
        expectedFix:
          "Énoncer seulement l'équivalence avec $u(x)=\\ln(k)$, puis préciser les hypothèses garantissant l'unicité.",
        source: "deterministic",
      });
    }

    const falseExpCubicThreshold =
      /e\^x>x\^3/.test(compact) &&
      /(?:x>3|pourtoutx>3)/.test(compact);
    if (falseExpCubicThreshold) {
      issues.push({
        id: reference.id,
        severity: "blocking",
        category: "numerical_error",
        message:
          "L'affirmation $e^x>x^3$ pour tout $x>3$ est fausse ; par exemple $e^4<4^3$.",
        expectedFix:
          "Remplacer l'énoncé par une affirmation exacte ou déterminer correctement le seuil après vérification numérique et analytique.",
        source: "deterministic",
      });
    }

    const wrongFunctionalProof =
      compact.includes("g(x)=exp(x+a)-exp(a)*exp(x)") &&
      compact.includes("g'(x)=0");
    if (wrongFunctionalProof) {
      issues.push({
        id: reference.id,
        severity: "blocking",
        category: "proof_error",
        message:
          "La preuve affirme $g'(x)=0$ pour $g(x)=\\exp(x+a)-\\exp(a)\\exp(x)$, alors que $g'(x)=g(x)$. Le raisonnement est invalide.",
        expectedFix:
          "Utiliser une fonction quotient ou produit dont la dérivée est réellement nulle, ou présenter la propriété comme admise conformément au programme.",
        source: "deterministic",
      });
    }

    const wrongTangentAtZero =
      normalized.includes("tangente") &&
      /(?:en|au point|a l abscisse)\s*0/.test(normalized) &&
      /(?:^|[\s:;])y\s*=\s*x(?:[.,;]|$)/.test(normalized) &&
      !/y\s*=\s*x\s*\+\s*1/.test(normalized);
    if (wrongTangentAtZero) {
      issues.push({
        id: reference.id,
        severity: "blocking",
        category: "graph_or_table_error",
        message:
          "La tangente à la courbe de l'exponentielle en 0 est $y=x+1$, pas $y=x$.",
        expectedFix:
          "Remplacer l'équation par $y=x+1$ et vérifier que le point $(0,1)$ et la pente 1 sont cohérents.",
        source: "deterministic",
      });
    }

    const invalidPositivityContradiction =
      compact.includes("exp(x)<=0") &&
      compact.includes("exp(-x)<=0") &&
      normalized.includes("produit") &&
      /contradiction|impossible/.test(normalized);
    if (invalidPositivityContradiction) {
      issues.push({
        id: reference.id,
        severity: "blocking",
        category: "proof_error",
        message:
          "Le raisonnement de positivité est invalide : deux nombres négatifs peuvent avoir un produit positif égal à 1.",
        expectedFix:
          "Donner une preuve valide de la stricte positivité, par exemple en utilisant $\\exp(x)=\\exp(x/2)^2$ puis le fait que l'exponentielle ne s'annule pas.",
        source: "deterministic",
      });
    }

    const falseDerivativeCausality =
      /nombre derive en 0 vaut 1.*(?:donne|definit).*nombre e/.test(normalized);
    if (falseDerivativeCausality) {
      issues.push({
        id: reference.id,
        severity: "blocking",
        category: "mathematical_error",
        message:
          "Le nombre dérivé en 0 vaut 1, mais cela ne 'donne' pas le nombre $e$ ; $e$ est défini comme $\\exp(1)$.",
        expectedFix:
          "Séparer les deux faits : $\\exp'(0)=1$ et $e=\\exp(1)$.",
        source: "deterministic",
      });
    }

    const corruptedMathematicalNotation =
      /lim_\s*x\s*(?:-|->|→)\s*\+?infini/.test(normalized) ||
      /n\s+in\s+n\^\*n/.test(normalized) ||
      /\b(?:xmapsto|xto-?infty|xto-?infini)\b/.test(normalized) ||
      /-\+\s*(?:∞|infini)/.test(raw);
    if (corruptedMathematicalNotation) {
      issues.push({
        id: reference.id,
        severity: "blocking",
        category: "notation_error",
        message:
          "La notation mathématique est dégradée au point de rendre l'énoncé ou la propriété difficile à interpréter.",
        expectedFix:
          "Réécrire entièrement le champ en français clair et en Markdown mathématique valide, sans fragments de LaTeX cassés.",
        source: "deterministic",
      });
    }

    if (strictFirstExponent) {
      const scopeRules: Array<{
        pattern: RegExp;
        label: string;
        expectedFix: string;
      }> = [
        {
          pattern: /\b(?:logarithme|ln)\b/,
          label: "logarithme népérien",
          expectedFix:
            "Remplacer par une transformation algébrique de l'exponentielle, une lecture graphique ou une modélisation ne nécessitant pas le logarithme.",
        },
        {
          pattern:
            /\b(?:nombre complexe|nombres complexes|exponentielle complexe|forme exponentielle complexe|formule d euler|module et argument|racines? cubiques?.*complex)\b|e\^i/,
          label: "nombres complexes ou formule d'Euler",
          expectedFix:
            "Remplacer par une propriété réelle de l'exponentielle conforme à la Première générale.",
        },
        {
          pattern:
            /\b(?:asymptote|croissance comparee|limite de fonction|limite en [+-]?infini)\b|lim_?\s*x/,
          label: "limites de fonctions, asymptotes ou croissance comparée",
          expectedFix:
            "Remplacer par l'étude du signe, des variations, de la courbe ou par une comparaison graphique adaptée au niveau.",
        },
        {
          pattern: /\b(?:convexite|convexe|derivee seconde|point d inflexion)\b|f''|exp''/,
          label: "convexité ou dérivée seconde",
          expectedFix:
            "Remplacer par l'étude des variations à l'aide de la dérivée première ou par la tangente sans invoquer la convexité.",
        },
        {
          pattern:
            /\b(?:equation differentielle lineaire|facteur integrant|cauchy lipschitz|probleme de cauchy)\b|y'\s*[+-]\s*[a-z0-9]*y\s*=/,
          label: "équation différentielle générale",
          expectedFix:
            "Se limiter à la définition admise de l'exponentielle par $f'=f$, $f(0)=1$, sans résoudre d'équation différentielle générale.",
        },
        {
          pattern: /\b(?:fonction exponentielle de base|base a)\b|\ba\^x\b/,
          label: "fonction exponentielle de base quelconque",
          expectedFix:
            "Revenir à la fonction exponentielle réelle $x\\mapsto e^x$ et aux fonctions $t\\mapsto e^{at}$ prévues au programme.",
        },
        {
          pattern: /\b(?:fonction contractante|theoreme de contraction|point fixe)\b/,
          label: "théorème de point fixe",
          expectedFix:
            "Remplacer par un lien élémentaire avec les suites géométriques ou une modélisation exponentielle simple.",
        },
        {
          pattern: /\be\^u\(x\)\b|\bexp\(u\(x\)\)/,
          label: "composée exponentielle générale $e^{u(x)}$",
          expectedFix:
            "Se limiter au cas affine $e^{ax+b}$ lorsque celui-ci est utile au niveau annoncé.",
        },
      ];
      for (const rule of scopeRules) {
        if (!rule.pattern.test(normalized)) continue;
        issues.push({
          id: reference.id,
          severity: "blocking",
          category: "level_mismatch",
          message: `Le champ introduit ${rule.label}, hors du périmètre strict de la fonction exponentielle en Première générale.`,
          expectedFix: rule.expectedFix,
          source: "deterministic",
        });
      }
    }
  });

  lesson.exercises.forEach((exercise, exerciseIndex) => {
    const question = normalizeForSemanticDetection(
      richTextToMarkdown(exercise.question),
    );
    const answer = normalizeForSemanticDetection(richTextToMarkdown(exercise.answer));
    const explanation = normalizeForSemanticDetection(
      richTextToMarkdown(exercise.explanation),
    );
    const combined = `${question} ${answer} ${explanation}`;
    if (
      PROOF_REQUEST_PATTERN.test(question) &&
      FALSE_PREMISE_PATTERN.test(`${answer} ${explanation}`)
    ) {
      issues.push({
        id: `e${exerciseIndex}-question`,
        severity: "blocking",
        category: "mathematical_error",
        message:
          "L'énoncé demande de démontrer une affirmation que la réponse ou la correction réfute elle-même.",
        expectedFix:
          "Remplacer l'énoncé par une proposition vraie, puis recalculer answer, hint et explanation depuis zéro.",
        source: "deterministic",
      });
    }

    const positiveGrowthHalfLife =
      /\b(?:capital|placement|interet)\b/.test(combined) &&
      /\bdemi vie\b/.test(combined) &&
      /(?:taux.*(?:positif|5\s*%)|e\^[+]?0[.,]0?5t|croissance)/.test(combined);
    if (positiveGrowthHalfLife) {
      issues.push({
        id: `e${exerciseIndex}-question`,
        severity: "blocking",
        category: "scope_error",
        message:
          "Un capital à taux positif possède un temps de doublement, pas une demi-vie. L'énoncé mélange croissance et décroissance.",
        expectedFix:
          "Demander le temps de doublement du capital, ou remplacer le contexte par une décroissance si une demi-vie est réellement visée.",
        source: "deterministic",
      });
    }

    const cubicRootsCoefficientConflict =
      /z\^3=8i/.test(question.replace(/\s+/g, "")) &&
      /sqrt\s*2|√2/.test(answer) &&
      /(?:^|\s)2e\^/.test(explanation);
    if (cubicRootsCoefficientConflict) {
      issues.push({
        id: `e${exerciseIndex}-answer`,
        severity: "blocking",
        category: "answer_explanation_conflict",
        message:
          "Pour $z^3=8i$, la réponse annonce des racines de module $\\sqrt2$ tandis que l'explication utilise le module 2.",
        expectedFix:
          "Recalculer les racines cubiques : leur module vaut $\\sqrt[3]{8}=2$, puis harmoniser answer et explanation.",
        source: "deterministic",
      });
    }
  });

  return issues;
}

function deterministicPublicationIssues(
  lesson: StructuredCourseLesson,
  options?: Pick<PublicationGateOptions, "level" | "subject">,
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
        message:
          "La réponse finale contient une ellipse ou un marqueur de contenu incomplet.",
        expectedFix:
          "Donner la réponse complète, sans ellipse ni plage tronquée.",
        source: "deterministic",
      });
    }

    const answerFinalResult = finalApproximationResult(answer);
    const explanationFinalResult = finalApproximationResult(explanation);

    if (
      answerFinalResult &&
      explanationFinalResult &&
      // 20,5 % et 0,205 peuvent représenter la même valeur.
      // Ce cas ambigu est laissé au juge indépendant.
      usesPercentNotation(answerFinalResult.segment) ===
        usesPercentNotation(explanationFinalResult.segment) &&
      !allApproximateNumbersArePresent(
        answerFinalResult.values,
        explanationFinalResult.values,
      )
    ) {
      issues.push({
        id: explanationId,
        severity: "blocking",
        category: "answer_explanation_conflict",
        message:
          `Les valeurs finales de answer ` +
          `(${answerFinalResult.values.map((item) => item.raw).join(", ")}) ` +
          `et de la conclusion de explanation ` +
          `(${explanationFinalResult.values.map((item) => item.raw).join(", ")}) ` +
          `ne coïncident pas.`,
        expectedFix:
          "Recalculer l'exercice puis terminer explanation par exactement les mêmes valeurs finales, unités et signes que answer.",
        source: "deterministic",
      });
    }
  });

  issues.push(...deterministicSemanticRedFlags(lesson, options));

  courseLessonUnstructuredMathFields(lesson).forEach((id) => {
    issues.push({
      id,
      severity: "warning",
      category: "notation_error",
      message:
        "Le champ contient probablement une formule non délimitée ou une commande LaTeX à normaliser.",
      expectedFix:
        "Réécrire le champ en Markdown mathématique valide avec $...$ lorsque cela améliore le rendu.",
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

function publicationUniversalJudgePrompt(options: PublicationGateOptions): string {
  return `Tu es le certificateur mathématique universel final d'Educalcul.
Tu contrôles en UNE SEULE PASSE la théorie, les exemples, les tableaux, les graphes et tous les exercices de la leçon. Tu ne fais confiance ni au cours ni aux réponses proposées.

Niveau : ${sanitizeStructuredText(options.level)}.
Sujet : ${sanitizeStructuredText(options.subject)}.
Cours : ${sanitizeStructuredText(options.courseTitle)}.
Chapitre : ${sanitizeStructuredText(options.chapterTitle)}.
Leçon : ${sanitizeStructuredText(options.lessonPlan.title)}.
Objectif : ${sanitizeStructuredText(options.lessonPlan.objective)}.
Périmètre : ${sanitizeStructuredText(options.lessonPlan.scope)}.
Notions propriétaires : ${options.boundaries.ownedConcepts.join(" ; ") || "non précisées"}.
Notions interdites ou réservées : ${options.boundaries.forbiddenDevelopments.join(" ; ") || "aucune"}.
Compétences des exercices : ${options.lessonPlan.exerciseSkills.join(" ; ") || "non précisées"}.
${curriculumPromptFragment(options)}

PROTOCOLE UNIVERSEL OBLIGATOIRE :
• respecte strictement le niveau, le programme, l'objectif et le périmètre de la leçon ;
• vérifie chaque définition, propriété, implication, équivalence, hypothèse et conclusion ;
• cherche un contre-exemple simple pour toute affirmation générale avant de l'accepter ;
• arithmétique et calcul numérique : refais les opérations exactement, vérifie unités, conversions, signes et arrondis ;
• algèbre : développe, factorise ou substitue indépendamment et vérifie l'ensemble complet des solutions ;
• analyse : vérifie domaine, continuité requise, dérivées, limites, signes, variations, extrema et conditions d'application ;
• géométrie et trigonométrie : vérifie les hypothèses de la figure, les coordonnées, orientations, longueurs, angles, unités et cas dégénérés ;
• probabilités et combinatoire : reconstruis l'univers, contrôle que les probabilités sont dans $[0,1]$, que les sommes et dénominateurs sont cohérents et que l'indépendance n'est jamais supposée sans justification ;
• statistiques : vérifie effectifs, fréquences, moyenne, médiane, quartiles, dispersion et cohérence des données ;
• suites, logique et mathématiques discrètes : vérifie indices, initialisation, récurrence, quantificateurs et cas de base ;
• graphes et tableaux : vérifie expression, paramètres, valeurs, racines, asymptotes, tangentes, sens des flèches et légendes ;
• pour CHAQUE exercice, résous la question depuis zéro avant de comparer answer et explanation ;
• question, answer, hint et explanation doivent être cohérents et répondre à toutes les sous-questions ;
• refuse les brouillons visibles, autocorrections, contradictions, résultats provisoires, seuils inventés et preuves circulaires ;
• un simple délimiteur mathématique manquant est warning uniquement si le sens reste totalement non ambigu ;
• chaque erreur susceptible d'enseigner quelque chose de faux est BLOCKING et cible exactement un id fourni ;
• verdict="pass" seulement si aucune erreur bloquante ne reste.

Ne réécris rien. Ne donne que le verdict structuré et les issues ciblées.`;
}

async function runUniversalPublicationJudge(
  lesson: StructuredCourseLesson,
  options: PublicationGateOptions,
  deterministicIssues: CoursePublicationIssue[],
  scope: { theory: boolean; exercises: boolean },
): Promise<CoursePublicationIssue[]> {
  const references = collectReferences(lesson).filter((reference) => {
    const exercise = reference.role.startsWith("exercise_");
    return exercise ? scope.exercises : scope.theory;
  });
  if (references.length === 0) return [];

  const validIds = new Set(references.map((reference) => reference.id));
  const raw = await options.generate(
    JSON.stringify({
      deterministic_alerts: deterministicIssues
        .filter((issue) => validIds.has(issue.id))
        .map((issue) => ({
          id: issue.id,
          severity: issue.severity,
          category: issue.category,
          message: issue.message,
        })),
      fields: references.map((reference) => ({
        id: reference.id,
        path: reference.path,
        role: reference.role,
        content: reference.value(),
      })),
      exercises: scope.exercises
        ? lesson.exercises.map((exercise, exerciseIndex) => ({
            index: exerciseIndex + 1,
            ids: {
              question: `e${exerciseIndex}-question`,
              answer: `e${exerciseIndex}-answer`,
              hint: `e${exerciseIndex}-hint`,
              explanation: `e${exerciseIndex}-explanation`,
            },
            question: richTextToMarkdown(exercise.question),
            answer: richTextToMarkdown(exercise.answer),
            hint: richTextToMarkdown(exercise.hint),
            explanation: richTextToMarkdown(exercise.explanation),
          }))
        : [],
    }),
    publicationUniversalJudgePrompt(options),
    publicationJudgeContract(
      80,
      "educalcul_universal_math_certifier",
      "Certification universelle en une passe de la théorie et des exercices d'une leçon de mathématiques.",
    ),
    0,
    options.reviewMaxTokens,
    true,
  );
  return parseJudgeIssues(raw, validIds);
}

type PublicationJudgeScope = {
  theory: boolean;
  exercises: boolean;
};

const FULL_PUBLICATION_JUDGE_SCOPE: PublicationJudgeScope = {
  theory: true,
  exercises: true,
};

function publicationJudgeScopeForIssues(
  issues: CoursePublicationIssue[],
): PublicationJudgeScope {
  const exercises = issues.some((issue) => /^e\d+-/.test(issue.id));
  const theory = issues.some((issue) => !/^e\d+-/.test(issue.id));
  return {
    theory: theory || !exercises,
    exercises,
  };
}

async function runPublicationJudge(
  lesson: StructuredCourseLesson,
  options: PublicationGateOptions,
  deterministicIssues: CoursePublicationIssue[],
  scope: PublicationJudgeScope = FULL_PUBLICATION_JUDGE_SCOPE,
): Promise<CoursePublicationIssue[]> {
  const issues = await runUniversalPublicationJudge(
    lesson,
    options,
    deterministicIssues,
    scope,
  );
  console.info(
    `[course-ai][certification] universelle « ${options.lessonPlan.title} » : ${issues.filter((issue) => issue.severity === "blocking").length} erreur(s) bloquante(s)`,
  );
  return issues;
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
  scope: PublicationJudgeScope = FULL_PUBLICATION_JUDGE_SCOPE,
): Promise<LessonPublicationAudit> {
  const deterministic = deterministicPublicationIssues(lesson, options);
  const judge = await runPublicationJudge(
    lesson,
    options,
    deterministic,
    scope,
  );
  return {
    deterministic,
    judge,
    unresolved: dedupeBlockingPublicationIssues([...deterministic, ...judge]),
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
  const byId = new Map(
    references.map((reference) => [reference.id, reference]),
  );
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
${curriculumPromptFragment(options)}
Cycle de réparation ${round}/${maxRounds}.

Corrige TOUTES les erreurs bloquantes listées, uniquement par patches locaux.
• Recalcule chaque exercice depuis l'énoncé avant d'écrire la correction et cherche un contre-exemple à toute affirmation universelle.
• Si l'énoncé demande de démontrer une affirmation fausse ou hors niveau, remplace question, answer, hint et explanation par une mini-unité exacte et conforme au programme.
• Pour une incohérence d'exercice, harmonise question, answer, hint et explanation. Réécris les quatre champs si cela évite toute ambiguïté.
• answer contient la réponse finale complète ; explanation démontre et conclut avec exactement le même résultat, les mêmes unités, les mêmes signes et les mêmes valeurs approchées.
• Une valeur intermédiaire ne doit jamais être présentée comme réponse finale.
• Pour une affirmation de cours fausse, remplace le champ entier par une version exacte, adaptée au niveau et au périmètre.
• Pour un graphe ou un tableau, la formule, les cas, la légende et les valeurs doivent être cohérents.
• Supprime toute circularité de preuve en donnant un argument valide, sans utiliser le résultat à démontrer.
• Utilise le Markdown mathématique avec $...$ ; un display_math reçoit uniquement le LaTeX sans délimiteurs.
• Ne modifie aucun champ non fourni et n'invente aucun id.
• Chaque patch remplace le champ complet, pas seulement un fragment.
• Supprime tout brouillon visible, autocorrection, calcul abandonné, « erreur », « reprenons » ou contradiction interne.
• Ne laisse aucune ellipse, aucun TODO et aucune réponse provisoire.
• Cette passe est obligatoire : renvoie au moins un patch valide lorsque des erreurs sont fournies.`,
    publicationRepairContract(Math.min(40, Math.max(8, fields.length)), true),
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
    .filter(
      (value, index, all) =>
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
      const exercise = value.exercises[
        exerciseIndex
      ] as StructuredCourseExercise;
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
${curriculumPromptFragment(options)}

Règles obligatoires :
• conserve la compétence et la difficulté visées, mais tu peux reformuler l'énoncé pour supprimer toute incohérence ;
• vérifie d'abord que l'affirmation demandée est vraie ; cherche un contre-exemple et remplace l'énoncé si nécessaire ;
• recalcule intégralement depuis l'énoncé ;
• answer donne uniquement la réponse finale complète ;
• explanation fournit un raisonnement vérifiable et se termine par exactement le même résultat que answer ;
• hint aide sans révéler directement la réponse ;
• vérifie les signes, unités, arrondis, intervalles, dates, taux et cas particuliers ;
• utilise du Markdown mathématique avec $...$ ;
• aucune ellipse, aucun TODO, aucun résultat provisoire, aucun brouillon ni autocorrection visible ;
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
    exercise.explanation = normalizeStructuredRichText(replacement.explanation);
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
): Promise<{
  value: StructuredCourseLesson;
  report: CoursePublicationGateReport;
}> {
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
    const issuesToRepair = audit.unresolved;
    const repaired = await repairPublicationIssues(
      current,
      options,
      issuesToRepair,
      round,
      maxRounds,
    );
    current = repaired.value;
    totalPatches += repaired.patches;
    audit = await auditCourseLessonForPublication(
      current,
      options,
      publicationJudgeScopeForIssues(issuesToRepair),
    );

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
      audit = await auditCourseLessonForPublication(current, options, {
        theory: false,
        exercises: true,
      });
      if (audit.unresolved.length === 0) break;
    }

    const signature = publicationIssueSignature(audit.unresolved);
    const madeProgress =
      repaired.patches > 0 ||
      exerciseRewrite.rewrites > 0 ||
      signature !== previousSignature;
    stagnantRounds = madeProgress ? 0 : stagnantRounds + 1;
    previousSignature = signature;

    // Une passe sans modification ni changement d'issue suffit : relancer
    // les mêmes juges ne ferait qu'allonger la requête jusqu'au timeout Vercel.
    if (stagnantRounds >= 1) break;
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
  curriculumContext?: string;
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
  options: Pick<GlobalPublicationGateOptions, "level" | "subject">,
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

async function runGlobalUniversalJudge(
  chapters: StructuredCourseChapter[],
  options: GlobalPublicationGateOptions,
): Promise<CoursePublicationIssue[]> {
  const references = collectCourseReferences(chapters);
  const validIds = new Set(references.map((reference) => reference.id));
  const raw = await options.generate(
    JSON.stringify({
      plan: options.blueprint.chapters.map((chapter, chapterIndex) => ({
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
      })),
      fields: references.map((reference) => ({
        id: reference.id,
        path: reference.path,
        role: reference.role,
        content: reference.value(),
      })),
    }),
    `Tu es l'inspecteur mathématique global universel d'Educalcul.
Tu contrôles en UNE SEULE PASSE la cohérence inter-leçons et la conformité au programme.

Niveau : ${sanitizeStructuredText(options.level)}.
Sujet : ${sanitizeStructuredText(options.subject)}.
${curriculumPromptFragment(options)}

Vérifie obligatoirement :
• aucune contradiction de notation, définition, convention, unité, hypothèse ou résultat entre deux leçons ;
• aucune notion hors niveau ou hors programme développée comme contenu central ;
• chaque leçon reste dans ses notions propriétaires et évite ses notions interdites ;
• progression logique, prérequis disponibles avant usage et absence de preuve utilisant une propriété non encore établie ;
• absence d'exercices ou de développements quasi identiques ;
• réponses et explications compatibles entre elles et avec les conventions du cours ;
• diversité réelle des compétences et couverture du sujet demandé sans chapitre artificiel ;
• adaptation au domaine mathématique rencontré : calcul, algèbre, analyse, géométrie, probabilités, statistiques, suites ou logique ;
• chaque problème réel est BLOCKING et cible exactement l'id du champ à corriger ;
• verdict="pass" uniquement si le cours peut être présenté tel quel au niveau annoncé.

Ne signale aucune préférence stylistique et n'invente aucun id.`,
    publicationJudgeContract(
      100,
      "educalcul_global_universal_math_certifier",
      "Certification globale universelle de cohérence, progression et conformité au programme.",
    ),
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
  const deterministic = globalDeterministicPublicationIssues(chapters, options);
  const judge = await runGlobalUniversalJudge(chapters, options);
  console.info(
    `[course-ai][certification] globale universelle : ${judge.filter((issue) => issue.severity === "blocking").length} erreur(s) bloquante(s)`,
  );
  return {
    deterministic,
    judge,
    unresolved: dedupeBlockingPublicationIssues([...deterministic, ...judge]),
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
  const byId = new Map(
    references.map((reference) => [reference.id, reference]),
  );
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
${curriculumPromptFragment(options)}
Cycle de réparation ${round}/${maxRounds}.
Corrige uniquement les incohérences inter-leçons, erreurs de niveau et défauts sémantiques listés. Les leçons ont déjà été vérifiées mathématiquement : ne réécris pas le cours et ne modifie aucun champ non fourni.
• conserve le plan, le niveau et le périmètre propriétaire de chaque leçon ;
• remplace tout contenu hors programme par un contenu exact qui enseigne la compétence prévue au niveau annoncé ;
• remplace toute définition non standard par la définition scolaire correcte ;
• harmonise les unités, symboles, hypothèses, taux et cas particuliers ;
• si un exercice est concerné, recalcule-le et harmonise question, answer, hint et explanation ;
• answer et explanation doivent se terminer par strictement le même résultat ;
• utilise du Markdown mathématique avec $...$ ;
• aucun id inventé, aucune ellipse, aucun contenu provisoire, aucun brouillon ou autocorrection visible ;
• pour toute affirmation générale, teste un contre-exemple avant de la conserver ;
• renvoie au moins un patch valide lorsque des erreurs sont fournies.`,
    publicationRepairContract(Math.min(60, Math.max(8, fields.length)), true),
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
