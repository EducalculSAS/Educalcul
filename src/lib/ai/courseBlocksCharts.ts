import { StructuredCourseBlock, finiteNumber, normalizeFigureTone, StructuredFigureTone, normalizeStructuredRichText, StructuredBar } from "./structuredFigures";
import { sanitizeStructuredText, asRecord, stringValue } from "./structuredMath";
import { sanitizeDiagramLabel } from "./courseBlocksText";
import { normalizeJsxSpec } from "@/lib/jsxFigure";


/** Étiquettes de cotes d'une figure de géométrie : clés connues seulement, valeurs courtes. */
export function geometryLabels(value: unknown): Record<string, string> {
  const allowed = ["height", "radius", "diameter", "base", "length", "width", "depth", "side", "a", "b", "c", "hypotenuse", "big_base", "small_base"];
  const rec = asRecord(value);
  const out: Record<string, string> = {};
  if (!rec) return out;
  for (const key of allowed) {
    const v = rec[key];
    if (typeof v === "string" || typeof v === "number") {
      const text = String(v).replace(/\s+/g, " ").trim().slice(0, 16);
      if (text) out[key] = text;
    }
  }
  return out;
}


export function normalizeBar(value: unknown): StructuredBar | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  const numericValue = finiteNumber(raw.value, Number.NaN);
  if (!label || !Number.isFinite(numericValue) || numericValue < 0) return null;
  return { label: label.slice(0, 30), value: numericValue, tone: normalizeFigureTone(raw.tone) };
}


