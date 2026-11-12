import type { EduFig, GeoItem, GeoStep, TreeBranch } from "@/lib/figures/types";
import { splitNames } from "@/lib/figures/normalize";

/**
 * Modèles de figures : l'admin choisit « Pythagore », remplit trois cases et obtient une figure juste. Chaque modèle
 * produit une figure EduFig ordinaire, modifiable ensuite dans l'onglet « Avancé ».
 */
export type PresetFamily = "geometry" | "transform" | "graph" | "stats" | "proba" | "solid" | "other";

export const PRESET_FAMILIES: { id: PresetFamily; label: string }[] = [
  { id: "geometry", label: "Géométrie" },
  { id: "transform", label: "Transformations" },
  { id: "graph", label: "Repère" },
  { id: "stats", label: "Statistiques" },
  { id: "proba", label: "Probabilités" },
  { id: "solid", label: "Solides" },
  { id: "other", label: "Autres" },
];

export interface PresetParam {
  key: string;
  label: string;
  type: "number" | "text" | "select" | "bool";
  default: string | number | boolean;
  options?: { value: string; label: string }[];
  help?: string;
}

export interface FigPreset {
  id: string;
  family: PresetFamily;
  label: string;
  description: string;
  params: PresetParam[];
  build: (p: Record<string, string | number | boolean>) => EduFig;
}

type V = Record<string, string | number | boolean>;
const N = (v: unknown, d = 0) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : d; };
const S = (v: unknown, d = "") => (typeof v === "string" && v.trim() ? v.trim() : d);
const names = (v: unknown, count: number, fallback: string) => { const n = splitNames(S(v, fallback)); return n.length === count ? n : splitNames(fallback); };
const list = (v: unknown) => S(v).split(/[;|\n]/).map((x) => x.trim()).filter(Boolean);
const numbers = (v: unknown) => list(v).map((x) => N(x));
const showOpts = [
  { value: "all", label: "Toutes les longueurs" },
  { value: "given", label: "Seulement les données" },
  { value: "none", label: "Aucune" },
];

/** Côtés d'un polygone avec leur longueur écrite (ou « ? » pour l'inconnue). */
function sideItems(pts: string[], show: string, given: string[], unknown?: string): GeoItem[] {
  const items: GeoItem[] = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const key = a + b, rev = b + a;
    if (unknown && (unknown === key || unknown === rev)) items.push({ type: "segment", from: a, to: b, label: "?" });
    else if (show === "all" || (show === "given" && (given.includes(key) || given.includes(rev)))) items.push({ type: "segment", from: a, to: b, label: true });
  });
  return items;
}

const triangleNames = (p: V) => names(p.names, 3, "ABC") as [string, string, string];

