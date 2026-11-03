import { StructuredCourseBlock } from "@/lib/ai/structuredContent";
import { num, escapeHtml, figPaper, FIG, FIG_STROKE, FIGURE_PALETTE, figText, figOpen, figArrowDefs, SHAPE_FILL_OPACITY, figDimension, Pt, geoAux, geoVertex, geoLabel, moneySvg } from "./compilerSvg";
import { buildGraphSvg } from "@/lib/mathGraph";
import { evaluate as evaluateMathExpr } from "mathjs";
import { encodeJsxSpec } from "@/lib/jsxFigure";


export function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}


/** Point sur un cercle en convention mathématique standard (0°=est,
 * antihoraire), contrairement à polarPoint (0°=est, horaire, utilisé par
 * "figure" pour des arcs SVG où l'axe y est inversé). */
export function trigPoint(
  cx: number,
  cy: number,
  radius: number,
  angleDegrees: number,
): { x: number; y: number } {
  const radians = (angleDegrees * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy - radius * Math.sin(radians) };
}


/** Alias rétro-compat : quadrillage simple. */
export function gridBackground(width: number, height: number, step: number): string {
  return figPaper(width, height, step);
}


export const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵",
  "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺",
};

/** Exposant en vrais caractères unicode (10⁻⁶, x², …) pour les <text> SVG. */
export function toSuperscript(value: number | string): string {
  return String(value)
    .split("")
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join("");
}


