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

// ── Système de figures Educalcul ────────────────────────────────────────────
// Toutes les figures partagent : une feuille blanche quadrillée (papier à
// petits carreaux), un cadre arrondi doré discret, la même palette, les mêmes
// épaisseurs de trait, des étiquettes avec halo blanc (lisibles par-dessus
// n'importe quel tracé), et des cotes (traits de mesure) pour donner l'ordre
// de grandeur. La carte extérieure .course-figure fournit l'effet liquid glass
// (globals.css). Objectif : cohérence visuelle d'une figure à l'autre.

const FIG = {
  ink: "#0f1e3a",
  inkSoft: "rgba(15,30,58,0.5)",
  paper: "#ffffff",
  grid: "rgba(15,30,58,0.06)",
  gridBold: "rgba(15,30,58,0.12)",
  frame: "rgba(197,161,72,0.4)",
  accent: "#c89f36",
} as const;

const FIG_STROKE = 1.75;

/** Motif de fond : feuille quadrillée + gros carreaux tous les 5, cadre doré.
 * `cell` est le pas de la petite grille en unités du viewBox. */
function figPaper(width: number, height: number, cell = 20): string {
  const small = `epaper-s-${cell}`;
  const big = `epaper-b-${cell}`;
  const b = cell * 5;
  return (
    `<defs>` +
    `<pattern id="${small}" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse">` +
    `<path d="M ${cell} 0 L 0 0 0 ${cell}" fill="none" stroke="${FIG.grid}" stroke-width="1"/></pattern>` +
    `<pattern id="${big}" width="${b}" height="${b}" patternUnits="userSpaceOnUse">` +
    `<path d="M ${b} 0 L 0 0 0 ${b}" fill="none" stroke="${FIG.gridBold}" stroke-width="1"/></pattern>` +
    `</defs>` +
    // Feuille blanche + quadrillage seulement. Pas de cadre : la carte
    // .course-figure (verre) est le seul cadre — on évite le double contour.
    `<rect x="0" y="0" width="${num(width)}" height="${num(height)}" fill="${FIG.paper}"/>` +
    `<rect x="0" y="0" width="${num(width)}" height="${num(height)}" fill="url(#${small})"/>` +
    `<rect x="0" y="0" width="${num(width)}" height="${num(height)}" fill="url(#${big})"/>`
  );
}

/** Alias rétro-compat : quadrillage simple. */
function gridBackground(width: number, height: number, step: number): string {
  return figPaper(width, height, step);
}

/** Marqueurs de flèche partagés (un id fixe : identiques partout). */
function figArrowDefs(): string {
  return (
    `<defs>` +
    `<marker id="efig-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">` +
    `<path d="M0,0 L6.5,3 L0,6 Z" fill="${FIG.ink}"/></marker>` +
    `<marker id="efig-arrow-start" markerWidth="8" markerHeight="8" refX="0.5" refY="3" orient="auto" markerUnits="userSpaceOnUse">` +
    `<path d="M6.5,0 L0,3 L6.5,6 Z" fill="${FIG.ink}"/></marker>` +
    `<marker id="efig-tick" markerWidth="6" markerHeight="8" refX="3" refY="4" orient="auto" markerUnits="userSpaceOnUse">` +
    `<line x1="3" y1="0.5" x2="3" y2="7.5" stroke="${FIG.accent}" stroke-width="1.1"/></marker>` +
    `</defs>`
  );
}

/** Attributs marker-* pour un trait selon l'option `arrow`. */
function arrowAttrs(arrow: "none" | "end" | "both"): string {
  if (arrow === "end") return ' marker-end="url(#efig-arrow)"';
  if (arrow === "both") return ' marker-start="url(#efig-arrow-start)" marker-end="url(#efig-arrow)"';
  return "";
}

/** Portion de cercle (arc) : path SVG de startAngle à endAngle (degrés,
 * convention maths). `flipY` inverse le sens vertical (repères écran). */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number, flipY = 1): string {
  const a0 = (startDeg * Math.PI) / 180;
  const a1 = (endDeg * Math.PI) / 180;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy - flipY * r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy - flipY * r * Math.sin(a1);
  const large = Math.abs(endDeg - startDeg) % 360 > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? (flipY > 0 ? 0 : 1) : flipY > 0 ? 1 : 0;
  return `M ${num(x0)} ${num(y0)} A ${num(r)} ${num(r)} 0 ${large} ${sweep} ${num(x1)} ${num(y1)}`;
}

/** Étiquette texte avec halo blanc : toujours lisible, même posée sur un trait
 * ou un aplat de couleur. À utiliser partout à la place d'un <text> brut. */
function figText(
  x: number,
  y: number,
  content: string,
  opts: { size?: number; weight?: number; anchor?: "start" | "middle" | "end"; fill?: string } = {},
): string {
  const size = opts.size ?? 11;
  const weight = opts.weight ?? 500;
  const anchor = opts.anchor ?? "middle";
  const fill = opts.fill ?? FIG.ink;
  // Halo contrasté : blanc sous un texte foncé, foncé sous un texte clair
  // (sinon un « 10 € » blanc sur billet devenait un pâté blanc illisible).
  const light = ["#fff", "#ffffff", "#fefefe"].includes(fill.toLowerCase().trim());
  const halo = light ? "rgba(15,30,58,0.35)" : "#ffffff";
  const haloW = light ? 2 : 2.6;
  return (
    `<text x="${num(x)}" y="${num(y)}" font-size="${size}" font-weight="${weight}" ` +
    `text-anchor="${anchor}" fill="${fill}" stroke="${halo}" stroke-width="${haloW}" ` +
    `stroke-linejoin="round" paint-order="stroke" style="paint-order:stroke">${content}</text>`
  );
}

/** Cote (trait de mesure) : petite ligne dorée à double flèche + étiquette,
 * décalée du segment mesuré. `offset` positif = au-dessus / à gauche. */
function figDimension(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  offset = 12,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ox = nx * offset;
  const oy = ny * offset;
  const ax1 = x1 + ox;
  const ay1 = y1 + oy;
  const ax2 = x2 + ox;
  const ay2 = y2 + oy;
  const mx = (ax1 + ax2) / 2;
  const my = (ay1 + ay2) / 2;
  return (
    `<g class="efig-dim">` +
    `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(ax1 + nx * 3)}" y2="${num(ay1 + ny * 3)}" stroke="${FIG.accent}" stroke-width="0.9" stroke-dasharray="2 2"/>` +
    `<line x1="${num(x2)}" y1="${num(y2)}" x2="${num(ax2 + nx * 3)}" y2="${num(ay2 + ny * 3)}" stroke="${FIG.accent}" stroke-width="0.9" stroke-dasharray="2 2"/>` +
    `<line x1="${num(ax1)}" y1="${num(ay1)}" x2="${num(ax2)}" y2="${num(ay2)}" stroke="${FIG.accent}" stroke-width="1.1" marker-start="url(#efig-tick)" marker-end="url(#efig-tick)"/>` +
    figText(mx, my - 2, escapeHtml(label), { size: 9.5, fill: "#8a6d3b", weight: 600 }) +
    `</g>`
  );
}

/** Ouvre une figure Educalcul : cadre + papier quadrillé + defs de flèches.
 * Le renderer y ajoute son tracé puis referme avec `</svg>`. */
function figOpen(width: number, height: number, opts: { grid?: boolean; cell?: number } = {}): string {
  const paper = opts.grid === false
    ? `<rect x="0" y="0" width="${num(width)}" height="${num(height)}" fill="${FIG.paper}"/>`
    : figPaper(width, height, opts.cell ?? 20);
  return `<svg class="edu-fig-svg" viewBox="0 0 ${num(width)} ${num(height)}" xmlns="http://www.w3.org/2000/svg" role="img">${figArrowDefs()}${paper}`;
}

const SHAPE_FILL_OPACITY = "0.14";

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵",
  "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺",
};
/** Exposant en vrais caractères unicode (10⁻⁶, x², …) pour les <text> SVG. */
function toSuperscript(value: number | string): string {
  return String(value)
    .split("")
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join("");
}

