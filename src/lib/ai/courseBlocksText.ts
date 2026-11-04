import { StructuredCourseBlock, finiteNumber, normalizeFigureTone, StructuredFigureTone, StructuredNumberLinePoint, StructuredNumberLineInterval, StructuredPieSlice, StructuredTrigCircleAngle, normalizeShapeBlock, normalizeFigureElement, StructuredFigureElement, StructuredGraphVector, clamp, normalizeStructuredRichText, StructuredSignValue, StructuredVariationDirection } from "./structuredFigures";
import { asRecord, sanitizeStructuredText, stringValue, normalizeStructuredLatex } from "./structuredMath";


// Conversions appliquées AVANT sanitizeStructuredText pour les labels courts
// des diagrammes déterministes (trig_circle, pie_chart...). sanitizeStructuredText
// seul se contente de retirer l'antislash d'une commande reconnue
// ("\frac" -> "frac"), ce qui est correct pour de la prose (la commande ne
// devrait de toute façon jamais y figurer) mais rend un label illisible : un
// angle "$-\frac{\pi}{3}$" ressortait "-frac{pi}{3}" au lieu de "-π/3" (vu en
// production). Ici on convertit d'abord en notation lisible équivalente à
// celle des captions (readableMathFallbackText dans qualityGuard.ts).
export const DIAGRAM_LABEL_CONVERSIONS: Array<[RegExp, string]> = [
  [/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2"],
  [/\\sqrt\{([^{}]*)\}/g, "√$1"],
  [/\\vec\{([^{}]*)\}/g, "$1⃗"],
  [/\\pi\b/g, "π"],
  [/\\theta\b/g, "θ"],
  [/\\infty\b/g, "∞"],
  [/\\lambda\b/g, "λ"],
  [/\\alpha\b/g, "α"],
  [/\\beta\b/g, "β"],
  [/\\times\b/g, "×"],
  [/\\cdot\b/g, "·"],
  [/\\leq\b/g, "≤"],
  [/\\geq\b/g, "≥"],
  [/\\neq\b/g, "≠"],
];


export function sanitizeDiagramLabel(value: unknown): string {
  let text = stringValue(value);
  for (const [pattern, replacement] of DIAGRAM_LABEL_CONVERSIONS) {
    text = text.replace(pattern, replacement);
  }
  return sanitizeStructuredText(text);
}



export function normalizeSignValue(value: unknown): StructuredSignValue {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "negative" || normalized === "zero" || normalized === "positive") {
    return normalized;
  }
  return "undefined";
}


export function normalizeVariationDirection(
  value: unknown,
): StructuredVariationDirection {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "down" || normalized === "constant") return normalized;
  return "up";
}


export function normalizeGraphVector(value: unknown): StructuredGraphVector | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const x = finiteNumber(raw.x, Number.NaN);
  const y = finiteNumber(raw.y, Number.NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const fromXRaw = raw.from_x ?? raw.fromX;
  const fromYRaw = raw.from_y ?? raw.fromY;
  return {
    x: clamp(x, -100, 100),
    y: clamp(y, -100, 100),
    ...(fromXRaw !== undefined ? { fromX: clamp(finiteNumber(fromXRaw, 0), -100, 100) } : {}),
    ...(fromYRaw !== undefined ? { fromY: clamp(finiteNumber(fromYRaw, 0), -100, 100) } : {}),
    ...(sanitizeStructuredText(raw.label) ? { label: sanitizeStructuredText(raw.label).slice(0, 20) } : {}),
    tone: normalizeFigureTone(raw.tone),
  };
}


export function normalizeTrigCircleAngle(value: unknown): StructuredTrigCircleAngle | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label ?? raw.angle_deg ?? raw.angleDeg);
  if (!label) return null;
  return {
    angleDeg: finiteNumber(raw.angle_deg ?? raw.angleDeg, 0),
    label: label.slice(0, 24),
  };
}


export function normalizePieSlice(value: unknown): StructuredPieSlice | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  const numericValue = finiteNumber(raw.value, Number.NaN);
  if (!label || !Number.isFinite(numericValue) || numericValue < 0) return null;
  return { label: label.slice(0, 60), value: numericValue, tone: normalizeFigureTone(raw.tone) };
}


export function normalizeNumberLinePoint(value: unknown): StructuredNumberLinePoint | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  const numericValue = finiteNumber(raw.value, Number.NaN);
  if (!label || !Number.isFinite(numericValue)) return null;
  return { value: numericValue, label: label.slice(0, 40), filled: raw.filled !== false };
}


