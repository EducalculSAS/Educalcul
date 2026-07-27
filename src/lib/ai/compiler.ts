import {
  isStructuredLatexValid,
  normalizeStructuredLatex,
  sanitizeStructuredText,
  structuredRichTextToPlainText,
  type StructuredCourseBlock,
  type StructuredCourseChapter,
  type StructuredExerciseDraft,
  type StructuredExerciseQuestion,
  type StructuredQuizDraft,
  type StructuredRichText,
} from "@/lib/ai/structuredContent";

export type CompiledCourseExercise = {
  id: string;
  question: string;
  type: "short_answer";
  answer: string;
  hint: string;
  explanation: string;
};

export type CompiledCourseLesson = {
  id: string;
  type: "text";
  title: string;
  content: string;
  duration: number;
  exercises: CompiledCourseExercise[];
};

export type CompiledCourseChapter = {
  id: string;
  title: string;
  lessons: CompiledCourseLesson[];
};

export type CompiledExerciseBlock = {
  id: string;
  type:
    | "text"
    | "text_input"
    | "qcm"
    | "true_false"
    | "fill_in_the_blank"
    | "matching"
    | "ordering"
    | "coding";
  title: string;
  content?: string;
  points?: number;
  options?: string[];
  correctAnswer?: string | string[];
  explanation?: string;
  blanks?: string[];
  pairs?: Array<{ left: string; right: string }>;
  items?: string[];
};

export type CompiledExercisePage = {
  id: string;
  title: string;
  blocks: CompiledExerciseBlock[];
};