function formatCentimes(centimes: number): string {
  if (centimes % 100 === 0) return `${centimes / 100} €`;
  if (centimes >= 100) return `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
  return `${centimes} c`;
}

/** Couronne de 12 étoiles de l'UE, en arc, pour les billets et les pièces. */
function euroStars(cx: number, cy: number, radius: number, count: number, size: number, from: number, to: number, color: string): string {
  const pts: string[] = [];
  for (let i = 0; i < count; i++) {
    const ang = ((from + ((to - from) * i) / Math.max(1, count - 1)) * Math.PI) / 180;
    const x = cx + radius * Math.cos(ang);
    const y = cy + radius * Math.sin(ang);
    const star: string[] = [];
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? size : size * 0.42;
      const a = (Math.PI / 5) * k - Math.PI / 2;
      star.push(`${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`);
    }
    pts.push(`<polygon points="${star.join(" ")}" fill="${color}"/>`);
  }
  return pts.join("");
}

/** Pièce ou billet en euro, dessin stylisé mais reconnaissable (motif « fenêtre
 * / portail » des billets série 1, couronne d'étoiles, valeur en gros ;
 * métaux réalistes pour les pièces). value en centimes. */
function moneySvg(value: number): string {
  const label = formatCentimes(value);
  if (value >= 500) {
    // Couleur dominante officielle de la coupure.
    const notes: Record<number, [string, string, string]> = {
      500: ["#7c7f85", "#b9bdc4", "#e7e9ec"],
      1000: ["#9c3d2c", "#c9705a", "#efc7ba"],
      2000: ["#2f6aa8", "#5f97c9", "#c3ddef"],
      5000: ["#c07d2f", "#dda85b", "#f2d9ac"],
      10000: ["#3f8f5e", "#6fb98a", "#c6e4d1"],
      20000: ["#6f5aa0", "#9a86c2", "#d8cde8"],
      50000: ["#b06a90", "#d199b7", "#eccfdd"],
    };
    const [dark, mid, light] = notes[value] ?? notes[500];
    const gid = `note-${value}`;
    const w = 108;
    const h = 58;
    return (
      `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0.15" y2="1">` +
      `<stop offset="0" stop-color="${light}"/><stop offset="0.5" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>` +
      `<rect x="3" y="6" width="${w - 6}" height="${h - 12}" rx="5" fill="url(#${gid})" stroke="${dark}" stroke-width="1.4"/>` +
      // Portail / fenêtre (motif recto série 1)
      `<path d="M 12 ${h - 10} L 12 24 Q 12 14 24 14 Q 36 14 36 24 L 36 ${h - 10} Z" fill="#ffffff" fill-opacity="0.22" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1"/>` +
      `<line x1="24" y1="14" x2="24" y2="${h - 10}" stroke="#ffffff" stroke-opacity="0.4" stroke-width="0.8"/>` +
      // Bande holographique
      `<rect x="${w - 20}" y="8" width="9" height="${h - 16}" rx="2" fill="#ffffff" fill-opacity="0.35"/>` +
      euroStars(w - 15.5, 22, 6.5, 12, 1.1, 0, 359, "#ffffff") +
      figText(w * 0.56, 30, "EURO", { size: 5.5, weight: 700, fill: "#ffffff" }) +
      figText(w * 0.56, 44, escapeHtml(label), { size: 17, weight: 800, fill: "#ffffff" }) +
      `</svg>`
    );
  }
  // Pièce : cuivre (1/2/5 c), or nordique (10/20/50 c), bimétal (1/2 €).
  const gid = `coin-${value}`;
  let ring = "#c9a23c";
  let center = "#e8c964";
  if (value <= 5) {
    ring = "#a9622f";
    center = "#cf8a55";
  } else if (value >= 100) {
    ring = value === 200 ? "#e0c057" : "#c3c8d1";
    center = value === 200 ? "#c3c8d1" : "#e6c964";
  }
  const bimetal = value >= 100;
  const numeral = value >= 100 ? String(value / 100) : String(value);
  return (
    `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><radialGradient id="${gid}" cx="0.36" cy="0.3" r="0.8">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/>` +
    `<stop offset="0.4" stop-color="${center}"/>` +
    `<stop offset="1" stop-color="${ring}"/></radialGradient></defs>` +
    `<circle cx="30" cy="30" r="27" fill="url(#${gid})" stroke="${ring}" stroke-width="1.5"/>` +
    (bimetal
      ? `<circle cx="30" cy="30" r="17" fill="${value === 200 ? "#eef0f3" : "#f3e5b8"}" fill-opacity="0.55" stroke="${ring}" stroke-width="0.8"/>`
      : `<circle cx="30" cy="30" r="21" fill="none" stroke="${ring}" stroke-width="0.9" stroke-opacity="0.6"/>`) +
    euroStars(30, 30, 23, 12, 1.05, 0, 359, "rgba(255,255,255,0.5)") +
    figText(30, 32, escapeHtml(numeral), { size: value >= 100 ? 17 : 14, weight: 800, fill: FIG.ink }) +
    figText(30, 43, value >= 100 ? "€" : "cent", { size: value >= 100 ? 8 : 5.5, weight: 700, fill: FIG.ink }) +
    `</svg>`
  );
}

function renderCoinPurse(
  block: Extract<StructuredCourseBlock, { type: "coin_purse" }>,
): string {
  const items = block.coins
    .map(
      (value) =>
        `<span class="coin-item${value >= 500 ? " coin-item-bill" : ""}" data-value="${value}" role="button" tabindex="0">${moneySvg(value)}</span>`,
    )
    .join("");
  const purse = `<div class="coin-purse-zone"><div class="coin-purse-total" data-target="${block.target}">Total : <span class="coin-purse-total-value">0 c</span></div><button type="button" class="coin-purse-reset">Réinitialiser</button></div>`;
  return `<figure class="course-figure course-figure-coin-purse"><div class="coin-purse-row">${items}</div>${purse}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

/** Balance de Roberval : deux plateaux plats suspendus au fléau ; chaque
 * membre est écrit en UNE étiquette ("3 + 2", "2x + 1"…) posée sur son plateau
 * — jamais de débordement quel que soit le nombre de termes. */
function balanceScaleSvg(leftLabel: string, rightLabel: string, tiltDeg: number): string {
  const W = 320;
  const H = 160;
  const cx = W / 2;
  const pivotY = 40;
  const beamHalf = 96;
  const rad = (Math.max(-8, Math.min(8, tiltDeg)) * Math.PI) / 180;
  const ex = (side: 1 | -1) => cx + side * beamHalf * Math.cos(rad);
  const ey = (side: 1 | -1) => pivotY + side * beamHalf * Math.sin(rad);

  const plate = (bx: number, by: number, label: string, tone: string) => {
    const text = label || "0";
    const size = Math.max(9, Math.min(13, 15 - Math.max(0, text.length - 3) * 0.5));
    const half = Math.min(58, Math.max(30, (text.length * size * 0.6) / 2 + 10));
    const dy = by + 38;
    const strings =
      `<line x1="${num(bx)}" y1="${num(by)}" x2="${num(bx - half * 0.7)}" y2="${num(dy)}" stroke="${FIG.inkSoft}" stroke-width="1"/>` +
      `<line x1="${num(bx)}" y1="${num(by)}" x2="${num(bx + half * 0.7)}" y2="${num(dy)}" stroke="${FIG.inkSoft}" stroke-width="1"/>`;
    const tray =
      `<rect x="${num(bx - half)}" y="${num(dy)}" width="${num(half * 2)}" height="4" rx="2" fill="${FIG.ink}"/>` +
      `<path d="M ${num(bx - half)} ${num(dy + 2)} Q ${num(bx)} ${num(dy + 9)} ${num(bx + half)} ${num(dy + 2)}" fill="none" stroke="${FIG.inkSoft}" stroke-width="1"/>`;
    const chip =
      `<rect x="${num(bx - half + 2)}" y="${num(dy - 20)}" width="${num(half * 2 - 4)}" height="19" rx="5" fill="${tone}" fill-opacity="0.92"/>` +
      figText(bx, dy - 7, escapeHtml(text), { size, weight: 700, fill: "#ffffff" });
    return strings + tray + chip;
  };

  const beam = `<line x1="${num(ex(-1))}" y1="${num(ey(-1))}" x2="${num(ex(1))}" y2="${num(ey(1))}" stroke="${FIG.ink}" stroke-width="3.5" stroke-linecap="round"/>`;
  const post = `<rect x="${num(cx - 3)}" y="${pivotY}" width="6" height="${H - 22 - pivotY}" rx="2" fill="${FIG.ink}"/>`;
  const base = `<path d="M ${num(cx - 34)} ${H - 10} L ${num(cx - 13)} ${H - 22} L ${num(cx + 13)} ${H - 22} L ${num(cx + 34)} ${H - 10} Z" fill="#eff3fb" stroke="${FIG.ink}" stroke-width="1.5" stroke-linejoin="round"/>`;
  const pivot = `<circle cx="${cx}" cy="${pivotY}" r="4" fill="${FIG.accent}" stroke="${FIG.ink}" stroke-width="1.1"/>`;
  return (
    `${figOpen(W, H)}${base}${post}${beam}${pivot}` +
    plate(ex(-1), ey(-1), leftLabel, FIGURE_PALETTE.blue) +
    plate(ex(1), ey(1), rightLabel, FIGURE_PALETTE.green) +
    `</svg>`
  );
}

function renderBalanceScale(
  block: Extract<StructuredCourseBlock, { type: "balance_scale" }>,
): string {
  const leftSum = block.left.reduce((a, b) => a + b, 0);
  const rightSum = block.right.reduce((a, b) => a + b, 0);
  // tilt > 0 => plateau DROIT plus bas ; < 0 => plateau GAUCHE plus bas.
  let tilt: number;
  if (block.tilt === "level") tilt = 0;
  else if (block.tilt === "left") tilt = -8;
  else if (block.tilt === "right") tilt = 8;
  else tilt = Math.max(-8, Math.min(8, (rightSum - leftSum) * 1.6));
  const leftLabel = block.leftLabel || block.left.join(" + ");
  const rightLabel = block.rightLabel || block.right.join(" + ");
  const svg = balanceScaleSvg(leftLabel, rightLabel, tilt);
  return `<figure class="course-figure course-figure-balance">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
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
        `<rect class="grid-cell${filled ? " grid-cell-filled" : ""}" data-index="${index}" x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="${filled ? FIGURE_PALETTE.blue : "#ffffff"}" fill-opacity="${filled ? 0.82 : 1}" stroke="${FIG.ink}" stroke-width="1"/>`,
      );
    }
  }
  const gpW = block.cols * cell, gpH = block.rows * cell;
  const svg = `<svg class="grid-painter-svg edu-fig-svg" viewBox="0 0 ${gpW} ${gpH}" xmlns="http://www.w3.org/2000/svg" role="img" data-rows="${block.rows}" data-cols="${block.cols}">${cells.join("")}</svg>`;
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
  // La règle est dessinée SUR toute la longueur du segment mais bornée à une
  // largeur d'affichage fixe : l'échelle s'adapte pour qu'un segment de 3 cm
  // comme de 40 cm tienne dans le cadre sans jamais déborder.
  const units = Math.max(1, Math.round(block.segmentLength));
  const PAD = 16;
  const MAX_INNER = 300;
  const scale = Math.min(24, MAX_INNER / units);
  const inner = units * scale;
  const width = inner + PAD * 2;
  const bodyTop = 8;
  const bodyH = 34;
  const ticks: string[] = [];
  for (let i = 0; i <= units; i++) {
    const x = PAD + i * scale;
    ticks.push(
      `<line x1="${num(x)}" y1="${bodyTop}" x2="${num(x)}" y2="${bodyTop + 13}" stroke="${FIG.ink}" stroke-width="1.1"/>`,
    );
    ticks.push(
      figText(x, bodyTop + 26, String(i), { size: 9 }),
    );
    // demi-graduation (5 mm) entre deux centimètres, si la place le permet
    if (i < units && scale >= 14) {
      ticks.push(
        `<line x1="${num(x + scale / 2)}" y1="${bodyTop}" x2="${num(x + scale / 2)}" y2="${bodyTop + 7}" stroke="${FIG.ink}" stroke-width="0.8"/>`,
      );
    }
  }
  const svg = `${figOpen(width, bodyTop + bodyH + 12, { grid: false })}<rect x="${PAD - 4}" y="${bodyTop}" width="${num(inner + 8)}" height="${bodyH}" rx="4" fill="#fdf6e3" stroke="${FIG.ink}" stroke-width="1.2"/>${ticks.join("")}</svg>`;
  return `<figure class="course-figure course-figure-ruler">${svg}<figcaption>${escapeHtml(block.caption)} (${block.segmentLength} ${escapeHtml(block.unit)})</figcaption></figure>`;
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
      const seg = `<rect x="${num(x)}" y="0" width="${num(w)}" height="36" fill="${FIGURE_PALETTE[p.tone]}" fill-opacity="0.85" stroke="#ffffff" stroke-width="1.5"/>` + figText(x + w / 2, 22, escapeHtml(p.label), { size: 10, weight: 700, fill: "#ffffff" });
      x += w;
      return seg;
    })
    .join("");
  const svg = `${figOpen(width + 8, 46, { grid: false })}<g transform="translate(4 5)">${segments}</g></svg>`;
  return `<figure class="course-figure course-figure-tape-diagram">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

/** Pyramide de briques (sommet en premier). Briques remplies en vert, briques vides en pointillés à compléter. */
function renderBrickPyramid(
  block: Extract<StructuredCourseBlock, { type: "brick_pyramid" }>,
): string {
  const rows = block.levels.length;
  const brickW = 46;
  const brickH = 26;
  const gap = 3;
  const width = rows * (brickW + gap) + 16;
  const height = rows * (brickH + gap) + 14;
  const bricks = block.levels
    .map((row, r) => {
      const rowWidth = row.length * (brickW + gap) - gap;
      const x0 = (width - rowWidth) / 2;
      const y = 7 + r * (brickH + gap);
      return row
        .map((value, c) => {
          const x = x0 + c * (brickW + gap);
          if (!value) {
            return `<rect x="${num(x)}" y="${num(y)}" width="${brickW}" height="${brickH}" rx="3" fill="#ffffff" stroke="${FIG.ink}" stroke-width="1.2" stroke-dasharray="4 3"/>` + figText(x + brickW / 2, y + brickH / 2 + 4, "?", { size: 12, weight: 600, fill: FIG.inkSoft });
          }
          return `<rect x="${num(x)}" y="${num(y)}" width="${brickW}" height="${brickH}" rx="3" fill="${FIGURE_PALETTE.green}" fill-opacity="0.5" stroke="${FIG.ink}" stroke-width="1.1"/>` + figText(x + brickW / 2, y + brickH / 2 + 4, escapeHtml(value), { size: 12, weight: 700 });
        })
        .join("");
    })
    .join("");
  const svg = `${figOpen(width, height, { grid: false })}${bricks}</svg>`;
  return `<figure class="course-figure course-figure-brick-pyramid">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

