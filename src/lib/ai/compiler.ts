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
import { buildGraphSvg } from "@/lib/mathGraph";
import { evaluate as evaluateMathExpr } from "mathjs";

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

/** Fond quadrillé (cadre blanc arrondi + grille fine), même style visuel que
 * .math-graph (mathGraph.ts) pour que tous les diagrammes à base de plan
 * coordonné se ressemblent. */
function gridBackground(width: number, height: number, step: number): string {
  const frame = `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="6" fill="#ffffff" stroke="rgba(197,161,72,0.25)" stroke-width="1"/>`;
  const lines: string[] = [];
  for (let x = step; x < width; x += step) {
    lines.push(`<line x1="${x}" y1="1" x2="${x}" y2="${height - 1}" stroke="rgba(15,30,58,0.07)" stroke-width="1"/>`);
  }
  for (let y = step; y < height; y += step) {
    lines.push(`<line x1="1" y1="${y}" x2="${width - 1}" y2="${y}" stroke="rgba(15,30,58,0.07)" stroke-width="1"/>`);
  }
  return frame + lines.join("");
}

function renderTrigCircle(
  block: Extract<StructuredCourseBlock, { type: "trig_circle" }>,
): string {
  const cx = 100;
  const cy = 100;
  const r = 68;
  const angles = block.highlightedAngles.slice(0, 8);
  const grid = gridBackground(200, 200, 20);
  const axes = `<line x1="${cx - r - 18}" y1="${cy}" x2="${cx + r + 18}" y2="${cy}" stroke="rgba(15,30,58,0.55)" stroke-width="1.5"/><line x1="${cx}" y1="${cy - r - 18}" x2="${cx}" y2="${cy + r + 18}" stroke="rgba(15,30,58,0.55)" stroke-width="1.5"/>`;
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
  const svg = `<svg class="tc-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img">${grid}${axes}${circle}${markers}<g class="tc-live"></g></svg>`;
  const controls = `<div class="tc-controls"><input type="range" class="tc-angle-slider" min="0" max="360" step="1" value="45"/><span class="tc-angle-value">45°</span></div>`;
  return `<figure class="course-figure course-figure-trig-circle">${svg}${controls}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function formatCentimes(centimes: number): string {
  if (centimes % 100 === 0) return `${centimes / 100} €`;
  if (centimes >= 100) return `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
  return `${centimes} c`;
}

function renderCoinPurse(
  block: Extract<StructuredCourseBlock, { type: "coin_purse" }>,
): string {
  const coinWidth = 56;
  const items = block.coins
    .map((value, i) => {
      const isBill = value >= 500;
      const shape = isBill
        ? `<rect x="4" y="14" width="48" height="28" rx="4" fill="#eef3fb" stroke="#10213d" stroke-width="1.5"/>`
        : `<circle cx="28" cy="28" r="24" fill="#f6ecd2" stroke="#10213d" stroke-width="1.5"/>`;
      const label = `<text x="28" y="32" font-size="11" text-anchor="middle" fill="#10213d">${escapeHtml(formatCentimes(value))}</text>`;
      return `<g class="coin-item" data-value="${value}" role="button" tabindex="0"><svg viewBox="0 0 56 56" width="${coinWidth}" height="${coinWidth}">${shape}${label}</svg></g>`;
    })
    .join("");
  const purse = `<div class="coin-purse-zone"><div class="coin-purse-total" data-target="${block.target}">Total : <span class="coin-purse-total-value">0 c</span></div><button type="button" class="coin-purse-reset">Réinitialiser</button></div>`;
  return `<figure class="course-figure course-figure-coin-purse"><div class="coin-purse-row">${items}</div>${purse}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderBalanceScale(
  block: Extract<StructuredCourseBlock, { type: "balance_scale" }>,
): string {
  const leftSum = block.left.reduce((a, b) => a + b, 0);
  const rightSum = block.right.reduce((a, b) => a + b, 0);
  const diff = leftSum - rightSum;
  const maxTilt = 12;
  const tilt = Math.max(-maxTilt, Math.min(maxTilt, diff * 2));
  const cx = 100;
  const pivotY = 60;
  const beamHalf = 70;
  const rad = (tilt * Math.PI) / 180;
  const leftX = cx - beamHalf * Math.cos(rad);
  const leftY = pivotY - beamHalf * Math.sin(rad);
  const rightX = cx + beamHalf * Math.cos(rad);
  const rightY = pivotY + beamHalf * Math.sin(rad);
  const pan = (x: number, y: number, values: number[]) => {
    const items = values
      .map((v, i) => `<text x="${num(x)}" y="${num(y + 24 + i * 14)}" font-size="11" text-anchor="middle" fill="#10213d">${escapeHtml(String(v))}</text>`)
      .join("");
    return `<line x1="${num(x)}" y1="${num(y)}" x2="${num(x)}" y2="${num(y + 16)}" stroke="#10213d" stroke-width="1.5"/><rect x="${num(x - 26)}" y="${num(y + 16)}" width="52" height="10" rx="3" fill="#eef3fb" stroke="#10213d" stroke-width="1.5"/>${items}`;
  };
  const beam = `<line x1="${num(leftX)}" y1="${num(leftY)}" x2="${num(rightX)}" y2="${num(rightY)}" stroke="#10213d" stroke-width="3"/>`;
  const pivot = `<polygon points="${cx - 8},${pivotY + 40} ${cx + 8},${pivotY + 40} ${cx},${pivotY}" fill="#c5a148"/>`;
  const svg = `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img">${pivot}${beam}${pan(leftX, leftY, block.left)}${pan(rightX, rightY, block.right)}</svg>`;
  return `<figure class="course-figure course-figure-balance"><div class="balance-caption-row">${svg}</div><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function parseGraphMeta(svg: string) {
  const num = (attr: string) => {
    const m = svg.match(new RegExp(`data-${attr}="([^"]+)"`));
    return m ? parseFloat(m[1]) : 0;
  };
  const xmin = num("xmin");
  const xmax = num("xmax");
  const ymin = num("ymin");
  const ymax = num("ymax");
  const padl = num("padl");
  const padt = num("padt");
  const plotw = num("plotw");
  const ploth = num("ploth");
  const sx = (x: number) => padl + ((x - xmin) / (xmax - xmin)) * plotw;
  const sy = (y: number) => padt + ploth - ((y - ymin) / (ymax - ymin)) * ploth;
  return { xmin, xmax, ymin, ymax, sx, sy };
}

