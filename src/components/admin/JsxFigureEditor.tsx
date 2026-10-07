"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  JSX_TONES,
  buildJsxBoard,
  normalizeJsxSpec,
  type JsxElement,
  type JsxFigureSpec,
  type JsxKind,
} from "@/lib/jsxFigure";
import { JSX_CATALOG as JSX_PRESETS } from "@/lib/jsxCatalog";

/* ------------------------------------------------------------------ */
/*  Description de chaque type d'élément : ses champs et ses valeurs    */
/* ------------------------------------------------------------------ */

type FieldKind = "ref" | "refs" | "number" | "expr" | "text" | "bool" | "select" | "range" | "json" | "records" | "matrix" | "list";
interface Column {
  key: string;
  label: string;
  type: "text" | "number" | "bool" | "color";
}
interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  /** refs : nombre d'éléments (0 = nombre libre). */
  count?: number;
  options?: string[];
  hint?: string;
  /** records : colonnes du tableau à saisir. */
  columns?: Column[];
  /** matrix : les cellules sont des nombres. */
  numeric?: boolean;
}

interface KindDef {
  label: string;
  family: string;
  fields: Field[];
  make: (id: string) => Partial<JsxElement>;
}

const f = (key: string, label: string, kind: FieldKind, extra: Partial<Field> = {}): Field => ({ key, label, kind, ...extra });