/** Grille à compléter (carré magique, tableau de nombres) : cases données en gras, cases vides en pointillés. */
function renderFillGrid(
  block: Extract<StructuredCourseBlock, { type: "fill_grid" }>,
): string {
  const cellW = 40;
  const cellH = 40;
  const cols = block.cells[0].length;
  const width = cols * cellW + 16;
  const height = block.cells.length * cellH + 16;
  const cells = block.cells
    .map((row, r) =>
      row
        .map((value, c) => {
          const x = 8 + c * cellW;
          const y = 8 + r * cellH;
          return value
            ? `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="#ffffff" stroke="${FIG.ink}" stroke-width="1.3"/>` + figText(x + cellW / 2, y + cellH / 2 + 4, escapeHtml(value), { size: 13, weight: 700 })
            : `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="#fff8e1" stroke="${FIG.ink}" stroke-width="1.3"/>`;
        })
        .join(""),
    )
    .join("");
  const svg = `${figOpen(width, height, { grid: false })}${cells}</svg>`;
  return `<figure class="course-figure course-figure-fill-grid">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
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
        `<rect x="${num(c * cellW)}" y="0" width="${num(cellW)}" height="24" fill="${c < f.numerator ? FIGURE_PALETTE.blue : "#ffffff"}" fill-opacity="${c < f.numerator ? 0.82 : 1}" stroke="${FIG.ink}" stroke-width="1"/>`,
      ).join("");
      return `<g transform="translate(6,${i * rowHeight + 6})">${cells}` + figText(width + 20, 17, `${f.numerator}/${f.denominator}`, { size: 11, weight: 600 }) + `</g>`;
    })
    .join("");
  const svg = `${figOpen(width + 46, block.fractions.length * rowHeight + 12, { grid: false })}${rows}</svg>`;
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
  const cx = 100, cy = 108, r = 84;
  const ticks: string[] = [];
  const numbers: string[] = [];
  for (let a = 0; a <= 180; a += 10) {
    const outer = trigPoint(cx, cy, r, a);
    const big = a % 30 === 0;
    const inner = trigPoint(cx, cy, r - (big ? 12 : 6), a);
    ticks.push(`<line x1="${num(inner.x)}" y1="${num(inner.y)}" x2="${num(outer.x)}" y2="${num(outer.y)}" stroke="${FIG.ink}" stroke-width="${big ? 1.3 : 0.8}"/>`);
    if (big) {
      // nombre juste sous la graduation, tiré vers l'intérieur ; les deux
      // extrêmes (0° / 180°) sont remontés pour ne pas coller à la ligne.
      const rl = a === 0 || a === 180 ? r - 12 : r - 24;
      const lab = trigPoint(cx, cy, rl, a);
      const dyExtreme = a === 0 || a === 180 ? -5 : 3;
      numbers.push(figText(lab.x, lab.y + dyExtreme, String(a), { size: 8, weight: 600, fill: FIG.inkSoft }));
    }
  }
  const arm = trigPoint(cx, cy, r - 30, block.angleDeg);
  const base = `<path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/><line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/>`;
  const armLine = `<line class="protractor-arm" x1="${cx}" y1="${cy}" x2="${num(arm.x)}" y2="${num(arm.y)}" stroke="${FIGURE_PALETTE.blue}" stroke-width="2.5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="3" fill="${FIG.ink}"/>`;
  const svg = `<svg class="protractor-svg edu-fig-svg" viewBox="0 0 200 128" xmlns="http://www.w3.org/2000/svg" role="img">${figPaper(200, 128, 20)}${ticks.join("")}${base}${armLine}${numbers.join("")}</svg>`;
  const controls = `<div class="protractor-controls"><input type="range" class="protractor-slider" min="0" max="180" step="1" value="${block.angleDeg}"/><span class="protractor-value">${block.angleDeg}°</span></div>`;
  return `<figure class="course-figure course-figure-protractor">${svg}${controls}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderCompassTool(
  block: Extract<StructuredCourseBlock, { type: "compass_tool" }>,
): string {
  const S = 200;
  const cx = S / 2, cy = S / 2;
  const maxR = 82;
  const r = Math.min(maxR, block.radius * 15);
  const svg =
    `<svg class="compass-svg edu-fig-svg" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" role="img" data-scale="${(r / block.radius).toFixed(3)}" data-max-r="${maxR}">` +
    `${figPaper(S, S, 20)}` +
    `<circle class="compass-circle" cx="${cx}" cy="${cy}" r="${num(r)}" fill="${FIGURE_PALETTE.blue}" fill-opacity="0.06" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="3" fill="${FIG.ink}"/>` +
    figText(cx - 9, cy + 12, escapeHtml(block.centerLabel), { size: 11, weight: 700 }) +
    `<line class="compass-radius-line" x1="${cx}" y1="${cy}" x2="${num(cx + r)}" y2="${cy}" stroke="${FIG.accent}" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    `<circle class="compass-handle" cx="${num(cx + r)}" cy="${cy}" r="6" fill="${FIG.accent}" stroke="#ffffff" stroke-width="1.5" role="button" tabindex="0" style="cursor:grab"/>` +
    figText(cx + r / 2, cy - 7, `r = ${block.radius}`, { size: 10, fill: "#8a6d3b", weight: 600 }) +
    `</svg>`;
  return `<figure class="course-figure course-figure-compass">${svg}<figcaption>${escapeHtml(block.caption)}, fais glisser le point doré</figcaption></figure>`;
}

function renderThermometerAxis(
  block: Extract<StructuredCourseBlock, { type: "thermometer_axis" }>,
): string {
  const height = 210;
  const top = 18;
  const W = 176;
  const H = height + top * 2 + 14;
  const bulbY = top + height + 6;
  const tubeX = 40;
  const clamp = (v: number) => Math.max(block.min, Math.min(block.max, v));
  const yFor = (v: number) => top + (1 - (clamp(v) - block.min) / (block.max - block.min || 1)) * height;
  const ticks: string[] = [];
  const step = Math.max(1, Math.round((block.max - block.min) / 8));
  for (let v = block.min; v <= block.max; v += step) {
    const y = yFor(v);
    ticks.push(`<line x1="${tubeX + 7}" y1="${num(y)}" x2="${tubeX + 13}" y2="${num(y)}" stroke="${FIG.ink}" stroke-width="1"/>` + figText(tubeX - 14, y + 3, String(v), { size: 9, anchor: "end", fill: FIG.inkSoft }));
  }
  // Tube en verre + réservoir + colonne de mercure jusqu'à la valeur la plus haute.
  const topVal = block.points.length ? Math.max(...block.points.map((p) => p.value)) : block.min;
  const mercuryTop = yFor(topVal);
  const glass =
    `<rect x="${tubeX - 5}" y="${top - 2}" width="10" height="${height + 8}" rx="5" fill="#ffffff" stroke="${FIG.ink}" stroke-width="1.4"/>` +
    `<circle cx="${tubeX}" cy="${bulbY}" r="9" fill="#ffffff" stroke="${FIG.ink}" stroke-width="1.4"/>`;
  const mercury =
    `<circle cx="${tubeX}" cy="${bulbY}" r="6" fill="${FIGURE_PALETTE.red}"/>` +
    `<rect x="${tubeX - 2.5}" y="${num(mercuryTop)}" width="5" height="${num(bulbY - mercuryTop)}" fill="${FIGURE_PALETTE.red}"/>`;
  const points = block.points
    .map((p) => {
      const y = yFor(p.value);
      return `<line x1="${tubeX + 6}" y1="${num(y)}" x2="${tubeX + 40}" y2="${num(y)}" stroke="${FIGURE_PALETTE.blue}" stroke-width="1" stroke-dasharray="3 2"/>` + figText(tubeX + 44, y + 3, `${escapeHtml(p.label)} (${p.value})`, { size: 10, anchor: "start" });
    })
    .join("");
  const zeroY = block.min <= 0 && block.max >= 0 ? yFor(0) : null;
  const zeroLine = zeroY !== null ? `<line x1="${tubeX + 6}" y1="${num(zeroY)}" x2="${W - 10}" y2="${num(zeroY)}" stroke="${FIG.inkSoft}" stroke-width="1" stroke-dasharray="4 3"/>` : "";
  const svg = `${figOpen(W, H, { grid: false })}${ticks.join("")}${zeroLine}${glass}${mercury}${points}</svg>`;
  return `<figure class="course-figure course-figure-thermometer">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

