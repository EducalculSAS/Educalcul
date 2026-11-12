import type { EduFig } from "@/lib/figures/types";
import { sanitizeStructuredText, asRecord, stringValue, normalizeStructuredLatex } from "./structuredMath";

/**
 * Format intermédiaire commun aux cours, exercices et quiz.
 *
 * Règle centrale : le modèle ne produit jamais de HTML et ne choisit jamais
 * les délimiteurs $ / $$. Le texte et les mathématiques sont séparés dès la
 * génération. Le serveur valide ensuite chaque champ `latex` avec KaTeX avant
 * de compiler vers les anciens champs HTML/texte utilisés par l'application.
 */

export type StructuredTextPart = {
  type: "text";
  value: string;
};


export type StructuredMathPart = {
  type: "math";
  latex: string;
};


export type StructuredRichTextPart = StructuredTextPart | StructuredMathPart;


export type StructuredRichText = {
  parts: StructuredRichTextPart[];
};


export type StructuredSignValue =
  | "negative"
  | "zero"
  | "positive"
  | "undefined";


export type StructuredVariationDirection = "up" | "down" | "constant";


export type StructuredFigureTone =
  | "navy"
  | "gold"
  | "blue"
  | "green"
  | "red"
  | "gray";


export type StructuredFigurePoint = { x: number; y: number };


/** Brique de base composable du bloc "shape" : une forme simple posée sur le
 * quadrillage, avec ses options (étiquettes de sommets / côtés, marque d'angle
 * droit, cotes). Combiner plusieurs parts remplace les figures spécifiques
 * (triangle annoté, Pythagore, schémas d'énoncé...). */
export type StructuredShapePart = {
  kind:
    | "rectangle"
    | "square"
    | "right_triangle"
    | "triangle"
    | "polygon" // n-gone libre via points
    | "circle"
    | "arc" // portion de cercle (startAngle → endAngle)
    | "angle" // marque d'angle : petit arc entre deux demi-droites issues de (x,y)
    | "segment"
    | "line" // droite infinie passant par (x,y) et points[0] (ou pente via w,h)
    | "point"
    | "text";
  // kind "text" : nombre ou courte étiquette libre posée en (x, y).
  text: string;
  // Coin bas-gauche de la boîte englobante, en carreaux (y vers le haut).
  // Pour circle/arc/angle/point : centre / sommet.
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  // Angles en degrés (convention maths : 0 = est, sens antihoraire).
  // arc : bornes de l'arc. angle : les deux demi-droites de la marque d'angle.
  startAngle: number;
  endAngle: number;
  // polygon / triangle libre / segment / line : sommets explicites.
  points: StructuredFigurePoint[];
  tone: StructuredFigureTone;
  filled: boolean;
  dashed: boolean;
  // "none" | "end" | "both" : pointes de flèche sur segment / line / ray.
  arrow: "none" | "end" | "both";
  // Noms des sommets dans l'ordre (A, B, C…). "" pour ne pas étiqueter.
  vertexLabels: string[];
  // Longueur / nom de chaque côté, même ordre que les sommets.
  sideLabels: string[];
  // Index du sommet portant l'angle droit (marque ⟂), ou null.
  rightAngleAt: number | null;
  showDimensions: boolean;
};


export type StructuredFigureElement =
  | {
      type: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      tone: StructuredFigureTone;
      dashed: boolean;
      arrowEnd: boolean;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    }
  | {
      type: "point";
      x: number;
      y: number;
      tone: StructuredFigureTone;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    }
  | {
      type: "circle";
      cx: number;
      cy: number;
      r: number;
      tone: StructuredFigureTone;
      filled: boolean;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    }
  | {
      type: "polygon";
      points: StructuredFigurePoint[];
      tone: StructuredFigureTone;
      filled: boolean;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    }
  | {
      type: "arc";
      cx: number;
      cy: number;
      r: number;
      startAngle: number;
      endAngle: number;
      tone: StructuredFigureTone;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    };


export type StructuredGraphVector = {
  x: number;
  y: number;
  fromX?: number;
  fromY?: number;
  label?: string;
  tone: StructuredFigureTone;
};


// Diagrammes déterministes : contrairement à "figure" (coordonnées brutes
// choisies par le modèle, ce qui provoque chevauchements et débordements dès
// que plusieurs labels mathématiques sont nécessaires — un <text> SVG ne
// peut pas afficher de KaTeX), ces blocs ne demandent au modèle que des
// données sémantiques (angles, valeurs, labels). La disposition géométrique
// est calculée côté serveur dans compiler.ts, et les labels passent par
// foreignObject + $...$ pour un rendu KaTeX correct.

