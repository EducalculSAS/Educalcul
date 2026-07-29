import type { JsonSchemaContract } from "@/lib/ai/schemas";
import {
  normalizeStructuredLatex,
  normalizeStructuredRichText,
  sanitizeStructuredText,
  type StructuredCourseBlock,
  type StructuredCourseExercise,
  type StructuredCourseLesson,
  type StructuredGenerator,
  type StructuredRichText,
} from "@/lib/ai/structuredContent";
import type {
  CourseBlueprintLesson,
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
        warnings: {
          type: "array",
          minItems: 0,
          maxItems: 8,
          items: { type: "string" },
        },
      },
      required: ["verdict", "summary", "patches", "warnings"],
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

Contrôle obligatoirement :
• exactitude des définitions, calculs, limites, dérivées, signes, intervalles, extrema et preuves ;
• cohérence entre chaque question, answer et explanation ;
• légendes de graphiques : pente, tangente, asymptote, variations et convexité doivent être exactes ;
• dans graph_caption et figure_caption, tout symbole ou expression (infini, lambda, fraction, comparaison, f(x)=...) est entre $...$ ; si tu trouves "infty", "-infty", "lambda" ou une inégalité écrite en toutes lettres, corrige-la avec la notation $...$ correspondante ;
• tableaux : chaque cellule et chaque cas doivent être cohérents avec les hypothèses ;
• aucune affirmation plus forte que ce qui est démontré ;
• aucune confusion entre minimum et infimum, implication et équivalence, croissance et convexité ;
• aucune répétition développée d'une notion interdite. Un rappel autorisé tient en une phrase.
• si le callout "Point clé" ou le tableau de synthèse ne fait que reformuler le dernier paragraphe ou la dernière propriété déjà énoncés, patch son contenu (callout_paragraph, table_cell) pour qu'il apporte une information réellement absente du texte (comparaison de cas, piège fréquent, lien avec un autre chapitre) plutôt que de le laisser redondant ;
• si un exercice développe une notion interdite ou hors périmètre, ne le laisse pas simplement en warning : remplace localement ses quatre champs question, answer, hint et explanation par un exercice de difficulté comparable strictement dans le périmètre de la leçon.

Règles de sortie :
• ne réécris jamais toute la leçon ;
• renvoie au maximum 18 patches ;
• chaque patch remplace UN champ existant, identifié par id ;
• replacement conserve le rôle du champ et utilise du Markdown mathématique avec $...$ ;
• pour un champ display_math, replacement contient seulement le LaTeX sans $ ;
• pour graph_expression, replacement contient uniquement l'expression compatible mathGraph ;
• ne corrige pas le style si le contenu est juste ;
• verdict="ok" si aucune erreur importante ; verdict="patched" si tu fournis au moins un patch.
• ne retourne jamais verdict reject : une difficulté non corrigeable va dans warnings.`;

  const raw = await options.generate(
    `Voici les champs de la leçon à contrôler :\n${JSON.stringify({ fields: payload })}`,
    systemPrompt,
    reviewContract(18),
    0,
    3_800,
    false,
  );

  const record = asRecord(raw);
  const rawPatches = Array.isArray(record?.patches) ? record.patches : [];
  const rawWarnings = Array.isArray(record?.warnings) ? record.warnings : [];
  let patches = 0;

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

  return {
    value,
    report: {
      patches,
      warnings: rawWarnings
        .map((warning) => sanitizeStructuredText(warning))
        .filter(Boolean)
        .slice(0, 8),
    },
  };
}