type ShapePart = Extract<StructuredCourseBlock, { type: "shape" }>["parts"][number];

/** Un sommet d'une part = polygone : renvoie ses points en carreaux (repère
 * local, origine bas-gauche, y vers le haut). */
function shapePartVertices(p: ShapePart): { x: number; y: number }[] {
  if (p.points.length >= 3) return p.points;
  if (p.kind === "right_triangle") {
    return [
      { x: p.x, y: p.y },
      { x: p.x, y: p.y + p.h },
      { x: p.x + p.w, y: p.y },
    ];
  }
  if (p.kind === "triangle") {
    return [
      { x: p.x, y: p.y },
      { x: p.x + p.w, y: p.y },
      { x: p.x + p.w / 2, y: p.y + p.h },
    ];
  }
  // rectangle / square
  return [
    { x: p.x, y: p.y },
    { x: p.x + p.w, y: p.y },
    { x: p.x + p.w, y: p.y + p.h },
    { x: p.x, y: p.y + p.h },
  ];
}

/** Boîte englobante d'une part, en carreaux (unités du canevas). */
function shapePartBounds(p: ShapePart): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  if (p.kind === "circle" || p.kind === "arc" || p.kind === "angle") {
    const r = p.kind === "angle" ? Math.min(1.1, p.r || 1) : p.r || 1;
    xs.push(p.x - r, p.x + r);
    ys.push(p.y - r, p.y + r);
  } else if (p.kind === "point" || p.kind === "text") {
    xs.push(p.x);
    ys.push(p.y);
  } else if (p.kind === "segment" || p.kind === "line") {
    const a = p.points[0] ?? { x: p.x, y: p.y };
    const b = p.points[1] ?? { x: p.x + p.w, y: p.y + p.h };
    xs.push(a.x, b.x);
    ys.push(a.y, b.y);
  } else {
    for (const v of shapePartVertices(p)) {
      xs.push(v.x);
      ys.push(v.y);
    }
  }
  if (!xs.length) return null;
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const TRIG_REMARKABLE = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
const TRIG_LABELS: Record<number, string> = {
  0: "0", 30: "π/6", 45: "π/4", 60: "π/3", 90: "π/2",
  120: "2π/3", 135: "3π/4", 150: "5π/6", 180: "π",
  210: "7π/6", 225: "5π/4", 240: "4π/3", 270: "3π/2",
  300: "5π/3", 315: "7π/4", 330: "11π/6",
};

/** Cercle trigonométrique : feuille quadrillée, cercle unité, axes, TOUS les
 * angles remarquables (les mis en avant par l'IA en gros/rouge + étiquette),
 * et un point mobile interactif (cf. trigCircleInteractive.ts). */
function renderTrigCircle(
  block: Extract<StructuredCourseBlock, { type: "trig_circle" }>,
): string {
  const W = 228;
  const cx = 114;
  const cy = 114;
  const r = 84;
  const norm = (d: number) => ((Math.round(d) % 360) + 360) % 360;
  const hot = new Map(block.highlightedAngles.map((a) => [norm(a.angleDeg), a.label]));
  const emphasizeAll = hot.size === 0;
  const axes =
    `<line x1="${cx - r - 16}" y1="${cy}" x2="${cx + r + 16}" y2="${cy}" stroke="${FIG.inkSoft}" stroke-width="1.25" marker-end="url(#efig-arrow)"/>` +
    `<line x1="${cx}" y1="${cy + r + 16}" x2="${cx}" y2="${cy - r - 16}" stroke="${FIG.inkSoft}" stroke-width="1.25" marker-end="url(#efig-arrow)"/>`;
  const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${FIG.ink}" stroke-width="1.6"/>`;
  const marks = TRIG_REMARKABLE.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const px = cx + r * Math.cos(rad);
    const py = cy - r * Math.sin(rad);
    const isHot = emphasizeAll ? deg <= 90 : hot.has(deg);
    let out = `<circle cx="${num(px)}" cy="${num(py)}" r="${isHot ? 3.4 : 1.9}" fill="${isHot ? FIGURE_PALETTE.red : FIG.inkSoft}"${isHot ? ' stroke="#ffffff" stroke-width="1"' : ""}/>`;
    if (isHot) {
      const lx = Math.min(W - 10, Math.max(10, cx + (r + 17) * Math.cos(rad)));
      const ly = cy - (r + 17) * Math.sin(rad) + 3.2;
      const text = hot.get(deg) || TRIG_LABELS[deg] || `${deg}°`;
      out += figText(lx, ly, escapeHtml(text), { size: 9, weight: 600 });
    }
    return out;
  }).join("");
  const svg =
    `<svg class="tc-svg edu-fig-svg" viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg" role="img" ` +
    `data-cx="${cx}" data-cy="${cy}" data-r="${r}" data-angle="45">` +
    `${figArrowDefs()}${figPaper(W, W, 19)}${axes}${circle}${marks}<g class="tc-live"></g></svg>`;
  const readout = `<div class="tc-readout"><span class="tc-angle-value">45° · cos 0.71 · sin 0.71</span></div>`;
  return `<figure class="course-figure course-figure-trig-circle">${svg}${readout}<figcaption>${escapeHtml(block.caption)}, fais glisser le point</figcaption></figure>`;
}

/** Bloc "shape" : canevas quadrillé sur lequel on pose une ou plusieurs formes
 * simples (rectangle, triangle, cercle, segment, point). Chaque forme porte
 * ses options (sommets étiquetés, côtés cotés, marque d'angle droit). Combiner
 * les parts remplace les anciennes figures dédiées (triangle annoté, Pythagore). */