const KIND_DEFS: Record<JsxKind, KindDef> = {
  point: { label: "Point", family: "Points et droites", fields: [f("x", "x", "number"), f("y", "y", "number"), f("label", "Nom", "text", { hint: "ou {{1}} pour une case de réponse" })], make: (id) => ({ x: 0, y: 0, label: id }) },
  segment: { label: "Segment", family: "Points et droites", fields: [f("from", "De", "ref"), f("to", "À", "ref")], make: () => ({}) },
  line: { label: "Droite", family: "Points et droites", fields: [f("through", "Passe par", "refs", { count: 2 })], make: () => ({}) },
  ray: { label: "Demi-droite", family: "Points et droites", fields: [f("from", "Origine", "ref"), f("to", "Passe par", "ref")], make: () => ({}) },
  vector: { label: "Vecteur", family: "Points et droites", fields: [f("from", "Origine", "ref"), f("to", "Extrémité", "ref")], make: () => ({}) },
  midpoint: { label: "Milieu", family: "Points et droites", fields: [f("of", "Milieu de", "refs", { count: 2 }), f("label", "Nom", "text")], make: () => ({ label: "I" }) },
  intersection: { label: "Intersection", family: "Points et droites", fields: [f("of", "Entre", "refs", { count: 2 }), f("index", "Numéro (0, 1...)", "number"), f("label", "Nom", "text")], make: () => ({ index: 0, label: "M" }) },
  circle: { label: "Cercle", family: "Cercles et polygones", fields: [f("center", "Centre", "ref"), f("through", "Passe par", "ref"), f("radius", "ou rayon", "number")], make: () => ({}) },
  arc: { label: "Arc de cercle", family: "Cercles et polygones", fields: [f("center", "Centre", "ref"), f("from", "De", "ref"), f("to", "À", "ref")], make: () => ({}) },
  sector: { label: "Secteur", family: "Cercles et polygones", fields: [f("center", "Centre", "ref"), f("from", "De", "ref"), f("to", "À", "ref")], make: () => ({}) },
  polygon: { label: "Polygone", family: "Cercles et polygones", fields: [f("vertices", "Sommets (dans l'ordre)", "refs", { count: 0 }), f("filled", "Rempli", "bool")], make: () => ({ vertices: [] }) },
  angle: { label: "Angle", family: "Cercles et polygones", fields: [f("points", "Points A, sommet, B", "refs", { count: 3 }), f("label", "Valeur affichée", "text", { hint: "ex. 50° ou {{1}}" }), f("radius", "Rayon", "number")], make: () => ({ label: "", radius: 0.8 }) },
  perpendicular: { label: "Perpendiculaire", family: "Constructions", fields: [f("line", "À la droite", "ref"), f("through", "Passant par", "ref")], make: () => ({}) },
  parallel: { label: "Parallèle", family: "Constructions", fields: [f("line", "À la droite", "ref"), f("through", "Passant par", "ref")], make: () => ({}) },
  bisector: { label: "Bissectrice", family: "Constructions", fields: [f("points", "Points A, sommet, B", "refs", { count: 3 })], make: () => ({}) },
  perpendicular_bisector: { label: "Médiatrice", family: "Constructions", fields: [f("of", "Du segment", "refs", { count: 2 })], make: () => ({}) },
  reflect: { label: "Symétrique (axiale)", family: "Transformations", fields: [f("of", "Du point", "ref"), f("over", "Par rapport à la droite", "ref"), f("label", "Nom", "text")], make: () => ({ label: "A'" }) },
  rotate: { label: "Image par rotation", family: "Transformations", fields: [f("of", "Du point", "ref"), f("center", "Centre", "ref"), f("angle", "Angle (degrés)", "number"), f("label", "Nom", "text")], make: () => ({ angle: 90, label: "A'" }) },
  translate: { label: "Image par translation", family: "Transformations", fields: [f("of", "Du point", "ref"), f("dx", "Vecteur x", "number"), f("dy", "Vecteur y", "number"), f("label", "Nom", "text")], make: () => ({ dx: 3, dy: 1, label: "A'" }) },
  dilate: { label: "Image par homothétie", family: "Transformations", fields: [f("of", "Du point", "ref"), f("center", "Centre", "ref"), f("ratio", "Rapport", "number"), f("label", "Nom", "text")], make: () => ({ ratio: 2, label: "A'" }) },
  function: { label: "Courbe y = f(x)", family: "Fonctions et courbes", fields: [f("expr", "f(x) =", "expr", { hint: "x^2-3*x+1, sin(x), sqrt(x), abs(x)... ; les curseurs (a, b...) sont utilisables" }), f("domain", "Domaine (facultatif)", "range")], make: () => ({ expr: "x^2", color: "blue" }) },
  parametric: { label: "Courbe paramétrée", family: "Fonctions et courbes", fields: [f("x", "x(t) =", "expr"), f("y", "y(t) =", "expr"), f("t", "t de... à...", "range")], make: () => ({ x: "cos(t)", y: "sin(t)", t: [0, 6.2832], color: "blue" }) },
  implicit: { label: "Courbe F(x, y) = 0", family: "Fonctions et courbes", fields: [f("expr", "F(x, y) =", "expr", { hint: "x^2/9+y^2/4-1 (ellipse), y-x^2 (parabole)..." })], make: () => ({ expr: "x^2+y^2-4", color: "blue" }) },
  tangent: { label: "Tangente à une courbe", family: "Fonctions et courbes", fields: [f("graph", "À la courbe", "ref"), f("x", "En x =", "number")], make: () => ({ x: 1, color: "red" }) },
  integral: { label: "Aire sous la courbe", family: "Fonctions et courbes", fields: [f("graph", "Courbe", "ref"), f("from", "De x =", "number"), f("to", "à x =", "number")], make: () => ({ from: 0, to: 2, color: "blue" }) },
  riemann: { label: "Rectangles de Riemann", family: "Fonctions et courbes", fields: [f("graph", "Courbe", "ref"), f("n", "Nombre de rectangles", "number"), f("type", "Type", "select", { options: ["left", "right", "middle", "lower", "upper", "trapezoidal"] }), f("from", "De x =", "number"), f("to", "à x =", "number")], make: () => ({ n: 8, type: "left", from: 0, to: 4 }) },
  inequality: { label: "Demi-plan (inéquation)", family: "Fonctions et courbes", fields: [f("line", "Frontière (droite)", "ref"), f("inverse", "Côté opposé", "bool")], make: () => ({}) },
  vectorfield: { label: "Champ de vecteurs", family: "Fonctions et courbes", fields: [f("fx", "Composante en x", "expr", { hint: "ex. -y" }), f("fy", "Composante en y", "expr", { hint: "ex. x" })], make: () => ({ fx: "-y", fy: "x" }) },
  text: { label: "Texte", family: "Annotations", fields: [f("text", "Texte", "text", { hint: "ou {{1}} pour une case de réponse" }), f("x", "x", "number"), f("y", "y", "number"), f("size", "Taille", "number")], make: () => ({ text: "Texte", x: 0, y: 0, size: 15 }) },
  slider: { label: "Curseur", family: "Annotations", fields: [f("label", "Nom (a, b, t...)", "text"), f("min", "Min", "number"), f("value", "Valeur", "number"), f("max", "Max", "number"), f("step", "Pas", "number"), f("x1", "Position x gauche", "number"), f("y1", "Position y", "number"), f("x2", "Position x droite", "number")], make: (id) => ({ label: id, min: 0, value: 1, max: 5, step: 0.5 }) },
  rect: { label: "Rectangle (coordonnées)", family: "Formes à coordonnées", fields: [f("x", "x (coin bas gauche)", "number"), f("y", "y", "number"), f("w", "Largeur", "number"), f("h", "Hauteur", "number")], make: () => ({ x: 0, y: 0, w: 3, h: 2 }) },
  shape: { label: "Polygone ou ligne brisée (coordonnées)", family: "Formes à coordonnées", fields: [f("points", "Points : un par ligne, « x ; y »", "matrix", { numeric: true }), f("closed", "Fermé (polygone)", "bool")], make: () => ({ points: [[0, 0], [3, 0], [1.5, 2.5]] }) },
  seg: { label: "Segment (coordonnées)", family: "Formes à coordonnées", fields: [f("x1", "x de départ", "number"), f("y1", "y de départ", "number"), f("x2", "x d'arrivée", "number"), f("y2", "y d'arrivée", "number")], make: () => ({ x1: 0, y1: 0, x2: 3, y2: 2 }) },
  toggle: { label: "Case à cocher (afficher / masquer)", family: "Annotations", fields: [f("label", "Texte de la case", "text"), f("targets", "Éléments concernés (noms séparés par des virgules)", "list"), f("x", "x", "number"), f("y", "y", "number")], make: () => ({ label: "Afficher", targets: [], x: -5, y: 4 }) },
  bar_chart: { label: "Diagramme en barres", family: "Statistiques", fields: [f("data", "Barres", "records", { columns: [{ key: "label", label: "Nom", type: "text" }, { key: "value", label: "Valeur", type: "number" }, { key: "color", label: "Couleur", type: "color" }] })], make: () => ({ data: [{ label: "A", value: 4 }, { label: "B", value: 7 }] }) },
  histogram: { label: "Histogramme", family: "Statistiques", fields: [f("bins", "Classes", "records", { columns: [{ key: "from", label: "De", type: "number" }, { key: "to", label: "À", type: "number" }, { key: "count", label: "Effectif", type: "number" }] })], make: () => ({ bins: [{ from: 0, to: 5, count: 3 }, { from: 5, to: 10, count: 6 }] }) },
  pie_chart: { label: "Camembert", family: "Statistiques", fields: [f("slices", "Parts", "records", { columns: [{ key: "label", label: "Nom", type: "text" }, { key: "value", label: "Valeur", type: "number" }, { key: "color", label: "Couleur", type: "color" }] })], make: () => ({ slices: [{ label: "A", value: 6 }, { label: "B", value: 4 }] }) },
  box_plot: { label: "Boîte à moustaches", family: "Statistiques", fields: [f("min", "Minimum", "number"), f("q1", "1er quartile", "number"), f("median", "Médiane", "number"), f("q3", "3e quartile", "number"), f("max", "Maximum", "number")], make: () => ({ min: 2, q1: 5, median: 7, q3: 9, max: 12 }) },
  scatter: { label: "Nuage de points", family: "Statistiques", fields: [f("points", "Points : un par ligne, « x ; y »", "matrix", { numeric: true }), f("regression", "Droite de régression", "bool")], make: () => ({ points: [[1, 2], [2, 3], [3, 5], [4, 6]], regression: true }) },
  number_line: { label: "Droite graduée", family: "Nombres", fields: [f("min", "Minimum", "number"), f("max", "Maximum", "number"), f("step", "Pas", "number"), f("points", "Points", "records", { columns: [{ key: "value", label: "Valeur", type: "number" }, { key: "label", label: "Nom", type: "text" }, { key: "color", label: "Couleur", type: "color" }] }), f("intervals", "Intervalles", "records", { columns: [{ key: "from", label: "De", type: "number" }, { key: "to", label: "À", type: "number" }, { key: "fromOpen", label: "Ouvert à gauche", type: "bool" }, { key: "toOpen", label: "Ouvert à droite", type: "bool" }] })], make: () => ({ min: -5, max: 5, step: 1, points: [{ value: 2, label: "A" }] }) },
  fraction_bar: { label: "Fraction : barre", family: "Nombres", fields: [f("parts", "Parts", "number"), f("filled", "Parts colorées", "number")], make: () => ({ parts: 4, filled: 3 }) },
  fraction_disc: { label: "Fraction : disque", family: "Nombres", fields: [f("parts", "Parts", "number"), f("filled", "Parts colorées", "number")], make: () => ({ parts: 8, filled: 3 }) },
  grid_paint: { label: "Quadrillage à colorier", family: "Nombres", fields: [f("rows", "Lignes", "number"), f("cols", "Colonnes", "number"), f("painted", "Cases coloriées", "number")], make: () => ({ rows: 3, cols: 4, painted: 5 }) },
  grid_cells: { label: "Tableau de cases (cases à remplir : {{1}}, {{2}}...)", family: "Nombres", fields: [f("rows", "Lignes : cellules séparées par « ; »", "matrix"), f("cellWidth", "Largeur d'une case", "number")], make: () => ({ rows: [["1", "2"], ["3", "{{1}}"]] }) },
  pyramid: { label: "Pyramide de briques (cases à remplir)", family: "Nombres", fields: [f("levels", "Étages (haut en premier) : briques séparées par « ; »", "matrix")], make: () => ({ levels: [["{{1}}"], ["3", "4"], ["1", "2", "2"]] }) },
  prob_tree: { label: "Arbre de probabilités", family: "Probabilités", fields: [f("root", "Départ", "text"), f("branches", "Branches (JSON imbriqué : label, p, children)", "json")], make: () => ({ root: "", branches: [{ label: "A", p: "1/2", children: [{ label: "B", p: "1/2" }] }, { label: "C", p: "1/2" }] }) },
  venn: { label: "Diagramme de Venn", family: "Probabilités", fields: [f("sets", "Ensembles (2 ou 3)", "records", { columns: [{ key: "label", label: "Nom", type: "text" }, { key: "color", label: "Couleur", type: "color" }] }), f("counts", "Effectifs (JSON : A, B, C, AB, AC, BC, ABC, out)", "json")], make: () => ({ sets: [{ label: "A" }, { label: "B" }], counts: { A: "3", AB: "2", B: "4", out: "1" } }) },
  regular_polygon: { label: "Polygone régulier", family: "Cercles et polygones", fields: [f("sides", "Nombre de côtés", "number"), f("radius", "Rayon", "number"), f("rotation", "Rotation (degrés)", "number"), f("diagonals", "Diagonales", "bool")], make: () => ({ sides: 6, radius: 3 }) },
  solid3d: { label: "Solide (cube, pavé, pyramide, cylindre...)", family: "Espace 3D", fields: [f("shape", "Solide", "select", { options: ["cube", "box", "pyramid", "prism", "tetra", "cylinder", "cone", "sphere"] }), f("a", "Arête / largeur", "number"), f("b", "Profondeur (pavé, pyramide)", "number"), f("c", "Hauteur (pavé)", "number"), f("h", "Hauteur (pyramide, prisme, cylindre, cône)", "number"), f("r", "Rayon (cylindre, cône, sphère)", "number"), f("at", "Position [x, y, z]", "json")], make: () => ({ shape: "cube", a: 3, at: [0, 0, 1.5] }) },
  point3d: { label: "Point", family: "Espace 3D", fields: [f("x", "x", "number"), f("y", "y", "number"), f("z", "z", "number")], make: () => ({ x: 0, y: 0, z: 1 }) },
  segment3d: { label: "Segment", family: "Espace 3D", fields: [f("from", "De [x, y, z]", "json"), f("to", "À [x, y, z]", "json")], make: () => ({ from: [0, 0, 0], to: [2, 2, 2] }) },
  polygon3d: { label: "Polygone plan", family: "Espace 3D", fields: [f("points", "Sommets : un par ligne, « x ; y ; z »", "matrix", { numeric: true })], make: () => ({ points: [[0, 0, 0], [2, 0, 0], [1, 2, 1]] }) },
  plane3d: { label: "Plan", family: "Espace 3D", fields: [f("point", "Point [x, y, z]", "json"), f("dir1", "Direction 1", "json"), f("dir2", "Direction 2", "json")], make: () => ({ point: [0, 0, 1], dir1: [1, 0, 0], dir2: [0, 1, 0] }) },
  sphere3d: { label: "Sphère (centre, rayon)", family: "Espace 3D", fields: [f("center", "Centre [x, y, z]", "json"), f("radius", "Rayon", "number")], make: () => ({ center: [0, 0, 2], radius: 2 }) },
  surface3d: { label: "Surface z = f(x, y)", family: "Espace 3D", fields: [f("expr", "f(x, y) =", "expr")], make: () => ({ expr: "(x^2+y^2)/3", color: "blue" }) },
  curve3d: { label: "Courbe paramétrée", family: "Espace 3D", fields: [f("x", "x(t) =", "expr"), f("y", "y(t) =", "expr"), f("z", "z(t) =", "expr"), f("t", "t de... à...", "range")], make: () => ({ x: "2*cos(t)", y: "2*sin(t)", z: "t/3", t: [0, 12.5] }) },
  raw: { label: "Objet JSXGraph avancé", family: "Avancé", fields: [f("type", "Type JSXGraph", "text", { hint: "ellipse, hyperbola, parabola, conic, locus, curve, grid..." }), f("parents", "Parents (JSON)", "json", { hint: '["@A", "@B", "@C"] : @A désigne l\'élément A ; "=x^2" est une formule' }), f("attributes", "Attributs (JSON)", "json")], make: () => ({ type: "ellipse", parents: [], attributes: {} }) },
};