export type StructuredTrigCircleAngle = {
  angleDeg: number;
  label: string;
};


export type StructuredPieSlice = {
  label: string;
  value: number;
  tone: StructuredFigureTone;
};


export type StructuredNumberLinePoint = {
  value: number;
  label: string;
  filled: boolean;
};


export type StructuredNumberLineInterval = {
  from: number;
  to: number;
  fromIncluded: boolean;
  toIncluded: boolean;
  tone: StructuredFigureTone;
};


export type StructuredBar = {
  label: string;
  value: number;
  tone: StructuredFigureTone;
};


export type StructuredProbabilityLeaf = {
  label: string;
  probability: string;
};


export type StructuredProbabilityBranch = StructuredProbabilityLeaf & {
  children: StructuredProbabilityLeaf[];
};


export type StructuredVennSet = {
  label: string;
  tone: StructuredFigureTone;
};


export type StructuredCourseBlock =
  | { type: "edufig"; fig: EduFig }
  | {
      type: "heading";
      level: 3 | 4;
      content: StructuredRichText;
    }
  | {
      type: "paragraph";
      content: StructuredRichText;
    }
  | {
      type: "display_math";
      latex: string;
      fallbackText?: string;
    }
  | {
      type: "list";
      ordered: boolean;
      items: StructuredRichText[];
    }
  | {
      type: "checklist";
      items: StructuredRichText[];
    }
  | {
      type: "callout";
      variant: "note" | "warning";
      title?: StructuredRichText;
      paragraphs: StructuredRichText[];
    }
  | {
      type: "table";
      variant: "value";
      headers: StructuredRichText[];
      rows: StructuredRichText[][];
    }
  | {
      type: "column_operation";
      operator: "+" | "-" | "×" | "÷";
      operands: string[];
      result: string;
      carries: string[];
    }
  | {
      type: "image";
      query: string;
      caption: string;
      url?: string;
      attribution?: string;
    }
  | {
      type: "base_ten_blocks";
      hundreds: number;
      tens: number;
      units: number;
      caption: string;
    }
  | {
      type: "sign_table";
      expression: StructuredRichText;
      boundaries: StructuredRichText[];
      intervalSigns: StructuredSignValue[];
      boundarySigns: StructuredSignValue[];
    }
  | {
      type: "variation_table";
      variable: StructuredRichText;
      functionName: StructuredRichText;
      points: StructuredRichText[];
      values: StructuredRichText[];
      directions: StructuredVariationDirection[];
      derivativeSigns: StructuredSignValue[];
    }
  | {
      type: "graph";
      expression: string;
      xmin: number;
      xmax: number;
      caption: string;
      parameter?: {
        name: string;
        min: number;
        max: number;
        default: number;
      };
      vectors: StructuredGraphVector[];
    }
  | {
      type: "figure";
      caption: string;
      elements: StructuredFigureElement[];
    }
  | {
      type: "trig_circle";
      caption: string;
      highlightedAngles: StructuredTrigCircleAngle[];
    }
  | {
      type: "shape";
      caption: string;
      // Canevas en carreaux (origine en bas à gauche, y vers le haut).
      // Auto-agrandi si une part déborde.
      width: number;
      height: number;
      // Preset facultatif assemblé côté serveur à partir de formes simples :
      // "pythagoras" = triangle rectangle + les 3 carrés des côtés (a, b = cathètes).
      preset: "none" | "pythagoras";
      a: number;
      b: number;
      parts: StructuredShapePart[];
    }
  | {
      type: "pie_chart";
      caption: string;
      slices: StructuredPieSlice[];
    }
  | {
      type: "number_line";
      caption: string;
      min: number;
      max: number;
      points: StructuredNumberLinePoint[];
      intervals: StructuredNumberLineInterval[];
    }
  | {
      // Courbe d'évolution : une ou plusieurs séries partageant le même axe
      // des abscisses (températures par mois, suite au fil des rangs…). Le
      // bar_chart ne rendait pas l'idée de continuité, et le graph ne sait
      // tracer qu'une expression, pas des relevés.
      type: "line_chart";
      caption: string;
      xLabel: string;
      yLabel: string;
      xValues: string[];
      series: { name: string; tone: StructuredFigureTone; values: number[] }[];
    }
  | {
      // Nuage de points : le catalogue l'annonçait déjà, mais aucun bloc de
      // cours ne l'implémentait — les 16 figures produites étaient rejetées en
      // silence. Indispensable en statistiques (corrélation, ajustement).
      type: "scatter_plot";
      caption: string;
      xLabel: string;
      yLabel: string;
      points: { x: number; y: number }[];
    }
  | {
      // Schéma d'algorithme : suite d'étapes, avec losanges pour les tests et
      // une flèche de retour possible pour les boucles.
      type: "flowchart";
      caption: string;
      nodes: { label: string; kind: "start" | "end" | "action" | "condition" }[];
      loopFrom: number | null;
      loopTo: number | null;
    }
  | {
      type: "bar_chart";
      caption: string;
      bars: StructuredBar[];
    }
  | {
      type: "clock";
      caption: string;
      hours: number;
      minutes: number;
      interactive: boolean;
    }
  | {
      type: "fraction";
      caption: string;
      numerator: number;
      denominator: number;
      shape: "bar" | "circle";
    }
  | {
      type: "definition";
      term: string;
      definition: StructuredRichText;
      example?: StructuredRichText;
    }
  | {
      type: "coin_purse";
      caption: string;
      coins: number[];
      target: number;
    }
  | {
      type: "balance_scale";
      caption: string;
      left: number[];
      right: number[];
      // Étiquettes libres (prioritaires sur left/right) : "2x + 3", "m", …
      leftLabel: string;
      rightLabel: string;
      // Inclinaison forcée : "level" (équilibre), "left" / "right" (penché de
      // ce côté), ou "auto" (déduit de la somme des masses).
      tilt: "auto" | "level" | "left" | "right";
    }
  | {
      type: "grid_painter";
      caption: string;
      rows: number;
      cols: number;
      highlighted: number;
    }
  | {
      type: "pattern_maker";
      caption: string;
      sequence: string[];
      options: string[];
      answer: string;
    }
  | {
      type: "ruler_measurer";
      caption: string;
      segmentLength: number;
      unit: string;
    }
  | {
      type: "tape_diagram";
      caption: string;
      parts: { label: string; value: number; tone: StructuredFigureTone }[];
    }
  | {
      /** Pyramide de briques : levels du SOMMET vers la base (1, 2, 3... briques), "" = brique vide à compléter. */
      type: "brick_pyramid";
      caption: string;
      levels: string[][];
    }
  | {
      /** Grille à compléter (carré magique, tableau de nombres...) : cells[ligne][colonne], "" = case vide. */
      type: "fill_grid";
      caption: string;
      cells: string[][];
    }
  | {
      /** Solide en perspective, cotes en étiquettes (labels : height, radius, base, length, width, depth, side). */
      type: "solid";
      solid: "cube" | "box" | "cylinder" | "cone" | "pyramid" | "triangular_prism" | "sphere";
      caption: string;
      labels: Record<string, string>;
    }
  | {
      /** Polygone usuel dessiné par le code, côtés et hauteur étiquetés. */
      type: "labeled_polygon";
      shape: "rectangle" | "square" | "right_triangle" | "triangle" | "parallelogram" | "trapezoid";
      caption: string;
      labels: Record<string, string>;
      vertices: string[];
    }
  | {
      /** Figure libre JSXGraph : toute figure de maths décrite par un JSON (voir lib/jsxFigure.ts). */
      type: "jsx_figure";
      caption: string;
      spec: import("@/lib/jsxFigure").JsxFigureSpec;
    }
  | {
      /** Cercle avec rayon et/ou diamètre étiquetés. */
      type: "labeled_circle";
      caption: string;
      labels: Record<string, string>;
    }
  | {
      type: "fraction_strips";
      caption: string;
      fractions: { numerator: number; denominator: number }[];
    }
  | {
      type: "place_value_chart";
      caption: string;
      number: number;
    }
  | {
      type: "ratio_mixer";
      caption: string;
      ratios: { label: string; value: number; tone: StructuredFigureTone }[];
    }
  | {
      type: "net_folder";
      caption: string;
      solid: "cube" | "pave";
      width: number;
      height: number;
      depth: number;
    }
  | {
      type: "interactive_protractor";
      caption: string;
      angleDeg: number;
    }
  | {
      type: "compass_tool";
      caption: string;
      radius: number;
      centerLabel: string;
    }
  | {
      type: "thermometer_axis";
      caption: string;
      min: number;
      max: number;
      points: { value: number; label: string }[];
    }
  | {
      type: "area_decomposer";
      caption: string;
      shapes: { width: number; height: number; label: string }[];
    }
  | {
      type: "scientific_notation_converter";
      caption: string;
      value: number;
      exponent: number;
    }
  | {
      type: "equation_balancer";
      caption: string;
      leftTerms: string[];
      rightTerms: string[];
    }
  | {
      type: "slope_triangle";
      caption: string;
      a: number;
      b: number;
      xMin: number;
      xMax: number;
    }
  | {
      type: "vector_addition_pad";
      caption: string;
      ux: number;
      uy: number;
      vx: number;
      vy: number;
    }
  | {
      type: "interval_builder";
      caption: string;
      min: number;
      max: number;
      lowerBound: number;
      upperBound: number;
      lowerOpen: boolean;
      upperOpen: boolean;
    }
  | {
      type: "tangent_scrubber";
      caption: string;
      expression: string;
      x0: number;
      xMin: number;
      xMax: number;
    }
  | {
      type: "sequence_cobweb";
      caption: string;
      expression: string;
      u0: number;
      iterations: number;
      xMin: number;
      xMax: number;
    }
  | {
      type: "integral_riemann_slider";
      caption: string;
      expression: string;
      xMin: number;
      xMax: number;
      rectangles: number;
    }
  | {
      type: "complex_plane_polar";
      caption: string;
      re: number;
      im: number;
    }
  | {
      type: "algo_sandbox";
      caption: string;
      code: string;
      language: string;
    }
  | {
      type: "probability_tree";
      caption: string;
      branches: StructuredProbabilityBranch[];
    }
  | {
      type: "venn_diagram";
      caption: string;
      sets: StructuredVennSet[];
      regionLabels?: {
        aOnly?: string;
        bOnly?: string;
        both?: string;
        neither?: string;
      };
    }
  | {
      type: "box_plot";
      caption: string;
      min: number;
      q1: number;
      median: number;
      q3: number;
      max: number;
      axisLabel?: string;
    }
  | {
      type: "exercise";
      exerciseIndex: number;
    }
  | {
      type: "steps";
      steps: Array<{
        title?: StructuredRichText;
        blocks: StructuredCourseBlock[];
      }>;
    }