export type CompiledQuizQuestion = {
  id: string;
  text: string;
  type: "single_choice";
  points: number;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function readableMathFallback(latex: string): string {
  return sanitizeStructuredText(latex.replace(/\\([A-Za-z]+)/g, "$1"));
}

/** Compile du texte structuré vers les chaînes historiques attendues par les
 * viewers. Seules les formules validées par KaTeX reçoivent des délimiteurs.
 * Une formule invalide devient du texte : aucun $ cassé ne peut être stocké. */
export function compileStructuredRichText(value: StructuredRichText): string {
  const compiled = value.parts.map((part) => {
    if (part.type === "text") {
      return {
        html: escapeHtml(part.value),
        source: part.value,
      };
    }
    const latex = normalizeStructuredLatex(part.latex);
    const readable = readableMathFallback(latex) || "Formule mathématique";
    return {
      html: isStructuredLatexValid(latex)
        ? `$${latex}$`
        : escapeHtml(readable),
      source: readable,
    };
  });

  let output = "";
  compiled.forEach((part, index) => {
    const previous = compiled[index - 1];
    if (previous) {
      const previousLast = previous.source.at(-1) || "";
      const currentFirst = part.source[0] || "";
      const alreadySeparated = /\s/.test(previousLast) || /\s/.test(currentFirst);
      const punctuation = /^[,.;:!?%)\]}]/.test(currentFirst);
      const opening = /[(\[{]$/.test(previousLast);
      if (!alreadySeparated && !punctuation && !opening) output += " ";
    }
    output += part.html;
  });
  return output;
}

function compileDisplayMath(latex: string, fallbackText?: string): string {
  const normalized = normalizeStructuredLatex(latex);
  if (isStructuredLatexValid(normalized)) {
    return `<p>$$${normalized}$$</p>`;
  }
  const fallback = sanitizeStructuredText(fallbackText) || readableMathFallback(normalized);
  return fallback ? `<p>${escapeHtml(fallback)}</p>` : "";
}


function signSymbol(
  sign: "negative" | "zero" | "positive" | "undefined",
): string {
  if (sign === "negative") return "$-$";
  if (sign === "zero") return "$0$";
  if (sign === "undefined") return "non défini";
  return "$+$";
}

function variationArrow(
  direction: "increasing" | "decreasing" | "constant",
): string {
  if (direction === "decreasing") return "$\\searrow$";
  if (direction === "constant") return "$\\rightarrow$";
  return "$\\nearrow$";
}

function diagramId(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `arrow-${hash.toString(36)}`;
}

function compileGeometryDiagram(
  block: Extract<StructuredCourseBlock, { type: "geometry_diagram" }>,
): string {
  if (block.points.length < 2 || block.segments.length < 1) return "";
  const pointMap = new Map(block.points.map((point) => [point.name, point]));
  const marker = diagramId(block.caption || block.points.map((point) => point.name).join(""));
  const polygons = block.polygons
    .map((polygon) => {
      const coordinates = polygon.points
        .map((name) => pointMap.get(name))
        .filter((point): point is { name: string; x: number; y: number; labelDx: number; labelDy: number } => Boolean(point))
        .map((point) => `${point.x},${point.y}`)
        .join(" ");
      return coordinates.split(" ").length >= 3
        ? `<polygon points="${coordinates}" fill="${polygon.filled ? "#dbeafe" : "none"}" stroke="#1e3a5f" stroke-width="1.5"/>`
        : "";
    })
    .join("");
  const circles = block.circles
    .map((circle) => {
      const center = pointMap.get(circle.center);
      return center
        ? `<circle cx="${center.x}" cy="${center.y}" r="${circle.radius}" fill="none" stroke="#1e3a5f" stroke-width="1.5"/>`
        : "";
    })
    .join("");
  const segments = block.segments
    .map((segment) => {
      const from = pointMap.get(segment.from);
      const to = pointMap.get(segment.to);
      if (!from || !to) return "";
      return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#1e3a5f" stroke-width="1.5"${segment.dashed ? ' stroke-dasharray="5 4"' : ""}${segment.arrow ? ` marker-end="url(#${marker})"` : ""}/>`;
    })
    .join("");
  const points = block.points
    .map(
      (point) =>
        `<circle cx="${point.x}" cy="${point.y}" r="2.5" fill="#1e3a5f"/><text x="${point.x + point.labelDx}" y="${point.y + point.labelDy}" font-size="12" fill="#10213d">${escapeHtml(point.name)}</text>`,
    )
    .join("");
  return `<figure class="course-figure"><svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeAttribute(block.caption)}"><defs><marker id="${marker}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L6,3 L0,6 Z" fill="#1e3a5f"/></marker></defs>${polygons}${circles}${segments}${points}</svg><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function sectorPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const toPoint = (angle: number) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  });
  const start = toPoint(startAngle);
  const end = toPoint(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

function compileFractionModel(
  block: Extract<StructuredCourseBlock, { type: "fraction_model" }>,
): string {
  const denominator = Math.max(1, Math.min(20, block.denominator));
  const numerator = Math.max(0, Math.min(denominator, block.numerator));
  let svg = "";
  if (block.shape === "circle") {
    const sectors = Array.from({ length: denominator }, (_, index) => {
      const start = -Math.PI / 2 + (index * 2 * Math.PI) / denominator;
      const end = -Math.PI / 2 + ((index + 1) * 2 * Math.PI) / denominator;
      return `<path d="${sectorPath(100, 76, 58, start, end)}" fill="${index < numerator ? "#93c5fd" : "#ffffff"}" stroke="#1e3a5f" stroke-width="1.2"/>`;
    }).join("");
    svg = `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeAttribute(block.caption)}">${sectors}</svg>`;
  } else {
    const width = 160 / denominator;
    const cells = Array.from({ length: denominator }, (_, index) =>
      `<rect x="${20 + index * width}" y="55" width="${width}" height="45" fill="${index < numerator ? "#93c5fd" : "#ffffff"}" stroke="#1e3a5f" stroke-width="1.2"/>`,
    ).join("");
    svg = `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeAttribute(block.caption)}">${cells}</svg>`;
  }
  return `<figure class="course-figure">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function compileCourseBlock(
  block: StructuredCourseBlock,
  exerciseIds: string[],
  usedExerciseIndexes: Set<number>,
): string {
  switch (block.type) {
    case "heading": {
      const level = block.level === 4 ? 4 : 3;
      return `<h${level}>${compileStructuredRichText(block.content)}</h${level}>`;
    }
    case "paragraph":
      return `<p>${compileStructuredRichText(block.content)}</p>`;
    case "display_math":
      return compileDisplayMath(block.latex, block.fallbackText);
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const items = block.items
        .map((item) => `<li>${compileStructuredRichText(item)}</li>`)
        .join("");
      return items ? `<${tag}>${items}</${tag}>` : "";
    }
    case "callout": {
      const variant = block.variant === "warning" ? "warning" : "note";
      const title = block.title?.parts.length
        ? `<strong>${compileStructuredRichText(block.title)}</strong>`
        : "";
      const paragraphs = block.paragraphs
        .map((paragraph) => `<p>${compileStructuredRichText(paragraph)}</p>`)
        .join("");
      return `<blockquote class="course-callout course-callout-${variant}">${title}${paragraphs}</blockquote>`;
    }
    case "table": {
      const headers = block.headers
        .map((header) => `<th>${compileStructuredRichText(header)}</th>`)
        .join("");
      const rows = block.rows
        .filter((row) => row.length === block.headers.length)
        .map(
          (row) =>
            `<tr>${row
              .map((cell) => `<td>${compileStructuredRichText(cell)}</td>`)
              .join("")}</tr>`,
        )
        .join("");
      if (!headers || !rows) return "";
      return `<table class="math-table math-table-value"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    case "sign_table": {
      if (block.entries.length < 2) return "";
      const domains = block.entries
        .map((entry) => `<th>${compileStructuredRichText(entry.domain)}</th>`)
        .join("");
      const signs = block.entries
        .map((entry) => `<td>${signSymbol(entry.sign)}</td>`)
        .join("");
      return `<table class="math-table math-table-sign"><thead><tr><th>${compileStructuredRichText(block.expression)}</th>${domains}</tr></thead><tbody><tr><th>Signe</th>${signs}</tr></tbody></table>`;
    }
    case "variation_table": {
      if (block.intervals.length < 1) return "";
      const headers = block.intervals
        .map((interval) => `<th>${compileStructuredRichText(interval.domain)}</th>`)
        .join("");
      const variations = block.intervals
        .map(
          (interval) =>
            `<td>${compileStructuredRichText(interval.startValue)} ${variationArrow(interval.direction)} ${compileStructuredRichText(interval.endValue)}</td>`,
        )
        .join("");
      return `<table class="math-table math-table-variation"><thead><tr><th>${compileStructuredRichText(block.function)}</th>${headers}</tr></thead><tbody><tr><th>Variation</th>${variations}</tr></tbody></table>`;
    }
    case "graph": {
      const parameter = block.parameter
        ? ` data-param="${escapeAttribute(block.parameter.name)}" data-param-min="${block.parameter.min}" data-param-max="${block.parameter.max}" data-param-default="${block.parameter.default}"`
        : "";
      const palette = ["#dc2626", "#2563eb", "#059669", "#7c3aed"];
      const vectors = block.vectors.length
        ? ` data-vectors='${escapeAttribute(
            JSON.stringify(
              block.vectors.map((vector, index) => ({
                x: vector.x,
                y: vector.y,
                fromX: vector.fromX,
                fromY: vector.fromY,
                label: `$\\vec{${vector.label}}$`,
                color: palette[index % palette.length],
              })),
            ),
          )}'`
        : "";
      return `<div class="math-graph-placeholder" data-function="${escapeAttribute(block.expression)}" data-xmin="${block.xmin}" data-xmax="${block.xmax}"${parameter}${vectors} data-caption="${escapeAttribute(block.caption)}"></div>`;
    }
    case "geometry_diagram":
      return compileGeometryDiagram(block);
    case "fraction_model":
      return compileFractionModel(block);
    case "exercise": {
      const zeroBased = block.exerciseIndex - 1;
      const exerciseId = exerciseIds[zeroBased];
      if (!exerciseId || usedExerciseIndexes.has(zeroBased)) return "";
      usedExerciseIndexes.add(zeroBased);
      return `<div class="lesson-exercise" data-exercise-id="${escapeAttribute(exerciseId)}"></div>`;
    }
    case "steps": {
      const steps = block.steps
        .map((step) => {
          const nestedUsed = usedExerciseIndexes;
          const title = step.title?.parts.length
            ? `<p><strong>${compileStructuredRichText(step.title)}</strong></p>`
            : "";
          const content = step.blocks
            .map((entry) => compileCourseBlock(entry, exerciseIds, nestedUsed))
            .join("");
          return content ? `<div class="course-step">${title}${content}</div>` : "";
        })
        .filter(Boolean)
        .join("");
      return steps ? `<div class="course-steps">${steps}</div>` : "";
    }
    case "interactive_vectors":
      return `<div class="course-interactive-vectors" data-ox="${block.ox}" data-oy="${block.oy}" data-ux="${block.ux}" data-uy="${block.uy}" data-vx="${block.vx}" data-vy="${block.vy}" data-ulabel="${escapeAttribute(block.uLabel)}" data-vlabel="${escapeAttribute(block.vLabel)}" data-show-projection="${block.showProjection ? "true" : "false"}" data-caption="${escapeAttribute(block.caption)}"></div>`;
  }
}

