import { BlockCtx, sanitizeDiagramLabel } from "./courseBlocksText";
import { StructuredCourseBlock, StructuredRichText, normalizeStructuredRichText, finiteNumber, StructuredVennSet, normalizeShapeBlock, normalizeFigureTone, StructuredProbabilityBranch, StructuredProbabilityLeaf } from "./structuredFigures";
import { asRecord, sanitizeStructuredText } from "./structuredMath";


export function normalizeProbabilityLeaf(value: unknown): StructuredProbabilityLeaf | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  const probability = sanitizeDiagramLabel(raw.probability);
  if (!label || !probability) return null;
  return { label: label.slice(0, 40), probability: probability.slice(0, 20) };
}


export function normalizeProbabilityBranch(
  value: unknown,
): StructuredProbabilityBranch | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const leaf = normalizeProbabilityLeaf(raw);
  if (!leaf) return null;
  const children = Array.isArray(raw.children)
    ? raw.children
        .map(normalizeProbabilityLeaf)
        .filter((entry): entry is StructuredProbabilityLeaf => entry !== null)
        .slice(0, 4)
    : [];
  return { ...leaf, children };
}


export function normalizeVennSet(value: unknown): StructuredVennSet | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  if (!label) return null;
  return { label: label.slice(0, 30), tone: normalizeFigureTone(raw.tone) };
}


export function blockInteractiveProtractor(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "interactive_protractor",
    caption: sanitizeStructuredText(raw.caption),
    angleDeg: Math.max(0, Math.min(180, finiteNumber(raw.angleDeg, 45))),
  };
}


export function blockCompassTool(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "compass_tool",
    caption: sanitizeStructuredText(raw.caption),
    radius: Math.max(1, finiteNumber(raw.radius, 5)),
    centerLabel: sanitizeDiagramLabel(raw.centerLabel) || "O",
  };
}


export function blockThermometerAxis(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const points = Array.isArray(raw.points)
    ? raw.points
        .map((p: unknown) => {
          const rec = asRecord(p);
          if (!rec) return null;
          const label = sanitizeDiagramLabel(rec.label);
          const value = finiteNumber(rec.value, Number.NaN);
          if (!label || !Number.isFinite(value)) return null;
          return { value, label: label.slice(0, 20) };
        })
        .filter((p): p is { value: number; label: string } => p !== null)
        .slice(0, 6)
    : [];
  return {
    type: "thermometer_axis",
    caption: sanitizeStructuredText(raw.caption),
    min: finiteNumber(raw.min, -10),
    max: finiteNumber(raw.max, 10),
    points,
  };
}


export function blockAreaDecomposer(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const shapes = Array.isArray(raw.shapes)
    ? raw.shapes
        .map((s: unknown) => {
          const rec = asRecord(s);
          if (!rec) return null;
          const width = finiteNumber(rec.width, Number.NaN);
          const height = finiteNumber(rec.height, Number.NaN);
          if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
          return { width, height, label: sanitizeDiagramLabel(rec.label).slice(0, 20) };
        })
        .filter((s): s is { width: number; height: number; label: string } => s !== null)
        .slice(0, 5)
    : [];
  if (shapes.length === 0) return null;
  // Décomposition d'aire = plusieurs rectangles → bloc "shape" composable.
  let ax = 1;
  return normalizeShapeBlock({
    caption: raw.caption,
    parts: shapes.flatMap((s) => {
      const p = {
        kind: "rectangle",
        x: ax,
        y: 1,
        w: s.width,
        h: s.height,
        tone: "blue",
        side_labels: [],
        vertex_labels: [],
        show_dimensions: true,
      };
      const label = s.label
        ? [{ kind: "text", x: ax + s.width / 2, y: 1 + s.height / 2, text: s.label, tone: "navy" }]
        : [];
      ax += s.width + 1;
      return [p, ...label];
    }),
  });
}


export function blockScientificNotationConverter(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "scientific_notation_converter",
    caption: sanitizeStructuredText(raw.caption),
    value: finiteNumber(raw.value, 1),
    exponent: Math.round(finiteNumber(raw.exponent, 0)),
  };
}