export function blockScatterPlot(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const points = (Array.isArray(raw.points) ? raw.points : [])
    .map(asRecord)
    .filter((p): p is Record<string, unknown> => p !== null)
    .map((p) => ({ x: finiteNumber(p.x, Number.NaN), y: finiteNumber(p.y, Number.NaN) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .slice(0, 40);
  if (points.length < 2) return null;
  return {
    type: "scatter_plot",
    caption: sanitizeStructuredText(raw.caption),
    xLabel: sanitizeDiagramLabel(raw.x_label) ?? "",
    yLabel: sanitizeDiagramLabel(raw.y_label) ?? "",
    points,
  };
}


export function blockFlowchart(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  // Deux écritures observées : nodes[{label, type}] et steps[""].
  const rawNodes = Array.isArray(raw.nodes)
    ? raw.nodes
    : Array.isArray(raw.steps)
      ? raw.steps.map((label) => ({ label }))
      : [];
  
  const nodes = rawNodes
    .map((entry, index, all) => {
      const row: Record<string, unknown> = asRecord(entry) ?? { label: entry };
      const label = sanitizeDiagramLabel(row.label ?? row.text);
      if (!label) return null;
      const declared = String(row.kind ?? row.type ?? "").toLowerCase();
      // Une flèche n'est pas une étape : le modèle en glisse parfois entre
      // deux boîtes, ce qui ferait un rectangle « Oui » dans le schéma.
      if (declared === "arrow" || declared === "edge") return null;
      const kind: "start" | "end" | "action" | "condition" =
        declared === "condition" || declared === "decision" || /\?\s*$/.test(label)
          ? "condition"
          : declared === "start" || (index === 0 && /début|debut|start/i.test(label))
            ? "start"
            : declared === "end" || declared === "stop" || index === all.length - 1
              ? "end"
              : "action";
      return { label: label.slice(0, 48), kind };
    })
    .filter((n): n is { label: string; kind: "start" | "end" | "action" | "condition" } => n !== null)
    .slice(0, 8);
  
  if (nodes.length < 2) return null;
  
  const loopFrom = Number.isInteger(raw.loop_from) ? (raw.loop_from as number) : null;
  const loopTo = Number.isInteger(raw.loop_to) ? (raw.loop_to as number) : null;
  const valid = (n: number | null) => (n !== null && n >= 0 && n < nodes.length ? n : null);
  return {
    type: "flowchart",
    caption: sanitizeStructuredText(raw.caption),
    nodes,
    loopFrom: valid(loopFrom),
    loopTo: valid(loopTo),
  };
}


export function blockBarChart(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const bars = Array.isArray(raw.bars)
    ? raw.bars
        .map(normalizeBar)
        .filter((entry): entry is StructuredBar => entry !== null)
        .slice(0, 10)
    : [];
  if (bars.length < 2) return null;
  return {
    type: "bar_chart",
    caption: sanitizeStructuredText(raw.caption),
    bars,
  };
}


export function blockClock(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const hours = Math.max(0, Math.min(23, Math.round(finiteNumber(raw.hours, 3))));
  const minutes = Math.max(0, Math.min(59, Math.round(finiteNumber(raw.minutes, 0))));
  return {
    type: "clock",
    caption: sanitizeStructuredText(raw.caption),
    hours,
    minutes,
    interactive: raw.interactive !== false,
  };
}


export function blockDefinition(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const term = sanitizeStructuredText(raw.term);
  const definition = normalizeStructuredRichText(raw.definition);
  if (!term || definition.parts.length === 0) return null;
  const example = raw.example !== undefined ? normalizeStructuredRichText(raw.example) : undefined;
  return {
    type: "definition",
    term,
    definition,
    example: example && example.parts.length > 0 ? example : undefined,
  };
}


export function blockCoinPurse(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const coins = Array.isArray(raw.coins)
    ? raw.coins.map((c: unknown) => Math.round(finiteNumber(c, 0))).filter((c: number) => c > 0).slice(0, 12)
    : [];
  if (coins.length < 2) return null;
  return {
    type: "coin_purse",
    caption: sanitizeStructuredText(raw.caption),
    coins,
    target: Math.max(1, Math.round(finiteNumber(raw.target, coins[0] ?? 100))),
  };
}


export function blockBalanceScale(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const toNumArray = (v: unknown): number[] =>
    Array.isArray(v)
      ? v.map((n: unknown) => Math.round(finiteNumber(n, 0))).slice(0, 8)
      : [];
  const left = toNumArray(raw.left);
  const right = toNumArray(raw.right);
  const leftLabel = sanitizeStructuredText(raw.left_label ?? raw.leftLabel).slice(0, 40);
  const rightLabel = sanitizeStructuredText(raw.right_label ?? raw.rightLabel).slice(0, 40);
  if (left.length === 0 && right.length === 0 && !leftLabel && !rightLabel) return null;
  const tRaw = stringValue(raw.tilt).toLowerCase();
  const tilt =
    tRaw === "level" || tRaw === "left" || tRaw === "right" ? tRaw : "auto";
  return {
    type: "balance_scale",
    caption: sanitizeStructuredText(raw.caption),
    left,
    right,
    leftLabel,
    rightLabel,
    tilt,
  };
}


export function blockGridPainter(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const rows = Math.max(1, Math.min(12, Math.round(finiteNumber(raw.rows, 3))));
  const cols = Math.max(1, Math.min(12, Math.round(finiteNumber(raw.cols, 4))));
  const highlighted = Math.max(0, Math.min(rows * cols, Math.round(finiteNumber(raw.highlighted, 0))));
  return { type: "grid_painter", caption: sanitizeStructuredText(raw.caption), rows, cols, highlighted };
}


export function blockPatternMaker(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const sequence = Array.isArray(raw.sequence)
    ? raw.sequence.map((s: unknown) => sanitizeDiagramLabel(s)).filter(Boolean).slice(0, 8)
    : [];
  const options = Array.isArray(raw.options)
    ? raw.options.map((s: unknown) => sanitizeDiagramLabel(s)).filter(Boolean).slice(0, 6)
    : [];
  const answer = sanitizeDiagramLabel(raw.answer);
  if (sequence.length < 2 || options.length < 2 || !answer) return null;
  return { type: "pattern_maker", caption: sanitizeStructuredText(raw.caption), sequence, options, answer };
}


export function blockRulerMeasurer(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const segmentLength = Math.max(1, finiteNumber(raw.segmentLength, 10));
  return {
    type: "ruler_measurer",
    caption: sanitizeStructuredText(raw.caption),
    segmentLength,
    unit: sanitizeDiagramLabel(raw.unit) || "cm",
  };
}


export function blockTapeDiagram(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const parts = Array.isArray(raw.parts)
    ? raw.parts
        .map((p: unknown) => {
          const rec = asRecord(p);
          if (!rec) return null;
          const label = sanitizeDiagramLabel(rec.label);
          const value = finiteNumber(rec.value, Number.NaN);
          if (!label || !Number.isFinite(value) || value < 0) return null;
          return { label: label.slice(0, 24), value, tone: normalizeFigureTone(rec.tone) };
        })
        .filter((p): p is { label: string; value: number; tone: StructuredFigureTone } => p !== null)
        .slice(0, 6)
    : [];
  if (parts.length < 2) return null;
  return { type: "tape_diagram", caption: sanitizeStructuredText(raw.caption), parts };
}


export function blockSolid(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const solids = ["cube", "box", "cylinder", "cone", "pyramid", "triangular_prism", "sphere"] as const;
  const solid = solids.find((s) => s === String(raw.solid ?? raw.kind ?? "").trim());
  if (!solid) return null;
  return { type: "solid", solid, caption: sanitizeStructuredText(raw.caption), labels: geometryLabels(raw.labels) };
}


export function blockLabeledPolygon(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const shapes = ["rectangle", "square", "right_triangle", "triangle", "parallelogram", "trapezoid"] as const;
  const shape = shapes.find((s) => s === String(raw.shape ?? raw.kind ?? "").trim());
  if (!shape) return null;
  const vertices = Array.isArray(raw.vertices) ? raw.vertices.map((v: unknown) => String(v ?? "").trim().slice(0, 3)).slice(0, 6) : [];
  return { type: "labeled_polygon", shape, caption: sanitizeStructuredText(raw.caption), labels: geometryLabels(raw.labels), vertices };
}


export function blockJsxFigure(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const spec = normalizeJsxSpec(raw.spec ?? raw);
  return spec ? { type: "jsx_figure", caption: spec.caption, spec } : null;
}


export function blockLabeledCircle(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return { type: "labeled_circle", caption: sanitizeStructuredText(raw.caption), labels: geometryLabels(raw.labels) };
}


export function blockBrickPyramid(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const cell = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 9);
  let levels = Array.isArray(raw.levels)
    ? raw.levels
        .map((row: unknown) => (Array.isArray(row) ? row.map(cell) : null))
        .filter((row: string[] | null): row is string[] => row !== null)
        .slice(0, 7)
    : [];
  // Fournie de la base vers le sommet : on remet le sommet en premier.
  if (levels.length >= 2 && levels[0].length > levels[levels.length - 1].length) levels = levels.slice().reverse();
  if (levels.length < 2 || levels.some((row: string[], i: number) => row.length !== i + 1)) return null;
  return { type: "brick_pyramid", caption: sanitizeStructuredText(raw.caption), levels };
}


export function blockFillGrid(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const cell = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 12);
  const cells = Array.isArray(raw.cells)
    ? raw.cells
        .map((row: unknown) => (Array.isArray(row) ? row.map(cell) : null))
        .filter((row: string[] | null): row is string[] => row !== null)
        .slice(0, 8)
    : [];
  const width = cells[0]?.length ?? 0;
  if (cells.length < 1 || width < 1 || width > 8 || cells.some((row: string[]) => row.length !== width)) return null;
  return { type: "fill_grid", caption: sanitizeStructuredText(raw.caption), cells };
}


export function blockFractionStrips(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const fractions = Array.isArray(raw.fractions)
    ? raw.fractions
        .map((f: unknown) => {
          const rec = asRecord(f);
          if (!rec) return null;
          const denominator = Math.max(2, Math.min(12, Math.round(finiteNumber(rec.denominator, 4))));
          const numerator = Math.max(0, Math.min(denominator, Math.round(finiteNumber(rec.numerator, 1))));
          return { numerator, denominator };
        })
        .filter((f): f is { numerator: number; denominator: number } => f !== null)
        .slice(0, 5)
    : [];
  if (fractions.length < 2) return null;
  return { type: "fraction_strips", caption: sanitizeStructuredText(raw.caption), fractions };
}


export function blockPlaceValueChart(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "place_value_chart",
    caption: sanitizeStructuredText(raw.caption),
    number: finiteNumber(raw.number, 0),
  };
}


export function blockRatioMixer(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const ratios = Array.isArray(raw.ratios)
    ? raw.ratios
        .map((r: unknown) => {
          const rec = asRecord(r);
          if (!rec) return null;
          const label = sanitizeDiagramLabel(rec.label);
          const value = finiteNumber(rec.value, Number.NaN);
          if (!label || !Number.isFinite(value) || value < 0) return null;
          return { label: label.slice(0, 24), value, tone: normalizeFigureTone(rec.tone) };
        })
        .filter((r): r is { label: string; value: number; tone: StructuredFigureTone } => r !== null)
        .slice(0, 5)
    : [];
  if (ratios.length < 2) return null;
  return { type: "ratio_mixer", caption: sanitizeStructuredText(raw.caption), ratios };
}


export function blockNetFolder(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "net_folder",
    caption: sanitizeStructuredText(raw.caption),
    solid: raw.solid === "pave" ? "pave" : "cube",
    width: Math.max(1, finiteNumber(raw.width, 4)),
    height: Math.max(1, finiteNumber(raw.height, 4)),
    depth: Math.max(1, finiteNumber(raw.depth, 4)),
  };
}