export function compileStructuredCourseChapter(
  chapter: StructuredCourseChapter,
  options: { chapterIndex: number; durationPerLesson: number },
): CompiledCourseChapter {
  let chapterExerciseCounter = 1;
  const lessons = chapter.lessons.map((lesson, lessonIndex) => {
    const exerciseIds = lesson.exercises.map(
      () => `c${options.chapterIndex + 1}-ex-${chapterExerciseCounter++}`,
    );
    const compiledExercises: CompiledCourseExercise[] = lesson.exercises.map(
      (exercise, exerciseIndex) => ({
        id: exerciseIds[exerciseIndex],
        type: "short_answer",
        question: compileStructuredRichText(exercise.question),
        answer: compileStructuredRichText(exercise.answer),
        hint: compileStructuredRichText(exercise.hint),
        explanation: compileStructuredRichText(exercise.explanation),
      }),
    );

    const usedExerciseIndexes = new Set<number>();
    let content = lesson.blocks
      .map((block) => compileCourseBlock(block, exerciseIds, usedExerciseIndexes))
      .join("\n");

    // Le modèle ne choisit pas les ids. Si un emplacement a été oublié, le
    // serveur l'ajoute à la fin sans rejeter ni régénérer toute la leçon.
    for (let index = 0; index < exerciseIds.length; index += 1) {
      if (!usedExerciseIndexes.has(index)) {
        content += `\n<div class="lesson-exercise" data-exercise-id="${escapeAttribute(exerciseIds[index])}"></div>`;
      }
    }

    if (!content.trim()) {
      content = `<p>${escapeHtml(lesson.title)}</p>`;
    }

    return {
      id: `c${options.chapterIndex + 1}-lesson-${lessonIndex + 1}`,
      type: "text" as const,
      title: lesson.title,
      content,
      duration: options.durationPerLesson,
      exercises: compiledExercises,
    };
  });

  return {
    id: `chapter-${options.chapterIndex + 1}`,
    title: chapter.title,
    lessons,
  };
}


