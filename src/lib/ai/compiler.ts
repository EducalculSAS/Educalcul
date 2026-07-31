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
  type StructuredLearningResource,
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


const FIGURE_PALETTE = {
  navy: "#10213d",
  gold: "#c89f36",
  blue: "#2563eb",
  green: "#15803d",
  red: "#dc2626",
  gray: "#64748b",
} as const;

const GRAPH_VECTOR_PALETTE = {
  navy: "#10213d",
  gold: "#c89f36",
  blue: "#3182ce",
  green: "#38a169",
  red: "#e53e3e",
  gray: "#64748b",
} as const;

function signSymbol(value: string): string {
  if (value === "positive") return "+";
  if (value === "negative") return "−";
  if (value === "zero") return "0";
  return "∅";
}

function directionSymbol(value: string): string {
  if (value === "down") return "↘";
  if (value === "constant") return "→";
  return "↗";
}

function simpleHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function figureLabel(
  value: StructuredRichText | undefined,
  x: number | undefined,
  y: number | undefined,
): string {
  if (!value?.parts.length || x === undefined || y === undefined) return "";
  const label = structuredRichTextToPlainText(value);
  return label
    ? `<text x="${x}" y="${y}" font-size="12" fill="#10213d">${escapeHtml(label)}</text>`
    : "";
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

// ── Diagrammes déterministes ─────────────────────────────────────────────────
// La disposition géométrique (angles, échelles, positions) est calculée ici,
// jamais laissée à l'IA : c'est ce qui élimine la classe de bugs de "figure"
// (chevauchement de labels, débordement du viewBox). Le modèle ne fournit que
// des données sémantiques (valeurs, labels courts).

function num(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

/** Point sur un cercle en convention mathématique standard (0°=est,
 * antihoraire), contrairement à polarPoint (0°=est, horaire, utilisé par
 * "figure" pour des arcs SVG où l'axe y est inversé). */
function trigPoint(
  cx: number,
  cy: number,
  radius: number,
  angleDegrees: number,
): { x: number; y: number } {
  const radians = (angleDegrees * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy - radius * Math.sin(radians) };
}

function labelAnchorFor(cosValue: number): "start" | "middle" | "end" {
  if (cosValue > 0.2) return "start";
  if (cosValue < -0.2) return "end";
  return "middle";
}

function labelDyFor(sinValue: number): string {
  if (sinValue > 0.2) return "-4";
  if (sinValue < -0.2) return "10";
  return "3";
}

// Coordonnées exactes des angles remarquables du cercle trigonométrique :
// calculées une fois ici, jamais confiées au modèle (élimine tout risque
// d'erreur de calcul ou de "racine(3)/2" mal placé/tronqué).
const UNIT_CIRCLE_COORDS: Record<number, [string, string]> = {
  0: ["1", "0"],
  30: ["√3/2", "1/2"],
  45: ["√2/2", "√2/2"],
  60: ["1/2", "√3/2"],
  90: ["0", "1"],
  120: ["-1/2", "√3/2"],
  135: ["-√2/2", "√2/2"],
  150: ["-√3/2", "1/2"],
  180: ["-1", "0"],
  210: ["-√3/2", "-1/2"],
  225: ["-√2/2", "-√2/2"],
  240: ["-1/2", "-√3/2"],
  270: ["0", "-1"],
  300: ["1/2", "-√3/2"],
  315: ["√2/2", "-√2/2"],
  330: ["√3/2", "-1/2"],
};

function renderTrigCircle(
  block: Extract<StructuredCourseBlock, { type: "trig_circle" }>,
): string {
  const cx = 100;
  const cy = 100;
  const r = 68;
  const angles = block.highlightedAngles.slice(0, 8);
  const axes = `<line x1="${cx - r - 18}" y1="${cy}" x2="${cx + r + 18}" y2="${cy}" stroke="#94a3b8" stroke-width="1"/><line x1="${cx}" y1="${cy - r - 18}" x2="${cx}" y2="${cy + r + 18}" stroke="#94a3b8" stroke-width="1"/>`;
  const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="#10213d" stroke-width="1.5" fill="none"/>`;
  const markers = angles
    .map((angle) => {
      const normalized = ((Math.round(angle.angleDeg) % 360) + 360) % 360;
      const exact = UNIT_CIRCLE_COORDS[normalized];
      const text = exact
        ? `${escapeHtml(angle.label)} : (${escapeHtml(exact[0])}, ${escapeHtml(exact[1])})`
        : escapeHtml(angle.label);
      const point = trigPoint(cx, cy, r, angle.angleDeg);
      const labelPoint = trigPoint(cx, cy, r + 16, angle.angleDeg);
      const radians = (angle.angleDeg * Math.PI) / 180;
      const anchor = labelAnchorFor(Math.cos(radians));
      const dy = labelDyFor(Math.sin(radians));
      return `<circle cx="${num(point.x)}" cy="${num(point.y)}" r="3.2" fill="#dc2626"/><text x="${num(labelPoint.x)}" y="${num(labelPoint.y)}" dy="${dy}" font-size="10" text-anchor="${anchor}" fill="#10213d">${text}</text>`;
    })
    .join("");
  // Point mobile ajouté/animé côté client par enhanceTrigCircles
  // (src/lib/trigCircleInteractive.ts) : le curseur fait varier l'angle et
  // affiche (cos, sin) en direct, sans jamais recalculer le tracé statique
  // ci-dessus (déjà correct et déterministe).
  const svg = `<svg class="tc-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img">${axes}${circle}${markers}<g class="tc-live"></g></svg>`;
  const controls = `<div class="tc-controls"><input type="range" class="tc-angle-slider" min="0" max="360" step="1" value="45"/><span class="tc-angle-value">45°</span></div>`;
  return `<figure class="course-figure course-figure-trig-circle">${svg}${controls}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderPieChart(
  block: Extract<StructuredCourseBlock, { type: "pie_chart" }>,
): string {
  const cx = 95;
  const cy = 80;
  const r = 55;
  const total = block.slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  let startAngle = -90;
  const parts = block.slices.map((slice) => {
    const sweep = (slice.value / total) * 360;
    const endAngle = startAngle + sweep;
    const start = trigPoint(cx, cy, r, -startAngle);
    const end = trigPoint(cx, cy, r, -endAngle);
    const largeArc = sweep > 180 ? 1 : 0;
    const midAngle = -(startAngle + endAngle) / 2;
    const labelPoint = trigPoint(cx, cy, r + 16, midAngle);
    const midRadians = (midAngle * Math.PI) / 180;
    const anchor = labelAnchorFor(Math.cos(midRadians));
    const percent = Math.round((slice.value / total) * 100);
    const path =
      sweep >= 359.99
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${FIGURE_PALETTE[slice.tone]}" fill-opacity="0.75" stroke="#fff" stroke-width="1.5"/>`
        : `<path d="M ${num(cx)} ${num(cy)} L ${num(start.x)} ${num(start.y)} A ${r} ${r} 0 ${largeArc} 1 ${num(end.x)} ${num(end.y)} Z" fill="${FIGURE_PALETTE[slice.tone]}" fill-opacity="0.75" stroke="#fff" stroke-width="1.5"/>`;
    const label = `<text x="${num(labelPoint.x)}" y="${num(labelPoint.y)}" font-size="10" text-anchor="${anchor}" fill="#10213d">${escapeHtml(slice.label)} (${percent}%)</text>`;
    startAngle = endAngle;
    return path + label;
  });
  const svg = `<svg viewBox="0 0 260 160" xmlns="http://www.w3.org/2000/svg" role="img">${parts.join("")}</svg>`;
  return `<figure class="course-figure course-figure-pie-chart">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderNumberLine(
  block: Extract<StructuredCourseBlock, { type: "number_line" }>,
): string {
  const min = Math.min(block.min, block.max);
  const max = Math.max(block.min, block.max);
  const span = max - min || 1;
  const left = 20;
  const right = 220;
  const y = 35;
  const toX = (value: number) => left + ((value - min) / span) * (right - left);
  const showTicks = span <= 14 && Number.isInteger(min) && Number.isInteger(max);
  const ticks = showTicks
    ? Array.from({ length: Math.round(span) + 1 }, (_, index) => min + index)
        .map(
          (value) =>
            `<line x1="${num(toX(value))}" y1="${y - 4}" x2="${num(toX(value))}" y2="${y + 4}" stroke="#94a3b8" stroke-width="1"/><text x="${num(toX(value))}" y="${y + 18}" font-size="9" text-anchor="middle" fill="#64748b">${value}</text>`,
        )
        .join("")
    : "";
  const line = `<line x1="${left - 10}" y1="${y}" x2="${right + 10}" y2="${y}" stroke="#10213d" stroke-width="1.5" marker-end="url(#nl-arrow)" marker-start="url(#nl-arrow-start)"/>`;
  const intervals = block.intervals
    .map((interval) => {
      const x1 = toX(Math.max(interval.from, min));
      const x2 = toX(Math.min(interval.to, max));
      const color = FIGURE_PALETTE[interval.tone];
      const bracket = (x: number, included: boolean) =>
        included
          ? `<circle cx="${num(x)}" cy="${y}" r="3.5" fill="${color}"/>`
          : `<circle cx="${num(x)}" cy="${y}" r="3.5" fill="#fff" stroke="${color}" stroke-width="1.5"/>`;
      return `<line x1="${num(x1)}" y1="${y}" x2="${num(x2)}" y2="${y}" stroke="${color}" stroke-width="4"/>${bracket(x1, interval.fromIncluded)}${bracket(x2, interval.toIncluded)}`;
    })
    .join("");
  const points = block.points
    .map((point) => {
      const x = toX(clampNumber(point.value, min, max));
      const fill = point.filled ? "#10213d" : "#fff";
      return `<circle cx="${num(x)}" cy="${y}" r="4" fill="${fill}" stroke="#10213d" stroke-width="1.5"/><text x="${num(x)}" y="${y - 10}" font-size="10" text-anchor="middle" fill="#10213d">${escapeHtml(point.label)}</text>`;
    })
    .join("");
  const svg = `<svg viewBox="0 0 240 70" xmlns="http://www.w3.org/2000/svg" role="img"><defs><marker id="nl-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L6,3 L0,6 Z" fill="#10213d"/></marker><marker id="nl-arrow-start" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M6,0 L0,3 L6,6 Z" fill="#10213d"/></marker></defs>${line}${ticks}${intervals}${points}</svg>`;
  return `<figure class="course-figure course-figure-number-line">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function renderBarChart(
  block: Extract<StructuredCourseBlock, { type: "bar_chart" }>,
): string {
  const bars = block.bars;
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);
  const chartLeft = 20;
  const chartRight = 210;
  const chartTop = 15;
  const chartBottom = 130;
  const slotWidth = (chartRight - chartLeft) / bars.length;
  const barWidth = slotWidth * 0.6;
  const axis = `<line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#10213d" stroke-width="1.5"/>`;
  const parts = bars
    .map((bar, index) => {
      const height = (bar.value / maxValue) * (chartBottom - chartTop);
      const x = chartLeft + index * slotWidth + (slotWidth - barWidth) / 2;
      const yTop = chartBottom - height;
      const color = FIGURE_PALETTE[bar.tone];
      return `<rect x="${num(x)}" y="${num(yTop)}" width="${num(barWidth)}" height="${num(height)}" fill="${color}" fill-opacity="0.8"/><text x="${num(x + barWidth / 2)}" y="${num(yTop - 5)}" font-size="10" text-anchor="middle" fill="#10213d">${bar.value}</text><text x="${num(x + barWidth / 2)}" y="${chartBottom + 14}" font-size="10" text-anchor="middle" fill="#64748b">${escapeHtml(bar.label)}</text>`;
    })
    .join("");
  const svg = `<svg viewBox="0 0 220 160" xmlns="http://www.w3.org/2000/svg" role="img">${axis}${parts}</svg>`;
  return `<figure class="course-figure course-figure-bar-chart">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderProbabilityTree(
  block: Extract<StructuredCourseBlock, { type: "probability_tree" }>,
): string {
  const branches = block.branches;
  const leafCounts = branches.map((branch) => Math.max(1, branch.children.length));
  const totalLeaves = leafCounts.reduce((sum, count) => sum + count, 0);
  const rowHeight = 26;
  const height = Math.max(90, (totalLeaves + branches.length) * rowHeight);
  const rootX = 15;
  const branchX = 95;
  const leafX = 190;
  const rootY = height / 2;
  let cursorY = 10;
  const segments: string[] = [];
  branches.forEach((branch, index) => {
    const leaves = branch.children.length > 0 ? branch.children : [{ label: "", probability: "" }];
    const branchTop = cursorY;
    const branchBottom = cursorY + leaves.length * rowHeight;
    const branchY = (branchTop + branchBottom) / 2;
    segments.push(
      `<line x1="${rootX}" y1="${num(rootY)}" x2="${branchX}" y2="${num(branchY)}" stroke="#10213d" stroke-width="1.5"/>`,
      `<text x="${(rootX + branchX) / 2}" y="${num((rootY + branchY) / 2 - 5)}" font-size="9" text-anchor="middle" fill="#64748b">${escapeHtml(branch.probability)}</text>`,
      `<text x="${branchX + 6}" y="${num(branchY)}" dy="-6" font-size="10" fill="#10213d">${escapeHtml(branch.label)}</text>`,
    );
    if (branch.children.length > 0) {
      branch.children.forEach((leaf, leafIndex) => {
        const leafY = branchTop + leafIndex * rowHeight + rowHeight / 2;
        segments.push(
          `<line x1="${branchX}" y1="${num(branchY)}" x2="${leafX}" y2="${num(leafY)}" stroke="#10213d" stroke-width="1.5"/>`,
          `<text x="${(branchX + leafX) / 2}" y="${num((branchY + leafY) / 2 - 5)}" font-size="9" text-anchor="middle" fill="#64748b">${escapeHtml(leaf.probability)}</text>`,
          `<text x="${leafX + 6}" y="${num(leafY)}" dy="3" font-size="10" fill="#10213d">${escapeHtml(leaf.label)}</text>`,
        );
      });
    }
    cursorY = branchBottom;
    void index;
  });
  const svg = `<svg viewBox="0 0 260 ${num(height)}" xmlns="http://www.w3.org/2000/svg" role="img">${segments.join("")}</svg>`;
  return `<figure class="course-figure course-figure-probability-tree">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderVennDiagram(
  block: Extract<StructuredCourseBlock, { type: "venn_diagram" }>,
): string {
  const sets = block.sets;
  const r = 42;
  if (sets.length === 2) {
    const cxA = 78;
    const cxB = 122;
    const cy = 75;
    const region = block.regionLabels;
    const circles = `<circle cx="${cxA}" cy="${cy}" r="${r}" fill="${FIGURE_PALETTE[sets[0].tone]}" fill-opacity="0.35" stroke="${FIGURE_PALETTE[sets[0].tone]}" stroke-width="1.5"/><circle cx="${cxB}" cy="${cy}" r="${r}" fill="${FIGURE_PALETTE[sets[1].tone]}" fill-opacity="0.35" stroke="${FIGURE_PALETTE[sets[1].tone]}" stroke-width="1.5"/>`;
    const setLabels = `<text x="${cxA - 20}" y="${cy - r - 6}" font-size="11" text-anchor="middle" fill="#10213d">${escapeHtml(sets[0].label)}</text><text x="${cxB + 20}" y="${cy - r - 6}" font-size="11" text-anchor="middle" fill="#10213d">${escapeHtml(sets[1].label)}</text>`;
    const regionLabels = region
      ? [
          region.aOnly ? `<text x="${cxA - 22}" y="${cy}" font-size="10" text-anchor="middle" fill="#10213d">${escapeHtml(region.aOnly)}</text>` : "",
          region.bOnly ? `<text x="${cxB + 22}" y="${cy}" font-size="10" text-anchor="middle" fill="#10213d">${escapeHtml(region.bOnly)}</text>` : "",
          region.both ? `<text x="${(cxA + cxB) / 2}" y="${cy}" font-size="10" text-anchor="middle" fill="#10213d">${escapeHtml(region.both)}</text>` : "",
          region.neither ? `<text x="100" y="${cy + r + 20}" font-size="10" text-anchor="middle" fill="#64748b">${escapeHtml(region.neither)}</text>` : "",
        ].join("")
      : "";
    const svg = `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img">${circles}${setLabels}${regionLabels}</svg>`;
    return `<figure class="course-figure course-figure-venn">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
  }
  const centers = [
    { x: 85, y: 55 },
    { x: 60, y: 100 },
    { x: 110, y: 100 },
  ];
  const circles = sets
    .slice(0, 3)
    .map(
      (set, index) =>
        `<circle cx="${centers[index].x}" cy="${centers[index].y}" r="${r}" fill="${FIGURE_PALETTE[set.tone]}" fill-opacity="0.3" stroke="${FIGURE_PALETTE[set.tone]}" stroke-width="1.5"/>`,
    )
    .join("");
  const labelOffsets = [
    { x: 85, y: 55 - r - 8 },
    { x: 60 - r + 5, y: 100 + r + 4 },
    { x: 110 + r - 5, y: 100 + r + 4 },
  ];
  const setLabels = sets
    .slice(0, 3)
    .map(
      (set, index) =>
        `<text x="${labelOffsets[index].x}" y="${labelOffsets[index].y}" font-size="11" text-anchor="middle" fill="#10213d">${escapeHtml(set.label)}</text>`,
    )
    .join("");
  const svg = `<svg viewBox="0 0 170 160" xmlns="http://www.w3.org/2000/svg" role="img">${circles}${setLabels}</svg>`;
  return `<figure class="course-figure course-figure-venn">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderTriangleDiagram(
  block: Extract<StructuredCourseBlock, { type: "triangle_diagram" }>,
): string {
  const isRight = block.rightAngleAt !== undefined;
  const base: Array<{ x: number; y: number }> = isRight
    ? block.rightAngleAt === 0
      ? [{ x: 40, y: 130 }, { x: 160, y: 130 }, { x: 40, y: 30 }]
      : block.rightAngleAt === 1
        ? [{ x: 30, y: 30 }, { x: 30, y: 130 }, { x: 160, y: 130 }]
        : [{ x: 40, y: 130 }, { x: 160, y: 30 }, { x: 40, y: 30 }]
    : [{ x: 100, y: 25 }, { x: 35, y: 135 }, { x: 165, y: 135 }];
  const [a, b, c] = base;
  const centroid = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  const labelAt = (point: { x: number; y: number }) => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: point.x + (dx / length) * 14, y: point.y + (dy / length) * 14 };
  };
  const vertexLabels = [a, b, c]
    .map((point, index) => {
      const label = labelAt(point);
      return `<text x="${num(label.x)}" y="${num(label.y)}" font-size="11" font-weight="bold" text-anchor="middle" fill="#10213d">${escapeHtml(block.vertexLabels[index])}</text>`;
    })
    .join("");
  const sides: Array<[{ x: number; y: number }, { x: number; y: number }]> = [
    [b, c],
    [a, c],
    [a, b],
  ];
  const sideLabels = block.sideLabels
    ? sides
        .map(([p1, p2], index) => {
          const text = block.sideLabels?.[index];
          if (!text) return "";
          const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
          const label = labelAt(mid);
          const midLabel = { x: mid.x + (label.x - mid.x) * 0.6, y: mid.y + (label.y - mid.y) * 0.6 };
          return `<text x="${num(midLabel.x)}" y="${num(midLabel.y)}" font-size="10" text-anchor="middle" fill="#64748b">${escapeHtml(text)}</text>`;
        })
        .join("")
    : "";
  const angleLabels = block.angleLabels
    ? [a, b, c]
        .map((point, index) => {
          const text = block.angleLabels?.[index];
          if (!text) return "";
          const dx = centroid.x - point.x;
          const dy = centroid.y - point.y;
          const length = Math.hypot(dx, dy) || 1;
          const pos = { x: point.x + (dx / length) * 22, y: point.y + (dy / length) * 22 };
          return `<text x="${num(pos.x)}" y="${num(pos.y)}" font-size="9" text-anchor="middle" fill="#c89f36">${escapeHtml(text)}</text>`;
        })
        .join("")
    : "";
  let rightAngleMarker = "";
  if (block.rightAngleAt !== undefined) {
    const vertex = base[block.rightAngleAt];
    const others = base.filter((_, index) => index !== block.rightAngleAt);
    const toUnit = (p: { x: number; y: number }) => {
      const dx = p.x - vertex.x;
      const dy = p.y - vertex.y;
      const length = Math.hypot(dx, dy) || 1;
      return { x: dx / length, y: dy / length };
    };
    const u1 = toUnit(others[0]);
    const u2 = toUnit(others[1]);
    const size = 12;
    const p1 = { x: vertex.x + u1.x * size, y: vertex.y + u1.y * size };
    const p2 = { x: vertex.x + u1.x * size + u2.x * size, y: vertex.y + u1.y * size + u2.y * size };
    const p3 = { x: vertex.x + u2.x * size, y: vertex.y + u2.y * size };
    rightAngleMarker = `<path d="M ${num(p1.x)} ${num(p1.y)} L ${num(p2.x)} ${num(p2.y)} L ${num(p3.x)} ${num(p3.y)}" fill="none" stroke="#10213d" stroke-width="1.2"/>`;
  }
  const triangle = `<polygon points="${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}" fill="#10213d" fill-opacity="0.06" stroke="#10213d" stroke-width="1.5"/>`;
  const svg = `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img">${triangle}${rightAngleMarker}${vertexLabels}${sideLabels}${angleLabels}</svg>`;
  return `<figure class="course-figure course-figure-triangle">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderBoxPlot(
  block: Extract<StructuredCourseBlock, { type: "box_plot" }>,
): string {
  const axisMin = Math.min(block.min, block.q1, block.median, block.q3, block.max);
  const axisMax = Math.max(block.min, block.q1, block.median, block.q3, block.max);
  const padding = (axisMax - axisMin) * 0.1 || 1;
  const min = axisMin - padding;
  const max = axisMax + padding;
  const span = max - min || 1;
  const left = 20;
  const right = 210;
  const y = 40;
  const boxHalf = 16;
  const toX = (value: number) => left + ((value - min) / span) * (right - left);
  const whiskerLeft = `<line x1="${num(toX(block.min))}" y1="${y}" x2="${num(toX(block.q1))}" y2="${y}" stroke="#10213d" stroke-width="1.5"/><line x1="${num(toX(block.min))}" y1="${y - 8}" x2="${num(toX(block.min))}" y2="${y + 8}" stroke="#10213d" stroke-width="1.5"/>`;
  const whiskerRight = `<line x1="${num(toX(block.q3))}" y1="${y}" x2="${num(toX(block.max))}" y2="${y}" stroke="#10213d" stroke-width="1.5"/><line x1="${num(toX(block.max))}" y1="${y - 8}" x2="${num(toX(block.max))}" y2="${y + 8}" stroke="#10213d" stroke-width="1.5"/>`;
  const box = `<rect x="${num(toX(block.q1))}" y="${y - boxHalf}" width="${num(toX(block.q3) - toX(block.q1))}" height="${boxHalf * 2}" fill="#2563eb" fill-opacity="0.15" stroke="#10213d" stroke-width="1.5"/>`;
  const median = `<line x1="${num(toX(block.median))}" y1="${y - boxHalf}" x2="${num(toX(block.median))}" y2="${y + boxHalf}" stroke="#dc2626" stroke-width="2"/>`;
  const labels = [
    { value: block.min, key: "min" },
    { value: block.q1, key: "Q1" },
    { value: block.median, key: "Méd" },
    { value: block.q3, key: "Q3" },
    { value: block.max, key: "max" },
  ]
    .map(
      (entry) =>
        `<text x="${num(toX(entry.value))}" y="${y + boxHalf + 16}" font-size="9" text-anchor="middle" fill="#64748b">${entry.value}</text>`,
    )
    .join("");
  const axisLabel = block.axisLabel
    ? `<text x="${(left + right) / 2}" y="${y + boxHalf + 30}" font-size="10" text-anchor="middle" fill="#10213d">${escapeHtml(block.axisLabel)}</text>`
    : "";
  const svg = `<svg viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg" role="img">${whiskerLeft}${whiskerRight}${box}${median}${labels}${axisLabel}</svg>`;
  return `<figure class="course-figure course-figure-box-plot">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
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
      const markerId = `course-arrow-${simpleHash(block.caption)}`;
      const elements = block.elements
        .map((element) => {
          const color = FIGURE_PALETTE[element.tone];
          const label = figureLabel(
            element.label,
            element.labelX,
            element.labelY,
          );
          if (element.type === "line") {
            return `<line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" stroke="${color}" stroke-width="1.5"${element.dashed ? ' stroke-dasharray="5 4"' : ""}${element.arrowEnd ? ` marker-end="url(#${markerId})"` : ""}/>${label}`;
          }
          if (element.type === "point") {
            return `<circle cx="${element.x}" cy="${element.y}" r="3.5" fill="${color}"/>${label}`;
          }
          if (element.type === "circle") {
            return `<circle cx="${element.cx}" cy="${element.cy}" r="${element.r}" stroke="${color}" stroke-width="1.5" fill="${element.filled ? color : "none"}"${element.filled ? ' fill-opacity="0.18"' : ""}/>${label}`;
          }
          if (element.type === "polygon") {
            const points = element.points.map((point) => `${point.x},${point.y}`).join(" ");
            return `<polygon points="${points}" stroke="${color}" stroke-width="1.5" fill="${element.filled ? color : "none"}"${element.filled ? ' fill-opacity="0.16"' : ""}/>${label}`;
          }
          const start = polarPoint(
            element.cx,
            element.cy,
            element.r,
            element.startAngle,
          );
          const end = polarPoint(
            element.cx,
            element.cy,
            element.r,
            element.endAngle,
          );
          const delta = Math.abs(element.endAngle - element.startAngle) % 360;
          const largeArc = delta > 180 ? 1 : 0;
          const sweep = element.endAngle >= element.startAngle ? 1 : 0;
          return `<path d="M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${element.r} ${element.r} 0 ${largeArc} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}" stroke="${color}" stroke-width="1.5" fill="none"/>${label}`;
        })
        .join("");
      return `<figure class="course-figure"><svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img"><defs><marker id="${markerId}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L6,3 L0,6 Z" fill="#10213d"/></marker></defs>${elements}</svg><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
    }
    case "trig_circle":
      return renderTrigCircle(block);
    case "pie_chart":
      return renderPieChart(block);
    case "number_line":
      return renderNumberLine(block);
    case "bar_chart":
      return renderBarChart(block);
    case "probability_tree":
      return renderProbabilityTree(block);
    case "venn_diagram":
      return renderVennDiagram(block);
    case "triangle_diagram":
      return renderTriangleDiagram(block);
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

export function structuredExerciseQuestionSummary(
  question: StructuredExerciseQuestion,
): string {
  return structuredRichTextToPlainText(question.prompt);
}
