/**
 * EduFig : LE format des figures d'Educalcul (cours, exercices, quiz, admin, génération par IA).
 *
 * Une figure se décrit par ce qu'elle représente (« triangle ABC rectangle en B avec AB = 5 et BC = 12 »), jamais par
 * un dessin : le moteur (`build.ts`) calcule les positions, `render.ts` produit le SVG au style du site. La description
 * est rangée dans le contenu avec son dessin (`embed.ts`) : la figure peut donc être redessinée (nouveau style, mode
 * sombre), modifiée dans l'admin et vérifiée contre l'énoncé (`check.ts`) à tout moment.
 */

export const EDUFIG_VERSION = 1;

/** Couleurs disponibles, traduites en couleurs du site (encre bleu nuit, or, etc.). */
export type FigTone = "ink" | "accent" | "blue" | "green" | "red" | "gray";
export const FIG_TONES: FigTone[] = ["ink", "accent", "blue", "green", "red", "gray"];

export type FigSize = "s" | "m" | "l";

interface FigBase {
  v: 1;
  /** Légende affichée sous la figure. */
  caption?: string;
  /** Description pour les lecteurs d'écran (sinon générée). */
  alt?: string;
  size?: FigSize;
  /** Figure manipulable : les points libres se déplacent à la souris ou au doigt. */
  interactive?: boolean;
}

/* ───────────── Géométrie ───────────── */

/** Les étapes de construction : chacune définit des points nommés à partir des précédents. */
export type GeoStep =
  | { op: "point"; name: string; x: number; y: number; free?: boolean }
  /**
   * Triangle défini par ses mesures : longueurs « AB », « BC », « AC » (n'importe quel ordre de lettres), angles en
   * degrés par sommet, et `right` pour l'angle droit. Trois données suffisent (trois côtés, deux côtés et l'angle
   * compris, un côté et deux angles, angle droit et deux côtés, angle droit, un côté et un angle).
   */
  | {
      op: "triangle";
      names: [string, string, string];
      lengths?: Record<string, number>;
      angles?: Record<string, number>;
      right?: string;
      /** Côté posé à l'horizontale, en bas (par défaut : un côté de l'angle droit, sinon le plus long). */
      base?: string;
      rotate?: number;
      flip?: boolean;
      draw?: boolean;
    }
  | { op: "rectangle"; names: [string, string, string, string]; width: number; height: number; rotate?: number; draw?: boolean }
  | { op: "square"; names: [string, string, string, string]; side: number; rotate?: number; draw?: boolean }
  | { op: "parallelogram"; names: [string, string, string, string]; base: number; side: number; angle: number; rotate?: number; draw?: boolean }
  | { op: "rhombus"; names: [string, string, string, string]; side: number; angle: number; rotate?: number; draw?: boolean }
  | { op: "trapezoid"; names: [string, string, string, string]; base: number; top: number; height: number; offset?: number; rotate?: number; draw?: boolean }
  | { op: "regular"; names: string[]; side: number; rotate?: number; draw?: boolean }
  | { op: "circle"; center: string; radius: number; x?: number; y?: number; draw?: boolean }
  | { op: "onCircle"; name: string; center: string; radius: number; angle: number }
  /** Point d'un segment : `t` (0 = from, 1 = to, au-delà = sur la droite) ou `distance` depuis `from`. */
  | { op: "onSegment"; name: string; from: string; to: string; t?: number; distance?: number }
  | { op: "midpoint"; name: string; of: [string, string] }
  | { op: "foot"; name: string; from: string; line: [string, string] }
  | { op: "intersection"; name: string; lines: [[string, string], [string, string]] }
  /**
   * Configuration de Thalès : triangle ABC (longueurs AB, AC et BC si connue), M sur (AB) avec AM donné, N sur (AC)
   * tel que (MN) // (BC). `butterfly` place M et N de l'autre côté de A (configuration « papillon »).
   */
  | {
      op: "thales";
      names: [string, string, string, string, string];
      AB: number;
      AC: number;
      BC?: number;
      AM: number;
      butterfly?: boolean;
      rotate?: number;
      draw?: boolean;
    }
  /** Image de points par une transformation ; `map` associe chaque point à son image (« A » → « A' »). */
  | { op: "image"; map: Record<string, string>; transform: GeoTransform; polygon?: boolean };

export type GeoTransform =
  | { type: "symmetryPoint"; center: string }
  | { type: "symmetryLine"; line: [string, string] }
  | { type: "rotation"; center: string; angle: number }
  | { type: "translation"; from: string; to: string }
  | { type: "homothety"; center: string; k: number };

