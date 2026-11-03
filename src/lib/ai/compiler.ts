import { isStructuredLatexValid, normalizeStructuredLatex, sanitizeStructuredText, structuredRichTextToPlainText, type StructuredCourseBlock, type StructuredCourseChapter, type StructuredExerciseDraft, type StructuredQuizDraft, type StructuredRichText, type StructuredLearningResource } from "@/lib/ai/structuredContent";

import { escapeHtml, figText, figOpen, FIGURE_PALETTE, FIG_STROKE, SHAPE_FILL_OPACITY, renderShape, renderLineChart, renderScatterPlot, renderFlowchart, renderSolid, renderLabeledPolygon, renderProbabilityTree, renderVennDiagram } from "./compilerSvg";
import { escapeAttribute, renderTrigCircle, renderPieChart, renderNumberLine, renderBarChart, renderClock, renderFraction, renderCoinPurse, renderBalanceScale, renderGridPainter, renderPatternMaker, renderRulerMeasurer, renderTapeDiagram, renderBrickPyramid, renderLabeledCircle, renderJsxFigure, renderFillGrid, renderFractionStrips, renderPlaceValueChart, renderRatioMixer, renderNetFolder, renderInteractiveProtractor, renderCompassTool, renderThermometerAxis, renderAreaDecomposer, renderScientificNotationConverter, renderEquationBalancer, renderSlopeTriangle, renderVectorAdditionPad, renderIntervalBuilder, renderTangentScrubber, renderSequenceCobweb, renderIntegralRiemannSlider, renderComplexPlanePolar, renderAlgoSandbox, renderBoxPlot } from "./compilerRender";
type CompiledCourseExercise = {
  id: string;
  question: string;
  type: "short_answer";
  answer: string;
  hint: string;
  explanation: string;
};