export function finiteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}


export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}


/**
 * Ajoute un segment mathématique en sortant les caractères qui relèvent du
 * TEXTE, pas des mathématiques.
 *
 * KaTeX n'a de glyphe ni pour « € » (ni £, ¥…) ni pour les guillemets
 * français : il émet « No character metrics for '€' in style 'Main-Regular' »
 * et les rend avec une largeur approximative, mal espacée. Or une unité
 * monétaire ou un guillemet n'a rien à faire dans une formule — « $5 €$ » se
 * lit « 5 » en mathématiques, suivi de « € » en texte. On découpe donc plutôt
 * que de forcer KaTeX sur un caractère qu'il ne connaît pas.
 */
export const TEXT_ONLY_IN_MATH = /([€£¥₽₹«»“”])/;


export function pushMathPart(parts: StructuredRichTextPart[], rawLatex: string): void {
  // « $\text{par visite de classe}$ » ou « $\text{48}$ » : du texte (ou un nombre
  // nu) enveloppé dans une formule, que le modèle produit souvent. On le range
  // en texte ordinaire plutôt qu'en mathématiques (police et espacement faux).
  const wrappedText = /^\s*\\text\{([^{}$\\]*)\}\s*$/.exec(rawLatex);
  if (wrappedText) {
    const value = wrappedText[1].trim();
    if (value) parts.push({ type: "text", value });
    return;
  }
  if (!TEXT_ONLY_IN_MATH.test(rawLatex)) {
    const latex = normalizeStructuredLatex(rawLatex);
    if (latex) parts.push({ type: "math", latex });
    return;
  }

  for (const chunk of rawLatex.split(TEXT_ONLY_IN_MATH)) {
    if (!chunk) continue;
    if (TEXT_ONLY_IN_MATH.test(chunk)) {
      // Espace insécable fine avant une unité monétaire, comme le veut
      // l'usage français ; les guillemets se collent à ce qu'ils encadrent.
      const thin = /[€£¥₽₹]/.test(chunk) ? " " : "";
      parts.push({ type: "text", value: `${thin}${chunk}` });
      continue;
    }
    const latex = normalizeStructuredLatex(chunk);
    if (latex) parts.push({ type: "math", latex });
  }
}


