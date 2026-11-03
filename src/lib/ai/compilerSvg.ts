import { StructuredCourseBlock } from "@/lib/ai/structuredContent";


export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}



export const FIGURE_PALETTE = {
  navy: "#10213d",
  gold: "#c89f36",
  blue: "#2563eb",
  green: "#15803d",
  red: "#dc2626",
  gray: "#64748b",
} as const;


// ── Diagrammes déterministes ─────────────────────────────────────────────────
// La disposition géométrique (angles, échelles, positions) est calculée ici,
// jamais laissée à l'IA : c'est ce qui élimine la classe de bugs de "figure"
// (chevauchement de labels, débordement du viewBox). Le modèle ne fournit que
// des données sémantiques (valeurs, labels courts).

export function num(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}


// ── Système de figures Educalcul ────────────────────────────────────────────
// Toutes les figures partagent : une feuille blanche quadrillée (papier à
// petits carreaux), un cadre arrondi doré discret, la même palette, les mêmes
// épaisseurs de trait, des étiquettes avec halo blanc (lisibles par-dessus
// n'importe quel tracé), et des cotes (traits de mesure) pour donner l'ordre
// de grandeur. La carte extérieure .course-figure fournit l'effet liquid glass
// (globals.css). Objectif : cohérence visuelle d'une figure à l'autre.

export const FIG = {
  ink: "#0f1e3a",
  inkSoft: "rgba(15,30,58,0.5)",
  paper: "#ffffff",
  grid: "rgba(15,30,58,0.06)",
  gridBold: "rgba(15,30,58,0.12)",
  frame: "rgba(197,161,72,0.4)",
  accent: "#c89f36",
} as const;


export const FIG_STROKE = 1.75;


/** Motif de fond : feuille quadrillée + gros carreaux tous les 5, cadre doré.
 * `cell` est le pas de la petite grille en unités du viewBox. */