const FAMILIES = ["Points et droites", "Cercles et polygones", "Constructions", "Transformations", "Fonctions et courbes", "Statistiques", "Nombres", "Probabilités", "Formes à coordonnées", "Annotations", "Espace 3D", "Avancé"];

const POINT_NAMES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const FUNCTION_NAMES = "fghkpqrs";

function freshId(kind: JsxKind, elements: JsxElement[]): string {
  const used = new Set(elements.map((e) => e.id).filter(Boolean));
  const pool = kind === "point" ? POINT_NAMES : kind === "function" ? FUNCTION_NAMES : kind === "slider" ? "abcdkmnt" : "";
  for (const ch of pool) if (!used.has(ch)) return ch;
  let i = 1;
  while (used.has(`e${i}`)) i++;
  return `e${i}`;
}

const inputCls = "border border-[rgba(197,161,72,0.3)] rounded-md text-xs px-2 py-1 bg-white w-full";

/** Nombre si le texte en est un, sinon formule conservée telle quelle. */
const parseNumeric = (raw: string): number | string => {
  const t = raw.trim().replace(",", ".");
  if (t !== "" && Number.isFinite(Number(t))) return Number(t);
  return raw;
};

/* ------------------------------------------------------------------ */
/*  Un élément                                                          */
/* ------------------------------------------------------------------ */

