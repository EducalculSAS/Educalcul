/**
 * Suite du catalogue de figures : constructions, interactif, statistiques, nombres, probabilités, espace (3D).
 * Chaque modèle est une figure complète que l'admin modifie ensuite à volonté (mêmes éléments, même éditeur).
 */
import type { JsxElement, JsxFigureSpec } from "@/lib/jsxFigure";
import { P, base } from "@/lib/jsxPresets";

type Preset = { id: string; label: string; group: string; spec: JsxFigureSpec };

const M = (id: string, x: number, y: number, extra: Partial<JsxElement> = {}): JsxElement => P(id, x, y, id, { movable: true, ...extra });
const T = (x: number, y: number, text: string, extra: Partial<JsxElement> = {}): JsxElement => ({ kind: "text", x, y, text, size: 14, anchor: "left", ...extra });
const flat = (caption: string, bb: [number, number, number, number], elements: JsxElement[], extra: Partial<JsxFigureSpec> = {}): JsxFigureSpec => base(caption, bb, elements, { grid: false, axes: false, ...extra });
const space = (caption: string, elements: JsxElement[], box: [number, number, number, number, number, number] = [-3, 3, -3, 3, 0, 5]): JsxFigureSpec => ({
  type: "jsx_figure", caption, boundingBox: [-6, 5, 6, -5], axes: false, grid: false, keepAspect: true, showNames: false, mode: "3d", box3d: box, height: 340, elements,
});

/** Toile d'araignée d'une suite u(n+1) = f(u(n)) : tracé calculé une fois pour toutes. */
function cobweb(f: (x: number) => number, u0: number, steps: number): [number, number][] {
  const pts: [number, number][] = [[u0, 0]];
  let u = u0;
  for (let i = 0; i < steps; i++) {
    const next = f(u);
    pts.push([u, next], [next, next]);
    u = next;
  }
  return pts;
}