export function figPaper(width: number, height: number, cell = 20): string {
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


/** Marqueurs de flèche partagés (un id fixe : identiques partout). */
export function figArrowDefs(): string {
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
export function arrowAttrs(arrow: "none" | "end" | "both"): string {
  if (arrow === "end") return ' marker-end="url(#efig-arrow)"';
  if (arrow === "both") return ' marker-start="url(#efig-arrow-start)" marker-end="url(#efig-arrow)"';
  return "";
}


/** Portion de cercle (arc) : path SVG de startAngle à endAngle (degrés,
 * convention maths). `flipY` inverse le sens vertical (repères écran). */
export function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number, flipY = 1): string {
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
export function figText(
  x: number,
  y: number,
  content: string,
  opts: { size?: number; weight?: number; anchor?: "start" | "middle" | "end"; fill?: string; slotW?: number; slotH?: number } = {},
): string {
  const size = opts.size ?? 11;
  const weight = opts.weight ?? 500;
  const anchor = opts.anchor ?? "middle";
  const fill = opts.fill ?? FIG.ink;
  // Halo contrasté : blanc sous un texte foncé, foncé sous un texte clair
  // (sinon un « 10 € » blanc sur billet devenait un pâté blanc illisible).
  // Étiquette « {{n}} » : emplacement de réponse. Le lecteur y pose un champ de saisie (voir SlotHtml) ;
  // n'importe quelle figure (cote, sommet, valeur) devient ainsi dynamique sans type dédié.
  const slot = /^\{\{(\d+)\}\}$/.exec(content.trim());
  if (slot) {
    const w = opts.slotW ?? 44;
    const h = opts.slotH ?? 24;
    const cx = anchor === "start" ? x + w / 2 : anchor === "end" ? x - w / 2 : x;
    const cy = y - size * 0.32;
    return `<g class="fig-slot" data-slot="${slot[1]}"><rect x="${num(cx - w / 2)}" y="${num(cy - h / 2)}" width="${w}" height="${h}" rx="6" fill="#ffffff" fill-opacity="0.94" stroke="${FIG.accent}" stroke-width="1.4" stroke-dasharray="3 2"/></g>`;
  }
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
export function figDimension(
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
export function figOpen(width: number, height: number, opts: { grid?: boolean; cell?: number } = {}): string {
  const paper = opts.grid === false
    ? `<rect x="0" y="0" width="${num(width)}" height="${num(height)}" fill="${FIG.paper}"/>`
    : figPaper(width, height, opts.cell ?? 20);
  return `<svg class="edu-fig-svg" viewBox="0 0 ${num(width)} ${num(height)}" xmlns="http://www.w3.org/2000/svg" role="img">${figArrowDefs()}${paper}`;
}


export const SHAPE_FILL_OPACITY = "0.14";


export function formatCentimes(centimes: number): string {
  if (centimes % 100 === 0) return `${centimes / 100} €`;
  if (centimes >= 100) return `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
  return `${centimes} c`;
}


/** Couronne de 12 étoiles de l'UE, en arc, pour les billets et les pièces. */
export function euroStars(cx: number, cy: number, radius: number, count: number, size: number, from: number, to: number, color: string): string {
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
export function moneySvg(value: number): string {
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


/* ------------------------------------------------------------------ */
/*  Figures de géométrie dessinées par le code (positions calculées)    */
/*  Même système que `shape` : quadrillage, palette, trait 1,75, aplat   */
/*  0,14, cotes dorées (figDimension), étiquettes à halo (figText).     */
/*  Toute étiquette « {{n}} » devient un emplacement de réponse.        */
/* ------------------------------------------------------------------ */

export type Pt = [number, number];


export const geoEdge = (a: Pt, b: Pt, hidden = false): string =>
  `<line x1="${num(a[0])}" y1="${num(a[1])}" x2="${num(b[0])}" y2="${num(b[1])}" stroke="${FIGURE_PALETTE.navy}" stroke-width="${FIG_STROKE}" stroke-linecap="round"${hidden ? ` stroke-dasharray="5 4" opacity="0.55"` : ""}/>`;


export const geoPoly = (points: Pt[], filled = true): string =>
  `<polygon points="${points.map((p) => `${num(p[0])},${num(p[1])}`).join(" ")}" fill="${filled ? FIGURE_PALETTE.navy : "none"}" fill-opacity="${filled ? SHAPE_FILL_OPACITY : 0}" stroke="${FIGURE_PALETTE.navy}" stroke-width="${FIG_STROKE}" stroke-linejoin="round"/>`;


/** Trait auxiliaire (hauteur, rayon) : pointillé doré. */
export const geoAux = (a: Pt, b: Pt): string =>
  `<line x1="${num(a[0])}" y1="${num(a[1])}" x2="${num(b[0])}" y2="${num(b[1])}" stroke="${FIG.accent}" stroke-width="1.4" stroke-dasharray="4 3"/>`;


export const geoLabel = (x: number, y: number, text: string, anchor: "start" | "middle" | "end" = "middle"): string =>
  text ? figText(x, y, escapeHtml(text), { size: 11, weight: 600, fill: "#8a6d3b", anchor }) : "";


export const geoDim = (a: Pt, b: Pt, text: string, offset = 17): string =>
  text ? figDimension(a[0], a[1], b[0], b[1], text, offset) : "";


// Les noms des points (A, B, C, O...) ne s'écrivent pas dans la figure : ils vont dans l'énoncé.
export const geoVertex = (_x: number, _y: number, _text: string): string => "";


/** Carré d'angle droit au sommet `corner`, entre les directions unitaires `u` et `v`. */
export function geoRightAngle(corner: Pt, u: Pt, v: Pt, size = 10): string {
  const p1: Pt = [corner[0] + u[0] * size, corner[1] + u[1] * size];
  const p2: Pt = [p1[0] + v[0] * size, p1[1] + v[1] * size];
  const p3: Pt = [corner[0] + v[0] * size, corner[1] + v[1] * size];
  return `<path d="M ${num(p1[0])} ${num(p1[1])} L ${num(p2[0])} ${num(p2[1])} L ${num(p3[0])} ${num(p3[1])}" fill="none" stroke="${FIGURE_PALETTE.navy}" stroke-width="1.1"/>`;
}


export function renderSolid(block: Extract<StructuredCourseBlock, { type: "solid" }>): string {
  const L = block.labels;
  const W = 260;
  const H = 200;
  let body = "";

  switch (block.solid) {
    case "cube":
    case "box": {
      const cube = block.solid === "cube";
      const x0 = cube ? 60 : 40;
      const y0 = cube ? 80 : 80;
      const w = cube ? 80 : 120;
      const h = 80;
      const dx = cube ? 40 : 60;
      const dy = -40;
      const A: Pt = [x0, y0 + h];
      const B: Pt = [x0 + w, y0 + h];
      const C: Pt = [x0 + w, y0];
      const D: Pt = [x0, y0];
      const sh = (p: Pt): Pt => [p[0] + dx, p[1] + dy];
      body =
        geoEdge(A, sh(A), true) + geoEdge(sh(A), sh(B), true) + geoEdge(sh(A), sh(D), true) +
        geoPoly([A, B, C, D]) + geoPoly([D, C, sh(C), sh(D)]) + geoPoly([B, sh(B), sh(C), C]) +
        geoDim(A, B, cube ? L.side ?? L.length ?? "" : L.length ?? "") +
        geoDim(D, A, L.height ?? "") +
        (cube ? "" : geoDim(B, sh(B), L.width ?? L.depth ?? "", 14));
      break;
    }
    case "cylinder": {
      const cx = 120;
      const rx = 60;
      const ry = 20;
      const top = 60;
      const bot = 160;
      body =
        `<path d="M ${cx - rx} ${top} L ${cx - rx} ${bot} A ${rx} ${ry} 0 0 0 ${cx + rx} ${bot} L ${cx + rx} ${top} Z" fill="${FIGURE_PALETTE.navy}" fill-opacity="${SHAPE_FILL_OPACITY}" stroke="none"/>` +
        `<path d="M ${cx - rx} ${bot} A ${rx} ${ry} 0 0 1 ${cx + rx} ${bot}" fill="none" stroke="${FIGURE_PALETTE.navy}" stroke-width="${FIG_STROKE}" stroke-dasharray="5 4" opacity="0.55"/>` +
        `<path d="M ${cx - rx} ${bot} A ${rx} ${ry} 0 0 0 ${cx + rx} ${bot}" fill="none" stroke="${FIGURE_PALETTE.navy}" stroke-width="${FIG_STROKE}"/>` +
        geoEdge([cx - rx, top], [cx - rx, bot]) + geoEdge([cx + rx, top], [cx + rx, bot]) +
        `<ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="${FIGURE_PALETTE.navy}" fill-opacity="${SHAPE_FILL_OPACITY}" stroke="${FIGURE_PALETTE.navy}" stroke-width="${FIG_STROKE}"/>` +
        geoAux([cx, top], [cx + rx, top]) +
        `<circle cx="${cx}" cy="${top}" r="2.5" fill="${FIGURE_PALETTE.navy}"/>` +
        geoLabel(cx + rx / 2, top - 6, L.radius ?? "") +
        geoDim([cx + rx, bot], [cx + rx, top], L.height ?? "", 17);
      break;
    }
    case "cone": {
      const cx = 120;
      const rx = 60;
      const ry = 20;
      const apex: Pt = [cx, 20];
      const by = 160;
      body =
        `<path d="M ${apex[0]} ${apex[1]} L ${cx - rx} ${by} A ${rx} ${ry} 0 0 0 ${cx + rx} ${by} Z" fill="${FIGURE_PALETTE.navy}" fill-opacity="${SHAPE_FILL_OPACITY}" stroke="none"/>` +
        `<path d="M ${cx - rx} ${by} A ${rx} ${ry} 0 0 1 ${cx + rx} ${by}" fill="none" stroke="${FIGURE_PALETTE.navy}" stroke-width="${FIG_STROKE}" stroke-dasharray="5 4" opacity="0.55"/>` +
        `<path d="M ${cx - rx} ${by} A ${rx} ${ry} 0 0 0 ${cx + rx} ${by}" fill="none" stroke="${FIGURE_PALETTE.navy}" stroke-width="${FIG_STROKE}"/>` +
        geoEdge(apex, [cx - rx, by]) + geoEdge(apex, [cx + rx, by]) +
        geoAux(apex, [cx, by]) + geoAux([cx, by], [cx + rx, by]) +
        `<circle cx="${cx}" cy="${by}" r="2.5" fill="${FIGURE_PALETTE.navy}"/>` +
        geoLabel(cx - 8, (apex[1] + by) / 2 + 4, L.height ?? "", "end") +
        geoLabel(cx + rx / 2, by - 6, L.radius ?? "");
      break;
    }
    case "pyramid": {
      const FL: Pt = [40, 160];
      const FR: Pt = [160, 160];
      const BR: Pt = [220, 120];
      const BL: Pt = [100, 120];
      const apex: Pt = [130, 20];
      const foot: Pt = [130, 140];
      body =
        geoPoly([FL, FR, BR, BL], false) +
        geoEdge(FL, BL, true) + geoEdge(BL, BR, true) + geoEdge(apex, BL, true) +
        `<polygon points="${[apex, FL, FR].map((p) => p.join(",")).join(" ")}" fill="${FIGURE_PALETTE.navy}" fill-opacity="${SHAPE_FILL_OPACITY}" stroke="none"/>` +
        `<polygon points="${[apex, FR, BR].map((p) => p.join(",")).join(" ")}" fill="${FIGURE_PALETTE.navy}" fill-opacity="${SHAPE_FILL_OPACITY}" stroke="none"/>` +
        geoEdge(FL, FR) + geoEdge(FR, BR) + geoEdge(apex, FL) + geoEdge(apex, FR) + geoEdge(apex, BR) +
        geoAux(apex, foot) +
        geoLabel(apex[0] - 8, (apex[1] + foot[1]) / 2 + 4, L.height ?? "", "end") +
        geoDim(FL, FR, L.base ?? "");
      break;
    }
    case "triangular_prism": {
      const A: Pt = [40, 160];
      const B: Pt = [140, 160];
      const C: Pt = [40, 80];
      const dx = 60;
      const dy = -40;
      const sh = (p: Pt): Pt => [p[0] + dx, p[1] + dy];
      body =
        geoEdge(A, sh(A), true) + geoEdge(sh(A), sh(B), true) + geoEdge(sh(A), sh(C), true) +
        geoPoly([A, B, C]) + geoPoly([B, sh(B), sh(C), C]) +
        geoEdge(C, sh(C)) + geoEdge(sh(B), sh(C)) +
        geoRightAngle(A, [1, 0], [0, -1]) +
        geoDim(A, B, L.base ?? "") +
        geoDim(C, A, L.height ?? "") +
        geoDim(B, sh(B), L.length ?? L.depth ?? "", 14);
      break;
    }
    case "sphere": {
      const cx = 120;
      const cy = 100;
      const r = 80;
      body =
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${FIGURE_PALETTE.navy}" fill-opacity="${SHAPE_FILL_OPACITY}" stroke="${FIGURE_PALETTE.navy}" stroke-width="${FIG_STROKE}"/>` +
        `<path d="M ${cx - r} ${cy} A ${r} 24 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${FIGURE_PALETTE.navy}" stroke-width="1.3" stroke-dasharray="5 4" opacity="0.55"/>` +
        `<path d="M ${cx - r} ${cy} A ${r} 24 0 0 0 ${cx + r} ${cy}" fill="none" stroke="${FIGURE_PALETTE.navy}" stroke-width="1.3"/>` +
        geoAux([cx, cy], [cx + r, cy]) +
        `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${FIGURE_PALETTE.navy}"/>` +
        geoLabel(cx + r / 2, cy - 7, L.radius ?? "");
      break;
    }
  }
  const svg = `${figOpen(W, H)}${body}</svg>`;
  return `<figure class="course-figure course-figure-solid">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}


export function renderLabeledPolygon(block: Extract<StructuredCourseBlock, { type: "labeled_polygon" }>): string {
  const L = block.labels;
  const V = block.vertices;
  const W = 260;
  const H = 180;
  let body = "";
  const letters = (pts: Pt[], offsets: Pt[]) =>
    pts.map((p, i) => geoVertex(p[0] + offsets[i][0], p[1] + offsets[i][1], V[i] ?? "")).join("");

  switch (block.shape) {
    case "rectangle":
    case "square": {
      const sq = block.shape === "square";
      const x = sq ? 60 : 40;
      const y = 40;
      const w = sq ? 100 : 160;
      const h = 100;
      const A: Pt = [x, y + h];
      const B: Pt = [x + w, y + h];
      const C: Pt = [x + w, y];
      const D: Pt = [x, y];
      body =
        geoPoly([A, B, C, D]) +
        geoRightAngle(A, [1, 0], [0, -1]) + geoRightAngle(B, [-1, 0], [0, -1]) +
        geoRightAngle(C, [-1, 0], [0, 1]) + geoRightAngle(D, [1, 0], [0, 1]) +
        geoDim(A, B, sq ? L.side ?? L.length ?? "" : L.length ?? "") +
        geoDim(B, C, sq ? L.side ?? "" : L.width ?? L.height ?? "") +
        letters([A, B, C, D], [[-10, 14], [10, 14], [10, -6], [-10, -6]]);
      break;
    }
    case "right_triangle": {
      const A: Pt = [40, 140];
      const B: Pt = [200, 140];
      const C: Pt = [40, 40];
      body =
        geoPoly([A, B, C]) + geoRightAngle(A, [1, 0], [0, -1]) +
        geoDim(A, B, L.b ?? L.base ?? "") +
        geoDim(C, A, L.a ?? L.height ?? "") +
        geoDim(B, C, L.c ?? L.hypotenuse ?? "") +
        letters([A, B, C], [[-10, 14], [10, 14], [-10, -6]]);
      break;
    }
    case "triangle": {
      const P1: Pt = [40, 140];
      const P2: Pt = [220, 140];
      const apex: Pt = [100, 40];
      const foot: Pt = [100, 140];
      body =
        geoPoly([P1, P2, apex]) + geoAux(apex, foot) + geoRightAngle(foot, [-1, 0], [0, -1]) +
        geoDim(P1, P2, L.base ?? "") +
        geoLabel(foot[0] + 8, (apex[1] + foot[1]) / 2 + 4, L.height ?? "", "start") +
        letters([P1, P2, apex], [[-10, 14], [10, 14], [0, -8]]);
      break;
    }
    case "parallelogram": {
      const A: Pt = [40, 140];
      const B: Pt = [160, 140];
      const C: Pt = [220, 40];
      const D: Pt = [100, 40];
      const foot: Pt = [100, 140];
      body =
        geoPoly([A, B, C, D]) + geoAux(D, foot) + geoRightAngle(foot, [1, 0], [0, -1]) +
        geoDim(A, B, L.base ?? "") +
        geoLabel(foot[0] - 8, (D[1] + foot[1]) / 2 + 4, L.height ?? "", "end") +
        geoDim(B, C, L.side ?? "") +
        letters([A, B, C, D], [[-10, 14], [10, 14], [10, -6], [-10, -6]]);
      break;
    }
    case "trapezoid": {
      const A: Pt = [40, 140];
      const B: Pt = [220, 140];
      const C: Pt = [180, 40];
      const D: Pt = [80, 40];
      const foot: Pt = [80, 140];
      body =
        geoPoly([A, B, C, D]) + geoAux(D, foot) + geoRightAngle(foot, [1, 0], [0, -1]) +
        geoDim(A, B, L.big_base ?? L.base ?? "") +
        geoDim(C, D, L.small_base ?? "") +
        geoLabel(foot[0] - 8, (D[1] + foot[1]) / 2 + 4, L.height ?? "", "end") +
        geoDim(B, C, L.side ?? "") +
        letters([A, B, C, D], [[-10, 14], [10, 14], [10, -6], [-10, -6]]);
      break;
    }
  }
  const svg = `${figOpen(W, H)}${body}</svg>`;
  return `<figure class="course-figure course-figure-labeled-polygon">${svg}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
}


export type ShapePart = Extract<StructuredCourseBlock, { type: "shape" }>["parts"][number];


/** Un sommet d'une part = polygone : renvoie ses points en carreaux (repère
 * local, origine bas-gauche, y vers le haut). */
export function shapePartVertices(p: ShapePart): { x: number; y: number }[] {
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
export function shapePartBounds(p: ShapePart): { minX: number; minY: number; maxX: number; maxY: number } | null {
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


/** Bloc "shape" : canevas quadrillé sur lequel on pose une ou plusieurs formes
 * simples (rectangle, triangle, cercle, segment, point). Chaque forme porte
 * ses options (sommets étiquetés, côtés cotés, marque d'angle droit). Combiner
 * les parts remplace les anciennes figures dédiées (triangle annoté, Pythagore). */
export function renderShape(
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


export function normVec(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}


/** Preset Pythagore : triangle rectangle + les carrés des 3 côtés, assemblés
 * à partir de formes simples (aucune coordonnée laissée au modèle). */
export function renderPythagorasShape(
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


/**
 * Courbe d'évolution : une à quatre séries sur un axe commun.
 *
 * Le bar_chart ne rendait pas la continuité d'une évolution, et le graph ne
 * sait tracer qu'une expression — pas des relevés (températures par mois,
 * termes d'une suite). Même grammaire visuelle que renderBarChart : grille
 * horizontale légère, axes sobres, étiquettes en dessous.
 */
export function renderLineChart(
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
export function renderScatterPlot(
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
export function renderFlowchart(
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


export function renderProbabilityTree(
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


export function renderVennDiagram(
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