function renderShape(
  block: Extract<StructuredCourseBlock, { type: "shape" }>,
): string {
  if (block.preset === "pythagoras") return renderPythagorasShape(block);

  // Recadrage automatique : on ignore width/height fournis et on cale le canevas
  // sur la boîte englobante réelle des parts → figure toujours centrée, pas de
  // marge morte (ni pour l'IA, ni pour une figure faite main).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of block.parts) {
    const b = shapePartBounds(p);
    if (!b) continue;
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = block.width;
    maxY = block.height;
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const cell = Math.max(11, Math.min(30, Math.floor(Math.min(320 / spanX, 200 / spanY))));
  // Marge = 2 carreaux pleins (place aux étiquettes extérieures) ; W/H arrondis
  // au carreau → le quadrillage reste calé sur les formes.
  const M = cell * 2;
  const W = M * 2 + Math.ceil(spanX) * cell;
  const H = M * 2 + Math.ceil(spanY) * cell;
  const X = (gx: number) => M + (gx - minX) * cell;
  const Y = (gy: number) => H - M - (gy - minY) * cell;

  const body = block.parts
    .map((p) => {
      const color = FIGURE_PALETTE[p.tone];
      const style = `stroke="${color}" stroke-width="${FIG_STROKE}" stroke-linejoin="round" stroke-linecap="round"${p.dashed ? ' stroke-dasharray="5 4"' : ""}`;
      const fillStyle = p.filled ? `fill="${color}" fill-opacity="${SHAPE_FILL_OPACITY}"` : 'fill="none"';
      let out = "";

      if (p.kind === "text") {
        const t = p.text || p.vertexLabels[0] || "";
        return t
          ? figText(X(p.x), Y(p.y) + 4, escapeHtml(t), { size: 12, weight: 700, fill: color === FIGURE_PALETTE.navy ? FIG.ink : color })
          : "";
      }
      if (p.kind === "point") {
        out += `<circle cx="${num(X(p.x))}" cy="${num(Y(p.y))}" r="4" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
        if (p.vertexLabels[0]) out += figText(X(p.x), Y(p.y) - 9, escapeHtml(p.vertexLabels[0]), { size: 11, weight: 600 });
        return out;
      }
      if (p.kind === "segment" || p.kind === "line") {
        // Extrémités : les 2 premiers "points" si fournis, sinon (x,y)→(x+w,y+h).
        let ax = X(p.points[0]?.x ?? p.x);
        let ay = Y(p.points[0]?.y ?? p.y);
        let bx = X(p.points[1]?.x ?? p.x + p.w);
        let by = Y(p.points[1]?.y ?? p.y + p.h);
        if (p.kind === "line") {
          // Prolonge la droite jusqu'aux bords du canevas.
          const dx = bx - ax;
          const dy = by - ay;
          const len = Math.hypot(dx, dy) || 1;
          const ext = (W + H) / len;
          ax -= (dx / len) * ext;
          ay -= (dy / len) * ext;
          bx += (dx / len) * ext;
          by += (dy / len) * ext;
        }
        out += `<line x1="${num(ax)}" y1="${num(ay)}" x2="${num(bx)}" y2="${num(by)}" ${style}${arrowAttrs(p.arrow)}/>`;
        if (p.kind === "segment") {
          if (p.vertexLabels[0]) out += figText(X(p.points[0]?.x ?? p.x), Y(p.points[0]?.y ?? p.y) + 12, escapeHtml(p.vertexLabels[0]), { size: 11, weight: 600 });
          if (p.vertexLabels[1]) out += figText(X(p.points[1]?.x ?? p.x + p.w), Y(p.points[1]?.y ?? p.y + p.h) - 8, escapeHtml(p.vertexLabels[1]), { size: 11, weight: 600 });
          if (p.sideLabels[0]) out += figText((ax + bx) / 2, (ay + by) / 2 - 6, escapeHtml(p.sideLabels[0]), { size: 10, fill: "#8a6d3b", weight: 600 });
        }
        return out;
      }
      if (p.kind === "arc") {
        out += `<path d="${arcPath(X(p.x), Y(p.y), p.r * cell, p.startAngle, p.endAngle)}" fill="none" ${style}/>`;
        if (p.sideLabels[0] || p.text) {
          const mid = ((p.startAngle + p.endAngle) / 2) * (Math.PI / 180);
          out += figText(X(p.x) + (p.r * cell + 10) * Math.cos(mid), Y(p.y) - (p.r * cell + 10) * Math.sin(mid) + 3, escapeHtml(p.sideLabels[0] || p.text), { size: 10, weight: 600 });
        }
        return out;
      }
      if (p.kind === "angle") {
        // Marque d'angle au sommet (x,y), rayon ~0.9 carreau, entre startAngle
        // et endAngle. text/sideLabels[0] : la mesure de l'angle.
        const vr = Math.min(cell * 1.1, p.r * cell || cell);
        out += `<path d="${arcPath(X(p.x), Y(p.y), vr, p.startAngle, p.endAngle)}" fill="none" stroke="${color}" stroke-width="1.4"/>`;
        const label = p.text || p.sideLabels[0];
        if (label) {
          const mid = ((p.startAngle + p.endAngle) / 2) * (Math.PI / 180);
          out += figText(X(p.x) + (vr + 12) * Math.cos(mid), Y(p.y) - (vr + 12) * Math.sin(mid) + 3, escapeHtml(label), { size: 9.5, weight: 600, fill: "#8a6d3b" });
        }
        return out;
      }
      if (p.kind === "circle") {
        const cxp = X(p.x);
        const cyp = Y(p.y);
        const rp = p.r * cell;
        out += `<circle cx="${num(cxp)}" cy="${num(cyp)}" r="${num(rp)}" ${fillStyle} ${style}/>`;
        // Rayon (trait + cote) : seulement si demandé explicitement — pas sur
        // les cercles qui se chevauchent d'un diagramme de Venn.
        const rLabel = p.sideLabels[0] || (p.showDimensions && !p.vertexLabels[0] ? `r = ${p.r}` : "");
        if (rLabel) {
          out += `<circle cx="${num(cxp)}" cy="${num(cyp)}" r="2.5" fill="${color}"/>`;
          out += `<line x1="${num(cxp)}" y1="${num(cyp)}" x2="${num(cxp + rp)}" y2="${num(cyp)}" stroke="${color}" stroke-width="1.1" stroke-dasharray="4 3"/>`;
          out += figText(cxp + rp / 2, cyp - 6, escapeHtml(rLabel), { size: 10, fill: "#8a6d3b", weight: 600 });
        }
        // Nom du cercle : au-dessus, à l'extérieur (jamais posé sur le tracé).
        if (p.vertexLabels[0]) {
          out += figText(cxp, cyp - rp - 6, escapeHtml(p.vertexLabels[0]), { size: 11, weight: 700 });
        }
        return out;
      }

      // Polygones : rectangle / square / triangle / right_triangle / points libres
      const verts = shapePartVertices(p);
      const scr = verts.map((v) => ({ x: X(v.x), y: Y(v.y) }));
      const cxg = scr.reduce((s, v) => s + v.x, 0) / scr.length;
      const cyg = scr.reduce((s, v) => s + v.y, 0) / scr.length;
      out += `<polygon points="${scr.map((v) => `${num(v.x)},${num(v.y)}`).join(" ")}" ${fillStyle} ${style}/>`;

      // Marque d'angle droit
      if (p.rightAngleAt !== null && p.rightAngleAt >= 0 && p.rightAngleAt < scr.length) {
        const v = scr[p.rightAngleAt];
        const a = scr[(p.rightAngleAt + 1) % scr.length];
        const b = scr[(p.rightAngleAt + scr.length - 1) % scr.length];
        const u1 = normVec(a.x - v.x, a.y - v.y);
        const u2 = normVec(b.x - v.x, b.y - v.y);
        const s = 9;
        out += `<path d="M ${num(v.x + u1.x * s)} ${num(v.y + u1.y * s)} L ${num(v.x + (u1.x + u2.x) * s)} ${num(v.y + (u1.y + u2.y) * s)} L ${num(v.x + u2.x * s)} ${num(v.y + u2.y * s)}" fill="none" stroke="${color}" stroke-width="1.2"/>`;
      }

      // Étiquettes de sommets (décalées vers l'extérieur)
      verts.forEach((_, i) => {
        const label = p.vertexLabels[i];
        if (!label) return;
        const s = scr[i];
        const dx = s.x - cxg;
        const dy = s.y - cyg;
        const len = Math.hypot(dx, dy) || 1;
        out += figText(s.x + (dx / len) * 13, s.y + (dy / len) * 13 + 3, escapeHtml(label), { size: 11, weight: 700 });
      });

      // Étiquettes de côtés (au milieu de chaque arête, vers l'extérieur)
      scr.forEach((s, i) => {
        const label = p.sideLabels[i];
        if (!label) return;
        const nx = scr[(i + 1) % scr.length];
        const mx = (s.x + nx.x) / 2;
        const my = (s.y + nx.y) / 2;
        const dx = mx - cxg;
        const dy = my - cyg;
        const len = Math.hypot(dx, dy) || 1;
        out += figText(mx + (dx / len) * 12, my + (dy / len) * 12 + 3, escapeHtml(label), { size: 10, fill: "#8a6d3b", weight: 600 });
      });

      // Cotes automatiques pour un rectangle sans étiquettes de côté
      if (p.showDimensions && (p.kind === "rectangle" || p.kind === "square") && p.sideLabels.length === 0) {
        out +=
          figDimension(X(p.x), Y(p.y), X(p.x + p.w), Y(p.y), String(p.w), 15) +
          figDimension(X(p.x), Y(p.y), X(p.x), Y(p.y + p.h), String(p.h), -15);
      }
      if (p.showDimensions && (p.kind === "right_triangle") && p.sideLabels.length === 0) {
        out +=
          figDimension(X(p.x), Y(p.y), X(p.x + p.w), Y(p.y), String(p.w), 15) +
          figDimension(X(p.x), Y(p.y), X(p.x), Y(p.y + p.h), String(p.h), -15);
      }
      return out;
    })
    .join("");

  return `<figure class="course-figure course-figure-shape">${figOpen(W, H, { cell })}${body}</svg><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function normVec(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

/** Preset Pythagore : triangle rectangle + les carrés des 3 côtés, assemblés
 * à partir de formes simples (aucune coordonnée laissée au modèle). */
function renderPythagorasShape(
  block: Extract<StructuredCourseBlock, { type: "shape" }>,
): string {
  const a = Math.max(1, block.a);
  const b = Math.max(1, block.b);
  const cell = Math.max(11, Math.min(22, Math.floor(132 / Math.max(a, b))));
  const A = a * cell;
  const B = b * cell;
  const PAD = 2 * cell; // multiple du pas → carrés calés + marge pour le carré c²
  const tx = A + PAD;
  const ty = a * cell + b * cell + PAD;
  const W = 2 * A + B + 2 * PAD;
  const H = A + 2 * B + 2 * PAD;
  const poly = (pts: string, color: string) =>
    `<polygon points="${pts}" fill="${color}" fill-opacity="${SHAPE_FILL_OPACITY}" stroke="${color}" stroke-width="${FIG_STROKE}" stroke-linejoin="round"/>`;
  const sqA = poly(`${num(-A)},${num(-A)} 0,${num(-A)} 0,0 ${num(-A)},0`, FIGURE_PALETTE.blue) + figText(-A / 2, -A / 2 + 4, "a²", { weight: 800, size: 15 });
  const sqB = poly(`0,0 ${num(B)},0 ${num(B)},${num(B)} 0,${num(B)}`, FIGURE_PALETTE.green) + figText(B / 2, B / 2 + 4, "b²", { weight: 800, size: 15 });
  const h = Math.hypot(A, B);
  const ndx = A / h;
  const ndy = -B / h;
  const sqC =
    poly(
      `0,${num(-A)} ${num(B)},0 ${num(B + ndx * h)},${num(ndy * h)} ${num(ndx * h)},${num(-A + ndy * h)}`,
      FIGURE_PALETTE.red,
    ) + figText((A + B) / 2, -(A + B) / 2 + 4, "c²", { weight: 800, size: 15 });
  const tri = poly(`0,0 0,${num(-A)} ${num(B)},0`, FIGURE_PALETTE.navy);
  const ra = `<path d="M 10 0 L 10 -10 L 0 -10" fill="none" stroke="${FIG.ink}" stroke-width="1.2"/>`;
  return `<figure class="course-figure course-figure-shape">${figOpen(W, H, { cell })}<g transform="translate(${num(tx)} ${num(ty)})">${sqA}${sqB}${sqC}${tri}${ra}</g></svg><figcaption>${escapeHtml(block.caption)} ($a=${block.a}$, $b=${block.b}$, $c=${Math.hypot(a, b).toFixed(2)}$)</figcaption></figure>`;
}

function renderAreaDecomposer(
  block: Extract<StructuredCourseBlock, { type: "area_decomposer" }>,
): string {
  const shapes = block.shapes.slice(0, 6);
  const total = shapes.reduce((a, s) => a + s.width * s.height, 0);
  const GAPu = 1; // 1 carreau entre deux formes
  const spanU =
    shapes.reduce((a, s) => a + s.width, 0) + GAPu * (shapes.length - 1);
  const maxHu = Math.max(...shapes.map((s) => s.height), 1);
  // Pas de la grille = 1 unité ; borné pour que la figure reste compacte.
  const cell = Math.max(9, Math.min(24, Math.floor(Math.min(300 / spanU, 150 / maxHu))));
  const PAD = cell * Math.ceil(22 / cell); // multiple du pas → formes calées sur les carreaux
  const baselineY = PAD + maxHu * cell;
  let ux = 0;
  const parts = shapes
    .map((s) => {
      const x = PAD + ux * cell;
      const w = s.width * cell;
      const h = s.height * cell;
      const y = baselineY - h;
      ux += s.width + GAPu;
      return (
        `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${FIGURE_PALETTE.blue}" fill-opacity="${SHAPE_FILL_OPACITY}" stroke="${FIGURE_PALETTE.blue}" stroke-width="${FIG_STROKE}"/>` +
        figText(x + w / 2, y + h / 2 + 4, escapeHtml(s.label), { size: 12, weight: 700 }) +
        figDimension(x, baselineY, x + w, baselineY, `${s.width}`, 14) +
        figDimension(x, y + h, x, y, `${s.height}`, -14)
      );
    })
    .join("");
  const W = PAD * 2 + spanU * cell;
  const H = baselineY + PAD;
  return `<figure class="course-figure course-figure-area-decomposer">${figOpen(W, H, { cell })}${parts}</svg><figcaption>${escapeHtml(block.caption)} (aire totale : ${total})</figcaption></figure>`;
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
    ticks.push(`<line x1="${num(tx)}" y1="30" x2="${num(tx)}" y2="38" stroke="${FIG.inkSoft}" stroke-width="1"/>${figText(tx, 51, `10${toSuperscript(e)}`, { size: 9.5, fill: FIG.inkSoft })}`);
  }
  const svg = `<svg class="sci-notation-svg edu-fig-svg" viewBox="0 0 ${width} 60" xmlns="http://www.w3.org/2000/svg" role="img" data-min-exp="${minExp}" data-max-exp="${maxExp}" data-width="${width}">${figArrowDefs()}<rect x="0" y="0" width="${num(width)}" height="60" fill="${FIG.paper}"/><line x1="20" y1="34" x2="${width - 20}" y2="34" stroke="${FIG.ink}" stroke-width="1.5"/>${ticks.join("")}<circle class="sci-notation-handle" cx="${num(x)}" cy="34" r="7" fill="${FIGURE_PALETTE.red}" stroke="#fff" stroke-width="1.5" role="button" tabindex="0"/></svg>`;
  const controls = `<div class="sci-notation-controls">Valeur : <span class="sci-notation-value">${block.value} × 10<sup class="sci-notation-exp">${block.exponent}</sup></span></div>`;
  return `<figure class="course-figure course-figure-sci-notation" data-value="${block.value}">${svg}${controls}<figcaption>${escapeHtml(block.caption)}, fais glisser le point pour changer la puissance de 10</figcaption></figure>`;
}

function renderEquationBalancer(
  block: Extract<StructuredCourseBlock, { type: "equation_balancer" }>,
): string {
  // Les deux membres sont égaux (c'est une équation) → balance à l'équilibre.
  const join = (terms: string[]) =>
    terms.reduce((acc, t, i) => {
      if (i === 0) return t;
      const neg = /^-/.test(t.trim());
      return `${acc} ${neg ? "−" : "+"} ${t.trim().replace(/^-/, "")}`;
    }, "");
  const svg = balanceScaleSvg(join(block.leftTerms), join(block.rightTerms), 0);
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
  const gold = FIG.accent;
  const overlay =
    `<polygon points="${num(meta.sx(x1))},${num(meta.sy(y1))} ${num(meta.sx(x2))},${num(meta.sy(y1))} ${num(meta.sx(x2))},${num(meta.sy(y2))}" fill="${gold}" fill-opacity="0.16" stroke="${gold}" stroke-width="1.4"/>` +
    figText((meta.sx(x1) + meta.sx(x2)) / 2, meta.sy(y1) + 13, "1", { size: 10, weight: 600, fill: "#8a6d3b" }) +
    figText(meta.sx(x2) + 8, (meta.sy(y1) + meta.sy(y2)) / 2 + 3, String(block.a), { size: 10, weight: 600, fill: "#8a6d3b", anchor: "start" });
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
  // "0*x" ne sert que de repère : on retire la courbe plate y=0 (grosse ligne
  // noire parasite), les axes restent.
  return `<figure class="course-figure course-figure-graph">${stripFlatCurve(svg)}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function stripFlatCurve(svg: string): string {
  return svg.replace(/<path class="g-curve"[^>]*\/>/g, "");
}

function renderIntervalBuilder(
  block: Extract<StructuredCourseBlock, { type: "interval_builder" }>,
): string {
  const width = 264;
  const H = 56;
  const y = 34;
  const sx = (v: number) => 22 + ((v - block.min) / (block.max - block.min || 1)) * (width - 44);
  const x1 = sx(block.lowerBound), x2 = sx(block.upperBound);
  const line = `<line x1="14" y1="${y}" x2="${width - 14}" y2="${y}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}" marker-end="url(#efig-arrow)"/>`;
  const highlight = `<line x1="${num(x1)}" y1="${y}" x2="${num(x2)}" y2="${y}" stroke="${FIGURE_PALETTE.blue}" stroke-width="4.5" stroke-linecap="round"/>`;
  const endpoint = (x: number, open: boolean) =>
    `<circle cx="${num(x)}" cy="${y}" r="5" fill="${open ? "#fff" : FIGURE_PALETTE.blue}" stroke="${FIGURE_PALETTE.blue}" stroke-width="2"/>`;
  const labels = figText(x1, y - 11, String(block.lowerBound), { size: 10, weight: 600 }) + figText(x2, y - 11, String(block.upperBound), { size: 10, weight: 600 });
  return `<figure class="course-figure course-figure-interval">${figOpen(width, H, { grid: false })}${line}${highlight}${endpoint(x1, block.lowerOpen)}${endpoint(x2, block.upperOpen)}${labels}</svg><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
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
  return `<figure class="course-figure course-figure-graph">${stripFlatCurve(svg)}${toggle}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
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
      `<line x1="${num(inner.x)}" y1="${num(inner.y)}" x2="${num(outer.x)}" y2="${num(outer.y)}" stroke="${FIG.ink}" stroke-width="${i % 3 === 0 ? 2 : 1}"/>`,
    );
    const hourNumber = i === 0 ? 12 : i;
    ticks.push(figText(label.x, label.y + 4, String(hourNumber), { size: i % 3 === 0 ? 12 : 10, weight: 600 }));
  }
  const hourAngle = ((block.hours % 12) + block.minutes / 60) * 30;
  const minuteAngle = block.minutes * 6;
  const hourHand = trigPoint(cx, cy, r * 0.5, 90 - hourAngle);
  const minuteHand = trigPoint(cx, cy, r * 0.78, 90 - minuteAngle);
  const face = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/>`;
  const hands = `<line class="clock-hour-hand" x1="${cx}" y1="${cy}" x2="${num(hourHand.x)}" y2="${num(hourHand.y)}" stroke="${FIG.ink}" stroke-width="4" stroke-linecap="round"/><line class="clock-minute-hand" x1="${cx}" y1="${cy}" x2="${num(minuteHand.x)}" y2="${num(minuteHand.y)}" stroke="${FIGURE_PALETTE.blue}" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4" fill="${FIG.ink}"/>`;
  const svg = `<svg class="clock-svg edu-fig-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" data-hours="${block.hours}" data-minutes="${block.minutes}">${figPaper(200, 200, 20)}${face}${ticks.join("")}<g class="clock-hands">${hands}</g></svg>`;
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
      slices.push(
        `<path d="M ${num(cx)} ${num(cy)} L ${num(start.x)} ${num(start.y)} A ${r} ${r} 0 ${largeArc} 1 ${num(end.x)} ${num(end.y)} Z" fill="${filled ? FIGURE_PALETTE.blue : "#ffffff"}" fill-opacity="${filled ? 0.85 : 1}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/>`,
      );
      startAngle = endAngle;
    }
    svg = `${figOpen(160, 160, { grid: false })}${slices.join("")}</svg>`;
  } else {
    const width = 244;
    const height = 64;
    const cellWidth = (width - 8) / denominator;
    const cells: string[] = [];
    for (let i = 0; i < denominator; i++) {
      const filled = i < numerator;
      cells.push(
        `<rect x="${num(4 + i * cellWidth)}" y="4" width="${num(cellWidth)}" height="${height - 8}" fill="${filled ? FIGURE_PALETTE.blue : "#ffffff"}" fill-opacity="${filled ? 0.85 : 1}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/>`,
      );
    }
    svg = `${figOpen(width, height, { grid: false })}${cells.join("")}</svg>`;
  }
  const label = `<div class="fraction-label">${numerator} / ${denominator}</div>`;
  return `<figure class="course-figure course-figure-fraction">${svg}${label}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderPieChart(
  block: Extract<StructuredCourseBlock, { type: "pie_chart" }>,
): string {
  const cx = 80;
  const cy = 80;
  const r = 62;
  const total = block.slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  let startAngle = -90;
  // Camembert centré + pourcentage court à l'intérieur de la part ; les noms
  // (souvent longs : « Musique », « Théâtre »...) vont dans une légende HTML
  // sous la figure au lieu de déborder du cadre SVG.
  const legendItems: string[] = [];
  const parts = block.slices.map((slice) => {
    const sweep = (slice.value / total) * 360;
    const endAngle = startAngle + sweep;
    const start = trigPoint(cx, cy, r, -startAngle);
    const end = trigPoint(cx, cy, r, -endAngle);
    const largeArc = sweep > 180 ? 1 : 0;
    const midAngle = -(startAngle + endAngle) / 2;
    const inner = trigPoint(cx, cy, r * 0.6, midAngle);
    const percent = Math.round((slice.value / total) * 100);
    const color = FIGURE_PALETTE[slice.tone];
    legendItems.push(
      `<li><span class="pie-legend-dot" style="background:${color}"></span>${escapeHtml(slice.label)} : ${percent}%</li>`,
    );
    const path =
      sweep >= 359.99
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="0.8" stroke="#fff" stroke-width="1.5"/>`
        : `<path d="M ${num(cx)} ${num(cy)} L ${num(start.x)} ${num(start.y)} A ${r} ${r} 0 ${largeArc} 1 ${num(end.x)} ${num(end.y)} Z" fill="${color}" fill-opacity="0.8" stroke="#fff" stroke-width="1.5"/>`;
    const label =
      percent >= 8
        ? `<text x="${num(inner.x)}" y="${num(inner.y + 3)}" font-size="10" font-weight="600" text-anchor="middle" fill="#0f1e3a">${percent}%</text>`
        : "";
    startAngle = endAngle;
    return path + label;
  });
  const svg = `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" role="img">${parts.join("")}</svg>`;
  const legend = `<ul class="pie-legend">${legendItems.join("")}</ul>`;
  return `<figure class="course-figure course-figure-pie-chart">${svg}${legend}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderNumberLine(
  block: Extract<StructuredCourseBlock, { type: "number_line" }>,
): string {
  const min = Math.min(block.min, block.max);
  const max = Math.max(block.min, block.max);
  const span = max - min || 1;
  const W = 260;
  const H = 76;
  const left = 24;
  const right = W - 24;
  const y = 40;
  const toX = (value: number) => left + ((value - min) / span) * (right - left);
  const showTicks = span <= 16 && Number.isInteger(min) && Number.isInteger(max);
  const ticks = showTicks
    ? Array.from({ length: Math.round(span) + 1 }, (_, index) => min + index)
        .map(
          (value) =>
            `<line x1="${num(toX(value))}" y1="${y - 5}" x2="${num(toX(value))}" y2="${y + 5}" stroke="${FIG.inkSoft}" stroke-width="1"/>` +
            figText(toX(value), y + 18, String(value), { size: 9, fill: FIG.inkSoft }),
        )
        .join("")
    : "";
  const line = `<line x1="${left - 12}" y1="${y}" x2="${right + 12}" y2="${y}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}" marker-end="url(#efig-arrow)"/>`;
  const intervals = block.intervals
    .map((interval) => {
      const x1 = toX(Math.max(interval.from, min));
      const x2 = toX(Math.min(interval.to, max));
      const color = FIGURE_PALETTE[interval.tone];
      const bracket = (x: number, included: boolean) =>
        included
          ? `<circle cx="${num(x)}" cy="${y}" r="4" fill="${color}"/>`
          : `<circle cx="${num(x)}" cy="${y}" r="4" fill="#fff" stroke="${color}" stroke-width="1.75"/>`;
      return `<line x1="${num(x1)}" y1="${y}" x2="${num(x2)}" y2="${y}" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/>${bracket(x1, interval.fromIncluded)}${bracket(x2, interval.toIncluded)}`;
    })
    .join("");
  const points = block.points
    .map((point) => {
      const x = toX(clampNumber(point.value, min, max));
      return `<circle cx="${num(x)}" cy="${y}" r="4.5" fill="${point.filled ? FIG.ink : "#fff"}" stroke="${FIG.ink}" stroke-width="1.75"/>${figText(x, y - 11, escapeHtml(point.label), { size: 10, weight: 600 })}`;
    })
    .join("");
  return `<figure class="course-figure course-figure-number-line">${figOpen(W, H, { grid: false })}${line}${ticks}${intervals}${points}</svg><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function renderBarChart(
  block: Extract<StructuredCourseBlock, { type: "bar_chart" }>,
): string {
  const bars = block.bars;
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);
  const W = 230;
  const H = 165;
  const chartLeft = 22;
  const chartRight = W - 14;
  const chartTop = 16;
  const chartBottom = 132;
  const slotWidth = (chartRight - chartLeft) / bars.length;
  const barWidth = Math.min(34, slotWidth * 0.58);
  const gridSteps = 4;
  const valueGrid = Array.from({ length: gridSteps + 1 }, (_, index) => {
    const yy = chartTop + ((chartBottom - chartTop) * index) / gridSteps;
    return `<line x1="${chartLeft}" y1="${num(yy)}" x2="${chartRight}" y2="${num(yy)}" stroke="${FIG.grid}" stroke-width="1"/>`;
  }).join("");
  const axis = `<line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/>`;
  const parts = bars
    .map((bar, index) => {
      const height = (bar.value / maxValue) * (chartBottom - chartTop);
      const x = chartLeft + index * slotWidth + (slotWidth - barWidth) / 2;
      const yTop = chartBottom - height;
      const color = FIGURE_PALETTE[bar.tone];
      return (
        `<rect x="${num(x)}" y="${num(yTop)}" width="${num(barWidth)}" height="${num(height)}" rx="2" fill="${color}" fill-opacity="0.85" stroke="${color}" stroke-width="1"/>` +
        figText(x + barWidth / 2, yTop - 5, String(bar.value), { size: 10, weight: 700 }) +
        figText(x + barWidth / 2, chartBottom + 14, escapeHtml(bar.label), { size: 9.5, fill: FIG.inkSoft })
      );
    })
    .join("");
  return `<figure class="course-figure course-figure-bar-chart">${figOpen(W, H, { grid: false })}${valueGrid}${axis}${parts}</svg><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