export function normalizeNumberLineInterval(
  value: unknown,
): StructuredNumberLineInterval | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const from = finiteNumber(raw.from, Number.NaN);
  const to = finiteNumber(raw.to, Number.NaN);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return {
    from: Math.min(from, to),
    to: Math.max(from, to),
    fromIncluded: (raw.from_included ?? raw.fromIncluded) === true,
    toIncluded: (raw.to_included ?? raw.toIncluded) === true,
    tone: normalizeFigureTone(raw.tone),
  };
}


/** Contexte passé à chaque normaliseur de bloc : l'étiquette lue, la profondeur d'imbrication et la fonction récursive. */
export interface BlockCtx {
  type: string;
  depth: number;
  normalize: (value: unknown, depth?: number) => StructuredCourseBlock | null;
}

export type BlockNormalizer = (raw: Record<string, unknown>, ctx: BlockCtx) => StructuredCourseBlock | null;


export function blockHeading(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "heading",
    level: finiteNumber(raw.level, 3) >= 4 ? 4 : 3,
    content: normalizeStructuredRichText(raw.content ?? raw.text ?? raw.title),
  };
}


export function blockParagraph(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "paragraph",
    content: normalizeStructuredRichText(raw.content ?? raw.text ?? raw.value),
  };
}


export function blockDisplayMath(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "display_math",
    latex: normalizeStructuredLatex(raw.latex ?? raw.value ?? raw.content),
  };
}


export function blockList(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizeStructuredRichText).filter((item) => item.parts.length > 0)
    : [];
  return {
    type: "list",
    ordered: raw.ordered === true || stringValue(raw.style).toLowerCase() === "ordered",
    items,
  };
}


export function blockChecklist(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizeStructuredRichText).filter((item) => item.parts.length > 0)
    : [];
  return { type: "checklist", items };
}


export function blockCallout(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const paragraphsRaw = Array.isArray(raw.paragraphs)
    ? raw.paragraphs
    : raw.content !== undefined
      ? [raw.content]
      : [];
  return {
    type: "callout",
    variant: stringValue(raw.variant).toLowerCase() === "warning" ? "warning" : "note",
    title: raw.title !== undefined ? normalizeStructuredRichText(raw.title) : undefined,
    paragraphs: paragraphsRaw
      .map(normalizeStructuredRichText)
      .filter((paragraph) => paragraph.parts.length > 0),
  };
}


export function blockTable(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const headers = Array.isArray(raw.headers)
    ? raw.headers
        .map(normalizeStructuredRichText)
        .filter((entry) => entry.parts.length > 0)
        .slice(0, 8)
    : [];
  if (headers.length === 0) return null;
  const rows = Array.isArray(raw.rows)
    ? raw.rows
        .filter(Array.isArray)
        .map((row) =>
          (row as unknown[])
            .slice(0, headers.length)
            .map(normalizeStructuredRichText),
        )
        .filter((row) => row.length === headers.length)
        .slice(0, 20)
    : [];
  if (rows.length === 0) return null;
  return { type: "table", variant: "value", headers, rows };
}


export function blockColumnOperation(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const rawOperator = stringValue(raw.operator);
  const operator = (["+", "-", "×", "÷", "x", "*", "/"].includes(rawOperator)
    ? rawOperator === "x" || rawOperator === "*"
      ? "×"
      : rawOperator === "/"
        ? "÷"
        : rawOperator
    : "+") as "+" | "-" | "×" | "÷";
  const operands = Array.isArray(raw.operands)
    ? raw.operands.map((entry) => stringValue(entry)).filter(Boolean).slice(0, 4)
    : [];
  const result = stringValue(raw.result);
  if (operands.length < 2 || !result) return null;
  const carries = Array.isArray(raw.carries)
    ? raw.carries.map((entry) => stringValue(entry))
    : [];
  return { type: "column_operation", operator, operands, result, carries };
}


export function blockImage(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const query = stringValue(raw.query).slice(0, 200);
  const caption = stringValue(raw.caption).slice(0, 200);
  // Un admin peut fournir directement une URL (lien colle ou upload) —
  // dans ce cas le bloc s'affiche immediatement, sans passer par la
  // resolution differee (catalogue-advance/route.ts) reservee aux
  // requetes de recherche generees par l'IA sans URL connue.
  const url = stringValue(raw.url).slice(0, 500);
  const attribution = stringValue(raw.attribution).slice(0, 200);
  if (!query && !url) return null;
  return {
    type: "image",
    query,
    caption,
    url: url || undefined,
    attribution: attribution || undefined,
  };
}


export function blockBaseTenBlocks(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const clamp = (value: unknown) => Math.min(9, Math.max(0, Math.trunc(finiteNumber(value, 0))));
  const hundreds = clamp(raw.hundreds);
  const tens = clamp(raw.tens);
  const units = clamp(raw.units);
  const caption = stringValue(raw.caption).slice(0, 200);
  if (hundreds === 0 && tens === 0 && units === 0) return null;
  return { type: "base_ten_blocks", hundreds, tens, units, caption };
}