export const EDUFIG_PRESETS: FigPreset[] = [
  {
    id: "right-triangle",
    family: "geometry",
    label: "Triangle rectangle (Pythagore)",
    description: "Donne l'angle droit et deux longueurs : la troisième est calculée.",
    params: [
      { key: "names", label: "Sommets", type: "text", default: "ABC" },
      { key: "right", label: "Angle droit en", type: "text", default: "B" },
      { key: "side1", label: "Premier côté (ex. AB)", type: "text", default: "AB" },
      { key: "len1", label: "Sa longueur", type: "number", default: 5 },
      { key: "side2", label: "Deuxième côté (ex. BC)", type: "text", default: "BC" },
      { key: "len2", label: "Sa longueur", type: "number", default: 12 },
      { key: "unknown", label: "Côté cherché (écrit « ? »)", type: "text", default: "AC" },
      { key: "show", label: "Longueurs écrites", type: "select", default: "given", options: showOpts },
    ],
    build: (p) => {
      const n = triangleNames(p);
      const s1 = S(p.side1, n[0] + n[1]), s2 = S(p.side2, n[1] + n[2]);
      return {
        v: 1, kind: "geometry", unit: "cm",
        steps: [{ op: "triangle", names: n, right: S(p.right, n[1]), lengths: { [s1]: N(p.len1, 3), [s2]: N(p.len2, 4) } }],
        items: sideItems(n, S(p.show, "given"), [s1, s2], S(p.unknown) || undefined),
      };
    },
  },
  {
    id: "triangle-sss",
    family: "geometry",
    label: "Triangle par ses trois côtés",
    description: "Le triangle est construit à l'échelle ; s'il est impossible, l'aperçu le dit.",
    params: [
      { key: "names", label: "Sommets", type: "text", default: "ABC" },
      { key: "a", label: "Premier côté (AB)", type: "number", default: 6 },
      { key: "b", label: "Deuxième côté (BC)", type: "number", default: 5 },
      { key: "c", label: "Troisième côté (AC)", type: "number", default: 4 },
      { key: "show", label: "Longueurs écrites", type: "select", default: "all", options: showOpts },
    ],
    build: (p) => {
      const n = triangleNames(p);
      return {
        v: 1, kind: "geometry", unit: "cm",
        steps: [{ op: "triangle", names: n, lengths: { [n[0] + n[1]]: N(p.a, 6), [n[1] + n[2]]: N(p.b, 5), [n[0] + n[2]]: N(p.c, 4) } }],
        items: sideItems(n, S(p.show, "all"), [n[0] + n[1], n[1] + n[2], n[0] + n[2]]),
      };
    },
  },
  {
    id: "triangle-sas",
    family: "geometry",
    label: "Triangle : deux côtés et un angle",
    description: "Deux côtés issus d'un même sommet et l'angle entre eux.",
    params: [
      { key: "names", label: "Sommets", type: "text", default: "ABC" },
      { key: "ab", label: "Longueur AB", type: "number", default: 5 },
      { key: "ac", label: "Longueur AC", type: "number", default: 4 },
      { key: "angle", label: "Angle en A (°)", type: "number", default: 50 },
      { key: "isoceles", label: "Coder les côtés égaux s'ils le sont", type: "bool", default: true },
    ],
    build: (p) => {
      const n = triangleNames(p);
      const items: GeoItem[] = [
        { type: "angle", points: [n[1], n[0], n[2]], label: `${N(p.angle, 50)}°` },
        { type: "segment", from: n[0], to: n[1], label: true },
        { type: "segment", from: n[0], to: n[2], label: true },
      ];
      if (p.isoceles !== false && N(p.ab) === N(p.ac)) items.push({ type: "equal", segments: [[n[0], n[1]], [n[0], n[2]]] });
      return { v: 1, kind: "geometry", unit: "cm", steps: [{ op: "triangle", names: n, lengths: { [n[0] + n[1]]: N(p.ab, 5), [n[0] + n[2]]: N(p.ac, 4) }, angles: { [n[0]]: N(p.angle, 50) }, base: n[1] + n[2] }], items };
    },
  },
  {
    id: "trigonometry",
    family: "geometry",
    label: "Trigonométrie",
    description: "Triangle rectangle, un angle aigu marqué, un côté connu, un côté cherché.",
    params: [
      { key: "names", label: "Sommets", type: "text", default: "ABC" },
      { key: "right", label: "Angle droit en", type: "text", default: "B" },
      { key: "vertex", label: "Angle marqué en", type: "text", default: "A" },
      { key: "angle", label: "Mesure de l'angle (°)", type: "number", default: 35 },
      { key: "side", label: "Côté connu", type: "text", default: "AC" },
      { key: "length", label: "Sa longueur", type: "number", default: 8 },
      { key: "unknown", label: "Côté cherché", type: "text", default: "BC" },
    ],
    build: (p) => {
      const n = triangleNames(p);
      const right = S(p.right, n[1]), vtx = S(p.vertex, n[0]);
      const others = n.filter((x) => x !== vtx);
      const side = S(p.side, n[0] + n[2]);
      return {
        v: 1, kind: "geometry", unit: "cm",
        steps: [{ op: "triangle", names: n, right, angles: { [vtx]: N(p.angle, 35) }, lengths: { [side]: N(p.length, 8) } }],
        items: [
          { type: "angle", points: [others[0], vtx, others[1]], label: `${N(p.angle, 35)}°` },
          ...sideItems(n, "given", [side], S(p.unknown) || undefined),
        ],
      };
    },
  },
  {
    id: "thales",
    family: "geometry",
    label: "Thalès",
    description: "Triangle ABC, M sur (AB), N sur (AC) avec (MN) // (BC). Version classique ou « papillon ».",
    params: [
      { key: "names", label: "Points (A, B, C, M, N)", type: "text", default: "ABCMN" },
      { key: "AB", label: "AB", type: "number", default: 6 },
      { key: "AC", label: "AC", type: "number", default: 7.5 },
      { key: "BC", label: "BC", type: "number", default: 5 },
      { key: "AM", label: "AM", type: "number", default: 2.4 },
      { key: "butterfly", label: "Configuration papillon", type: "bool", default: false },
      { key: "unknown", label: "Longueur cherchée (ex. MN)", type: "text", default: "MN" },
    ],
    build: (p) => {
      const n = names(p.names, 5, "ABCMN") as [string, string, string, string, string];
      const [A, B, C, M, Nn] = n;
      const unk = S(p.unknown);
      const lab = (a: string, b: string): GeoItem => ({ type: "segment", from: a, to: b, label: unk === a + b || unk === b + a ? "?" : true });
      return {
        v: 1, kind: "geometry", unit: "cm",
        steps: [{ op: "thales", names: n, AB: N(p.AB, 6), AC: N(p.AC, 7.5), BC: N(p.BC, 5) || undefined, AM: N(p.AM, 2.4), butterfly: p.butterfly === true }],
        items: [lab(A, M), lab(B, C), lab(M, Nn), ...(p.butterfly === true ? [] : [lab(A, B)])],
      };
    },
  },
  {
    id: "rectangle",
    family: "geometry",
    label: "Rectangle ou carré",
    description: "Dessiné à l'échelle, diagonale facultative.",
    params: [
      { key: "names", label: "Sommets", type: "text", default: "ABCD" },
      { key: "width", label: "Longueur", type: "number", default: 8 },
      { key: "height", label: "Largeur", type: "number", default: 5 },
      { key: "diagonal", label: "Tracer la diagonale [AC]", type: "bool", default: false },
      { key: "marks", label: "Coder les angles droits", type: "bool", default: true },
    ],
    build: (p) => {
      const n = names(p.names, 4, "ABCD") as [string, string, string, string];
      const w = N(p.width, 8), h = N(p.height, 5);
      const items: GeoItem[] = [{ type: "segment", from: n[0], to: n[1], label: true }, { type: "segment", from: n[1], to: n[2], label: true }];
      if (p.marks !== false) items.push({ type: "right", points: [n[3], n[0], n[1]] }, { type: "right", points: [n[0], n[1], n[2]] }, { type: "right", points: [n[1], n[2], n[3]] }, { type: "right", points: [n[2], n[3], n[0]] });
      if (p.diagonal === true) items.push({ type: "segment", from: n[0], to: n[2], label: "?" });
      if (w === h) items.push({ type: "equal", segments: [[n[0], n[1]], [n[1], n[2]], [n[2], n[3]], [n[3], n[0]]] });
      const step: GeoStep = w === h ? { op: "square", names: n, side: w } : { op: "rectangle", names: n, width: w, height: h };
      return { v: 1, kind: "geometry", unit: "cm", steps: [step], items };
    },
  },
  {
    id: "parallelogram",
    family: "geometry",
    label: "Parallélogramme, losange, trapèze",
    description: "Quadrilatère construit à partir de ses mesures.",
    params: [
      { key: "shape", label: "Forme", type: "select", default: "parallelogram", options: [{ value: "parallelogram", label: "Parallélogramme" }, { value: "rhombus", label: "Losange" }, { value: "trapezoid", label: "Trapèze" }] },
      { key: "names", label: "Sommets", type: "text", default: "ABCD" },
      { key: "base", label: "Base (AB)", type: "number", default: 7 },
      { key: "side", label: "Côté (AD) ou petite base", type: "number", default: 4 },
      { key: "angle", label: "Angle en A (°) ou hauteur", type: "number", default: 60 },
    ],
    build: (p) => {
      const n = names(p.names, 4, "ABCD") as [string, string, string, string];
      const shape = S(p.shape, "parallelogram");
      const step: GeoStep = shape === "rhombus" ? { op: "rhombus", names: n, side: N(p.base, 5), angle: N(p.angle, 60) }
        : shape === "trapezoid" ? { op: "trapezoid", names: n, base: N(p.base, 7), top: N(p.side, 4), height: N(p.angle, 3) }
        : { op: "parallelogram", names: n, base: N(p.base, 7), side: N(p.side, 4), angle: N(p.angle, 60) };
      const items: GeoItem[] = shape === "rhombus" ? [{ type: "equal", segments: [[n[0], n[1]], [n[1], n[2]], [n[2], n[3]], [n[3], n[0]]] }] : [{ type: "segment", from: n[0], to: n[1], label: true }];
      return { v: 1, kind: "geometry", unit: "cm", steps: [step], items };
    },
  },
  {
    id: "circle",
    family: "geometry",
    label: "Cercle",
    description: "Cercle de centre O, rayon et diamètre facultatifs.",
    params: [
      { key: "center", label: "Centre", type: "text", default: "O" },
      { key: "radius", label: "Rayon", type: "number", default: 3 },
      { key: "radiusLine", label: "Tracer un rayon [OA]", type: "bool", default: true },
      { key: "diameter", label: "Tracer un diamètre [BC]", type: "bool", default: false },
    ],
    build: (p) => {
      const c = S(p.center, "O"), r = N(p.radius, 3);
      const steps: GeoStep[] = [{ op: "circle", center: c, radius: r }];
      const items: GeoItem[] = [];
      if (p.radiusLine !== false) { steps.push({ op: "onCircle", name: "A", center: c, radius: r, angle: 35 }); items.push({ type: "segment", from: c, to: "A", label: true }); }
      if (p.diameter === true) { steps.push({ op: "onCircle", name: "B", center: c, radius: r, angle: 200 }, { op: "onCircle", name: "C", center: c, radius: r, angle: 20 }); items.push({ type: "segment", from: "B", to: "C", tone: "accent" }); }
      return { v: 1, kind: "geometry", unit: "cm", steps, items };
    },
  },
  {
    id: "symmetry-line",
    family: "transform",
    label: "Symétrie axiale",
    description: "Un triangle, l'axe (d) et son image.",
    params: [{ key: "dashed", label: "Tracer les liens point / image", type: "bool", default: true }],
    build: (p) => ({
      v: 1, kind: "geometry", grid: true, hideLabels: ["P", "Q"],
      steps: [
        { op: "point", name: "A", x: 1, y: 1 }, { op: "point", name: "B", x: 3, y: 1.5 }, { op: "point", name: "C", x: 1.5, y: 3.5 },
        { op: "point", name: "P", x: 4.5, y: -0.5 }, { op: "point", name: "Q", x: 4.5, y: 4.5 },
        { op: "image", map: { A: "A'", B: "B'", C: "C'" }, transform: { type: "symmetryLine", line: ["P", "Q"] } },
      ],
      items: [
        { type: "polygon", points: ["A", "B", "C"] },
        { type: "line", through: ["P", "Q"], tone: "accent", label: "(d)" },
        ...(p.dashed !== false ? (["A", "B", "C"].map((x) => ({ type: "segment", from: x, to: x + "'", dashed: true, tone: "gray" })) as GeoItem[]) : []),
      ],
    }),
  },
  {
    id: "symmetry-point",
    family: "transform",
    label: "Symétrie centrale",
    description: "Un triangle, le centre O et son image.",
    params: [],
    build: () => ({
      v: 1, kind: "geometry", grid: true,
      steps: [
        { op: "point", name: "O", x: 0, y: 0 },
        { op: "point", name: "A", x: 1, y: 1 }, { op: "point", name: "B", x: 3.5, y: 1.2 }, { op: "point", name: "C", x: 2, y: 3 },
        { op: "image", map: { A: "A'", B: "B'", C: "C'" }, transform: { type: "symmetryPoint", center: "O" } },
      ],
      items: [{ type: "polygon", points: ["A", "B", "C"] }, { type: "points", names: ["O"] }, ...(["A", "B", "C"].map((x) => ({ type: "segment", from: x, to: x + "'", dashed: true, tone: "gray" })) as GeoItem[])],
    }),
  },
  {
    id: "rotation",
    family: "transform",
    label: "Rotation",
    description: "Image d'un triangle par la rotation de centre O.",
    params: [{ key: "angle", label: "Angle (°, sens inverse des aiguilles d'une montre)", type: "number", default: 90 }],
    build: (p) => ({
      v: 1, kind: "geometry", grid: true,
      steps: [
        { op: "point", name: "O", x: 0, y: 0 },
        { op: "point", name: "A", x: 1.5, y: 0.5 }, { op: "point", name: "B", x: 4, y: 0.5 }, { op: "point", name: "C", x: 2, y: 2.5 },
        { op: "image", map: { A: "A'", B: "B'", C: "C'" }, transform: { type: "rotation", center: "O", angle: N(p.angle, 90) } },
      ],
      items: [{ type: "polygon", points: ["A", "B", "C"] }, { type: "points", names: ["O"] }, { type: "angle", points: ["A", "O", "A'"], label: `${N(p.angle, 90)}°` }, { type: "segment", from: "O", to: "A", dashed: true, tone: "gray" }, { type: "segment", from: "O", to: "A'", dashed: true, tone: "gray" }],
    }),
  },
  {
    id: "homothety",
    family: "transform",
    label: "Homothétie",
    description: "Agrandissement ou réduction de rapport k, de centre O.",
    params: [{ key: "k", label: "Rapport k", type: "number", default: 2 }],
    build: (p) => ({
      v: 1, kind: "geometry", grid: true,
      steps: [
        { op: "point", name: "O", x: 0, y: 0 },
        { op: "point", name: "A", x: 1, y: 0.5 }, { op: "point", name: "B", x: 2.5, y: 0.5 }, { op: "point", name: "C", x: 1.5, y: 1.8 },
        { op: "image", map: { A: "A'", B: "B'", C: "C'" }, transform: { type: "homothety", center: "O", k: N(p.k, 2) } },
      ],
      items: [{ type: "polygon", points: ["A", "B", "C"] }, { type: "points", names: ["O"] }, ...(["A", "B", "C"].map((x) => ({ type: "line", through: ["O", x], dashed: true, tone: "gray" })) as GeoItem[])],
    }),
  },
  {
    id: "translation",
    family: "transform",
    label: "Translation",
    description: "Image d'un triangle par la translation qui envoie E sur F.",
    params: [],
    build: () => ({
      v: 1, kind: "geometry", grid: true,
      steps: [
        { op: "point", name: "E", x: 0, y: 3.5 }, { op: "point", name: "F", x: 3, y: 4.5 },
        { op: "point", name: "A", x: 0, y: 0 }, { op: "point", name: "B", x: 2, y: 0 }, { op: "point", name: "C", x: 0.5, y: 1.8 },
        { op: "image", map: { A: "A'", B: "B'", C: "C'" }, transform: { type: "translation", from: "E", to: "F" } },
      ],
      items: [{ type: "polygon", points: ["A", "B", "C"] }, { type: "vector", from: "E", to: "F", tone: "accent" }],
    }),
  },
  {
    id: "function",
    family: "graph",
    label: "Fonction dans un repère",
    description: "Une ou deux courbes ; écris l'expression comme sur la calculatrice (2x + 1, x^2 - 3).",
    params: [
      { key: "expr", label: "f(x) =", type: "text", default: "2x - 1" },
      { key: "expr2", label: "g(x) = (facultatif)", type: "text", default: "" },
      { key: "xmin", label: "x minimum", type: "number", default: -4 },
      { key: "xmax", label: "x maximum", type: "number", default: 4 },
      { key: "point", label: "Point à placer (x ; y), facultatif", type: "text", default: "2 ; 3" },
    ],
    build: (p) => {
      const pt = S(p.point).split(";").map((x) => N(x, NaN));
      const curves = [{ expr: S(p.expr, "x"), name: "f" }];
      if (S(p.expr2)) curves.push({ expr: S(p.expr2), name: "g" });
      return {
        v: 1, kind: "graph", x: [N(p.xmin, -4), N(p.xmax, 4)], curves,
        points: pt.length === 2 && pt.every(Number.isFinite) ? [{ x: pt[0], y: pt[1], name: "A", guides: true }] : [],
      };
    },
  },
  {
    id: "numberline",
    family: "graph",
    label: "Droite graduée",
    description: "Graduations, points et intervalles (pour les inéquations).",
    params: [
      { key: "min", label: "De", type: "number", default: -3 },
      { key: "max", label: "À", type: "number", default: 5 },
      { key: "step", label: "Pas", type: "number", default: 1 },
      { key: "points", label: "Points (nom=valeur ; …)", type: "text", default: "A=-2 ; B=1,5" },
      { key: "interval", label: "Intervalle (de ; à), facultatif", type: "text", default: "" },
    ],
    build: (p) => {
      const points = list(p.points).map((x) => { const [nm, v] = x.split("="); return { name: v !== undefined ? nm.trim() : undefined, value: N(v ?? nm) }; });
      const iv = S(p.interval).split(";").map((x) => N(x, NaN));
      return {
        v: 1, kind: "numberline", min: N(p.min, -3), max: N(p.max, 5), step: N(p.step, 1) || 1, points,
        intervals: iv.length === 2 && iv.every(Number.isFinite) ? [{ from: iv[0], to: iv[1] }] : [],
      };
    },
  },
  {
    id: "bar",
    family: "stats",
    label: "Diagramme en barres",
    description: "Catégories et effectifs séparés par des points-virgules.",
    params: [
      { key: "categories", label: "Catégories", type: "text", default: "Lun ; Mar ; Mer ; Jeu ; Ven" },
      { key: "values", label: "Valeurs", type: "text", default: "12 ; 8 ; 15 ; 10 ; 6" },
      { key: "yLabel", label: "Titre de l'axe vertical", type: "text", default: "Effectif" },
      { key: "joined", label: "Histogramme (barres jointives)", type: "bool", default: false },
    ],
    build: (p) => ({ v: 1, kind: "bar", categories: list(p.categories), values: numbers(p.values), yLabel: S(p.yLabel) || undefined, joined: p.joined === true || undefined }),
  },
  {
    id: "pie",
    family: "stats",
    label: "Diagramme circulaire",
    description: "Parts et valeurs ; les pourcentages sont calculés.",
    params: [
      { key: "labels", label: "Parts", type: "text", default: "Vélo ; Bus ; À pied ; Voiture" },
      { key: "values", label: "Valeurs", type: "text", default: "8 ; 10 ; 5 ; 7" },
    ],
    build: (p) => ({ v: 1, kind: "pie", items: list(p.labels).map((label, i) => ({ label, value: numbers(p.values)[i] ?? 0 })) }),
  },
  {
    id: "linechart",
    family: "stats",
    label: "Courbe d'évolution",
    description: "Une série de valeurs dans le temps.",
    params: [
      { key: "labels", label: "Abscisses", type: "text", default: "2020 ; 2021 ; 2022 ; 2023 ; 2024" },
      { key: "values", label: "Valeurs", type: "text", default: "120 ; 135 ; 128 ; 150 ; 162" },
      { key: "yLabel", label: "Grandeur", type: "text", default: "" },
    ],
    build: (p) => ({ v: 1, kind: "linechart", labels: list(p.labels), series: [{ values: numbers(p.values) }], yLabel: S(p.yLabel) || undefined }),
  },
  {
    id: "tree",
    family: "proba",
    label: "Arbre de probabilités",
    description: "Une ou deux épreuves. Issues : « R=1/3 ; B=2/3 ».",
    params: [
      { key: "first", label: "Première épreuve", type: "text", default: "R=3/5 ; B=2/5" },
      { key: "second", label: "Deuxième épreuve (vide = une seule)", type: "text", default: "R=2/4 ; B=2/4" },
    ],
    build: (p) => {
      const parse = (v: unknown): TreeBranch[] => list(v).map((x) => { const [label, pr] = x.split("="); return { label: label.trim(), p: pr?.trim() }; });
      const second = parse(p.second);
      return { v: 1, kind: "tree", branches: parse(p.first).map((b) => ({ ...b, children: second.length ? second.map((c) => ({ ...c })) : undefined })) };
    },
  },
  {
    id: "solid",
    family: "solid",
    label: "Solide",
    description: "Pavé, cube, cylindre, cône, pyramide, sphère ou prisme, en perspective cavalière.",
    params: [
      { key: "shape", label: "Solide", type: "select", default: "box", options: [
        { value: "box", label: "Pavé droit" }, { value: "cube", label: "Cube" }, { value: "cylinder", label: "Cylindre" },
        { value: "cone", label: "Cône" }, { value: "pyramid", label: "Pyramide à base carrée" }, { value: "sphere", label: "Boule" }, { value: "prism", label: "Prisme droit" },
      ] },
      { key: "a", label: "Longueur ou côté", type: "number", default: 5 },
      { key: "b", label: "Largeur (pavé, prisme)", type: "number", default: 3 },
      { key: "c", label: "Hauteur (pavé)", type: "number", default: 4 },
      { key: "r", label: "Rayon", type: "number", default: 2 },
      { key: "h", label: "Hauteur (cylindre, cône, pyramide, prisme)", type: "number", default: 5 },
      { key: "names", label: "Noms des sommets (facultatif)", type: "text", default: "" },
    ],
    build: (p) => ({
      v: 1, kind: "solid", shape: S(p.shape, "box") as "box", showDims: true,
      dims: { a: N(p.a, 5), b: N(p.b, 3), c: N(p.c, 4), r: N(p.r, 2), h: N(p.h, 5) },
      names: S(p.names) ? splitNames(S(p.names)) : undefined,
    }),
  },
  {
    id: "program",
    family: "other",
    label: "Programme de calcul",
    description: "Une étape par ligne ou séparées par « ; ».",
    params: [{ key: "steps", label: "Étapes", type: "text", default: "Choisir un nombre ; Multiplier par 3 ; Ajouter 5 ; Écrire le résultat" }],
    build: (p) => ({ v: 1, kind: "program", steps: list(p.steps) }),
  },
];

export const presetDefaults = (preset: FigPreset): V => Object.fromEntries(preset.params.map((p) => [p.key, p.default]));