/**
 * Courbe d'évolution : une à quatre séries sur un axe commun.
 *
 * Le bar_chart ne rendait pas la continuité d'une évolution, et le graph ne
 * sait tracer qu'une expression — pas des relevés (températures par mois,
 * termes d'une suite). Même grammaire visuelle que renderBarChart : grille
 * horizontale légère, axes sobres, étiquettes en dessous.
 */
function renderLineChart(
  block: Extract<StructuredCourseBlock, { type: "line_chart" }>,
): string {
  const W = 250;
  const H = 175;
  const left = 30;
  const right = W - 12;
  const top = 16;
  const bottom = 128;

  const all = block.series.flatMap((s) => s.values);
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  // Un palier plat (toutes les valeurs égales) donnerait une hauteur nulle.
  const min = rawMin === rawMax ? rawMin - 1 : rawMin;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax;
  const count = Math.max(...block.series.map((s) => s.values.length));

  const xAt = (i: number) => left + (count <= 1 ? 0 : ((right - left) * i) / (count - 1));
  const yAt = (v: number) => bottom - ((v - min) / (max - min)) * (bottom - top);

  const gridSteps = 4;
  const grid = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const y = top + ((bottom - top) * i) / gridSteps;
    const value = max - ((max - min) * i) / gridSteps;
    return (
      `<line x1="${left}" y1="${num(y)}" x2="${right}" y2="${num(y)}" stroke="${FIG.grid}" stroke-width="1"/>` +
      figText(left - 5, y + 3, String(Math.round(value * 10) / 10), { size: 8.5, anchor: "end", fill: FIG.inkSoft })
    );
  }).join("");

  const axes =
    `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/>` +
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/>`;

  const curves = block.series
    .map((serie) => {
      const color = FIGURE_PALETTE[serie.tone];
      const path = serie.values.map((v, i) => `${i === 0 ? "M" : "L"} ${num(xAt(i))} ${num(yAt(v))}`).join(" ");
      const dots = serie.values
        .map((v, i) => `<circle cx="${num(xAt(i))}" cy="${num(yAt(v))}" r="2.4" fill="${color}"/>`)
        .join("");
      return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
    })
    .join("");

  // Étiquettes d'abscisse : on n'en affiche qu'une sur n pour ne pas les
  // empiler quand la série est longue (12 mois sur 250 px).
  const step = Math.ceil(count / 6);
  const xLabels = block.xValues
    .map((label, i) => (i % step === 0 ? figText(xAt(i), bottom + 13, escapeHtml(label), { size: 8.5, fill: FIG.inkSoft }) : ""))
    .join("");

  const legend = block.series
    .filter((s) => s.name)
    .map((serie, i) => {
      const color = FIGURE_PALETTE[serie.tone];
      const y = H - 20 + i * 0;
      const x = left + i * 78;
      return (
        `<line x1="${num(x)}" y1="${num(y)}" x2="${num(x + 14)}" y2="${num(y)}" stroke="${color}" stroke-width="2"/>` +
        figText(x + 18, y + 3.5, escapeHtml(serie.name), { size: 9, anchor: "start", fill: FIG.inkSoft })
      );
    })
    .join("");

  const axisTitles =
    (block.yLabel ? figText(left - 22, top + 4, escapeHtml(block.yLabel), { size: 8.5, anchor: "start", fill: FIG.inkSoft }) : "") +
    (block.xLabel ? figText((left + right) / 2, bottom + 27, escapeHtml(block.xLabel), { size: 8.5, fill: FIG.inkSoft }) : "");

  return `<figure class="course-figure course-figure-line-chart">${figOpen(W, H, { grid: false })}${grid}${axes}${curves}${xLabels}${axisTitles}${legend}</svg><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