/** Ce qu'on dessine en plus des formes construites. */
export type GeoItem =
  | { type: "polygon"; points: string[]; tone?: FigTone; fill?: boolean; dashed?: boolean }
  /** `label: true` écrit la longueur calculée (avec l'unité), une chaîne écrit ce texte (« ? », « x », « 5 cm »). */
  | { type: "segment"; from: string; to: string; tone?: FigTone; dashed?: boolean; label?: string | boolean }
  | { type: "line"; through: [string, string]; tone?: FigTone; dashed?: boolean; label?: string }
  | { type: "ray"; from: string; through: string; tone?: FigTone; dashed?: boolean }
  | { type: "vector"; from: string; to: string; tone?: FigTone; label?: string }
  | { type: "circle"; center: string; radius?: number; through?: string; tone?: FigTone; dashed?: boolean; fill?: boolean }
  /** Angle au sommet du milieu : `["B","A","C"]` = angle BAC. `label: true` écrit la mesure calculée. */
  | { type: "angle"; points: [string, string, string]; label?: string | boolean; tone?: FigTone; marks?: 1 | 2 | 3 }
  | { type: "right"; points: [string, string, string] }
  /** Codage de longueurs égales sur une liste de segments. */
  | { type: "equal"; segments: [string, string][]; marks?: 1 | 2 | 3 }
  | { type: "points"; names: string[]; tone?: FigTone }
  | { type: "text"; at: string; text: string; dx?: number; dy?: number; tone?: FigTone };

export interface GeometryFig extends FigBase {
  kind: "geometry";
  steps: GeoStep[];
  items?: GeoItem[];
  /** Unité écrite à côté des longueurs calculées. */
  unit?: string;
  /** Points dont le nom n'est pas écrit (« auto » par défaut : tous les points nommés sont écrits). */
  hideLabels?: string[];
  /** Quadrillage en fond, comme un cahier. */
  grid?: boolean;
}

/* ───────────── Repère et courbes ───────────── */

export interface GraphFig extends FigBase {
  kind: "graph";
  x: [number, number];
  y?: [number, number];
  xStep?: number;
  yStep?: number;
  grid?: boolean;
  xLabel?: string;
  yLabel?: string;
  /** `expr` en notation usuelle : « 2x + 1 », « x^2 - 3 », « 3/(x+1) », « sqrt(x) ». */
  curves?: { expr: string; name?: string; tone?: FigTone; domain?: [number, number]; dashed?: boolean }[];
  points?: { x: number; y: number; name?: string; tone?: FigTone; guides?: boolean }[];
  segments?: { from: [number, number]; to: [number, number]; tone?: FigTone; dashed?: boolean; arrow?: boolean }[];
}

/* ───────────── Droite graduée ───────────── */

export interface NumberLineFig extends FigBase {
  kind: "numberline";
  min: number;
  max: number;
  step: number;
  /** Graduations secondaires par intervalle (0 = aucune). */
  minor?: number;
  /** Valeurs écrites : toutes, seulement 0 et les bornes, ou aucune. */
  labels?: "all" | "ends" | "none";
  points?: { value: number; name?: string; tone?: FigTone }[];
  intervals?: { from: number; to: number; closedFrom?: boolean; closedTo?: boolean; tone?: FigTone }[];
}

/* ───────────── Statistiques ───────────── */

export interface BarFig extends FigBase {
  kind: "bar";
  categories: string[];
  values: number[];
  xLabel?: string;
  yLabel?: string;
  /** Histogramme : barres jointives (classes). */
  joined?: boolean;
  tone?: FigTone;
}

export interface PieFig extends FigBase {
  kind: "pie";
  items: { label: string; value: number }[];
  /** Écrit les pourcentages (sinon les valeurs). */
  percent?: boolean;
}

export interface LineChartFig extends FigBase {
  kind: "linechart";
  labels: string[];
  series: { name?: string; values: number[]; tone?: FigTone }[];
  yLabel?: string;
}

/* ───────────── Probabilités ───────────── */

export interface TreeBranch {
  label: string;
  /** Probabilité écrite sur la branche (« 1/3 », « 0,4 », « p »). */
  p?: string;
  children?: TreeBranch[];
}

export interface TreeFig extends FigBase {
  kind: "tree";
  branches: TreeBranch[];
}

/* ───────────── Solides ───────────── */

export interface SolidFig extends FigBase {
  kind: "solid";
  shape: "cube" | "box" | "cylinder" | "cone" | "pyramid" | "sphere" | "prism";
  /** Mesures : `a` (longueur), `b` (largeur), `c` (hauteur), `r` (rayon), `h` (hauteur). */
  dims?: { a?: number; b?: number; c?: number; r?: number; h?: number };
  /** Noms des sommets (pavé : 8, pyramide : 5, prisme : 6). */
  names?: string[];
  unit?: string;
  /** Écrit les mesures sur la figure. */
  showDims?: boolean;
}

/* ───────────── Programme de calcul ───────────── */

export interface ProgramFig extends FigBase {
  kind: "program";
  steps: string[];
}

export type EduFig = GeometryFig | GraphFig | NumberLineFig | BarFig | PieFig | LineChartFig | TreeFig | SolidFig | ProgramFig;
export type EduFigKind = EduFig["kind"];

export const EDUFIG_KINDS: EduFigKind[] = ["geometry", "graph", "numberline", "bar", "pie", "linechart", "tree", "solid", "program"];