export const JSX_PRESETS_MORE: Preset[] = [
  // ---- Géométrie plane : constructions et théorèmes
  { id: "pythagoras", label: "Théorème de Pythagore (carrés)", group: "Géométrie plane", spec: flat("Les trois carrés du théorème de Pythagore", [-5, 8, 8, -5], [
    P("A", 0, 0), P("B", 4, 0), P("C", 0, 3), { kind: "polygon", vertices: ["A", "B", "C"], color: "navy" }, { kind: "angle", points: ["B", "A", "C"], radius: 0.5 },
    { kind: "shape", points: [[0, 0], [4, 0], [4, -4], [0, -4]], color: "blue" }, { kind: "shape", points: [[0, 0], [0, 3], [-3, 3], [-3, 0]], color: "green" }, { kind: "shape", points: [[4, 0], [0, 3], [3, 7], [7, 4]], color: "red" },
    { kind: "text", x: 2, y: -2, text: "16", size: 18 }, { kind: "text", x: -1.5, y: 1.5, text: "9", size: 18 }, { kind: "text", x: 3.5, y: 3.5, text: "25", size: 18 },
  ]) },
  { id: "parallels", label: "Parallèles et sécante (angles)", group: "Géométrie plane", spec: flat("Angles correspondants", [-6, 6, 6, -1], [
    P("P1", -5.5, 1, "", { hidden: true }), P("P2", 5.5, 1, "", { hidden: true }), P("Q1", -5.5, 4, "", { hidden: true }), P("Q2", 5.5, 4, "", { hidden: true }), P("S1", -1.5, -0.5, "", { hidden: true }), P("S2", 2.5, 5.5, "", { hidden: true }),
    { kind: "line", id: "l1", through: ["P1", "P2"] }, { kind: "line", id: "l2", through: ["Q1", "Q2"] }, { kind: "line", id: "s", through: ["S1", "S2"], color: "red" },
    { kind: "intersection", id: "I1", of: ["s", "l1"], index: 0 }, { kind: "intersection", id: "I2", of: ["s", "l2"], index: 0 },
    { kind: "angle", points: ["P2", "I1", "S2"], radius: 0.9, color: "gold" }, { kind: "angle", points: ["Q2", "I2", "S2"], radius: 0.9, color: "gold" },
  ], { grid: true }) },
  { id: "medians", label: "Médianes et centre de gravité", group: "Géométrie plane", spec: flat("Les trois médianes se coupent au centre de gravité", [-1, 7, 10, -1], [
    M("A", 1, 1), M("B", 9, 1), M("C", 4, 6), { kind: "polygon", vertices: ["A", "B", "C"] },
    { kind: "midpoint", id: "Ma", of: ["B", "C"] }, { kind: "midpoint", id: "Mb", of: ["A", "C"] }, { kind: "midpoint", id: "Mc", of: ["A", "B"] },
    { kind: "segment", id: "ma", from: "A", to: "Ma", color: "gold" }, { kind: "segment", id: "mb", from: "B", to: "Mb", color: "gold" }, { kind: "segment", id: "mc", from: "C", to: "Mc", color: "gold" },
    { kind: "intersection", id: "G", of: ["ma", "mb"], index: 0, color: "red" },
  ], { grid: true }) },
  { id: "circumcircle", label: "Cercle circonscrit", group: "Géométrie plane", spec: flat("Le centre du cercle circonscrit est sur les médiatrices", [-3, 8, 11, -4], [
    M("A", 1, 1), M("B", 9, 1), M("C", 3, 6), { kind: "polygon", vertices: ["A", "B", "C"], filled: false },
    { kind: "perpendicular_bisector", id: "m1", of: ["A", "B"], color: "gold", dash: true }, { kind: "perpendicular_bisector", id: "m2", of: ["A", "C"], color: "gold", dash: true },
    { kind: "intersection", id: "O", of: ["m1", "m2"], index: 0, color: "red" }, { kind: "circle", center: "O", through: "A", filled: false, color: "blue" },
  ], { grid: true }) },
  { id: "inscribed_angle", label: "Angle inscrit et angle au centre", group: "Géométrie plane", spec: flat("Angle inscrit et angle au centre", [-4.5, 4.5, 4.5, -4], [
    P("O", 0, 0), P("A", -2.82, -1.03), P("B", 2.82, -1.03), P("M", -0.52, 2.95),
    { kind: "circle", center: "O", through: "A", filled: false }, { kind: "segment", from: "M", to: "A" }, { kind: "segment", from: "M", to: "B" },
    { kind: "segment", from: "O", to: "A", color: "gold" }, { kind: "segment", from: "O", to: "B", color: "gold" },
    { kind: "angle", points: ["B", "M", "A"], radius: 0.8, color: "blue" }, { kind: "angle", points: ["B", "O", "A"], radius: 0.7, color: "gold" },
  ]) },
  { id: "trig_triangle", label: "Trigonométrie du triangle rectangle", group: "Géométrie plane", spec: flat("Côté adjacent, côté opposé, hypoténuse", [-1, 5, 7.5, -1.5], [
    P("A", 0, 0), P("B", 5.5, 0), P("C", 5.5, 4), { kind: "polygon", vertices: ["A", "B", "C"] }, { kind: "angle", points: ["C", "B", "A"], radius: 0.4, color: "navy" }, { kind: "angle", points: ["B", "A", "C"], radius: 1.1, color: "gold" },
    { kind: "text", x: 2.75, y: -0.6, text: "côté adjacent", size: 14 }, { kind: "text", x: 6.6, y: 2, text: "côté opposé", size: 14 }, { kind: "text", x: 2.2, y: 2.4, text: "hypoténuse", size: 14, color: "red" },
  ]) },
  { id: "hexagon", label: "Polygone régulier", group: "Géométrie plane", spec: flat("Hexagone régulier et ses diagonales", [-4, 4, 4, -4], [{ kind: "regular_polygon", sides: 6, radius: 3, diagonals: true }]) },

  // ---- Interactif : l'élève déplace, les mesures suivent
  { id: "thales_live", label: "Thalès interactif (rapports en direct)", group: "Interactif", spec: flat("Déplace M : les rapports restent égaux", [-1, 7.5, 10, -2.5], [
    P("A", 1, 1), P("B", 9, 1), P("C", 4, 6), M("M", 3.4, 1), { kind: "polygon", vertices: ["A", "B", "C"], filled: false },
    { kind: "line", id: "bc", through: ["B", "C"], hidden: true }, { kind: "line", id: "ac", through: ["A", "C"], hidden: true },
    { kind: "parallel", id: "par", line: "bc", through: "M", color: "red" }, { kind: "intersection", id: "N", of: ["par", "ac"], index: 0, color: "red" },
    T(0, -1.2, "AM / AB = {dist(A,M) / dist(A,B)}", { size: 15 }), T(0, -2, "AN / AC = {dist(A,N) / dist(A,C)}", { size: 15 }),
  ]) },
  { id: "triangle_angles", label: "Somme des angles d'un triangle", group: "Interactif", spec: flat("Déplace les sommets : la somme reste 180°", [-1, 8, 10, -3.5], [
    M("A", 1, 1), M("B", 8, 1.5), M("C", 4, 6), { kind: "polygon", vertices: ["A", "B", "C"] },
    { kind: "angle", points: ["B", "A", "C"], radius: 0.9, color: "gold" }, { kind: "angle", points: ["C", "B", "A"], radius: 0.9, color: "blue" }, { kind: "angle", points: ["A", "C", "B"], radius: 0.9, color: "green" },
    T(0, -1, "Angle A = {angle(B,A,C)}°", { size: 15 }), T(0, -1.7, "Angle B = {angle(A,B,C)}°", { size: 15 }), T(0, -2.4, "Angle C = {angle(A,C,B)}°", { size: 15 }),
    T(0, -3.1, "Somme = {angle(B,A,C) + angle(A,B,C) + angle(A,C,B)}°", { size: 15, color: "red" }),
  ]) },
  { id: "line_two_points", label: "Droite par deux points (pente)", group: "Interactif", spec: base("Déplace A et B : la pente suit", [-6, 6, 6, -6], [
    M("A", -2, -1), M("B", 3, 3), { kind: "line", through: ["A", "B"], color: "blue" },
    T(-5.5, 5, "pente = {slope(A,B)}", { size: 15 }), T(-5.5, 4.2, "A({px(A)} ; {py(A)})   B({px(B)} ; {py(B)})", { size: 13 }),
  ], { axes: true }) },
  { id: "coordinates", label: "Coordonnées d'un point", group: "Interactif", spec: base("Déplace M pour lire ses coordonnées", [-6, 6, 6, -6], [
    M("M", 3, 2, { color: "red" }), T(-5.5, 5, "M({px(M)} ; {py(M)})", { size: 16 }),
  ], { axes: true }) },
  { id: "complex_plane", label: "Plan complexe (module, argument)", group: "Interactif", spec: base("Nombre complexe z = a + bi", [-5, 5, 5, -5], [
    P("O", 0, 0, "", { hidden: true }), M("M", 3, 2, { color: "red" }), { kind: "vector", from: "O", to: "M", color: "blue" },
    T(-4.7, 4.3, "z = {px(M)} + {py(M)}i", { size: 15 }), T(-4.7, 3.5, "|z| = {sqrt(px(M)^2 + py(M)^2)}", { size: 15 }), T(-4.7, 2.7, "arg(z) = {atan2(py(M), px(M)) * 180 / pi}°", { size: 15 }),
  ], { axes: true }) },
  { id: "tangent_live", label: "Tangente mobile (dérivée)", group: "Interactif", spec: base("Fais glisser le point rouge sur la courbe", [-4, 7, 5, -2], [
    { kind: "function", id: "f", expr: "x^2/2", color: "blue" }, { kind: "tangent", graph: "f", x: 1, color: "red", movable: true },
  ], { axes: true }) },
  { id: "sine_sliders", label: "Sinus : amplitude et période", group: "Interactif", spec: base("y = a·sin(b·x)", [-7, 4, 7, -4], [
    { kind: "slider", id: "a", label: "a", x1: -6, y1: -3, x2: -2.5, y2: -3, min: 0.5, value: 1, max: 3, step: 0.5 },
    { kind: "slider", id: "b", label: "b", x1: 0, y1: -3, x2: 3.5, y2: -3, min: 0.5, value: 1, max: 3, step: 0.5 },
    { kind: "function", expr: "a*sin(b*x)", color: "blue" },
  ], { axes: true }) },

  // ---- Fonctions
  { id: "exp_ln", label: "Exponentielle et logarithme", group: "Fonctions", spec: base("Courbes de exp et ln, symétriques par rapport à y = x", [-3, 5, 6, -3], [
    { kind: "function", expr: "exp(x)", color: "blue", domain: [-3, 1.7] }, { kind: "function", expr: "ln(x)", color: "green", domain: [0.05, 6] }, { kind: "function", expr: "x", color: "gray", dash: true },
  ], { axes: true }) },
  { id: "cobweb", label: "Suite récurrente (toile d'araignée)", group: "Fonctions", spec: base("u(n+1) = 0,5·u(n) + 1", [-0.5, 4.5, 4.5, -0.5], [
    { kind: "function", expr: "0.5*x+1", color: "blue", domain: [0, 4.4] }, { kind: "function", expr: "x", color: "gray", dash: true },
    { kind: "shape", points: cobweb((x) => 0.5 * x + 1, 0.5, 6), closed: false, color: "red", width: 1.5 },
  ], { axes: true }) },

  // ---- Statistiques
  { id: "bar_chart", label: "Diagramme en barres", group: "Statistiques", spec: flat("Notes de la classe", [-0.5, 12, 6.5, -2], [{ kind: "bar_chart", data: [{ label: "Lundi", value: 4 }, { label: "Mardi", value: 7 }, { label: "Mercredi", value: 5 }, { label: "Jeudi", value: 9 }] }], { axes: true, grid: true }) },
  { id: "histogram", label: "Histogramme", group: "Statistiques", spec: flat("Répartition des tailles", [-1, 14, 21, -2], [{ kind: "histogram", bins: [{ from: 0, to: 5, count: 3 }, { from: 5, to: 10, count: 8 }, { from: 10, to: 15, count: 12 }, { from: 15, to: 20, count: 5 }] }], { axes: true, grid: true }) },
  { id: "pie_chart", label: "Camembert", group: "Statistiques", spec: flat("Répartition des élèves", [-5.5, 5, 5.5, -5], [{ kind: "pie_chart", slices: [{ label: "Filles", value: 12 }, { label: "Garçons", value: 8 }, { label: "Autres", value: 4 }] }]) },
  { id: "box_plot", label: "Boîte à moustaches", group: "Statistiques", spec: flat("Boîte à moustaches", [0, 4, 14, -1.5], [{ kind: "box_plot", min: 2, q1: 5, median: 7, q3: 9, max: 12 }]) },
  { id: "scatter", label: "Nuage de points et droite de régression", group: "Statistiques", spec: base("Nuage de points", [-1, 9, 10, -1], [{ kind: "scatter", points: [[1, 2], [2, 3.2], [3, 3.9], [4, 5.1], [5, 5.8], [6, 7.3], [7, 7.9]], regression: true }], { axes: true }) },

  // ---- Nombres et fractions
  { id: "number_line", label: "Droite graduée (nombres relatifs)", group: "Nombres", spec: flat("Droite graduée", [-6.5, 3, 6.5, -2], [{ kind: "number_line", min: -5, max: 5, step: 1, points: [{ value: -3, label: "A" }, { value: 2, label: "B" }] }]) },
  { id: "interval", label: "Intervalle sur la droite", group: "Nombres", spec: flat("Intervalle ]-2 ; 3]", [-6.5, 3, 6.5, -2], [{ kind: "number_line", min: -5, max: 5, step: 1, intervals: [{ from: -2, to: 3, fromOpen: true, toOpen: false }] }]) },
  { id: "fraction_bar", label: "Fraction : barre", group: "Nombres", spec: flat("Trois quarts", [-1, 3, 7, -2], [{ kind: "fraction_bar", parts: 4, filled: 3 }]) },
  { id: "fraction_disc", label: "Fraction : disque", group: "Nombres", spec: flat("Trois huitièmes", [-4, 3.5, 4, -4.2], [{ kind: "fraction_disc", parts: 8, filled: 3 }]) },
  { id: "grid_paint", label: "Quadrillage à colorier", group: "Nombres", spec: flat("3 × 4 : 7 cases coloriées", [-1, 1, 5, -4], [{ kind: "grid_paint", rows: 3, cols: 4, painted: 7 }]) },
  { id: "pyramid", label: "Pyramide de briques (cases à remplir)", group: "Nombres", spec: flat("Complète la pyramide : chaque brique est la somme des deux briques en dessous", [-1, 1, 7, -4.5], [{ kind: "pyramid", levels: [["{{1}}"], ["{{2}}", "5"], ["3", "{{3}}", "2"]] }]) },
  { id: "magic_square", label: "Carré magique (cases à remplir)", group: "Nombres", spec: flat("Carré magique de somme 15", [-1, 1, 6.5, -4.5], [{ kind: "grid_cells", rows: [["8", "{{1}}", "6"], ["{{2}}", "5", "{{3}}"], ["4", "{{4}}", "2"]] }]) },
  { id: "table_cells", label: "Tableau de cases", group: "Nombres", spec: flat("Tableau de proportionnalité", [-1, 1, 8, -3.5], [{ kind: "grid_cells", cellWidth: 1.8, rows: [["x", "2", "4", "6"], ["y", "5", "{{1}}", "15"]] }]) },

  // ---- Probabilités et ensembles
  { id: "prob_tree", label: "Arbre de probabilités", group: "Probabilités", spec: flat("Deux lancers d'une pièce", [-1, 2, 12, -4], [{ kind: "prob_tree", root: "", branches: [{ label: "Pile", p: "1/2", children: [{ label: "Pile", p: "1/2" }, { label: "Face", p: "1/2" }] }, { label: "Face", p: "1/2", children: [{ label: "Pile", p: "1/2" }, { label: "Face", p: "1/2" }] }] }]) },
  { id: "venn2", label: "Diagramme de Venn (2 ensembles)", group: "Probabilités", spec: flat("Deux ensembles A et B", [-4.5, 4, 4.5, -4], [{ kind: "venn", sets: [{ label: "A" }, { label: "B" }], counts: { A: "7", AB: "5", B: "3", out: "2" } }]) },
  { id: "venn3", label: "Diagramme de Venn (3 ensembles)", group: "Probabilités", spec: flat("Trois ensembles", [-4.5, 4.2, 4.5, -4.2], [{ kind: "venn", sets: [{ label: "A" }, { label: "B" }, { label: "C" }], counts: { A: "4", B: "3", C: "5", AB: "2", AC: "1", BC: "2", ABC: "1" } }]) },

  // ---- Dans l'espace (la figure se fait tourner à la souris)
  { id: "cube", label: "Cube", group: "Dans l'espace", spec: space("Cube d'arête 3 cm", [{ kind: "solid3d", shape: "cube", a: 3, at: [0, 0, 1.5] }]) },
  { id: "box", label: "Pavé droit", group: "Dans l'espace", spec: space("Pavé droit", [{ kind: "solid3d", shape: "box", a: 4, b: 2.5, c: 2, at: [0, 0, 1] }]) },
  { id: "pyramid3d", label: "Pyramide à base carrée", group: "Dans l'espace", spec: space("Pyramide", [{ kind: "solid3d", shape: "pyramid", a: 3, h: 3.5 }]) },
  { id: "prism3d", label: "Prisme droit", group: "Dans l'espace", spec: space("Prisme droit à base triangulaire", [{ kind: "solid3d", shape: "prism", a: 3, h: 3.5 }]) },
  { id: "tetra", label: "Tétraèdre", group: "Dans l'espace", spec: space("Tétraèdre régulier", [{ kind: "solid3d", shape: "tetra", a: 3.5 }]) },
  { id: "cylinder3d", label: "Cylindre", group: "Dans l'espace", spec: space("Cylindre", [{ kind: "solid3d", shape: "cylinder", r: 1.6, h: 3.5 }]) },
  { id: "cone3d", label: "Cône", group: "Dans l'espace", spec: space("Cône", [{ kind: "solid3d", shape: "cone", r: 1.8, h: 3.5 }]) },
  { id: "sphere3d", label: "Sphère", group: "Dans l'espace", spec: space("Sphère", [{ kind: "solid3d", shape: "sphere", r: 2.2, at: [0, 0, 2.5] }]) },
  { id: "paraboloid", label: "Surface z = f(x, y)", group: "Dans l'espace", spec: space("Paraboloïde z = (x² + y²) / 3", [{ kind: "surface3d", expr: "(x^2+y^2)/3", color: "blue" }], [-3, 3, -3, 3, 0, 6]) },
  { id: "helix", label: "Hélice (courbe paramétrée)", group: "Dans l'espace", spec: space("Hélice", [{ kind: "curve3d", x: "2*cos(t)", y: "2*sin(t)", z: "t/3", t: [0, 12.5], color: "red" }], [-3, 3, -3, 3, 0, 5]) },
];