/**
 * Nuage de points. Mêmes axes et même grille que la courbe d'évolution, sans
 * ligne de liaison : c'est la dispersion qu'on veut donner à voir.
 */
function renderScatterPlot(
  block: Extract<StructuredCourseBlock, { type: "scatter_plot" }>,
): string {
  const W = 250;
  const H = 170;
  const left = 30;
  const right = W - 12;
  const top = 16;
  const bottom = 130;

  const xs = block.points.map((p) => p.x);
  const ys = block.points.map((p) => p.y);
  const span = (values: number[]) => {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
  };
  const [xMin, xMax] = span(xs);
  const [yMin, yMax] = span(ys);

  const xAt = (v: number) => left + ((v - xMin) / (xMax - xMin)) * (right - left);
  const yAt = (v: number) => bottom - ((v - yMin) / (yMax - yMin)) * (bottom - top);

  const gridSteps = 4;
  const grid = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const y = top + ((bottom - top) * i) / gridSteps;
    const value = yMax - ((yMax - yMin) * i) / gridSteps;
    return (
      `<line x1="${left}" y1="${num(y)}" x2="${right}" y2="${num(y)}" stroke="${FIG.grid}" stroke-width="1"/>` +
      figText(left - 5, y + 3, String(Math.round(value * 10) / 10), { size: 8.5, anchor: "end", fill: FIG.inkSoft })
    );
  }).join("");

  const axes =
    `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/>` +
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/>`;

  const dots = block.points
    .map((p) => `<circle cx="${num(xAt(p.x))}" cy="${num(yAt(p.y))}" r="3" fill="${FIGURE_PALETTE.blue}" fill-opacity="0.75" stroke="${FIGURE_PALETTE.blue}" stroke-width="1"/>`)
    .join("");

  const titles =
    (block.yLabel ? figText(left - 22, top + 4, escapeHtml(block.yLabel), { size: 8.5, anchor: "start", fill: FIG.inkSoft }) : "") +
    (block.xLabel ? figText((left + right) / 2, bottom + 24, escapeHtml(block.xLabel), { size: 8.5, fill: FIG.inkSoft }) : "") +
    figText(left, bottom + 13, String(Math.round(xMin * 10) / 10), { size: 8.5, fill: FIG.inkSoft }) +
    figText(right, bottom + 13, String(Math.round(xMax * 10) / 10), { size: 8.5, fill: FIG.inkSoft });

  return `<figure class="course-figure course-figure-scatter-plot">${figOpen(W, H, { grid: false })}${grid}${axes}${dots}${titles}</svg><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