function ElementCard({
  el, index, total, refs, onChange, onMove, onRemove,
}: {
  el: JsxElement;
  index: number;
  total: number;
  refs: JsxElement[];
  onChange: (next: JsxElement) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const def = KIND_DEFS[el.kind];
  const set = (key: string, value: unknown) => {
    const next = { ...el } as Record<string, unknown>;
    if (value === "" || value === undefined) delete next[key];
    else next[key] = value;
    onChange(next as JsxElement);
  };
  const refOptions = (
    <>
      <option value="">(aucun)</option>
      {refs.map((r) => (
        <option key={r.id} value={r.id}>{r.id} ({KIND_DEFS[r.kind].label.toLowerCase()})</option>
      ))}
    </>
  );

  const renderField = (field: Field) => {
    const value = el[field.key];
    switch (field.kind) {
      case "ref":
        return <select className={inputCls} value={typeof value === "string" ? value : ""} onChange={(e) => set(field.key, e.target.value)}>{refOptions}</select>;
      case "refs": {
        const list = Array.isArray(value) ? (value as string[]) : [];
        const n = field.count === 0 ? Math.max(list.length, 3) : field.count ?? 2;
        return (
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: n }, (_, i) => (
              <select key={i} className={`${inputCls} !w-auto min-w-[64px]`} value={list[i] ?? ""} onChange={(e) => {
                const next = Array.from({ length: n }, (_, k) => list[k] ?? "");
                next[i] = e.target.value;
                set(field.key, next.filter((v, k) => v || k < (field.count || 0)));
              }}>{refOptions}</select>
            ))}
            {field.count === 0 && (
              <button type="button" className="text-xs px-2 rounded-md border border-dashed border-[rgba(197,161,72,0.5)]" onClick={() => set(field.key, [...list, ""])}>+</button>
            )}
          </div>
        );
      }
      case "number":
        return <input className={inputCls} defaultValue={value === undefined ? "" : String(value)} key={String(value)} onBlur={(e) => set(field.key, e.target.value === "" ? undefined : parseNumeric(e.target.value))} placeholder={field.hint} />;
      case "expr":
      case "text":
        return <input className={inputCls} value={typeof value === "string" ? value : ""} onChange={(e) => set(field.key, e.target.value)} placeholder={field.hint} />;
      case "bool":
        return <input type="checkbox" checked={value === true || (field.key === "filled" && value === undefined)} onChange={(e) => set(field.key, field.key === "filled" ? (e.target.checked ? undefined : false) : e.target.checked || undefined)} />;
      case "select":
        return <select className={inputCls} value={typeof value === "string" ? value : field.options?.[0]} onChange={(e) => set(field.key, e.target.value)}>{field.options?.map((o) => <option key={o}>{o}</option>)}</select>;
      case "range": {
        const r = Array.isArray(value) ? (value as number[]) : [];
        return (
          <div className="flex gap-1">
            {[0, 1].map((i) => (
              <input key={`${i}-${r[i]}`} className={inputCls} defaultValue={r[i] ?? ""} onBlur={(e) => {
                const next = [r[0] ?? NaN, r[1] ?? NaN];
                next[i] = e.target.value === "" ? NaN : Number(e.target.value.replace(",", "."));
                set(field.key, next.every((v) => Number.isFinite(v)) ? next : undefined);
              }} placeholder={i === 0 ? "de" : "à"} />
            ))}
          </div>
        );
      }
      case "list":
        return <input className={inputCls} defaultValue={Array.isArray(value) ? (value as string[]).join(", ") : ""} key={JSON.stringify(value)} onBlur={(e) => set(field.key, e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} placeholder="A, B, f..." />;
      case "matrix": {
        const rows = Array.isArray(value) ? (value as unknown[][]) : [];
        return <textarea className={`${inputCls} font-mono min-h-[70px]`} defaultValue={rows.map((r) => (Array.isArray(r) ? r.join(" ; ") : "")).join("\n")} key={JSON.stringify(value)} onBlur={(e) => {
          const parsed = e.target.value.split("\n").map((line) => line.split(";").map((c) => c.trim())).filter((r) => r.some(Boolean)).map((r) => (field.numeric ? r.map((c) => Number(c.replace(",", "."))) : r));
          if (field.numeric && parsed.some((r) => r.some((c) => !Number.isFinite(c as number)))) return;
          set(field.key, parsed);
        }} />;
      }
      case "records": {
        const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
        const cols = field.columns ?? [];
        const update = (next: Record<string, unknown>[]) => set(field.key, next);
        return (
          <div className="space-y-1">
            {rows.map((row, ri) => (
              <div key={ri} className="flex items-center gap-1">
                {cols.map((col) =>
                  col.type === "bool" ? (
                    <label key={col.key} className="flex items-center gap-0.5 text-[10px] text-gray-500" title={col.label}>
                      <input type="checkbox" checked={row[col.key] === true} onChange={(e) => update(rows.map((r, k) => (k === ri ? { ...r, [col.key]: e.target.checked || undefined } : r)))} />
                      {col.label.slice(0, 8)}
                    </label>
                  ) : col.type === "color" ? (
                    <select key={col.key} className="border rounded text-xs px-1 py-1 bg-white" value={typeof row[col.key] === "string" ? (row[col.key] as string) : ""} onChange={(e) => update(rows.map((r, k) => (k === ri ? { ...r, [col.key]: e.target.value || undefined } : r)))}>
                      <option value="">auto</option>
                      {Object.keys(JSX_TONES).map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input key={col.key + String(row[col.key])} className={inputCls} placeholder={col.label} defaultValue={row[col.key] === undefined ? "" : String(row[col.key])} onBlur={(e) => {
                      const raw = e.target.value;
                      const v = col.type === "number" ? (raw === "" ? undefined : Number(raw.replace(",", "."))) : raw;
                      if (col.type === "number" && v !== undefined && !Number.isFinite(v)) return;
                      update(rows.map((r, k) => (k === ri ? { ...r, [col.key]: v } : r)));
                    }} />
                  ),
                )}
                <button type="button" className="p-1 text-red-400 hover:text-red-600" onClick={() => update(rows.filter((_, k) => k !== ri))} aria-label="Retirer la ligne"><Trash2 size={12} /></button>
              </div>
            ))}
            <button type="button" className="text-[11px] px-2 py-0.5 rounded border border-dashed border-[rgba(197,161,72,0.5)]" onClick={() => update([...rows, {}])}>+ Ajouter</button>
          </div>
        );
      }
      case "json":
        return <textarea className={`${inputCls} font-mono min-h-[44px]`} defaultValue={JSON.stringify(value ?? (field.key === "parents" ? [] : {}))} key={JSON.stringify(value)} placeholder={field.hint} onBlur={(e) => {
          try { set(field.key, JSON.parse(e.target.value)); } catch { /* JSON incomplet : on garde l'ancienne valeur */ }
        }} />;
    }
  };

  return (
    <div className="border border-[rgba(197,161,72,0.25)] rounded-lg p-2 space-y-2 bg-white">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-700">{def.label}</span>
        <input className={`${inputCls} !w-16`} value={el.id ?? ""} placeholder="nom" onChange={(e) => onChange({ ...el, id: e.target.value.trim() || undefined })} title="Nom de référence : les autres éléments s'y réfèrent" />
        <span className="flex-1" />
        <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Monter"><ArrowUp size={14} /></button>
        <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Descendre"><ArrowDown size={14} /></button>
        <button type="button" onClick={onRemove} className="p-1 text-red-400 hover:text-red-600" aria-label="Supprimer"><Trash2 size={14} /></button>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {def.fields.map((field) => (
          <label key={field.key} className={`text-[11px] text-gray-500 ${["refs", "expr", "json", "range", "records", "matrix", "list"].includes(field.kind) ? "col-span-2" : ""}`}>
            {field.label}
            <div className="mt-0.5 text-gray-800">{renderField(field)}</div>
          </label>
        ))}
      </div>
      {el.kind !== "raw" && el.kind !== "text" && el.kind !== "slider" && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
          <label className="flex items-center gap-1">Couleur
            <select className="border rounded text-xs px-1 py-0.5" value={el.color ?? ""} onChange={(e) => set("color", e.target.value)}>
              <option value="">auto</option>
              {Object.keys(JSX_TONES).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={!!el.dash} onChange={(e) => set("dash", e.target.checked || undefined)} /> Pointillés</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={!!el.hidden} onChange={(e) => set("hidden", e.target.checked || undefined)} /> Masqué (sert de support)</label>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Éditeur complet                                                     */
/* ------------------------------------------------------------------ */

export default function JsxFigureEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (spec: Record<string, unknown>) => void }) {
  const spec: JsxFigureSpec = useMemo(
    () => normalizeJsxSpec(value) ?? { type: "jsx_figure", caption: "", boundingBox: [-6, 5, 6, -5], axes: true, grid: true, keepAspect: true, showNames: false, height: 300, elements: [] },
    [value],
  );
  const confirm = useConfirm();
  const boardRef = useRef<HTMLDivElement>(null);
  const skipRebuild = useRef(false);
  const [error, setError] = useState("");

  const emit = (next: JsxFigureSpec) => {
    const { type: _type, ...rest } = next;
    void _type;
    onChange(rest);
  };
  const setElements = (elements: JsxElement[]) => emit({ ...spec, elements });

  // Atelier : le même dessin que sur le site, mais les points se déplacent à la souris.
  const specKey = JSON.stringify(spec);
  useEffect(() => {
    if (skipRebuild.current) {
      skipRebuild.current = false;
      return;
    }
    const container = boardRef.current;
    if (!container) return;
    let disposed = false;
    let destroy: (() => void) | null = null;
    setError("");
    buildJsxBoard(container, spec, { editable: true })
      .then((handle) => {
        if (disposed) return handle.destroy();
        destroy = handle.destroy;
        handle.board.on("up", () => {
          const positions = handle.readPoints();
          if (!Object.keys(positions).length) return;
          skipRebuild.current = true;
          setElements(spec.elements.map((e) => (e.id && positions[e.id] && typeof e.x === "number" && typeof e.y === "number" ? { ...e, x: positions[e.id][0], y: positions[e.id][1] } : e)));
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Figure impossible à dessiner."));
    return () => {
      disposed = true;
      destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

  const addElement = (kind: JsxKind) => {
    const id = freshId(kind, spec.elements);
    const needsId = !["text", "segment", "polygon", "angle", "vector"].includes(kind);
    setElements([...spec.elements, { kind, ...(needsId ? { id } : {}), ...KIND_DEFS[kind].make(id) } as JsxElement]);
  };

  const idsBefore = (i: number) => spec.elements.slice(0, i).filter((e) => e.id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="border border-[rgba(197,161,72,0.3)] rounded-lg text-sm px-2 py-1.5"
          value=""
          onChange={async (e) => {
            const preset = JSX_PRESETS.find((p) => p.id === e.target.value);
            if (!preset) return;
            if (spec.elements.length && !(await confirm("La figure actuelle sera remplacée par ce modèle.", { title: "Partir de ce modèle ?", confirmLabel: "Remplacer" }))) return;
            emit(JSON.parse(JSON.stringify(preset.spec)));
          }}
        >
          <option value="">Partir d&apos;un modèle...</option>
          {Array.from(new Set(JSX_PRESETS.map((p) => p.group))).map((group) => (
            <optgroup key={group} label={group}>
              {JSX_PRESETS.filter((p) => p.group === group).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </optgroup>
          ))}
        </select>
        <select
          className="border border-[rgba(197,161,72,0.3)] rounded-lg text-sm px-2 py-1.5"
          value=""
          onChange={(e) => e.target.value && addElement(e.target.value as JsxKind)}
        >
          <option value="">+ Ajouter un élément...</option>
          {FAMILIES.filter((family) => (family === "Espace 3D") === (spec.mode === "3d")).map((family) => (
            <optgroup key={family} label={family}>
              {(Object.keys(KIND_DEFS) as JsxKind[]).filter((k) => KIND_DEFS[k].family === family).map((k) => <option key={k} value={k}>{KIND_DEFS[k].label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-gray-500">
        <label className="col-span-2 sm:col-span-4">Légende
          <input className={inputCls} value={spec.caption} onChange={(e) => emit({ ...spec, caption: e.target.value })} />
        </label>
        <label className="col-span-2 sm:col-span-4 flex items-center gap-2">Type de figure
          <select className="border rounded text-xs px-1 py-1 bg-white" value={spec.mode === "3d" ? "3d" : "2d"} onChange={(e) => emit({ ...spec, mode: e.target.value as "2d" | "3d", elements: spec.elements.filter((el) => (KIND_DEFS[el.kind].family === "Espace 3D") === (e.target.value === "3d") || el.kind === "text") })}>
            <option value="2d">Plane (feuille quadrillée)</option>
            <option value="3d">Dans l&apos;espace (se tourne à la souris)</option>
          </select>
        </label>
        {spec.mode !== "3d" && (["Gauche (x min)", "Haut (y max)", "Droite (x max)", "Bas (y min)"] as const).map((label, i) => (
          <label key={label}>{label}
            <input className={inputCls} key={spec.boundingBox[i]} defaultValue={spec.boundingBox[i]} onBlur={(e) => {
              const n = Number(e.target.value.replace(",", "."));
              if (!Number.isFinite(n)) return;
              const bb = [...spec.boundingBox] as JsxFigureSpec["boundingBox"];
              bb[i] = n;
              if (bb[2] > bb[0] && bb[1] > bb[3]) emit({ ...spec, boundingBox: bb });
            }} />
          </label>
        ))}
        <label className="flex items-center gap-1"><input type="checkbox" checked={spec.axes} onChange={(e) => emit({ ...spec, axes: e.target.checked })} /> Axes</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={spec.grid} onChange={(e) => emit({ ...spec, grid: e.target.checked })} /> Quadrillage</label>
        {spec.mode === "3d" && (["x min", "x max", "y min", "y max", "z min", "z max"] as const).map((label, i) => (
          <label key={label}>{label}
            <input className={inputCls} key={String(spec.box3d?.[i])} defaultValue={spec.box3d?.[i] ?? 0} onBlur={(e) => {
              const n = Number(e.target.value.replace(",", "."));
              if (!Number.isFinite(n)) return;
              const box = [...(spec.box3d ?? [-3, 3, -3, 3, 0, 5])] as NonNullable<JsxFigureSpec["box3d"]>;
              box[i] = n;
              emit({ ...spec, box3d: box });
            }} />
          </label>
        ))}
        <label className="flex items-center gap-1" title="Les noms (A, B, C...) vont plutôt dans l'énoncé"><input type="checkbox" checked={spec.showNames} onChange={(e) => emit({ ...spec, showNames: e.target.checked })} /> Noms des points</label>
        {spec.mode !== "3d" && <label className="flex items-center gap-1"><input type="checkbox" checked={spec.keepAspect} onChange={(e) => emit({ ...spec, keepAspect: e.target.checked })} /> Repère orthonormé</label>}
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-1">{spec.mode === "3d" ? "Aperçu : fais tourner la figure à la souris, comme l'élève." : "Atelier : déplace les points à la souris, leurs coordonnées se mettent à jour toutes seules."}</p>
        <div className="course-figure-jsx" style={{ maxWidth: 520, margin: "0 auto" }}>
          <div ref={boardRef} className="jsx-board" />
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>

      <div className="space-y-2">
        {spec.elements.length === 0 && <p className="text-xs text-gray-400">Aucun élément : choisis un modèle ou ajoute un point, un segment, une courbe...</p>}
        {spec.elements.map((el, i) => (
          <ElementCard
            key={i}
            el={el}
            index={i}
            total={spec.elements.length}
            refs={idsBefore(i)}
            onChange={(next) => setElements(spec.elements.map((e, k) => (k === i ? next : e)))}
            onMove={(dir) => {
              const list = [...spec.elements];
              [list[i], list[i + dir]] = [list[i + dir], list[i]];
              setElements(list);
            }}
            onRemove={() => setElements(spec.elements.filter((_, k) => k !== i))}
          />
        ))}
        <button type="button" onClick={() => addElement("point")} className="inline-flex items-center gap-1 text-xs text-gray-500 border border-dashed border-[rgba(197,161,72,0.5)] rounded-md px-2 py-1">
          <Plus size={12} /> Point
        </button>
      </div>
    </div>
  );
}