export function parseLegacyRichText(value: string): StructuredRichTextPart[] {
  const parts: StructuredRichTextPart[] = [];
  const expression = /\$\$([\s\S]*?)\$\$|\$([^$\r\n]*?)\$|\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(value)) !== null) {
    if (match.index > cursor) {
      const text = sanitizeStructuredText(value.slice(cursor, match.index), true);
      if (text) parts.push({ type: "text", value: text });
    }
    pushMathPart(parts, match[1] ?? match[2] ?? match[3] ?? match[4] ?? "");
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) {
    const text = sanitizeStructuredText(value.slice(cursor), true);
    if (text) parts.push({ type: "text", value: text });
  }
  return parts;
}


export function needsBoundarySpace(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (/\s$/.test(left) || /^\s/.test(right)) return false;
  if (/[('’\[{\/-]$/.test(left)) return false;
  if (/^[,.;:!?%)\]}]/.test(right)) return false;
  // Fin de phrase collée à la suivante (« visites.Les tarifs ») ou unité collée au mot suivant.
  if (/[.!?€]$/.test(left) && /^[A-Za-zÀ-ÿ0-9]/.test(right)) return true;
  return /[A-Za-zÀ-ÿ0-9)]$/.test(left) && /^[A-Za-zÀ-ÿ0-9(]/.test(right);
}


