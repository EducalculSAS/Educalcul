import { EDUFIG_KINDS, FIG_TONES, type EduFig, type FigTone, type GeoItem, type GeoStep, type TreeBranch } from "@/lib/figures/types";

/**
 * Transforme n'importe quelle entrée (JSON écrit à la main, réponse d'une IA, ancien contenu) en figure valide, ou
 * explique en français pourquoi c'est impossible. Les nombres écrits « 5,2 » ou "5.2" sont acceptés.
 */
export interface Normalized {
  fig: EduFig | null;
  errors: string[];
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);

export function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const x = Number(v.trim().replace(",", ".").replace(/\s/g, ""));
    if (Number.isFinite(x)) return x;
  }
  return undefined;
}
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : undefined);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((x): x is string => !!x) : typeof v === "string" ? splitNames(v) : []);
const tone = (v: unknown): FigTone | undefined => {
  const t = str(v);
  const map: Record<string, FigTone> = { navy: "ink", gold: "accent", noir: "ink", or: "accent", bleu: "blue", vert: "green", rouge: "red", gris: "gray" };
  if (!t) return undefined;
  if ((FIG_TONES as string[]).includes(t)) return t as FigTone;
  return map[t];
};
/** « ABC » → ["A","B","C"] ; « A'B'C' » → ["A'","B'","C'"]. */
export function splitNames(v: string): string[] {
  const parts = v.replace(/[\s,;[\]()]/g, "").match(/[A-Z][a-z]?[0-9]*'*/g);
  return parts ?? [];
}
const numRecord = (v: unknown): Record<string, number> | undefined => {
  if (!isObj(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(v)) { const n = num(x); if (n !== undefined) out[k] = n; }
  return Object.keys(out).length ? out : undefined;
};
const pair = (v: unknown): [string, string] | null => { const a = strs(v); return a.length >= 2 ? [a[0], a[1]] : null; };
const xy = (v: unknown): [number, number] | null => {
  if (Array.isArray(v) && v.length >= 2) { const a = num(v[0]), b = num(v[1]); return a !== undefined && b !== undefined ? [a, b] : null; }
  if (isObj(v)) { const a = num(v.x), b = num(v.y); return a !== undefined && b !== undefined ? [a, b] : null; }
  return null;
};
const range = (v: unknown): [number, number] | undefined => { const r = xy(v); return r && r[1] > r[0] ? r : undefined; };

function step(raw: Raw, errors: string[]): GeoStep | null {
  const op = str(raw.op);
  const bool = (k: string) => (typeof raw[k] === "boolean" ? (raw[k] as boolean) : undefined);
  const names = strs(raw.names);
  switch (op) {
    case "point": {
      const name = str(raw.name), x = num(raw.x), y = num(raw.y);
      if (!name || x === undefined || y === undefined) { errors.push("Un point a besoin d'un nom et de coordonnées x et y."); return null; }
      return { op, name, x, y, free: bool("free") };
    }
    case "triangle":
      if (names.length !== 3) { errors.push("Un triangle a besoin de trois noms de sommets."); return null; }
      return { op, names: names as [string, string, string], lengths: numRecord(raw.lengths), angles: numRecord(raw.angles), right: str(raw.right), base: str(raw.base), rotate: num(raw.rotate), flip: bool("flip"), draw: bool("draw") };
    case "rectangle": case "square": case "parallelogram": case "rhombus": case "trapezoid": {
      if (names.length !== 4) { errors.push(`Un ${op === "square" ? "carré" : "quadrilatère"} a besoin de quatre noms de sommets.`); return null; }
      const n4 = names as [string, string, string, string];
      const base = { names: n4, rotate: num(raw.rotate), draw: bool("draw") };
      if (op === "rectangle") { const w = num(raw.width), h = num(raw.height); if (!(w! > 0 && h! > 0)) { errors.push("Un rectangle a besoin d'une largeur et d'une hauteur positives."); return null; } return { op, ...base, width: w!, height: h! }; }
      if (op === "square") { const sd = num(raw.side); if (!(sd! > 0)) { errors.push("Un carré a besoin d'un côté positif."); return null; } return { op, ...base, side: sd! }; }
      if (op === "rhombus") { const sd = num(raw.side), a = num(raw.angle) ?? 60; if (!(sd! > 0)) { errors.push("Un losange a besoin d'un côté positif."); return null; } return { op, ...base, side: sd!, angle: a }; }
      if (op === "parallelogram") { const b = num(raw.base), sd = num(raw.side), a = num(raw.angle) ?? 60; if (!(b! > 0 && sd! > 0)) { errors.push("Un parallélogramme a besoin d'une base et d'un côté positifs."); return null; } return { op, ...base, base: b!, side: sd!, angle: a }; }
      const b = num(raw.base), t = num(raw.top), h = num(raw.height);
      if (!(b! > 0 && t! > 0 && h! > 0)) { errors.push("Un trapèze a besoin de deux bases et d'une hauteur positives."); return null; }
      return { op: "trapezoid", ...base, base: b!, top: t!, height: h!, offset: num(raw.offset) };
    }
    case "regular": {
      const sd = num(raw.side);
      if (names.length < 3 || !(sd! > 0)) { errors.push("Un polygone régulier a besoin d'au moins trois sommets et d'un côté positif."); return null; }
      return { op, names, side: sd!, rotate: num(raw.rotate), draw: bool("draw") };
    }
    case "circle": {
      const c = str(raw.center), r = num(raw.radius);
      if (!c || !(r! > 0)) { errors.push("Un cercle a besoin d'un centre et d'un rayon positif."); return null; }
      return { op, center: c, radius: r!, x: num(raw.x), y: num(raw.y), draw: bool("draw") };
    }
    case "onCircle": {
      const name = str(raw.name), c = str(raw.center), r = num(raw.radius), a = num(raw.angle) ?? 0;
      if (!name || !c || !(r! > 0)) { errors.push("Un point sur un cercle a besoin d'un nom, d'un centre et d'un rayon."); return null; }
      return { op, name, center: c, radius: r!, angle: a };
    }
    case "onSegment": {
      const name = str(raw.name), from = str(raw.from), to = str(raw.to);
      if (!name || !from || !to) { errors.push("Un point sur un segment a besoin d'un nom et des deux extrémités."); return null; }
      return { op, name, from, to, t: num(raw.t), distance: num(raw.distance) };
    }
    case "midpoint": { const name = str(raw.name), of = pair(raw.of); if (!name || !of) { errors.push("Un milieu a besoin d'un nom et de deux points."); return null; } return { op, name, of }; }
    case "foot": { const name = str(raw.name), from = str(raw.from), l = pair(raw.line); if (!name || !from || !l) { errors.push("Un pied de hauteur a besoin d'un point et d'une droite."); return null; } return { op, name, from, line: l }; }
    case "intersection": {
      const name = str(raw.name), ls = Array.isArray(raw.lines) ? raw.lines.map(pair) : [];
      if (!name || ls.length !== 2 || !ls[0] || !ls[1]) { errors.push("Une intersection a besoin d'un nom et de deux droites."); return null; }
      return { op, name, lines: [ls[0], ls[1]] };
    }
    case "thales": {
      const AB = num(raw.AB), AC = num(raw.AC), AM = num(raw.AM);
      if (names.length !== 5 || !(AB! > 0 && AC! > 0 && AM! > 0)) { errors.push("Une configuration de Thalès a besoin de cinq noms (A, B, C, M, N) et des longueurs AB, AC et AM."); return null; }
      return { op, names: names as [string, string, string, string, string], AB: AB!, AC: AC!, BC: num(raw.BC), AM: AM!, butterfly: bool("butterfly"), rotate: num(raw.rotate), draw: bool("draw") };
    }
    case "image": {
      const map: Record<string, string> = {};
      if (isObj(raw.map)) for (const [k, v] of Object.entries(raw.map)) { const t = str(v); if (t) map[k] = t; }
      const t = isObj(raw.transform) ? raw.transform : null;
      const type = t && str(t.type);
      let transform: Extract<GeoStep, { op: "image" }>["transform"] | null = null;
      if (t && type === "symmetryPoint" && str(t.center)) transform = { type, center: str(t.center)! };
      else if (t && type === "symmetryLine" && pair(t.line)) transform = { type, line: pair(t.line)! };
      else if (t && type === "rotation" && str(t.center) && num(t.angle) !== undefined) transform = { type, center: str(t.center)!, angle: num(t.angle)! };
      else if (t && type === "translation" && str(t.from) && str(t.to)) transform = { type, from: str(t.from)!, to: str(t.to)! };
      else if (t && type === "homothety" && str(t.center) && num(t.k) !== undefined) transform = { type, center: str(t.center)!, k: num(t.k)! };
      if (!transform || !Object.keys(map).length) { errors.push("Une image a besoin des points à transformer et d'une transformation complète."); return null; }
      return { op, map, transform, polygon: bool("polygon") };
    }
    default:
      errors.push(`Étape de construction inconnue : « ${op ?? "?"} ».`);
      return null;
  }
}

function item(raw: Raw, errors: string[]): GeoItem | null {
  const t = str(raw.type);
  const tn = tone(raw.tone);
  const dashed = raw.dashed === true ? true : undefined;
  const label = typeof raw.label === "boolean" ? raw.label : str(raw.label);
  switch (t) {
    case "polygon": { const p = strs(raw.points); if (p.length < 2) break; return { type: t, points: p, tone: tn, fill: raw.fill === false ? false : undefined, dashed }; }
    case "segment": { const a = str(raw.from), b = str(raw.to); if (!a || !b) break; return { type: t, from: a, to: b, tone: tn, dashed, label }; }
    case "line": { const p = pair(raw.through); if (!p) break; return { type: t, through: p, tone: tn, dashed, label: typeof label === "string" ? label : undefined }; }
    case "ray": { const a = str(raw.from), b = str(raw.through); if (!a || !b) break; return { type: t, from: a, through: b, tone: tn, dashed }; }
    case "vector": { const a = str(raw.from), b = str(raw.to); if (!a || !b) break; return { type: t, from: a, to: b, tone: tn, label: typeof label === "string" ? label : undefined }; }
    case "circle": { const c = str(raw.center); if (!c) break; return { type: t, center: c, radius: num(raw.radius), through: str(raw.through), tone: tn, dashed, fill: raw.fill === true ? true : undefined }; }
    case "angle": { const p = strs(raw.points); if (p.length !== 3) break; const m = num(raw.marks); return { type: t, points: p as [string, string, string], label, tone: tn, marks: m === 2 || m === 3 ? m : undefined }; }
    case "right": { const p = strs(raw.points); if (p.length !== 3) break; return { type: t, points: p as [string, string, string] }; }
    case "equal": {
      const segs = Array.isArray(raw.segments) ? raw.segments.map(pair).filter((x): x is [string, string] => !!x) : [];
      if (!segs.length) break;
      const m = num(raw.marks);
      return { type: t, segments: segs, marks: m === 2 || m === 3 ? m : undefined };
    }
    case "points": { const p = strs(raw.names); if (!p.length) break; return { type: t, names: p, tone: tn }; }
    case "text": { const at = str(raw.at), tx = str(raw.text); if (!at || !tx) break; return { type: t, at, text: tx, dx: num(raw.dx), dy: num(raw.dy), tone: tn }; }
  }
  errors.push(`Élément de figure incomplet ou inconnu : « ${t ?? "?"} ».`);
  return null;
}

export function normalizeEduFig(input: unknown): Normalized {
  const errors: string[] = [];
  let raw: unknown = input;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { return { fig: null, errors: ["La description de la figure n'est pas un JSON valide."] }; }
  }
  if (!isObj(raw)) return { fig: null, errors: ["La description de la figure doit être un objet."] };
  const kind = str(raw.kind);
  if (!kind || !(EDUFIG_KINDS as string[]).includes(kind)) return { fig: null, errors: [`Type de figure inconnu : « ${kind ?? "?"} ».`] };
  const size: "s" | "l" | undefined = raw.size === "s" ? "s" : raw.size === "l" ? "l" : undefined;
  const base = { v: 1 as const, caption: str(raw.caption), alt: str(raw.alt), size, interactive: raw.interactive === true ? true : undefined };

  switch (kind) {
    case "geometry": {
      const steps = (Array.isArray(raw.steps) ? raw.steps : []).filter(isObj).map((s) => step(s, errors)).filter((s): s is GeoStep => !!s);
      const items = (Array.isArray(raw.items) ? raw.items : []).filter(isObj).map((s) => item(s, errors)).filter((s): s is GeoItem => !!s);
      if (!steps.length) errors.push("La figure ne contient aucune construction.");
      return { fig: { ...base, kind, steps, items: items.length ? items : undefined, unit: typeof raw.unit === "string" ? raw.unit : undefined, hideLabels: strs(raw.hideLabels).length ? strs(raw.hideLabels) : undefined, grid: raw.grid === true ? true : undefined }, errors };
    }
    case "graph": {
      const x = range(raw.x) ?? [-5, 5];
      const curves = (Array.isArray(raw.curves) ? raw.curves : []).filter(isObj).map((c) => ({ expr: str(c.expr) ?? "", name: str(c.name), tone: tone(c.tone), domain: range(c.domain), dashed: c.dashed === true ? true : undefined })).filter((c) => c.expr);
      const points = (Array.isArray(raw.points) ? raw.points : []).filter(isObj).map((p) => ({ x: num(p.x), y: num(p.y), name: str(p.name), tone: tone(p.tone), guides: p.guides === true ? true : undefined })).filter((p): p is { x: number; y: number; name: string | undefined; tone: FigTone | undefined; guides: true | undefined } => p.x !== undefined && p.y !== undefined);
      const segments = (Array.isArray(raw.segments) ? raw.segments : []).filter(isObj).map((sg) => ({ from: xy(sg.from), to: xy(sg.to), tone: tone(sg.tone), dashed: sg.dashed === true ? true : undefined, arrow: sg.arrow === true ? true : undefined })).filter((sg): sg is { from: [number, number]; to: [number, number]; tone: FigTone | undefined; dashed: true | undefined; arrow: true | undefined } => !!sg.from && !!sg.to);
      return { fig: { ...base, kind, x, y: range(raw.y), xStep: num(raw.xStep), yStep: num(raw.yStep), grid: raw.grid === false ? false : undefined, xLabel: str(raw.xLabel), yLabel: str(raw.yLabel), curves, points, segments }, errors };
    }
    case "numberline": {
      const min = num(raw.min), max = num(raw.max), stp = num(raw.step);
      if (min === undefined || max === undefined || !(max > min) || !(stp! > 0)) return { fig: null, errors: ["La droite graduée a besoin de min, max (plus grand que min) et d'un pas positif."] };
      if ((max - min) / stp! > 60) return { fig: null, errors: ["Trop de graduations : augmente le pas."] };
      const labels = raw.labels === "ends" || raw.labels === "none" ? raw.labels : undefined;
      const points = (Array.isArray(raw.points) ? raw.points : []).filter(isObj).map((p) => ({ value: num(p.value), name: str(p.name), tone: tone(p.tone) })).filter((p): p is { value: number; name: string | undefined; tone: FigTone | undefined } => p.value !== undefined);
      const intervals = (Array.isArray(raw.intervals) ? raw.intervals : []).filter(isObj).map((iv) => ({ from: num(iv.from) ?? min, to: num(iv.to) ?? max, closedFrom: iv.closedFrom === false ? false : undefined, closedTo: iv.closedTo === false ? false : undefined, tone: tone(iv.tone) }));
      return { fig: { ...base, kind, min, max, step: stp!, minor: num(raw.minor), labels, points, intervals }, errors };
    }
    case "bar": {
      const categories = strs(raw.categories);
      const values = (Array.isArray(raw.values) ? raw.values : []).map(num).map((v) => v ?? 0);
      if (!categories.length) return { fig: null, errors: ["Le diagramme a besoin de catégories."] };
      if (values.length !== categories.length) errors.push("Il faut autant de valeurs que de catégories.");
      return { fig: { ...base, kind, categories, values, xLabel: str(raw.xLabel), yLabel: str(raw.yLabel), joined: raw.joined === true ? true : undefined, tone: tone(raw.tone) }, errors };
    }
    case "pie": {
      const items = (Array.isArray(raw.items) ? raw.items : []).filter(isObj).map((it) => ({ label: str(it.label) ?? "", value: num(it.value) ?? 0 })).filter((it) => it.label);
      if (!items.length) return { fig: null, errors: ["Le diagramme circulaire a besoin d'au moins une part."] };
      return { fig: { ...base, kind, items, percent: raw.percent === false ? false : undefined }, errors };
    }
    case "linechart": {
      const labels = strs(raw.labels);
      const series = (Array.isArray(raw.series) ? raw.series : []).filter(isObj).map((s) => ({ name: str(s.name), values: (Array.isArray(s.values) ? s.values : []).map(num).map((v) => v ?? 0), tone: tone(s.tone) }));
      if (!labels.length || !series.length) return { fig: null, errors: ["Le graphique a besoin d'étiquettes et d'au moins une série."] };
      return { fig: { ...base, kind, labels, series, yLabel: str(raw.yLabel) }, errors };
    }
    case "tree": {
      const branch = (b: unknown, d: number): TreeBranch | null => {
        if (!isObj(b) || d > 4) return null;
        const label = str(b.label);
        if (!label) return null;
        const kids = Array.isArray(b.children) ? b.children.map((c) => branch(c, d + 1)).filter((c): c is TreeBranch => !!c) : [];
        return { label, p: str(b.p), children: kids.length ? kids : undefined };
      };
      const branches = (Array.isArray(raw.branches) ? raw.branches : []).map((b) => branch(b, 0)).filter((b): b is TreeBranch => !!b);
      if (!branches.length) return { fig: null, errors: ["L'arbre a besoin d'au moins une branche."] };
      return { fig: { ...base, kind, branches }, errors };
    }
    case "solid": {
      const shapes = ["cube", "box", "cylinder", "cone", "pyramid", "sphere", "prism"] as const;
      const shape = shapes.find((s) => s === raw.shape);
      if (!shape) return { fig: null, errors: ["Solide inconnu (cube, box, cylinder, cone, pyramid, sphere, prism)."] };
      const d = isObj(raw.dims) ? raw.dims : {};
      return { fig: { ...base, kind, shape, dims: { a: num(d.a), b: num(d.b), c: num(d.c), r: num(d.r), h: num(d.h) }, names: strs(raw.names).length ? strs(raw.names) : undefined, unit: typeof raw.unit === "string" ? raw.unit : undefined, showDims: raw.showDims === false ? false : true }, errors };
    }
    case "program": {
      const steps = Array.isArray(raw.steps) ? raw.steps.map(str).filter((x): x is string => !!x) : [];
      if (steps.length < 2) return { fig: null, errors: ["Un programme de calcul a besoin d'au moins deux étapes."] };
      return { fig: { ...base, kind, steps }, errors };
    }
  }
  return { fig: null, errors: ["Type de figure non géré."] };
}