type CompiledCourseLesson = {
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

type CompiledExerciseBlock = {
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

function readableMathFallback(latex: string): string {
  return sanitizeStructuredText(latex.replace(/\\([A-Za-z]+)/g, "$1"));
}

const GRAPH_VECTOR_PALETTE = {
  navy: "#10213d",
  gold: "#c89f36",
  blue: "#3182ce",
  green: "#38a169",
  red: "#e53e3e",
  gray: "#64748b",
} as const;

// Rendu en LaTeX ($...$) même pour un signe seul : cohérence avec le reste du
// tableau (les autres cellules sont du KaTeX) — demande explicite.
function signSymbol(value: string): string {
  if (value === "positive") return "$+$";
  if (value === "negative") return "$-$";
  if (value === "zero") return "$0$";
  return "$\\varnothing$";
}

function directionSymbol(value: string): string {
  if (value === "down") return "↘";
  if (value === "constant") return "→";
  return "↗";
}


function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  angleDegrees: number,
): { x: number; y: number } {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

/** Compile du texte structuré vers les chaînes historiques attendues par les
 * viewers. Seules les formules validées par KaTeX reçoivent des délimiteurs.
 * Une formule invalide devient du texte : aucun $ cassé ne peut être stocké. */
export function compileStructuredRichText(value: StructuredRichText): string {
  return value.parts
    .map((part) => {
      if (part.type === "text") return escapeHtml(part.value);
      const latex = normalizeStructuredLatex(part.latex);
      return isStructuredLatexValid(latex)
        ? `$${latex}$`
        : escapeHtml(readableMathFallback(latex) || "Formule mathématique");
    })
    .join("");
}

function compileDisplayMath(latex: string, fallbackText?: string): string {
  const normalized = normalizeStructuredLatex(latex);
  if (isStructuredLatexValid(normalized)) {
    return `<p>$$${normalized}$$</p>`;
  }
  const fallback = sanitizeStructuredText(fallbackText) || readableMathFallback(normalized);
  return fallback ? `<p>${escapeHtml(fallback)}</p>` : "";
}

export function compileCourseBlock(
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
    case "checklist": {
      // Rendu par CourseViewer.tsx en checklist "Je sais faire" cochable qui
      // gate le bouton "Terminer le cours" (voir InteractiveChecklist).
      const items = block.items
        .map((item) => `<li>${compileStructuredRichText(item)}</li>`)
        .join("");
      return items ? `<ul class="course-checklist">${items}</ul>` : "";
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
    case "definition": {
      const example = block.example
        ? `<p class="course-definition-example">${compileStructuredRichText(block.example)}</p>`
        : "";
      return `<div class="course-definition"><span class="course-definition-badge">Mot-clé</span><p class="course-definition-term">${escapeHtml(block.term)}</p><p class="course-definition-body">${compileStructuredRichText(block.definition)}</p>${example}</div>`;
    }
    case "table": {
      const headers = block.headers
        .map((header) => `<th>${compileStructuredRichText(header)}</th>`)
        .join("");
      const rows = block.rows
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
    case "column_operation": {
      // Opération posée en colonnes (addition, soustraction...) : un vrai
      // calcul en grille rendu par le serveur, pas du LaTeX \begin{array}
      // laissé à la charge du modèle — c'était la source du texte cassé
      // ("r@ l 3 +; 2 hline 5") observé dans les cours générés, KaTeX ne
      // supportant pas cet environnement et le repli texte ne le comprenant
      // pas non plus.
      const width = Math.max(
        block.result.length,
        ...block.operands.map((operand) => operand.length),
      );
      const pad = (value: string) => escapeAttribute(value).padStart(width, " ").replace(/ /g, "&nbsp;");
      const operandRows = block.operands
        .map((operand, index) => {
          const sign = index === block.operands.length - 1 ? escapeAttribute(block.operator) : "&nbsp;";
          return `<tr><td class="column-operation-sign">${sign}</td><td class="column-operation-digits">${pad(operand)}</td></tr>`;
        })
        .join("");
      const carryRow = block.carries.some(Boolean)
        ? `<tr class="column-operation-carries"><td></td><td class="column-operation-digits">${pad(
            block.carries.join(""),
          )}</td></tr>`
        : "";
      return `<table class="column-operation" data-operator="${escapeAttribute(block.operator)}"><tbody>${carryRow}${operandRows}<tr class="column-operation-result"><td></td><td class="column-operation-digits">${pad(
        block.result,
      )}</td></tr></tbody></table>`;
    }
    case "image": {
      // block.url est résolu côté serveur après la génération IA (boucle sur
      // les blocs image dans catalogue-advance/route.ts), pas par le
      // modèle lui-même : il ne fournit qu'une requête de recherche. Un bloc
      // non résolu (aucune image libre trouvée) ne s'affiche pas plutôt que
      // de casser la mise en page avec une image manquante.
      if (!block.url) return "";
      const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}${block.attribution ? ` <span class="course-image-credit"> : ${escapeHtml(block.attribution)}</span>` : ""}</figcaption>` : "";
      return `<figure class="course-image"><img src="${escapeAttribute(block.url)}" alt="${escapeAttribute(block.caption || "")}" loading="lazy" />${caption}</figure>`;
    }
    case "base_ten_blocks": {
      // Visualisation déterministe dizaines/unités (grille HTML/CSS), pour
      // remplacer les figures SVG dessinées à la main par l'IA — jugées peu
      // lisibles et peu soignées (retour utilisateur direct sur un exemple
      // CP montrant des points alignés à la va-vite).
      const hundredCol = Array.from({ length: block.hundreds }, () => `<div class="base-ten-hundred"></div>`).join("");
      const tenCol = Array.from({ length: block.tens }, () => `<div class="base-ten-ten"></div>`).join("");
      const unitCol = Array.from({ length: block.units }, () => `<div class="base-ten-unit"></div>`).join("");
      const groups = [
        block.hundreds > 0 ? `<div class="base-ten-group">${hundredCol}<span class="base-ten-label">${block.hundreds} centaine${block.hundreds > 1 ? "s" : ""}</span></div>` : "",
        block.tens > 0 ? `<div class="base-ten-group">${tenCol}<span class="base-ten-label">${block.tens} dizaine${block.tens > 1 ? "s" : ""}</span></div>` : "",
        block.units > 0 ? `<div class="base-ten-group">${unitCol}<span class="base-ten-label">${block.units} unité${block.units > 1 ? "s" : ""}</span></div>` : "",
      ].filter(Boolean).join("");
      const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : "";
      return `<figure class="base-ten-blocks">${groups}${caption}</figure>`;
    }
    case "sign_table": {
      const boundaryHeaders = block.boundaries.map((boundary, index) => {
        const leftInterval = `<th>Intervalle ${index + 1}</th>`;
        return `${leftInterval}<th>${compileStructuredRichText(boundary)}</th>`;
      });
      const finalInterval = `<th>Intervalle ${block.boundaries.length + 1}</th>`;
      const signCells: string[] = [];
      block.intervalSigns.forEach((sign, index) => {
        signCells.push(`<td>${signSymbol(sign)}</td>`);
        if (index < block.boundarySigns.length) {
          signCells.push(`<td>${signSymbol(block.boundarySigns[index])}</td>`);
        }
      });
      return `<table class="math-table math-table-sign"><thead><tr><th>${compileStructuredRichText(block.expression)}</th>${boundaryHeaders.join("")}${finalInterval}</tr></thead><tbody><tr><td>Signe</td>${signCells.join("")}</tr></tbody></table>`;
    }
    case "variation_table": {
      const columns: string[] = [];
      block.points.forEach((point, index) => {
        columns.push(`<th>${compileStructuredRichText(point)}</th>`);
        if (index < block.directions.length) columns.push("<th></th>");
      });
      const derivative: string[] = [];
      block.points.forEach((_point, index) => {
        derivative.push("<td></td>");
        if (index < block.derivativeSigns.length) {
          derivative.push(`<td>${signSymbol(block.derivativeSigns[index])}</td>`);
        }
      });
      const variations: string[] = [];
      block.values.forEach((value, index) => {
        variations.push(`<td>${compileStructuredRichText(value)}</td>`);
        if (index < block.directions.length) {
          variations.push(`<td class="variation-direction">${directionSymbol(block.directions[index])}</td>`);
        }
      });
      return `<table class="math-table math-table-variation"><thead><tr><th>${compileStructuredRichText(block.variable)}</th>${columns.join("")}</tr></thead><tbody><tr><td>Dérivée</td>${derivative.join("")}</tr><tr><td>${compileStructuredRichText(block.functionName)}</td>${variations.join("")}</tr></tbody></table>`;
    }
    case "graph": {
      const parameter = block.parameter
        ? ` data-param="${escapeAttribute(block.parameter.name)}" data-param-min="${block.parameter.min}" data-param-max="${block.parameter.max}" data-param-default="${block.parameter.default}"`
        : "";
      const vectors = block.vectors.length > 0
        ? ` data-vectors='${escapeAttribute(
            JSON.stringify(
              block.vectors.map((vector) => ({
                x: vector.x,
                y: vector.y,
                ...(vector.fromX !== undefined ? { fromX: vector.fromX } : {}),
                ...(vector.fromY !== undefined ? { fromY: vector.fromY } : {}),
                ...(vector.label ? { label: vector.label } : {}),
                color: GRAPH_VECTOR_PALETTE[vector.tone],
              })),
            ),
          )}'`
        : "";
      return `<div class="math-graph-placeholder" data-function="${escapeAttribute(block.expression)}" data-xmin="${block.xmin}" data-xmax="${block.xmax}"${parameter}${vectors} data-caption="${escapeAttribute(block.caption)}"></div>`;
    }
    case "figure": {
      // Feuille quadrillée + tracé cohérent : aplats translucides, traits
      // d'épaisseur constante, étiquettes avec halo blanc (lisibles sur le
      // quadrillage et par-dessus les formes). Le quadrillage donne l'échelle.
      const figLabel = (
        value: StructuredRichText | undefined,
        lx: number | undefined,
        ly: number | undefined,
      ): string => {
        if (!value?.parts.length || lx === undefined || ly === undefined) return "";
        const text = structuredRichTextToPlainText(value);
        return text ? figText(lx, ly, escapeHtml(text), { size: 11, weight: 600 }) : "";
      };
      const elements = block.elements
        .map((element) => {
          const color = FIGURE_PALETTE[element.tone];
          const label = figLabel(element.label, element.labelX, element.labelY);
          if (element.type === "line") {
            return `<line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" stroke="${color}" stroke-width="${FIG_STROKE}" stroke-linecap="round"${element.dashed ? ' stroke-dasharray="5 4"' : ""}${element.arrowEnd ? ' marker-end="url(#efig-arrow)"' : ""}/>${label}`;
          }
          if (element.type === "point") {
            return `<circle cx="${element.x}" cy="${element.y}" r="4" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>${label}`;
          }
          if (element.type === "circle") {
            return `<circle cx="${element.cx}" cy="${element.cy}" r="${element.r}" stroke="${color}" stroke-width="${FIG_STROKE}" fill="${element.filled ? color : "none"}"${element.filled ? ` fill-opacity="${SHAPE_FILL_OPACITY}"` : ""}/>${label}`;
          }
          if (element.type === "polygon") {
            const points = element.points.map((point) => `${point.x},${point.y}`).join(" ");
            return `<polygon points="${points}" stroke="${color}" stroke-width="${FIG_STROKE}" stroke-linejoin="round" fill="${element.filled ? color : "none"}"${element.filled ? ` fill-opacity="${SHAPE_FILL_OPACITY}"` : ""}/>${label}`;
          }
          const start = polarPoint(element.cx, element.cy, element.r, element.startAngle);
          const end = polarPoint(element.cx, element.cy, element.r, element.endAngle);
          const delta = Math.abs(element.endAngle - element.startAngle) % 360;
          const largeArc = delta > 180 ? 1 : 0;
          const sweep = element.endAngle >= element.startAngle ? 1 : 0;
          return `<path d="M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${element.r} ${element.r} 0 ${largeArc} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}" stroke="${color}" stroke-width="${FIG_STROKE}" fill="none"/>${label}`;
        })
        .join("");
      return `<figure class="course-figure">${figOpen(200, 160, { cell: 16 })}${elements}</svg><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
    }
    case "shape":
      return renderShape(block);
    case "trig_circle":
      return renderTrigCircle(block);
    case "pie_chart":
      return renderPieChart(block);
    case "number_line":
      return renderNumberLine(block);
    case "bar_chart":
      return renderBarChart(block);
    case "line_chart":
      return renderLineChart(block);
    case "scatter_plot":
      return renderScatterPlot(block);
    case "flowchart":
      return renderFlowchart(block);
    case "clock":
      return renderClock(block);
    case "fraction":
      return renderFraction(block);
    case "coin_purse":
      return renderCoinPurse(block);
    case "balance_scale":
      return renderBalanceScale(block);
    case "grid_painter":
      return renderGridPainter(block);
    case "pattern_maker":
      return renderPatternMaker(block);
    case "ruler_measurer":
      return renderRulerMeasurer(block);
    case "tape_diagram":
      return renderTapeDiagram(block);
    case "brick_pyramid":
      return renderBrickPyramid(block);
    case "solid":
      return renderSolid(block);
    case "labeled_polygon":
      return renderLabeledPolygon(block);
    case "labeled_circle":
      return renderLabeledCircle(block);
    case "jsx_figure":
      return renderJsxFigure(block);
    case "fill_grid":
      return renderFillGrid(block);
    case "fraction_strips":
      return renderFractionStrips(block);
    case "place_value_chart":
      return renderPlaceValueChart(block);
    case "ratio_mixer":
      return renderRatioMixer(block);
    case "net_folder":
      return renderNetFolder(block);
    case "interactive_protractor":
      return renderInteractiveProtractor(block);
    case "compass_tool":
      return renderCompassTool(block);
    case "thermometer_axis":
      return renderThermometerAxis(block);
    case "area_decomposer":
      return renderAreaDecomposer(block);
    case "scientific_notation_converter":
      return renderScientificNotationConverter(block);
    case "equation_balancer":
      return renderEquationBalancer(block);
    case "slope_triangle":
      return renderSlopeTriangle(block);
    case "vector_addition_pad":
      return renderVectorAdditionPad(block);
    case "interval_builder":
      return renderIntervalBuilder(block);
    case "tangent_scrubber":
      return renderTangentScrubber(block);
    case "sequence_cobweb":
      return renderSequenceCobweb(block);
    case "integral_riemann_slider":
      return renderIntegralRiemannSlider(block);
    case "complex_plane_polar":
      return renderComplexPlanePolar(block);
    case "algo_sandbox":
      return renderAlgoSandbox(block);
    case "probability_tree":
      return renderProbabilityTree(block);
    case "venn_diagram":
      return renderVennDiagram(block);
    case "box_plot":
      return renderBoxPlot(block);
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


function compileLearningResources(resources: StructuredLearningResource[]): string {
  const used = new Set<number>();
  return resources
    .map((resource) => compileCourseBlock(resource, [], used))
    .filter(Boolean)
    .join("\n");
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
    const statementParts =
      options.exerciseType === "contextual"
        ? [supportHtml, promptHtml]
        : [promptHtml];
    const resourceHtml = compileLearningResources(question.resources);
    const statementHtml = [resourceHtml, ...statementParts]
      .filter((entry) => entry.trim().length > 0)
      .map((entry) => `<p>${entry}</p>`)
      .join("\n");
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
      text: [compileStructuredRichText(question.text), compileLearningResources(question.resources)].filter(Boolean).join("\n"),
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