export function normalizePartBoundaries(
  parts: StructuredRichTextPart[],
): StructuredRichTextPart[] {
  const normalized: StructuredRichTextPart[] = [];
  for (const rawPart of parts) {
    if (!rawPart.type) continue;
    const part = rawPart.type === "text"
      ? { ...rawPart, value: rawPart.value.replace(/[ \t]+/g, " ") }
      : rawPart;
    const previous = normalized[normalized.length - 1];

    if (part.type === "text" && previous?.type === "text") {
      const spacer = needsBoundarySpace(previous.value, part.value) ? " " : "";
      previous.value = `${previous.value}${spacer}${part.value}`;
      continue;
    }

    if (previous && part.type === "text" && previous.type === "math") {
      if (part.value && needsBoundarySpace("x", part.value)) {
        part.value = ` ${part.value}`;
      }
    } else if (previous?.type === "text" && part.type === "math") {
      if (previous.value && needsBoundarySpace(previous.value, "x")) {
        previous.value = `${previous.value} `;
      }
    }
    normalized.push(part);
  }
  return normalized.filter(
    (part) => part.type === "math" || part.value.length > 0,
  );
}


export function mergeAdjacentText(parts: StructuredRichTextPart[]): StructuredRichTextPart[] {
  return normalizePartBoundaries(parts);
}


export function normalizeStructuredRichText(value: unknown): StructuredRichText {
  if (typeof value === "string") {
    const legacyParts = parseLegacyRichText(value);
    if (legacyParts.length > 0) return { parts: mergeAdjacentText(legacyParts) };
    const text = sanitizeStructuredText(value, true);
    return { parts: text ? [{ type: "text", value: text }] : [] };
  }

  const record = asRecord(value);
  const rawParts = Array.isArray(value)
    ? value
    : Array.isArray(record?.parts)
      ? record.parts
      : [];

  const parts: StructuredRichTextPart[] = [];
  for (const rawPart of rawParts) {
    if (typeof rawPart === "string") {
      parts.push(...parseLegacyRichText(rawPart));
      continue;
    }
    const part = asRecord(rawPart);
    if (!part) continue;
    const type = stringValue(part.type).toLowerCase();
    if (type === "math" || type === "latex" || type === "formula") {
      pushMathPart(parts, stringValue(part.latex ?? part.value ?? part.text));
      continue;
    }
    const text = sanitizeStructuredText(part.value ?? part.text ?? part.content, true);
    if (text) parts.push({ type: "text", value: text });
  }

  if (parts.length === 0 && record) {
    const fallback = sanitizeStructuredText(record.value ?? record.text ?? record.content, true);
    if (fallback) parts.push({ type: "text", value: fallback });
  }

  return { parts: mergeAdjacentText(parts) };
}


export function normalizeFigureTone(value: unknown): StructuredFigureTone {
  const tone = stringValue(value).toLowerCase();
  if (
    tone === "gold" ||
    tone === "blue" ||
    tone === "green" ||
    tone === "red" ||
    tone === "gray"
  ) {
    return tone;
  }
  return "navy";
}