export function blockSignTable(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const boundaries = Array.isArray(raw.boundaries)
    ? raw.boundaries
        .map(normalizeStructuredRichText)
        .filter((entry) => entry.parts.length > 0)
        .slice(0, 6)
    : [];
  const rawIntervalSigns = raw.interval_signs ?? raw.intervalSigns;
  const intervalSigns = Array.isArray(rawIntervalSigns)
    ? rawIntervalSigns
        .map(normalizeSignValue)
        .slice(0, boundaries.length + 1)
    : [];
  const rawBoundarySigns = raw.boundary_signs ?? raw.boundarySigns;
  const boundarySigns = Array.isArray(rawBoundarySigns)
    ? rawBoundarySigns
        .map(normalizeSignValue)
        .slice(0, boundaries.length)
    : [];
  if (
    boundaries.length === 0 ||
    intervalSigns.length !== boundaries.length + 1 ||
    boundarySigns.length !== boundaries.length
  ) {
    return null;
  }
  return {
    type: "sign_table",
    expression: normalizeStructuredRichText(raw.expression),
    boundaries,
    intervalSigns,
    boundarySigns,
  };
}


export function blockVariationTable(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const points = Array.isArray(raw.points)
    ? raw.points
        .map(normalizeStructuredRichText)
        .filter((entry) => entry.parts.length > 0)
        .slice(0, 7)
    : [];
  const values = Array.isArray(raw.values)
    ? raw.values.map(normalizeStructuredRichText).slice(0, points.length)
    : [];
  const directions = Array.isArray(raw.directions)
    ? raw.directions
        .map(normalizeVariationDirection)
        .slice(0, Math.max(0, points.length - 1))
    : [];
  const rawDerivativeSigns =
    raw.derivative_signs ?? raw.derivativeSigns;
  const derivativeSigns = Array.isArray(rawDerivativeSigns)
    ? rawDerivativeSigns
        .map(normalizeSignValue)
        .slice(0, Math.max(0, points.length - 1))
    : [];
  if (
    points.length < 2 ||
    values.length !== points.length ||
    directions.length !== points.length - 1 ||
    derivativeSigns.length !== points.length - 1
  ) {
    return null;
  }
  return {
    type: "variation_table",
    variable: normalizeStructuredRichText(raw.variable ?? "x"),
    functionName: normalizeStructuredRichText(
      raw.function_name ?? raw.functionName ?? "f",
    ),
    points,
    values,
    directions,
    derivativeSigns,
  };
}


export function blockGraph(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const parameterRaw = asRecord(raw.parameter);
  const name = sanitizeStructuredText(parameterRaw?.name)
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2);
  const parameter = parameterRaw && name
    ? {
        name,
        min: finiteNumber(parameterRaw.min, -3),
        max: finiteNumber(parameterRaw.max, 3),
        default: finiteNumber(parameterRaw.default, 1),
      }
    : undefined;
  const vectors = Array.isArray(raw.vectors)
    ? raw.vectors
        .map(normalizeGraphVector)
        .filter((entry): entry is StructuredGraphVector => entry !== null)
        .slice(0, 5)
    : [];
  return {
    type: "graph",
    expression: sanitizeGraphExpression(
      raw.expression ?? raw.function ?? raw.data_function,
    ),
    xmin: finiteNumber(raw.xmin, -5),
    xmax: finiteNumber(raw.xmax, 5),
    caption: sanitizeStructuredText(raw.caption),
    parameter,
    vectors,
  };
}


export function blockFigure(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const elements = Array.isArray(raw.elements)
    ? raw.elements
        .map(normalizeFigureElement)
        .filter((entry): entry is StructuredFigureElement => entry !== null)
        .slice(0, 12)
    : [];
  if (elements.length === 0) return null;
  return {
    type: "figure",
    caption: sanitizeStructuredText(raw.caption),
    elements,
  };
}


export function blockShape(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return normalizeShapeBlock(raw);
}


export function blockTriangleDiagram(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  // Ancien bloc dédié → devient un "shape" composable (1 triangle annoté).
  const vl = Array.isArray(raw.vertex_labels ?? raw.vertexLabels)
    ? (raw.vertex_labels ?? raw.vertexLabels)
    : ["A", "B", "C"];
  const slRaw = Array.isArray(raw.side_labels ?? raw.sideLabels)
    ? (raw.side_labels ?? raw.sideLabels)
    : [];
  const rightAt = raw.right_angle_at ?? raw.rightAngleAt;
  return normalizeShapeBlock({
    caption: raw.caption,
    width: 10,
    height: 8,
    parts: [
      {
        kind: rightAt === 0 || rightAt === 1 || rightAt === 2 ? "right_triangle" : "triangle",
        x: 1,
        y: 1,
        w: 8,
        h: 6,
        vertex_labels: vl,
        side_labels: slRaw,
        right_angle_at: rightAt,
        show_dimensions: false,
        tone: "navy",
      },
    ],
  });
}