export function blockEquationBalancer(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const leftTerms = Array.isArray(raw.leftTerms)
    ? raw.leftTerms.map((t: unknown) => sanitizeDiagramLabel(t)).filter(Boolean).slice(0, 5)
    : [];
  const rightTerms = Array.isArray(raw.rightTerms)
    ? raw.rightTerms.map((t: unknown) => sanitizeDiagramLabel(t)).filter(Boolean).slice(0, 5)
    : [];
  if (leftTerms.length === 0 || rightTerms.length === 0) return null;
  return { type: "equation_balancer", caption: sanitizeStructuredText(raw.caption), leftTerms, rightTerms };
}


export function blockSlopeTriangle(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "slope_triangle",
    caption: sanitizeStructuredText(raw.caption),
    a: finiteNumber(raw.a, 1),
    b: finiteNumber(raw.b, 0),
    xMin: finiteNumber(raw.xMin, -5),
    xMax: finiteNumber(raw.xMax, 5),
  };
}


export function blockVectorAdditionPad(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "vector_addition_pad",
    caption: sanitizeStructuredText(raw.caption),
    ux: finiteNumber(raw.ux, 2),
    uy: finiteNumber(raw.uy, 1),
    vx: finiteNumber(raw.vx, 1),
    vy: finiteNumber(raw.vy, 2),
  };
}


export function blockIntervalBuilder(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "interval_builder",
    caption: sanitizeStructuredText(raw.caption),
    min: finiteNumber(raw.min, -5),
    max: finiteNumber(raw.max, 5),
    lowerBound: finiteNumber(raw.lowerBound, -2),
    upperBound: finiteNumber(raw.upperBound, 2),
    lowerOpen: raw.lowerOpen === true,
    upperOpen: raw.upperOpen === true,
  };
}


export function blockTangentScrubber(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const expression = sanitizeDiagramLabel(raw.expression);
  if (!expression) return null;
  return {
    type: "tangent_scrubber",
    caption: sanitizeStructuredText(raw.caption),
    expression,
    x0: finiteNumber(raw.x0, 0),
    xMin: finiteNumber(raw.xMin, -5),
    xMax: finiteNumber(raw.xMax, 5),
  };
}


export function blockSequenceCobweb(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const expression = sanitizeDiagramLabel(raw.expression);
  if (!expression) return null;
  return {
    type: "sequence_cobweb",
    caption: sanitizeStructuredText(raw.caption),
    expression,
    u0: finiteNumber(raw.u0, 1),
    iterations: Math.max(1, Math.min(10, Math.round(finiteNumber(raw.iterations, 5)))),
    xMin: finiteNumber(raw.xMin, 0),
    xMax: finiteNumber(raw.xMax, 5),
  };
}


export function blockIntegralRiemannSlider(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const expression = sanitizeDiagramLabel(raw.expression);
  if (!expression) return null;
  return {
    type: "integral_riemann_slider",
    caption: sanitizeStructuredText(raw.caption),
    expression,
    xMin: finiteNumber(raw.xMin, 0),
    xMax: finiteNumber(raw.xMax, 5),
    rectangles: Math.max(2, Math.min(30, Math.round(finiteNumber(raw.rectangles, 8)))),
  };
}


export function blockComplexPlanePolar(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "complex_plane_polar",
    caption: sanitizeStructuredText(raw.caption),
    re: finiteNumber(raw.re, 1),
    im: finiteNumber(raw.im, 1),
  };
}


export function blockAlgoSandbox(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  // Le modèle nomme ce champ « content » ou « source » aussi souvent que « code ».
  const rawCode = raw.code ?? raw.content ?? raw.source;
  const code = typeof rawCode === "string" ? rawCode.slice(0, 2000) : "";
  if (!code.trim()) return null;
  return {
    type: "algo_sandbox",
    caption: sanitizeStructuredText(raw.caption),
    code,
    language: sanitizeDiagramLabel(raw.language) || "python",
  };
}


export function blockFraction(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const denominator = Math.max(2, Math.min(12, Math.round(finiteNumber(raw.denominator, 4))));
  const numerator = Math.max(0, Math.min(denominator, Math.round(finiteNumber(raw.numerator, 1))));
  const shape = raw.shape === "circle" ? "circle" : "bar";
  return {
    type: "fraction",
    caption: sanitizeStructuredText(raw.caption),
    numerator,
    denominator,
    shape,
  };
}


export function blockProbabilityTree(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const branches = Array.isArray(raw.branches)
    ? raw.branches
        .map(normalizeProbabilityBranch)
        .filter((entry): entry is StructuredProbabilityBranch => entry !== null)
        .slice(0, 4)
    : [];
  if (branches.length < 2) return null;
  return {
    type: "probability_tree",
    caption: sanitizeStructuredText(raw.caption),
    branches,
  };
}