export function optionalRichText(value: unknown): StructuredRichText | undefined {
  if (value === undefined || value === null) return undefined;
  const rich = normalizeStructuredRichText(value);
  return rich.parts.length > 0 ? rich : undefined;
}


export function optionalCoordinate(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return clamp(finiteNumber(value, 0), 0, 200);
}


export function normalizeFigurePoint(value: unknown): StructuredFigurePoint | null {
  const raw = asRecord(value);
  if (!raw) return null;
  return {
    x: clamp(finiteNumber(raw.x, 0), 0, 200),
    y: clamp(finiteNumber(raw.y, 0), 0, 160),
  };
}


export function normalizeFigureElement(value: unknown): StructuredFigureElement | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const type = stringValue(raw.type).toLowerCase();
  const tone = normalizeFigureTone(raw.tone);
  const label = optionalRichText(raw.label);
  const labelX = optionalCoordinate(raw.label_x ?? raw.labelX);
  const labelYRaw = raw.label_y ?? raw.labelY;
  const labelY =
    labelYRaw === undefined || labelYRaw === null || labelYRaw === ""
      ? undefined
      : clamp(finiteNumber(labelYRaw, 0), 0, 160);
  const shared = { tone, label, labelX, labelY };

  if (type === "line") {
    return {
      type: "line",
      x1: clamp(finiteNumber(raw.x1, 20), 0, 200),
      y1: clamp(finiteNumber(raw.y1, 120), 0, 160),
      x2: clamp(finiteNumber(raw.x2, 180), 0, 200),
      y2: clamp(finiteNumber(raw.y2, 120), 0, 160),
      dashed: raw.dashed === true,
      arrowEnd: raw.arrow_end === true || raw.arrowEnd === true,
      ...shared,
    };
  }
  if (type === "point") {
    return {
      type: "point",
      x: clamp(finiteNumber(raw.x, 100), 0, 200),
      y: clamp(finiteNumber(raw.y, 80), 0, 160),
      ...shared,
    };
  }
  if (type === "circle") {
    return {
      type: "circle",
      cx: clamp(finiteNumber(raw.cx, 100), 0, 200),
      cy: clamp(finiteNumber(raw.cy, 80), 0, 160),
      r: clamp(finiteNumber(raw.r, 35), 2, 80),
      filled: raw.filled === true,
      ...shared,
    };
  }
  if (type === "polygon") {
    const points = Array.isArray(raw.points)
      ? raw.points
          .map(normalizeFigurePoint)
          .filter((point): point is StructuredFigurePoint => point !== null)
          .slice(0, 8)
      : [];
    if (points.length < 3) return null;
    return {
      type: "polygon",
      points,
      filled: raw.filled === true,
      ...shared,
    };
  }
  if (type === "arc") {
    return {
      type: "arc",
      cx: clamp(finiteNumber(raw.cx, 100), 0, 200),
      cy: clamp(finiteNumber(raw.cy, 80), 0, 160),
      r: clamp(finiteNumber(raw.r, 30), 2, 80),
      startAngle: clamp(finiteNumber(raw.start_angle ?? raw.startAngle, 0), -360, 360),
      endAngle: clamp(finiteNumber(raw.end_angle ?? raw.endAngle, 90), -360, 360),
      ...shared,
    };
  }
  return null;
}


export const SHAPE_KINDS = [
  "rectangle",
  "square",
  "right_triangle",
  "triangle",
  "polygon",
  "circle",
  "arc",
  "angle",
  "segment",
  "line",
  "point",
  "text",
] as const;