export function compileStructuredExerciseDraft(
  draft: StructuredExerciseDraft,
  options: {
    blockType: string;
    exerciseType: "simple" | "contextual";
  },
): {
  title: string;
  description: string;
  contentJson: CompiledExercisePage[];
} {
  const blocks: CompiledExerciseBlock[] = [];

  if (options.exerciseType === "contextual" && draft.introduction.length > 0) {
    blocks.push({
      id: "block-intro",
      type: "text",
      title: "Mise en situation",
      content: draft.introduction
        .map((paragraph) => `<p>${compileStructuredRichText(paragraph)}</p>`)
        .join("\n"),
    });
  }

  draft.questions.forEach((question, index) => {
    const id = `block-${index + 1}`;
    const title = `Question ${index + 1}`;
    const promptHtml = compileStructuredRichText(question.prompt);
    const supportHtml = compileStructuredRichText(question.content);
    const statementHtml = promptHtml.trim().length > 0
      ? `<p>${promptHtml}</p>`
      : "";
    const explanation = compileStructuredRichText(question.explanation);
    const answer = compileStructuredRichText(question.answer);
    const plainAnswer = structuredRichTextToPlainText(question.answer);
    const type = options.blockType || "standard";

    if (type === "qcm") {
      const optionStrings = question.options.map(compileStructuredRichText);
      const correct = question.correctOptionIndexes
        .map((optionIndex) => optionStrings[optionIndex])
        .filter((value): value is string => typeof value === "string");
      blocks.push({
        id,
        type: "qcm",
        title,
        content: statementHtml,
        points: question.points,
        options: optionStrings,
        correctAnswer: correct.length > 0 ? correct : optionStrings.slice(0, 1),
        explanation,
      });
      return;
    }

    if (type === "true_false") {
      const optionStrings = ["Vrai", "Faux"];
      const indexAnswer = question.correctOptionIndexes[0] ?? 0;
      blocks.push({
        id,
        type: "true_false",
        title,
        content: statementHtml,
        points: question.points,
        options: optionStrings,
        correctAnswer: optionStrings[indexAnswer === 1 ? 1 : 0],
        explanation,
      });
      return;
    }

    if (type === "fill_in_the_blank") {
      const blanks = question.acceptedAnswers.map((alternatives) =>
        alternatives
          .map(structuredRichTextToPlainText)
          .filter(Boolean)
          .join("|"),
      );
      const fillContent = supportHtml || promptHtml;
      blocks.push({
        id,
        type: "fill_in_the_blank",
        title: structuredRichTextToPlainText(question.prompt) || title,
        content: fillContent,
        points: question.points,
        blanks: blanks.length > 0 ? blanks : [plainAnswer || "Réponse"],
        explanation,
      });
      return;
    }

    if (type === "matching") {
      blocks.push({
        id,
        type: "matching",
        title,
        content: statementHtml,
        points: question.points,
        pairs: question.pairs.map((pair) => ({
          left: compileStructuredRichText(pair.left),
          right: structuredRichTextToPlainText(pair.right),
        })),
        explanation,
      });
      return;
    }

    if (type === "ordering") {
      blocks.push({
        id,
        type: "ordering",
        title,
        content: statementHtml,
        points: question.points,
        items: question.items.map(compileStructuredRichText),
        explanation,
      });
      return;
    }

    if (type === "coding") {
      blocks.push({
        id,
        type: "coding",
        title,
        content: statementHtml,
        points: question.points,
        correctAnswer: plainAnswer || answer,
        explanation,
      });
      return;
    }

    blocks.push({
      id,
      type: "text_input",
      title,
      content: statementHtml,
      points: question.points,
      correctAnswer: plainAnswer || answer,
      explanation,
    });
  });

  return {
    title: draft.title,
    description: draft.description,
    contentJson: [
      {
        id: "page-1",
        title: options.exerciseType === "contextual" ? "Présentation" : "Questions",
        blocks,
      },
    ],
  };
}

export function compileStructuredQuizDraft(draft: StructuredQuizDraft): {
  title: string;
  description: string;
  timeLimit: number;
  maxAttempts: number;
  questions: CompiledQuizQuestion[];
} {
  const questions = draft.questions.map((question, index) => {
    const options = question.options.map(compileStructuredRichText);
    const correctAnswer =
      options[question.correctOptionIndex] ?? options[0] ?? "Réponse";
    return {
      id: `q-${index + 1}`,
      text: compileStructuredRichText(question.text),
      type: "single_choice" as const,
      points: question.points,
      options,
      correctAnswer,
      explanation: compileStructuredRichText(question.explanation),
    };
  });
  return {
    title: draft.title,
    description: draft.description,
    timeLimit: draft.timeLimit,
    maxAttempts: draft.maxAttempts,
    questions,
  };
}

export function structuredExerciseQuestionSummary(
  question: StructuredExerciseQuestion,
): string {
  return structuredRichTextToPlainText(question.prompt);
}