function injectIntoSvg(svg: string, extra: string): string {
  return svg.replace(/<\/svg>$/, `${extra}</svg>`);
}

function safeEval(expr: string, scope: Record<string, number>): number | null {
  try {
    const v = evaluateMathExpr(expr, scope);
    return typeof v === "number" && isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function renderGridPainter(
  block: Extract<StructuredCourseBlock, { type: "grid_painter" }>,
): string {
  const cell = 28;
  const cells: string[] = [];
  for (let r = 0; r < block.rows; r++) {
    for (let c = 0; c < block.cols; c++) {
      const index = r * block.cols + c;
      const filled = index < block.highlighted;
      cells.push(
        `<rect class="grid-cell${filled ? " grid-cell-filled" : ""}" data-index="${index}" x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="${filled ? "#2563eb" : "#fff"}" fill-opacity="${filled ? 0.8 : 1}" stroke="#10213d" stroke-width="1"/>`,
      );
    }
  }
  const svg = `<svg class="grid-painter-svg" viewBox="0 0 ${block.cols * cell} ${block.rows * cell}" xmlns="http://www.w3.org/2000/svg" role="img" data-rows="${block.rows}" data-cols="${block.cols}">${cells.join("")}</svg>`;
  return `<figure class="course-figure course-figure-grid-painter">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

const SHAPE_ICONS: Record<string, string> = {
  cercle: "circle", rond: "circle", carre: "square", carré: "square",
  triangle: "triangle", etoile: "star", étoile: "star",
};

function shapeSvg(name: string): string {
  const key = SHAPE_ICONS[name.toLowerCase()] ?? "circle";
  if (key === "square") return `<rect x="6" y="6" width="28" height="28" fill="#2563eb"/>`;
  if (key === "triangle") return `<polygon points="20,6 34,34 6,34" fill="#15803d"/>`;
  if (key === "star") return `<polygon points="20,4 24,16 37,16 26,24 30,36 20,28 10,36 14,24 3,16 16,16" fill="#c89f36"/>`;
  return `<circle cx="20" cy="20" r="15" fill="#dc2626"/>`;
}

function renderPatternMaker(
  block: Extract<StructuredCourseBlock, { type: "pattern_maker" }>,
): string {
  const seq = block.sequence
    .map((s) => `<div class="pattern-item"><svg viewBox="0 0 40 40" width="40" height="40">${shapeSvg(s)}</svg></div>`)
    .join("");
  const blank = `<div class="pattern-item pattern-blank">?</div>`;
  const options = block.options
    .map((o) => `<button type="button" class="pattern-option" data-answer="${escapeAttribute(o)}"><svg viewBox="0 0 40 40" width="36" height="36">${shapeSvg(o)}</svg></button>`)
    .join("");
  return `<figure class="course-figure course-figure-pattern-maker" data-correct="${escapeAttribute(block.answer)}"><div class="pattern-row">${seq}${blank}</div><div class="pattern-options">${options}</div><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderRulerMeasurer(
  block: Extract<StructuredCourseBlock, { type: "ruler_measurer" }>,
): string {
  const scale = 18;
  const width = block.segmentLength * scale + 40;
  const ticks: string[] = [];
  for (let i = 0; i <= block.segmentLength; i++) {
    const x = 20 + i * scale;
    const tall = i % 5 === 0;
    ticks.push(`<line x1="${x}" y1="30" x2="${x}" y2="${tall ? 12 : 20}" stroke="#10213d" stroke-width="1"/>`);
    if (tall) ticks.push(`<text x="${x}" y="46" font-size="10" text-anchor="middle" fill="#10213d">${i}</text>`);
  }
  const svg = `<svg viewBox="0 0 ${width} 55" xmlns="http://www.w3.org/2000/svg" role="img"><rect x="20" y="24" width="${block.segmentLength * scale}" height="6" fill="#eef3fb" stroke="#10213d" stroke-width="1"/>${ticks.join("")}<line x1="20" y1="10" x2="${20 + block.segmentLength * scale}" y2="10" stroke="#2563eb" stroke-width="2"/></svg>`;
  return `<figure class="course-figure course-figure-ruler"><div class="ruler-scroll">${svg}</div><figcaption>${escapeHtml(block.caption)} (${block.segmentLength} ${escapeHtml(block.unit)})</figcaption></figure>`;
}

function renderTapeDiagram(
  block: Extract<StructuredCourseBlock, { type: "tape_diagram" }>,
): string {
  const total = block.parts.reduce((a, p) => a + p.value, 0) || 1;
  const width = 260;
  let x = 0;
  const segments = block.parts
    .map((p) => {
      const w = (p.value / total) * width;
      const seg = `<rect x="${num(x)}" y="0" width="${num(w)}" height="36" fill="${FIGURE_PALETTE[p.tone]}" fill-opacity="0.75" stroke="#fff" stroke-width="1.5"/><text x="${num(x + w / 2)}" y="22" font-size="10" text-anchor="middle" fill="#fff">${escapeHtml(p.label)}</text>`;
      x += w;
      return seg;
    })
    .join("");
  const svg = `<svg viewBox="0 0 ${width} 36" xmlns="http://www.w3.org/2000/svg" role="img">${segments}</svg>`;
  return `<figure class="course-figure course-figure-tape-diagram">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderFractionStrips(
  block: Extract<StructuredCourseBlock, { type: "fraction_strips" }>,
): string {
  const width = 240;
  const rowHeight = 32;
  const rows = block.fractions
    .map((f, i) => {
      const cellW = width / f.denominator;
      const cells = Array.from({ length: f.denominator }, (_, c) =>
        `<rect x="${num(c * cellW)}" y="0" width="${num(cellW)}" height="24" fill="${c < f.numerator ? "#2563eb" : "#fff"}" fill-opacity="${c < f.numerator ? 0.8 : 1}" stroke="#10213d" stroke-width="1"/>`,
      ).join("");
      return `<g transform="translate(0,${i * rowHeight})">${cells}<text x="${width + 8}" y="17" font-size="11" fill="#10213d">${f.numerator}/${f.denominator}</text></g>`;
    })
    .join("");
  const svg = `<svg viewBox="0 0 ${width + 40} ${block.fractions.length * rowHeight}" xmlns="http://www.w3.org/2000/svg" role="img">${rows}</svg>`;
  return `<figure class="course-figure course-figure-fraction-strips">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderPlaceValueChart(
  block: Extract<StructuredCourseBlock, { type: "place_value_chart" }>,
): string {
  const [intPart, decPart = ""] = Math.abs(block.number).toString().split(".");
  const intDigits = intPart.split("");
  const decDigits = decPart.split("");
  const intLabels = ["unités", "dizaines", "centaines", "milliers"];
  const decLabels = ["dixièmes", "centièmes", "millièmes"];
  const intCells = intDigits
    .slice()
    .reverse()
    .map((d, i) => `<th>${intLabels[i] ?? `10^${i}`}</th>`)
    .reverse();
  const decCells = decDigits.map((_, i) => `<th>${decLabels[i] ?? `10^-${i + 1}`}</th>`);
  const intValues = intDigits.map((d) => `<td>${escapeHtml(d)}</td>`);
  const decValues = decDigits.map((d) => `<td>${escapeHtml(d)}</td>`);
  const sep = decDigits.length ? `<th>,</th>` : "";
  const sepVal = decDigits.length ? `<td>,</td>` : "";
  return `<figure class="course-figure course-figure-place-value"><table class="math-table"><thead><tr>${intCells.join("")}${sep}${decCells.join("")}</tr></thead><tbody><tr>${intValues.join("")}${sepVal}${decValues.join("")}</tr></tbody></table><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderRatioMixer(
  block: Extract<StructuredCourseBlock, { type: "ratio_mixer" }>,
): string {
  const max = Math.max(...block.ratios.map((r) => r.value), 1);
  const gauges = block.ratios
    .map((r) => {
      const h = (r.value / max) * 100;
      return `<div class="ratio-gauge"><div class="ratio-gauge-track"><div class="ratio-gauge-fill" style="height:${h}%;background:${FIGURE_PALETTE[r.tone]}"></div></div><span class="ratio-gauge-label">${escapeHtml(r.label)}</span><span class="ratio-gauge-value">${r.value}</span></div>`;
    })
    .join("");
  return `<figure class="course-figure course-figure-ratio-mixer"><div class="ratio-mixer-row">${gauges}</div><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderNetFolder(
  block: Extract<StructuredCourseBlock, { type: "net_folder" }>,
): string {
  const w0 = block.solid === "cube" ? Math.max(block.width, block.height, block.depth) : block.width;
  const h0 = block.solid === "cube" ? w0 : block.height;
  const d0 = block.solid === "cube" ? w0 : block.depth;
  // Echelle en pixels, plafonnee pour rester compact quelles que soient les dimensions saisies.
  const maxDim = Math.max(w0, h0, d0);
  const px = Math.min(28, 90 / maxDim);
  const W = w0 * px, H = h0 * px, D = d0 * px;
  const face = (cls: string, x: number, y: number, fw: number, fh: number, label: string) =>
    `<div class="nf-face ${cls}" style="left:${num(x)}px;top:${num(y)}px;width:${num(fw)}px;height:${num(fh)}px;">${escapeHtml(label)}</div>`;
  // Coordonnees decalees de (D, D) pour que rien ne soit negatif : le
  // conteneur .nf-cube reçoit une largeur/hauteur explicites correspondant
  // au patron en croix a plat, sinon (position absolue partout, aucune
  // dimension propre) il s'effondrerait a 0x0 et les faces deborderaient
  // sur les elements suivants (bouton de pliage, légende).
  const inner =
    face("nf-front", D, D, W, H, "avant") +
    face("nf-top", D, 0, W, D, "dessus") +
    face("nf-bottom", D, D + H, W, D, "dessous") +
    face("nf-left", 0, D, D, H, "gauche") +
    `<div class="nf-face nf-right" style="left:${num(D + W)}px;top:${num(D)}px;width:${num(D)}px;height:${num(H)}px;">droite${face("nf-back", D, 0, W, H, "arrière")}</div>`;
  const cubeWidth = 2 * D + 2 * W;
  const cubeHeight = H + 2 * D;
  const scene = `<div class="net-folder-3d-scene"><div class="nf-cube" style="--fold:0;width:${num(cubeWidth)}px;height:${num(cubeHeight)}px;">${inner}</div></div>`;
  const solidLabel = block.solid === "cube" ? `cube, arête ${w0}` : `pavé ${block.width}×${block.height}×${block.depth}`;
  const controls = `<div class="net-folder-controls"><label>Plié <input type="range" class="net-folder-slider" min="0" max="1" step="0.01" value="0"/> Déplié</label></div>`;
  return `<figure class="course-figure course-figure-net-folder">${scene}${controls}<figcaption>${escapeHtml(block.caption)} (${escapeHtml(solidLabel)})</figcaption></figure>`;
}

function renderInteractiveProtractor(
  block: Extract<StructuredCourseBlock, { type: "interactive_protractor" }>,
): string {
  const cx = 100, cy = 100, r = 80;
  const ticks: string[] = [];
  for (let a = 0; a <= 180; a += 10) {
    const outer = trigPoint(cx, cy, r, a);
    const inner = trigPoint(cx, cy, r - (a % 30 === 0 ? 10 : 5), a);
    ticks.push(`<line x1="${num(inner.x)}" y1="${num(inner.y)}" x2="${num(outer.x)}" y2="${num(outer.y)}" stroke="#10213d" stroke-width="1"/>`);
  }
  const arm = trigPoint(cx, cy, r - 15, block.angleDeg);
  const base = `<path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#10213d" stroke-width="1.5"/><line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="#10213d" stroke-width="1.5"/>`;
  const armLine = `<line class="protractor-arm" x1="${cx}" y1="${cy}" x2="${num(arm.x)}" y2="${num(arm.y)}" stroke="#2563eb" stroke-width="2.5"/>`;
  const svg = `<svg class="protractor-svg" viewBox="0 0 200 110" xmlns="http://www.w3.org/2000/svg" role="img">${ticks.join("")}${base}${armLine}</svg>`;
  const controls = `<div class="protractor-controls"><input type="range" class="protractor-slider" min="0" max="180" step="1" value="${block.angleDeg}"/><span class="protractor-value">${block.angleDeg}°</span></div>`;
  return `<figure class="course-figure course-figure-protractor">${svg}${controls}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderCompassTool(
  block: Extract<StructuredCourseBlock, { type: "compass_tool" }>,
): string {
  const cx = 90, cy = 90, r = Math.min(70, block.radius * 12);
  const svg = `<svg class="compass-svg" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" role="img" data-scale="${(r / block.radius).toFixed(3)}" data-max-r="70"><circle class="compass-circle" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2563eb" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="2.5" fill="#10213d"/><text x="${cx + 4}" y="${cy - 6}" font-size="11" fill="#10213d">${escapeHtml(block.centerLabel)}</text><line class="compass-radius-line" x1="${cx}" y1="${cy}" x2="${num(cx + r)}" y2="${cy}" stroke="#c89f36" stroke-width="1.5" stroke-dasharray="4 3"/><circle class="compass-handle" cx="${num(cx + r)}" cy="${cy}" r="6" fill="#c89f36" role="button" tabindex="0"/><text class="compass-radius-label" x="${num(cx + r / 2)}" y="${cy - 6}" font-size="10" text-anchor="middle" fill="#c89f36">${block.radius}</text></svg>`;
  return `<figure class="course-figure course-figure-compass">${svg}<figcaption>${escapeHtml(block.caption)} — fais glisser le point doré pour changer le rayon</figcaption></figure>`;
}

function renderThermometerAxis(
  block: Extract<StructuredCourseBlock, { type: "thermometer_axis" }>,
): string {
  const height = 220;
  const clamp = (v: number) => Math.max(block.min, Math.min(block.max, v));
  const yFor = (v: number) => 20 + (1 - (clamp(v) - block.min) / (block.max - block.min)) * height;
  const ticks: string[] = [];
  const step = Math.max(1, Math.round((block.max - block.min) / 8));
  for (let v = block.min; v <= block.max; v += step) {
    const y = yFor(v);
    ticks.push(`<line x1="30" y1="${num(y)}" x2="38" y2="${num(y)}" stroke="#10213d" stroke-width="1"/><text x="24" y="${num(y + 3)}" font-size="9" text-anchor="end" fill="#10213d">${v}</text>`);
  }
  const points = block.points
    .map((p) => {
      const y = yFor(p.value);
      return `<circle cx="38" cy="${num(y)}" r="4" fill="#2563eb"/><text x="46" y="${num(y + 3)}" font-size="10" fill="#10213d">${escapeHtml(p.label)} (${p.value})</text>`;
    })
    .join("");
  const zeroY = block.min <= 0 && block.max >= 0 ? yFor(0) : null;
  const zeroLine = zeroY !== null ? `<line x1="30" y1="${num(zeroY)}" x2="120" y2="${num(zeroY)}" stroke="#dc2626" stroke-width="1" stroke-dasharray="3 2"/>` : "";
  const svg = `<svg viewBox="0 0 160 ${height + 40}" xmlns="http://www.w3.org/2000/svg" role="img"><line x1="34" y1="20" x2="34" y2="${height + 20}" stroke="#10213d" stroke-width="2"/>${ticks.join("")}${zeroLine}${points}</svg>`;
  return `<figure class="course-figure course-figure-thermometer">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderAreaDecomposer(
  block: Extract<StructuredCourseBlock, { type: "area_decomposer" }>,
): string {
  const scale = 14;
  let x = 0;
  const total = block.shapes.reduce((a, s) => a + s.width * s.height, 0);
  const shapes = block.shapes
    .map((s) => {
      const w = s.width * scale, h = s.height * scale;
      const rect = `<rect x="${num(x)}" y="0" width="${num(w)}" height="${num(h)}" fill="#eef3fb" stroke="#2563eb" stroke-width="1.5"/><text x="${num(x + w / 2)}" y="${num(h / 2)}" font-size="10" text-anchor="middle" fill="#10213d">${escapeHtml(s.label)}</text><text x="${num(x + w / 2)}" y="${num(h + 14)}" font-size="9" text-anchor="middle" fill="#64748b">${s.width}×${s.height}</text>`;
      x += w + 10;
      return rect;
    })
    .join("");
  const maxH = Math.max(...block.shapes.map((s) => s.height)) * scale;
  const svg = `<svg viewBox="0 0 ${num(x)} ${num(maxH + 24)}" xmlns="http://www.w3.org/2000/svg" role="img">${shapes}</svg>`;
  return `<figure class="course-figure course-figure-area-decomposer">${svg}<figcaption>${escapeHtml(block.caption)} (aire totale : ${total})</figcaption></figure>`;
}

function renderPythagorasVisualizer(
  block: Extract<StructuredCourseBlock, { type: "pythagoras_visualizer" }>,
): string {
  const { a, b } = block;
  const scale = 18;
  const A = a * scale, B = b * scale;
  const p1 = { x: 60, y: 60 + A };
  const p2 = { x: 60, y: 60 };
  const p3 = { x: 60 + B, y: 60 + A };
  const triangle = `<polygon points="${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}" fill="#eef3fb" stroke="#10213d" stroke-width="1.5"/>`;
  const squareA = `<rect x="${p1.x - A}" y="${p1.y}" width="${A}" height="${A}" fill="#2563eb" fill-opacity="0.35" stroke="#2563eb"/><text x="${p1.x - A / 2}" y="${p1.y + A / 2}" font-size="11" text-anchor="middle" fill="#10213d">a²</text>`;
  const squareB = `<rect x="${p2.x}" y="${p2.y - B}" width="${B}" height="${B}" fill="#15803d" fill-opacity="0.35" stroke="#15803d"/><text x="${p2.x + B / 2}" y="${p2.y - B / 2}" font-size="11" text-anchor="middle" fill="#10213d">b²</text>`;
  const hyp = Math.hypot(B, A);
  const nx = A / hyp, ny = -B / hyp;
  const hx1 = p2.x + nx * hyp, hy1 = p2.y + ny * hyp * 0;
  const squareC = `<polygon points="${p2.x},${p2.y} ${p3.x},${p3.y} ${p3.x + A * (B / hyp) * 0 + nx * hyp},${p3.y + ny * hyp} ${p2.x + nx * hyp},${p2.y + ny * hyp}" fill="#dc2626" fill-opacity="0.3" stroke="#dc2626"/>`;
  const svg = `<svg viewBox="0 0 ${num(60 + B + A + 20)} ${num(60 + A + B + 20)}" xmlns="http://www.w3.org/2000/svg" role="img">${squareA}${squareB}${squareC}${triangle}</svg>`;
  return `<figure class="course-figure course-figure-pythagoras">${svg}<figcaption>${escapeHtml(block.caption)} ($a=${a}$, $b=${b}$, $c=${block.c.toFixed(2)}$)</figcaption></figure>`;
}

function renderScientificNotationConverter(
  block: Extract<StructuredCourseBlock, { type: "scientific_notation_converter" }>,
): string {
  const notation = `${block.value} \\times 10^{${block.exponent}}`;
  const width = 260;
  const minExp = -6, maxExp = 6;
  const clampedExp = Math.max(minExp, Math.min(maxExp, block.exponent));
  const x = 20 + ((clampedExp - minExp) / (maxExp - minExp)) * (width - 40);
  const ticks: string[] = [];
  for (let e = minExp; e <= maxExp; e += 2) {
    const tx = 20 + ((e - minExp) / (maxExp - minExp)) * (width - 40);
    ticks.push(`<line x1="${num(tx)}" y1="30" x2="${num(tx)}" y2="38" stroke="#10213d" stroke-width="1"/><text x="${num(tx)}" y="50" font-size="9" text-anchor="middle" fill="#10213d">10^${e}</text>`);
  }
  const svg = `<svg class="sci-notation-svg" viewBox="0 0 ${width} 55" xmlns="http://www.w3.org/2000/svg" role="img" data-min-exp="${minExp}" data-max-exp="${maxExp}" data-width="${width}"><line x1="20" y1="34" x2="${width - 20}" y2="34" stroke="#10213d" stroke-width="1.5"/>${ticks.join("")}<circle class="sci-notation-handle" cx="${num(x)}" cy="34" r="7" fill="#dc2626" role="button" tabindex="0"/></svg>`;
  const controls = `<div class="sci-notation-controls">Valeur : <span class="sci-notation-value">${block.value} × 10<sup class="sci-notation-exp">${block.exponent}</sup></span></div>`;
  return `<figure class="course-figure course-figure-sci-notation" data-value="${block.value}">${svg}${controls}<figcaption>${escapeHtml(block.caption)} — fais glisser le point pour changer la puissance de 10</figcaption></figure>`;
}

function renderEquationBalancer(
  block: Extract<StructuredCourseBlock, { type: "equation_balancer" }>,
): string {
  const cx = 100, pivotY = 60, beamHalf = 70;
  const pan = (x: number, terms: string[]) => {
    const items = terms
      .map((t, i) => `<text x="${num(x)}" y="${num(pivotY + 26 + i * 14)}" font-size="11" text-anchor="middle" fill="#10213d">${escapeHtml(t)}</text>`)
      .join("");
    return `<line x1="${num(x)}" y1="${pivotY}" x2="${num(x)}" y2="${pivotY + 16}" stroke="#10213d" stroke-width="1.5"/><rect x="${num(x - 30)}" y="${pivotY + 16}" width="60" height="10" rx="3" fill="#eef3fb" stroke="#10213d" stroke-width="1.5"/>${items}`;
  };
  const beam = `<line x1="${cx - beamHalf}" y1="${pivotY}" x2="${cx + beamHalf}" y2="${pivotY}" stroke="#10213d" stroke-width="3"/>`;
  const pivot = `<polygon points="${cx - 8},${pivotY + 40} ${cx + 8},${pivotY + 40} ${cx},${pivotY}" fill="#c5a148"/>`;
  const svg = `<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg" role="img">${pivot}${beam}${pan(cx - beamHalf, block.leftTerms)}${pan(cx + beamHalf, block.rightTerms)}</svg>`;
  return `<figure class="course-figure course-figure-equation-balancer">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderSlopeTriangle(
  block: Extract<StructuredCourseBlock, { type: "slope_triangle" }>,
): string {
  const { svg, error } = buildGraphSvg(`${block.a}*x+${block.b}`, block.xMin, block.xMax);
  if (error) return `<p class="course-figure-error">${escapeHtml(error)}</p>`;
  const meta = parseGraphMeta(svg);
  const x1 = (meta.xmin + meta.xmax) / 2 - 1;
  const x2 = x1 + 2;
  const y1 = block.a * x1 + block.b;
  const y2 = block.a * x2 + block.b;
  const overlay = `<line x1="${num(meta.sx(x1))}" y1="${num(meta.sy(y1))}" x2="${num(meta.sx(x2))}" y2="${num(meta.sy(y1))}" stroke="#c89f36" stroke-width="1.5" stroke-dasharray="4 3"/><line x1="${num(meta.sx(x2))}" y1="${num(meta.sy(y1))}" x2="${num(meta.sx(x2))}" y2="${num(meta.sy(y2))}" stroke="#c89f36" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${num((meta.sx(x1) + meta.sx(x2)) / 2)}" y="${num(meta.sy(y1) + 14)}" font-size="10" fill="#c89f36">1</text><text x="${num(meta.sx(x2) + 6)}" y="${num((meta.sy(y1) + meta.sy(y2)) / 2)}" font-size="10" fill="#c89f36">${block.a}</text>`;
  return `<figure class="course-figure course-figure-graph">${injectIntoSvg(svg, overlay)}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderVectorAdditionPad(
  block: Extract<StructuredCourseBlock, { type: "vector_addition_pad" }>,
): string {
  const range = Math.max(Math.abs(block.ux) + Math.abs(block.vx), Math.abs(block.uy) + Math.abs(block.vy), 3) + 1;
  const { svg, error } = buildGraphSvg("0*x", -range, range, 10, {}, [
    { x: block.ux, y: block.uy, fromX: 0, fromY: 0, label: "u", tone: "blue" } as never,
    { x: block.vx, y: block.vy, fromX: block.ux, fromY: block.uy, label: "v", tone: "green" } as never,
    { x: block.ux + block.vx, y: block.uy + block.vy, fromX: 0, fromY: 0, label: "u+v", tone: "red" } as never,
  ]);
  if (error) return `<p class="course-figure-error">${escapeHtml(error)}</p>`;
  return `<figure class="course-figure course-figure-graph">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderIntervalBuilder(
  block: Extract<StructuredCourseBlock, { type: "interval_builder" }>,
): string {
  const width = 260;
  const sx = (v: number) => 20 + ((v - block.min) / (block.max - block.min)) * (width - 40);
  const x1 = sx(block.lowerBound), x2 = sx(block.upperBound);
  const line = `<line x1="20" y1="30" x2="${width - 20}" y2="30" stroke="#10213d" stroke-width="1.5"/>`;
  const highlight = `<line x1="${num(x1)}" y1="30" x2="${num(x2)}" y2="30" stroke="#2563eb" stroke-width="4"/>`;
  const endpoint = (x: number, open: boolean) =>
    `<circle cx="${num(x)}" cy="30" r="5" fill="${open ? "#fff" : "#2563eb"}" stroke="#2563eb" stroke-width="2"/>`;
  const labels = `<text x="${num(x1)}" y="20" font-size="10" text-anchor="middle" fill="#10213d">${block.lowerBound}</text><text x="${num(x2)}" y="20" font-size="10" text-anchor="middle" fill="#10213d">${block.upperBound}</text>`;
  const svg = `<svg viewBox="0 0 ${width} 40" xmlns="http://www.w3.org/2000/svg" role="img">${line}${highlight}${endpoint(x1, block.lowerOpen)}${endpoint(x2, block.upperOpen)}${labels}</svg>`;
  return `<figure class="course-figure course-figure-interval">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderTangentScrubber(
  block: Extract<StructuredCourseBlock, { type: "tangent_scrubber" }>,
): string {
  const { svg, error } = buildGraphSvg(block.expression, block.xMin, block.xMax);
  if (error) return `<p class="course-figure-error">${escapeHtml(error)}</p>`;
  const y0 = safeEval(block.expression, { x: block.x0 });
  if (y0 === null) return `<figure class="course-figure course-figure-graph">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
  const h = (block.xMax - block.xMin) / 1000;
  const y0p = safeEval(block.expression, { x: block.x0 + h });
  const slope = y0p !== null ? (y0p - y0) / h : 0;
  const meta = parseGraphMeta(svg);
  const dx = (block.xMax - block.xMin) * 0.15;
  const tx1 = block.x0 - dx, tx2 = block.x0 + dx;
  const ty1 = y0 - slope * dx, ty2 = y0 + slope * dx;
  const overlay = `<line x1="${num(meta.sx(tx1))}" y1="${num(meta.sy(ty1))}" x2="${num(meta.sx(tx2))}" y2="${num(meta.sy(ty2))}" stroke="#dc2626" stroke-width="2"/><circle cx="${num(meta.sx(block.x0))}" cy="${num(meta.sy(y0))}" r="4" fill="#dc2626"/>`;
  return `<figure class="course-figure course-figure-graph">${injectIntoSvg(svg, overlay)}<figcaption>${escapeHtml(block.caption)} ($f'(${block.x0}) \\approx ${slope.toFixed(2)}$)</figcaption></figure>`;
}

function renderSequenceCobweb(
  block: Extract<StructuredCourseBlock, { type: "sequence_cobweb" }>,
): string {
  const { svg, error } = buildGraphSvg(block.expression, block.xMin, block.xMax);
  if (error) return `<p class="course-figure-error">${escapeHtml(error)}</p>`;
  const meta = parseGraphMeta(svg);
  const diag = `<line x1="${num(meta.sx(meta.xmin))}" y1="${num(meta.sy(meta.xmin))}" x2="${num(meta.sx(meta.xmax))}" y2="${num(meta.sy(meta.xmax))}" stroke="#64748b" stroke-width="1" stroke-dasharray="4 3"/>`;
  let u = block.u0;
  const segs: string[] = [];
  for (let i = 0; i < block.iterations; i++) {
    const fu = safeEval(block.expression, { x: u });
    if (fu === null) break;
    segs.push(`<line x1="${num(meta.sx(u))}" y1="${num(meta.sy(u))}" x2="${num(meta.sx(u))}" y2="${num(meta.sy(fu))}" stroke="#c89f36" stroke-width="1.5"/>`);
    segs.push(`<line x1="${num(meta.sx(u))}" y1="${num(meta.sy(fu))}" x2="${num(meta.sx(fu))}" y2="${num(meta.sy(fu))}" stroke="#c89f36" stroke-width="1.5"/>`);
    u = fu;
  }
  return `<figure class="course-figure course-figure-graph">${injectIntoSvg(svg, diag + segs.join(""))}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderIntegralRiemannSlider(
  block: Extract<StructuredCourseBlock, { type: "integral_riemann_slider" }>,
): string {
  const { svg, error } = buildGraphSvg(block.expression, block.xMin, block.xMax);
  if (error) return `<p class="course-figure-error">${escapeHtml(error)}</p>`;
  const meta = parseGraphMeta(svg);
  const dx = (block.xMax - block.xMin) / block.rectangles;
  const rects: string[] = [];
  for (let i = 0; i < block.rectangles; i++) {
    const x = block.xMin + i * dx;
    const y = safeEval(block.expression, { x: x + dx / 2 });
    if (y === null) continue;
    const rectX = meta.sx(x), rectX2 = meta.sx(x + dx);
    const rectY = meta.sy(Math.max(0, y)), baseY = meta.sy(0);
    rects.push(`<rect x="${num(Math.min(rectX, rectX2))}" y="${num(Math.min(rectY, baseY))}" width="${num(Math.abs(rectX2 - rectX))}" height="${num(Math.abs(baseY - rectY))}" fill="#2563eb" fill-opacity="0.35" stroke="#2563eb" stroke-width="1"/>`);
  }
  return `<figure class="course-figure course-figure-graph">${injectIntoSvg(svg, rects.join(""))}<figcaption>${escapeHtml(block.caption)} (${block.rectangles} rectangles)</figcaption></figure>`;
}

function renderComplexPlanePolar(
  block: Extract<StructuredCourseBlock, { type: "complex_plane_polar" }>,
): string {
  const modulus = Math.hypot(block.re, block.im);
  const angle = (Math.atan2(block.im, block.re) * 180) / Math.PI;
  const range = Math.max(Math.abs(block.re), Math.abs(block.im), 2) + 1;
  const { svg, error } = buildGraphSvg("0*x", -range, range, 10, {}, [
    { x: block.re, y: block.im, fromX: 0, fromY: 0, label: "z", tone: "blue" } as never,
  ]);
  if (error) return `<p class="course-figure-error">${escapeHtml(error)}</p>`;
  const algebraic = `${block.re}${block.im >= 0 ? " + " : " − "}${Math.abs(block.im)}i`;
  const polar = `${modulus.toFixed(2)} × (cos ${angle.toFixed(1)}° + i·sin ${angle.toFixed(1)}°)`;
  const toggle = `<div class="complex-toggle" data-algebraic="${escapeAttribute(algebraic)}" data-polar="${escapeAttribute(polar)}"><button type="button" class="complex-toggle-btn">Basculer forme algébrique / exponentielle</button><span class="complex-toggle-value">${escapeHtml(algebraic)}</span></div>`;
  return `<figure class="course-figure course-figure-graph">${svg}${toggle}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderAlgoSandbox(
  block: Extract<StructuredCourseBlock, { type: "algo_sandbox" }>,
): string {
  const isPython = block.language.toLowerCase() === "python";
  const runButton = isPython
    ? `<button type="button" class="algo-sandbox-run">▶ Exécuter</button>`
    : `<span class="algo-sandbox-readonly">(${escapeHtml(block.language)}, lecture seule)</span>`;
  return `<figure class="course-figure course-figure-algo-sandbox"><textarea class="algo-sandbox-code" spellcheck="false" ${isPython ? "" : "readonly"}>${escapeHtml(block.code)}</textarea><div class="algo-sandbox-toolbar">${runButton}</div><pre class="algo-sandbox-output" hidden></pre><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderClock(
  block: Extract<StructuredCourseBlock, { type: "clock" }>,
): string {
  const cx = 100;
  const cy = 100;
  const r = 82;
  const ticks: string[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = i * 30;
    const outer = trigPoint(cx, cy, r, 90 - angle);
    const inner = trigPoint(cx, cy, r - (i % 3 === 0 ? 12 : 6), 90 - angle);
    const label = trigPoint(cx, cy, r - 20, 90 - angle);
    ticks.push(
      `<line x1="${num(inner.x)}" y1="${num(inner.y)}" x2="${num(outer.x)}" y2="${num(outer.y)}" stroke="#10213d" stroke-width="${i % 3 === 0 ? 2 : 1}"/>`,
    );
    const hourNumber = i === 0 ? 12 : i;
    ticks.push(
      `<text x="${num(label.x)}" y="${num(label.y)}" dy="4" font-size="${i % 3 === 0 ? 12 : 10}" text-anchor="middle" fill="#10213d">${hourNumber}</text>`,
    );
  }
  const hourAngle = ((block.hours % 12) + block.minutes / 60) * 30;
  const minuteAngle = block.minutes * 6;
  const hourHand = trigPoint(cx, cy, r * 0.5, 90 - hourAngle);
  const minuteHand = trigPoint(cx, cy, r * 0.78, 90 - minuteAngle);
  const face = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="#10213d" stroke-width="1.5"/>`;
  const hands = `<line class="clock-hour-hand" x1="${cx}" y1="${cy}" x2="${num(hourHand.x)}" y2="${num(hourHand.y)}" stroke="#10213d" stroke-width="4" stroke-linecap="round"/><line class="clock-minute-hand" x1="${cx}" y1="${cy}" x2="${num(minuteHand.x)}" y2="${num(minuteHand.y)}" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4" fill="#10213d"/>`;
  const svg = `<svg class="clock-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" data-hours="${block.hours}" data-minutes="${block.minutes}">${face}${ticks.join("")}<g class="clock-hands">${hands}</g></svg>`;
  const controls = block.interactive
    ? `<div class="clock-controls"><button type="button" class="clock-drag-hint">Fais glisser les aiguilles</button><span class="clock-reading"></span></div>`
    : "";
  const className = block.interactive
    ? "course-figure course-figure-clock course-figure-clock-interactive"
    : "course-figure course-figure-clock";
  return `<figure class="${className}">${svg}${controls}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderFraction(
  block: Extract<StructuredCourseBlock, { type: "fraction" }>,
): string {
  const { numerator, denominator } = block;
  let svg: string;
  if (block.shape === "circle") {
    const cx = 80;
    const cy = 80;
    const r = 62;
    let startAngle = -90;
    const step = 360 / denominator;
    const slices: string[] = [];
    for (let i = 0; i < denominator; i++) {
      const endAngle = startAngle + step;
      const start = trigPoint(cx, cy, r, -startAngle);
      const end = trigPoint(cx, cy, r, -endAngle);
      const largeArc = step > 180 ? 1 : 0;
      const filled = i < numerator;
      const color = filled ? "#2563eb" : "#fff";
      slices.push(
        `<path d="M ${num(cx)} ${num(cy)} L ${num(start.x)} ${num(start.y)} A ${r} ${r} 0 ${largeArc} 1 ${num(end.x)} ${num(end.y)} Z" fill="${color}" fill-opacity="${filled ? 0.85 : 1}" stroke="#10213d" stroke-width="1.5"/>`,
      );
      startAngle = endAngle;
    }
    svg = `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" role="img">${slices.join("")}</svg>`;
  } else {
    const width = 240;
    const height = 60;
    const cellWidth = width / denominator;
    const cells: string[] = [];
    for (let i = 0; i < denominator; i++) {
      const filled = i < numerator;
      cells.push(
        `<rect x="${num(i * cellWidth)}" y="0" width="${num(cellWidth)}" height="${height}" fill="${filled ? "#2563eb" : "#fff"}" fill-opacity="${filled ? 0.85 : 1}" stroke="#10213d" stroke-width="1.5"/>`,
      );
    }
    svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">${cells.join("")}</svg>`;
  }
  const label = `<div class="fraction-label">${numerator} / ${denominator}</div>`;
  return `<figure class="course-figure course-figure-fraction">${svg}${label}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
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
  const grid = gridBackground(220, 160, 20);
  // Lignes horizontales à hauteur des graduations pour lire les valeurs,
  // même convention qu'un diagramme en barres classique.
  const gridSteps = 4;
  const valueGrid = Array.from({ length: gridSteps }, (_, index) => {
    const y = chartTop + ((chartBottom - chartTop) * index) / gridSteps;
    return `<line x1="${chartLeft}" y1="${num(y)}" x2="${chartRight}" y2="${num(y)}" stroke="rgba(15,30,58,0.07)" stroke-width="1"/>`;
  }).join("");
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
  const svg = `<svg viewBox="0 0 220 160" xmlns="http://www.w3.org/2000/svg" role="img">${grid}${valueGrid}${axis}${parts}</svg>`;
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
  const grid = gridBackground(220, 90, 20);
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
  const svg = `<svg viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg" role="img">${grid}${whiskerLeft}${whiskerRight}${box}${median}${labels}${axisLabel}</svg>`;
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
      const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}${block.attribution ? ` <span class="course-image-credit">— ${escapeHtml(block.attribution)}</span>` : ""}</figcaption>` : "";
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
    case "pythagoras_visualizer":
      return renderPythagorasVisualizer(block);
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