export function normalizeShapePart(value: unknown): StructuredShapePart | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const kindRaw = stringValue(raw.kind).toLowerCase();
  const kind = (SHAPE_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as StructuredShapePart["kind"])
    : "rectangle";
  const x = clamp(finiteNumber(raw.x, 1), -2, 40);
  const y = clamp(finiteNumber(raw.y, 1), -2, 40);
  const w = clamp(finiteNumber(raw.w ?? raw.width, kind === "square" ? 4 : 6), 0.5, 40);
  const h = clamp(
    finiteNumber(raw.h ?? raw.height, kind === "square" ? w : 4),
    0.5,
    40,
  );
  const strList = (input: unknown): string[] =>
    Array.isArray(input)
      ? input.map((s) => sanitizeStructuredText(s).slice(0, 18))
      : [];
  const ptsRaw = Array.isArray(raw.points) ? raw.points : [];
  const points = ptsRaw
    .map((p) => asRecord(p))
    .filter((p): p is Record<string, unknown> => !!p)
    .map((p) => ({
      x: clamp(finiteNumber(p.x, 0), -2, 40),
      y: clamp(finiteNumber(p.y, 0), -2, 40),
    }))
    .slice(0, 12);
  const raRaw = raw.right_angle_at ?? raw.rightAngleAt;
  const rightAngleAt =
    typeof raRaw === "number" && Number.isInteger(raRaw) && raRaw >= 0 && raRaw < 12
      ? raRaw
      : kind === "right_triangle"
        ? 0
        : null;
  const arrowRaw = stringValue(raw.arrow).toLowerCase();
  const arrow = arrowRaw === "end" || arrowRaw === "both" ? arrowRaw : "none";
  return {
    kind,
    text: sanitizeStructuredText(raw.text).slice(0, 24),
    x,
    y,
    w: kind === "square" ? w : w,
    h: kind === "square" ? w : h,
    r: clamp(finiteNumber(raw.r ?? raw.radius, 3), 0.5, 20),
    startAngle: finiteNumber(raw.start_angle ?? raw.startAngle, 0),
    endAngle: finiteNumber(raw.end_angle ?? raw.endAngle, 90),
    // segment/line/polygon/triangle : sommets libres (jusqu'à 12).
    points: points.length >= 2 ? points : [],
    tone: normalizeFigureTone(raw.tone),
    filled: raw.filled ?? raw.fill ?? (kind === "arc" || kind === "angle" || kind === "line" || kind === "segment" ? false : true) ? true : false,
    dashed: raw.dashed ?? raw.dash ?? false ? true : false,
    arrow,
    vertexLabels: strList(raw.vertex_labels ?? raw.vertexLabels).slice(0, 6),
    sideLabels: strList(raw.side_labels ?? raw.sideLabels).slice(0, 6),
    rightAngleAt,
    showDimensions: raw.show_dimensions ?? raw.showDimensions ?? true ? true : false,
  };
}


export function normalizeShapeBlock(
  raw: Record<string, unknown>,
): Extract<StructuredCourseBlock, { type: "shape" }> | null {
  const preset = raw.preset === "pythagoras" ? "pythagoras" : "none";
  let parts = Array.isArray(raw.parts)
    ? raw.parts
        .map(normalizeShapePart)
        .filter((p): p is StructuredShapePart => p !== null)
        .slice(0, 8)
    : [];
  // Rétro-compat : un "shape" à l'ancienne (kind/width/height au niveau bloc)
  // devient une part unique.
  if (parts.length === 0 && preset === "none" && typeof raw.kind === "string") {
    const single = normalizeShapePart({
      kind: raw.kind,
      x: 1,
      y: 1,
      w: raw.width,
      h: raw.height,
      r: raw.radius,
      tone: raw.tone,
      side_labels: Array.isArray(raw.side_labels) ? raw.side_labels : undefined,
      show_dimensions: raw.show_dimensions ?? raw.showDimensions,
    });
    if (single) parts = [single];
  }
  if (preset === "none" && parts.length === 0) {
    parts = [normalizeShapePart({ kind: "rectangle" }) as StructuredShapePart];
  }
  const spanX = Math.max(
    6,
    ...parts.map((p) =>
      p.points.length
        ? Math.max(...p.points.map((pt) => pt.x))
        : p.kind === "circle" || p.kind === "point"
          ? p.x + p.r
          : p.x + p.w,
    ),
  );
  const spanY = Math.max(
    5,
    ...parts.map((p) =>
      p.points.length
        ? Math.max(...p.points.map((pt) => pt.y))
        : p.kind === "circle" || p.kind === "point"
          ? p.y + p.r
          : p.y + p.h,
    ),
  );
  return {
    type: "shape",
    caption: sanitizeStructuredText(raw.caption),
    width: clamp(Math.ceil(finiteNumber(raw.width, spanX) + 1), 4, 44),
    height: clamp(Math.ceil(finiteNumber(raw.height, spanY) + 1), 4, 36),
    preset,
    a: clamp(finiteNumber(raw.a, 3), 1, 12),
    b: clamp(finiteNumber(raw.b, 4), 1, 12),
    parts,
  };
}