export function blockPythagorasVisualizer(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return normalizeShapeBlock({
    caption: raw.caption,
    preset: "pythagoras",
    a: finiteNumber(raw.a, 3),
    b: finiteNumber(raw.b, 4),
  });
}


export function blockTrigCircle(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const rawAngles = raw.highlighted_angles ?? raw.highlightedAngles;
  const highlightedAngles = Array.isArray(rawAngles)
    ? rawAngles
        .map(normalizeTrigCircleAngle)
        .filter((entry): entry is StructuredTrigCircleAngle => entry !== null)
        .slice(0, 16)
    : [];
  return {
    type: "trig_circle",
    caption: sanitizeStructuredText(raw.caption),
    highlightedAngles,
  };
}


export function blockPieChart(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const slices = Array.isArray(raw.slices)
    ? raw.slices
        .map(normalizePieSlice)
        .filter((entry): entry is StructuredPieSlice => entry !== null)
        .slice(0, 8)
    : [];
  if (slices.length < 2) return null;
  return {
    type: "pie_chart",
    caption: sanitizeStructuredText(raw.caption),
    slices,
  };
}


export function blockNumberLine(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const points = Array.isArray(raw.points)
    ? raw.points
        .map(normalizeNumberLinePoint)
        .filter((entry): entry is StructuredNumberLinePoint => entry !== null)
        .slice(0, 8)
    : [];
  const intervals = Array.isArray(raw.intervals)
    ? raw.intervals
        .map(normalizeNumberLineInterval)
        .filter((entry): entry is StructuredNumberLineInterval => entry !== null)
        .slice(0, 4)
    : [];
  if (points.length === 0 && intervals.length === 0) return null;
  return {
    type: "number_line",
    caption: sanitizeStructuredText(raw.caption),
    min: finiteNumber(raw.min, -5),
    max: finiteNumber(raw.max, 5),
    points,
    intervals,
  };
}


export function blockLineChart(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const rawSeries = Array.isArray(raw.series) ? raw.series : Array.isArray(raw.lines) ? raw.lines : [];
  let xValues = Array.isArray(raw.x_values)
    ? raw.x_values.map((v) => sanitizeDiagramLabel(v) ?? "")
    : [];
  
  const series = rawSeries
    .map((entry) => {
      const row = asRecord(entry);
      if (!row) return null;
      const values = (Array.isArray(row.values) ? row.values : [])
        .map((v) => finiteNumber(v, Number.NaN))
        .filter((v): v is number => Number.isFinite(v));
      if (values.length < 2) return null;
      return {
        name: sanitizeDiagramLabel(row.name ?? row.label) ?? "",
        tone: normalizeFigureTone(row.tone),
        values: values.slice(0, 24),
      };
    })
    .filter((s): s is { name: string; tone: StructuredFigureTone; values: number[] } => s !== null)
    .slice(0, 4);
  
  if (series.length === 0 && Array.isArray(raw.points)) {
    const points = raw.points.map(asRecord).filter((p): p is Record<string, unknown> => p !== null);
    const values = points.map((p) => finiteNumber(p.y, Number.NaN)).filter((v) => Number.isFinite(v));
    if (values.length >= 2) {
      series.push({ name: "", tone: normalizeFigureTone(raw.tone), values: values.slice(0, 24) });
      if (xValues.length === 0) {
        xValues = points.map((p) => sanitizeDiagramLabel(p.x) ?? "").slice(0, 24);
      }
    }
  }
  if (series.length === 0) return null;
  
  const longest = Math.max(...series.map((s) => s.values.length));
  return {
    type: "line_chart",
    caption: sanitizeStructuredText(raw.caption),
    xLabel: sanitizeDiagramLabel(raw.x_label) ?? "",
    yLabel: sanitizeDiagramLabel(raw.y_label) ?? "",
    xValues: xValues.length === longest ? xValues : [],
    series,
  };
}


export function sanitizeGraphExpression(value: unknown): string {
  return stringValue(value, "x")
    .replace(/[<>"'`;$]/g, "")
    .replace(/[^0-9A-Za-z_+\-*/^()., ]/g, "")
    .trim()
    .slice(0, 180) || "x";
}