/**
 * Schéma d'algorithme : étapes empilées, losange pour un test, flèche de
 * retour pour une boucle. Indispensable aux chapitres d'algorithmique, où le
 * texte seul décrit mal un enchaînement.
 */
function renderFlowchart(
  block: Extract<StructuredCourseBlock, { type: "flowchart" }>,
): string {
  const W = 240;
  const boxW = 128;
  const boxH = 26;
  const gap = 20;
  const cx = W / 2 + 12;
  const top = 14;
  const H = top + block.nodes.length * (boxH + gap) + 6;

  const yOf = (i: number) => top + i * (boxH + gap);

  const shapes = block.nodes
    .map((node, i) => {
      const y = yOf(i);
      const color =
        node.kind === "condition" ? FIGURE_PALETTE.gold
        : node.kind === "start" || node.kind === "end" ? FIGURE_PALETTE.green
        : FIGURE_PALETTE.blue;

      const body =
        node.kind === "condition"
          ? `<path d="M ${num(cx)} ${num(y)} L ${num(cx + boxW / 2)} ${num(y + boxH / 2)} L ${num(cx)} ${num(y + boxH)} L ${num(cx - boxW / 2)} ${num(y + boxH / 2)} Z" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-width="${FIG_STROKE}"/>`
          : `<rect x="${num(cx - boxW / 2)}" y="${num(y)}" width="${boxW}" height="${boxH}" rx="${node.kind === "start" || node.kind === "end" ? boxH / 2 : 5}" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-width="${FIG_STROKE}"/>`;

      const arrow =
        i < block.nodes.length - 1
          ? `<line x1="${num(cx)}" y1="${num(y + boxH)}" x2="${num(cx)}" y2="${num(yOf(i + 1) - 3)}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}" marker-end="url(#efig-arrow)"/>`
          : "";

      return body + figText(cx, y + boxH / 2 + 3.5, escapeHtml(node.label), { size: 9, weight: 600 }) + arrow;
    })
    .join("");

  // Flèche de retour : elle contourne la colonne par la gauche.
  let loop = "";
  if (block.loopFrom !== null && block.loopTo !== null && block.loopFrom !== block.loopTo) {
    const yFrom = yOf(block.loopFrom) + boxH / 2;
    const yTo = yOf(block.loopTo) + boxH / 2;
    const x = cx - boxW / 2 - 14;
    loop =
      `<path d="M ${num(cx - boxW / 2)} ${num(yFrom)} L ${num(x)} ${num(yFrom)} L ${num(x)} ${num(yTo)} L ${num(cx - boxW / 2 - 2)} ${num(yTo)}" ` +
      `fill="none" stroke="${FIG.accent}" stroke-width="${FIG_STROKE}" stroke-dasharray="4 3" marker-end="url(#efig-arrow)"/>`;
  }

  return `<figure class="course-figure course-figure-flowchart">${figOpen(W, H, { grid: false })}${loop}${shapes}</svg><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}

function renderProbabilityTree(
  block: Extract<StructuredCourseBlock, { type: "probability_tree" }>,
): string {
  const branches = block.branches;
  const leafCounts = branches.map((branch) => Math.max(1, branch.children.length));
  const totalLeaves = leafCounts.reduce((sum, count) => sum + count, 0);
  const rowHeight = 34;
  const contentH = totalLeaves * rowHeight;
  const marginY = 16;
  const height = contentH + marginY * 2;
  const W = 300;
  const rootX = 14;
  const branchX = 118;
  const leafX = 234;
  const rootY = height / 2;
  // Départ centré → l'arbre est symétrique autour de la racine.
  let cursorY = marginY;
  const segments: string[] = [];
  const along = (x1: number, y1: number, x2: number, y2: number, t: number) => ({
    x: x1 + (x2 - x1) * t,
    y: y1 + (y2 - y1) * t,
  });
  segments.push(`<circle cx="${rootX}" cy="${num(rootY)}" r="2.5" fill="${FIG.ink}"/>`);
  branches.forEach((branch) => {
    const leaves = branch.children.length > 0 ? branch.children : [{ label: "", probability: "" }];
    const branchTop = cursorY;
    const branchBottom = cursorY + leaves.length * rowHeight;
    const branchY = (branchTop + branchBottom) / 2;
    const bp = along(rootX, rootY, branchX, branchY, 0.5);
    segments.push(
      `<line x1="${rootX}" y1="${num(rootY)}" x2="${branchX}" y2="${num(branchY)}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/>`,
      `<circle cx="${branchX}" cy="${num(branchY)}" r="2.5" fill="${FIG.ink}"/>`,
      figText(bp.x, bp.y + (branchY <= rootY ? -5 : 12), escapeHtml(branch.probability), { size: 9, fill: "#8a6d3b", weight: 600 }),
      figText(branchX, branchY - (leaves.length > 1 ? 13 : 8), escapeHtml(branch.label), { size: 10, weight: 700, anchor: "middle" }),
    );
    if (branch.children.length > 0) {
      branch.children.forEach((leaf, leafIndex) => {
        const leafY = branchTop + leafIndex * rowHeight + rowHeight / 2;
        const lp = along(branchX, branchY, leafX, leafY, 0.5);
        // décalage perpendiculaire vers l'extérieur : symétrique haut/bas
        const perp = leafY <= branchY ? -5 : 12;
        segments.push(
          `<line x1="${branchX}" y1="${num(branchY)}" x2="${leafX}" y2="${num(leafY)}" stroke="${FIG.ink}" stroke-width="${FIG_STROKE}"/>`,
          figText(lp.x, lp.y + perp, escapeHtml(leaf.probability), { size: 9, fill: "#8a6d3b", weight: 600 }),
          figText(leafX + 6, leafY + 3.5, escapeHtml(leaf.label), { size: 10, anchor: "start" }),
        );
      });
    }
    cursorY = branchBottom;
  });
  const svg = `${figOpen(W, height, { grid: false })}${segments.join("")}</svg>`;
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

export function structuredExerciseQuestionSummary(
  question: StructuredExerciseQuestion,
): string {
  return structuredRichTextToPlainText(question.prompt);
}