export function blockVennDiagram(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const sets = Array.isArray(raw.sets)
    ? raw.sets
        .map(normalizeVennSet)
        .filter((entry): entry is StructuredVennSet => entry !== null)
        .slice(0, 3)
    : [];
  if (sets.length < 2) return null;
  const rl = asRecord(raw.region_labels ?? raw.regionLabels) ?? {};
  const g = (k: string) => sanitizeDiagramLabel(rl[k]);
  // Venn = 2 (ou 3) cercles qui se chevauchent + des nombres → "shape".
  const three = sets.length >= 3;
  const parts: Record<string, unknown>[] = three
    ? [
        { kind: "circle", x: 5, y: 7, r: 4, tone: sets[0].tone, filled: true, vertex_labels: [sets[0].label] },
        { kind: "circle", x: 9, y: 7, r: 4, tone: sets[1].tone, filled: true, vertex_labels: [sets[1].label] },
        { kind: "circle", x: 7, y: 4, r: 4, tone: sets[2].tone, filled: true, vertex_labels: [sets[2].label] },
      ]
    : [
        { kind: "circle", x: 6, y: 5.5, r: 3.8, tone: sets[0].tone, filled: true, vertex_labels: [sets[0].label] },
        { kind: "circle", x: 10, y: 5.5, r: 3.8, tone: sets[1].tone, filled: true, vertex_labels: [sets[1].label] },
      ];
  if (!three) {
    if (g("a_only")) parts.push({ kind: "text", x: 3.8, y: 5.5, text: g("a_only"), tone: "navy" });
    if (g("both")) parts.push({ kind: "text", x: 8, y: 5.5, text: g("both"), tone: "navy" });
    if (g("b_only")) parts.push({ kind: "text", x: 12.2, y: 5.5, text: g("b_only"), tone: "navy" });
    if (g("neither")) parts.push({ kind: "text", x: 14.5, y: 1.5, text: g("neither"), tone: "gray" });
  }
  return normalizeShapeBlock({
    caption: raw.caption,
    width: 16,
    height: three ? 13 : 11,
    parts,
  });
}


export function blockBoxPlot(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  const min = finiteNumber(raw.min, 0);
  const q1 = finiteNumber(raw.q1, min);
  const median = finiteNumber(raw.median, q1);
  const q3 = finiteNumber(raw.q3, median);
  const max = finiteNumber(raw.max, q3);
  return {
    type: "box_plot",
    caption: sanitizeStructuredText(raw.caption),
    min,
    q1,
    median,
    q3,
    max,
    axisLabel: sanitizeDiagramLabel(raw.axis_label ?? raw.axisLabel) || undefined,
  };
}


export function blockExercise(raw: Record<string, unknown>): StructuredCourseBlock | null {
  
  return {
    type: "exercise",
    exerciseIndex: Math.max(
      1,
      Math.trunc(finiteNumber(raw.exercise_index ?? raw.exerciseIndex ?? raw.index, 1)),
    ),
  };
}


export function blockSteps(raw: Record<string, unknown>, ctx: BlockCtx): StructuredCourseBlock | null {
  
  const steps: Array<{
    title?: StructuredRichText;
    blocks: StructuredCourseBlock[];
  }> = [];
  if (Array.isArray(raw.steps)) {
    for (const step of raw.steps) {
      const stepRecord = asRecord(step);
      if (!stepRecord) continue;
      const blocks = Array.isArray(stepRecord.blocks)
        ? stepRecord.blocks
            .map((block) => ctx.normalize(block, ctx.depth + 1))
            .filter((block): block is StructuredCourseBlock => block !== null)
        : [];
      if (blocks.length === 0 && stepRecord.content !== undefined) {
        blocks.push({
          type: "paragraph",
          content: normalizeStructuredRichText(stepRecord.content),
        });
      }
      if (blocks.length === 0) continue;
      const normalizedStep: {
        title?: StructuredRichText;
        blocks: StructuredCourseBlock[];
      } = { blocks };
      if (stepRecord.title !== undefined) {
        normalizedStep.title = normalizeStructuredRichText(stepRecord.title);
      }
      steps.push(normalizedStep);
    }
  }
  return { type: "steps", steps };
}