export function renderCoinPurse(
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
export function balanceScaleSvg(leftLabel: string, rightLabel: string, tiltDeg: number): string {
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


export function renderBalanceScale(
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


export function parseGraphMeta(svg: string) {
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


export function injectIntoSvg(svg: string, extra: string): string {
  return svg.replace(/<\/svg>$/, `${extra}</svg>`);
}


export function safeEval(expr: string, scope: Record<string, number>): number | null {
  try {
    const v = evaluateMathExpr(expr, scope);
    return typeof v === "number" && isFinite(v) ? v : null;
  } catch {
    return null;
  }
}


export function renderGridPainter(
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


export const SHAPE_ICONS: Record<string, string> = {
  cercle: "circle", rond: "circle", carre: "square", carré: "square",
  triangle: "triangle", etoile: "star", étoile: "star",
};


export function shapeSvg(name: string): string {
  const key = SHAPE_ICONS[name.toLowerCase()] ?? "circle";
  if (key === "square") return `<rect x="6" y="6" width="28" height="28" fill="#2563eb"/>`;
  if (key === "triangle") return `<polygon points="20,6 34,34 6,34" fill="#15803d"/>`;
  if (key === "star") return `<polygon points="20,4 24,16 37,16 26,24 30,36 20,28 10,36 14,24 3,16 16,16" fill="#c89f36"/>`;
  return `<circle cx="20" cy="20" r="15" fill="#dc2626"/>`;
}


export function renderPatternMaker(
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


export function renderRulerMeasurer(
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


export function renderTapeDiagram(
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


/** Pyramide de briques (sommet en premier), dans le système de figures Educalcul : feuille quadrillée, briques calées sur
 * les carreaux, aplats translucides + contour plein. Une brique « {{n}} » est un emplacement de réponse (champ dans le
 * lecteur) ; une brique « » est une brique vide à repérer (« ? »). */
export function renderBrickPyramid(
  block: Extract<StructuredCourseBlock, { type: "brick_pyramid" }>,
): string {
  const rows = block.levels.length;
  const bw = 60;
  const bh = 40;
  const width = Math.max(260, (rows * bw) + 40);
  const height = rows * bh + 40;
  const bricks = block.levels
    .map((row, r) => {
      const x0 = (width - row.length * bw) / 2;
      const y = 20 + r * bh;
      return row
        .map((value, c) => {
          const x = x0 + c * bw;
          const slot = /^\{\{\d+\}\}$/.test(value.trim());
          if (slot || !value) {
            return (
              `<rect x="${num(x)}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="#ffffff" fill-opacity="0.9" stroke="${FIG.accent}" stroke-width="${FIG_STROKE}"${slot ? "" : ' stroke-dasharray="5 4"'}/>` +
              figText(x + bw / 2, y + bh / 2 + 5, slot ? escapeHtml(value.trim()) : "?", { size: 15, weight: 600, fill: FIG.inkSoft, slotW: bw - 12, slotH: bh - 12 })
            );
          }
          return (
            `<rect x="${num(x)}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${FIGURE_PALETTE.green}" fill-opacity="${SHAPE_FILL_OPACITY}" stroke="${FIGURE_PALETTE.green}" stroke-width="${FIG_STROKE}"/>` +
            figText(x + bw / 2, y + bh / 2 + 5, escapeHtml(value), { size: 15, weight: 700 })
          );
        })
        .join("");
    })
    .join("");
  const svg = `${figOpen(width, height)}${bricks}</svg>`;
  return `<figure class="course-figure course-figure-brick-pyramid">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}


/** Grille à compléter (carré magique, tableau de nombres) : cases calées sur les carreaux, cases à remplir en teinte dorée. */
export function renderFillGrid(
  block: Extract<StructuredCourseBlock, { type: "fill_grid" }>,
): string {
  const cell = 40;
  const cols = block.cells[0].length;
  const width = Math.max(200, cols * cell + 60);
  const height = block.cells.length * cell + 40;
  const x0 = Math.round((width - cols * cell) / 40) * 20;
  const cells = block.cells
    .map((row, r) =>
      row
        .map((value, c) => {
          const x = x0 + c * cell;
          const y = 20 + r * cell;
          const slot = /^\{\{\d+\}\}$/.test(value.trim());
          if (slot || !value) {
            return (
              `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${FIG.accent}" fill-opacity="0.12" stroke="${FIGURE_PALETTE.navy}" stroke-width="${FIG_STROKE}"/>` +
              (slot ? figText(x + cell / 2, y + cell / 2 + 5, escapeHtml(value.trim()), { size: 15, slotW: cell - 8, slotH: cell - 10 }) : "")
            );
          }
          return (
            `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#ffffff" stroke="${FIGURE_PALETTE.navy}" stroke-width="${FIG_STROKE}"/>` +
            figText(x + cell / 2, y + cell / 2 + 5, escapeHtml(value), { size: 16, weight: 700 })
          );
        })
        .join(""),
    )
    .join("");
  const svg = `${figOpen(width, height)}${cells}</svg>`;
  return `<figure class="course-figure course-figure-fill-grid">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}


export function renderJsxFigure(block: Extract<StructuredCourseBlock, { type: "jsx_figure" }>): string {
  const spec = block.spec;
  return `<figure class="course-figure course-figure-jsx"><div class="jsx-board" data-jsx-spec="${escapeAttribute(encodeJsxSpec(spec))}" style="width:100%"></div><figcaption>${escapeHtml(spec.caption)}</figcaption></figure>`;
}


export function renderLabeledCircle(block: Extract<StructuredCourseBlock, { type: "labeled_circle" }>): string {
  const L = block.labels;
  const cx = 120;
  const cy = 100;
  const r = 60;
  const radius = L.radius !== undefined;
  const diameter = L.diameter !== undefined;
  const tip: Pt = [cx + r * Math.cos(-0.6), cy + r * Math.sin(-0.6)];
  const body =
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${FIGURE_PALETTE.navy}" fill-opacity="${SHAPE_FILL_OPACITY}" stroke="${FIGURE_PALETTE.navy}" stroke-width="${FIG_STROKE}"/>` +
    (diameter ? geoAux([cx - r, cy], [cx + r, cy]) : "") +
    (radius && !diameter ? geoAux([cx, cy], tip) : "") +
    `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${FIGURE_PALETTE.navy}"/>` + geoVertex(cx - 6, cy + 16, "O") +
    (diameter ? geoLabel(cx, cy - 8, L.diameter ?? "") : "") +
    (radius && !diameter ? geoLabel((cx + tip[0]) / 2 + 10, (cy + tip[1]) / 2 - 6, L.radius ?? "") : "");
  const svg = `${figOpen(240, 200)}${body}</svg>`;
  return `<figure class="course-figure course-figure-labeled-circle">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}


export function renderFractionStrips(
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


export function renderPlaceValueChart(
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
    .map((_, i) => `<th>${intLabels[i] ?? `10^${i}`}</th>`)
    .reverse();
  const decCells = decDigits.map((_, i) => `<th>${decLabels[i] ?? `10^-${i + 1}`}</th>`);
  const intValues = intDigits.map((d) => `<td>${escapeHtml(d)}</td>`);
  const decValues = decDigits.map((d) => `<td>${escapeHtml(d)}</td>`);
  const sep = decDigits.length ? `<th>,</th>` : "";
  const sepVal = decDigits.length ? `<td>,</td>` : "";
  return `<figure class="course-figure course-figure-place-value"><table class="math-table"><thead><tr>${intCells.join("")}${sep}${decCells.join("")}</tr></thead><tbody><tr>${intValues.join("")}${sepVal}${decValues.join("")}</tr></tbody></table><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}


export function renderRatioMixer(
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


export function renderNetFolder(
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


export function renderInteractiveProtractor(
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


export function renderCompassTool(
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


export function renderThermometerAxis(
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


export const TRIG_REMARKABLE = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];

export const TRIG_LABELS: Record<number, string> = {
  0: "0", 30: "π/6", 45: "π/4", 60: "π/3", 90: "π/2",
  120: "2π/3", 135: "3π/4", 150: "5π/6", 180: "π",
  210: "7π/6", 225: "5π/4", 240: "4π/3", 270: "3π/2",
  300: "5π/3", 315: "7π/4", 330: "11π/6",
};


/** Cercle trigonométrique : feuille quadrillée, cercle unité, axes, TOUS les
 * angles remarquables (les mis en avant par l'IA en gros/rouge + étiquette),
 * et un point mobile interactif (cf. trigCircleInteractive.ts). */
export function renderTrigCircle(
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


export function renderAreaDecomposer(
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


export function renderScientificNotationConverter(
  block: Extract<StructuredCourseBlock, { type: "scientific_notation_converter" }>,
): string {
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


export function renderEquationBalancer(
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


export function renderSlopeTriangle(
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


export function renderVectorAdditionPad(
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


export function stripFlatCurve(svg: string): string {
  return svg.replace(/<path class="g-curve"[^>]*\/>/g, "");
}


export function renderIntervalBuilder(
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


export function renderTangentScrubber(
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


export function renderSequenceCobweb(
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


export function renderIntegralRiemannSlider(
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


export function renderComplexPlanePolar(
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


export function renderAlgoSandbox(
  block: Extract<StructuredCourseBlock, { type: "algo_sandbox" }>,
): string {
  const isPython = block.language.toLowerCase() === "python";
  const runButton = isPython
    ? `<button type="button" class="algo-sandbox-run">▶ Exécuter</button>`
    : `<span class="algo-sandbox-readonly">(${escapeHtml(block.language)}, lecture seule)</span>`;
  return `<figure class="course-figure course-figure-algo-sandbox"><textarea class="algo-sandbox-code" spellcheck="false" ${isPython ? "" : "readonly"}>${escapeHtml(block.code)}</textarea><div class="algo-sandbox-toolbar">${runButton}</div><pre class="algo-sandbox-output" hidden></pre><figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}


export function renderClock(
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


export function renderFraction(
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


export function renderPieChart(
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


export function renderNumberLine(
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


export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}


export function renderBarChart(
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


export function renderBoxPlot(
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
