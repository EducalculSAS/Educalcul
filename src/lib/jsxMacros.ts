/**
 * Figures « toutes faites » du système unique de figures : un diagramme en barres, un camembert, une droite graduée, un
 * arbre de probabilités, un diagramme de Venn... se décrivent en une ligne de JSON et se développent ici en éléments de
 * base (rect, shape, seg, circle, text) que le moteur JSXGraph dessine. Un seul moteur, un seul éditeur, un seul style.
 *
 * Fonctions pures : testables sans navigateur.
 */
import type { JsxElement } from "@/lib/jsxFigure";

type El = Record<string, unknown>;

const TONES = ["blue", "red", "green", "gold", "navy", "gray"];
const toneAt = (i: number, given?: unknown) => (typeof given === "string" && given ? given : TONES[i % TONES.length]);
const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const list = (v: unknown): El[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as El[]) : []);
const round2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => String(round2(v)).replace(".", ",");

const text = (x: number, y: number, t: string, extra: El = {}): El => ({ kind: "text", x, y, text: t, size: 14, ...extra });
const rect = (x: number, y: number, w: number, h: number, color: string, extra: El = {}): El => ({ kind: "rect", x, y, w, h, color, ...extra });
const seg = (x1: number, y1: number, x2: number, y2: number, extra: El = {}): El => ({ kind: "seg", x1, y1, x2, y2, ...extra });
const dot = (x: number, y: number, r: number, color: string, extra: El = {}): El => ({ kind: "circle", x, y, radius: r, color, opacity: 1, ...extra });
const shape = (points: [number, number][], color: string, extra: El = {}): El => ({ kind: "shape", points, color, ...extra });

/** Points d'un arc (degrés, sens trigonométrique), pour tracer secteurs et disques en polygones fins. */
function arcPoints(cx: number, cy: number, r: number, from: number, to: number, steps = 48): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

const MACROS: Record<string, (e: JsxElement) => El[]> = {
  bar_chart(e) {
    const data = list(e.data);
    const max = Math.max(1, ...data.map((d) => n(d.value, 0)));
    const out: El[] = [];
    data.forEach((d, i) => {
      const x = i * 1.5 + 0.5;
      const v = n(d.value, 0);
      out.push(rect(x, 0, 1, v, toneAt(i, d.color), { opacity: 0.55 }));
      if (e.showValues !== false) out.push(text(x + 0.5, v + max * 0.05, fmt(v), { size: 13 }));
      out.push(text(x + 0.5, -max * 0.07, String(d.label ?? ""), { size: 13 }));
    });
    return out;
  },

  histogram(e) {
    return list(e.bins).flatMap((b, i) => {
      const from = n(b.from, i);
      const to = n(b.to, from + 1);
      const c = n(b.count, 0);
      return [rect(from, 0, to - from, c, toneAt(0, e.color), { opacity: 0.5 }), ...(e.showValues === false ? [] : [text((from + to) / 2, c + 0.35, fmt(c), { size: 12 })])];
    });
  },

  pie_chart(e) {
    const slices = list(e.slices);
    const total = slices.reduce((s, d) => s + Math.max(0, n(d.value, 0)), 0) || 1;
    const r = n(e.radius, 3);
    let angle = 90;
    const out: El[] = [];
    slices.forEach((d, i) => {
      const sweep = (Math.max(0, n(d.value, 0)) / total) * 360;
      const pts = [[0, 0] as [number, number], ...arcPoints(0, 0, r, angle, angle - sweep, Math.max(6, Math.round(sweep / 4)))];
      out.push(shape(pts, toneAt(i, d.color), { opacity: 0.55 }));
      const mid = ((angle - sweep / 2) * Math.PI) / 180;
      const pct = Math.round((Math.max(0, n(d.value, 0)) / total) * 100);
      out.push(text(Math.cos(mid) * r * 1.32, Math.sin(mid) * r * 1.32, `${d.label ?? ""} (${pct} %)`, { size: 13 }));
      angle -= sweep;
    });
    return out;
  },

  number_line(e) {
    const min = n(e.min, -5);
    const max = n(e.max, 5);
    const step = Math.max(0.0001, n(e.step, 1));
    const out: El[] = [seg(min - 0.6, 0, max + 0.6, 0, { width: 2.2 })];
    for (let v = min; v <= max + 1e-9; v += step) {
      out.push(seg(v, -0.16, v, 0.16, { width: 1.6 }));
      out.push(text(v, -0.62, fmt(v), { size: 13 }));
    }
    for (const iv of list(e.intervals)) {
      const a = n(iv.from, min);
      const b = n(iv.to, max);
      out.push(seg(a, 0, b, 0, { width: 6, color: toneAt(0, iv.color) }));
      out.push(dot(a, 0, 0.17, toneAt(0, iv.color), iv.fromOpen ? { whiteFill: true } : {}));
      out.push(dot(b, 0, 0.17, toneAt(0, iv.color), iv.toOpen ? { whiteFill: true } : {}));
    }
    list(e.points).forEach((p, i) => {
      const v = n(p.value, 0);
      out.push(dot(v, 0, 0.17, toneAt(i + 3, p.color)));
      if (p.label) out.push(text(v, 0.65, String(p.label), { size: 14 }));
    });
    return out;
  },

  box_plot(e) {
    const y = n(e.y, 1);
    const [mn, q1, med, q3, mx] = [n(e.min, 2), n(e.q1, 5), n(e.median, 7), n(e.q3, 9), n(e.max, 12)];
    const h = 1.4;
    const out: El[] = [
      seg(mn, y + h / 2, q1, y + h / 2, { width: 2 }),
      seg(q3, y + h / 2, mx, y + h / 2, { width: 2 }),
      seg(mn, y, mn, y + h, { width: 2 }),
      seg(mx, y, mx, y + h, { width: 2 }),
      rect(q1, y, q3 - q1, h, toneAt(0, e.color), { opacity: 0.35 }),
      seg(med, y, med, y + h, { width: 3, color: "red" }),
    ];
    [mn, q1, med, q3, mx].forEach((v) => out.push(text(v, y - 0.55, fmt(v), { size: 12 })));
    return out;
  },

  scatter(e) {
    const pts = (Array.isArray(e.points) ? e.points : []).filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number"));
    const out: El[] = pts.map(([x, y]) => dot(x, y, 0.1, toneAt(0, e.color)));
    if (e.regression === true && pts.length > 1) {
      const nPts = pts.length;
      const sx = pts.reduce((s, p) => s + p[0], 0);
      const sy = pts.reduce((s, p) => s + p[1], 0);
      const sxx = pts.reduce((s, p) => s + p[0] * p[0], 0);
      const sxy = pts.reduce((s, p) => s + p[0] * p[1], 0);
      const den = nPts * sxx - sx * sx;
      if (den !== 0) {
        const a = (nPts * sxy - sx * sy) / den;
        const b = (sy - a * sx) / nPts;
        out.push({ kind: "function", expr: `${a}*x+${b}`, color: "red", dash: true });
      }
    }
    return out;
  },

  venn(e) {
    const sets = list(e.sets);
    const three = sets.length >= 3;
    const centers: [number, number][] = three ? [[-1.1, 0.7], [1.1, 0.7], [0, -1.2]] : [[-1.1, 0], [1.1, 0]];
    const r = n(e.radius, 2);
    const out: El[] = [{ kind: "rect", x: -4.2, y: -3.6, w: 8.4, h: 7.2, color: "gray", opacity: 0.03 }];
    centers.forEach(([cx, cy], i) => {
      out.push({ kind: "circle", x: cx, y: cy, radius: r, color: toneAt(i, sets[i]?.color), opacity: 0.14 });
      const lx = cx + (i === 0 ? -1.6 : i === 1 ? 1.6 : 0);
      const ly = cy + (three ? (i === 2 ? -2.3 : 2.3) : 2.4);
      out.push(text(lx, ly, String(sets[i]?.label ?? "ABC"[i]), { size: 15 }));
    });
    const c = (e.counts && typeof e.counts === "object" ? e.counts : {}) as Record<string, unknown>;
    const put = (key: string, x: number, y: number) => {
      if (c[key] !== undefined && c[key] !== "") out.push(text(x, y, String(c[key]), { size: 16 }));
    };
    if (three) {
      put("A", -2, 1.4); put("B", 2, 1.4); put("C", 0, -2.2);
      put("AB", 0, 1.6); put("AC", -1.1, -0.3); put("BC", 1.1, -0.3); put("ABC", 0, 0.3);
    } else {
      put("A", -2, 0); put("B", 2, 0); put("AB", 0, 0);
    }
    put("out", -3.5, -3);
    return out;
  },

  prob_tree(e) {
    type Node = { label?: string; p?: string; children?: Node[] };
    const root: Node = { label: String(e.root ?? ""), children: (Array.isArray(e.branches) ? e.branches : []) as Node[] };
    const out: El[] = [];
    let leaf = 0;
    const depthOf = (nd: Node): number => 1 + Math.max(0, ...(nd.children ?? []).map(depthOf));
    const D = depthOf(root);
    const place = (nd: Node, depth: number): number => {
      const kids = nd.children ?? [];
      const x = depth * 3.6;
      let y: number;
      if (!kids.length) y = -leaf++ * 1.3;
      else {
        const ys = kids.map((k) => place(k, depth + 1));
        y = (ys[0] + ys[ys.length - 1]) / 2;
        kids.forEach((k, i) => {
          const kx = (depth + 1) * 3.6;
          out.push(seg(x + 0.35, y, kx - 0.55, ys[i], { width: 1.6 }));
          if (k.p !== undefined) out.push(text((x + kx) / 2 - 0.1, (y + ys[i]) / 2 + 0.28, String(k.p), { size: 12, color: "gold" }));
        });
      }
      out.push(text(x, y, nd.label ?? "", { size: 14 }));
      return y;
    };
    place(root, 0);
    void D;
    return out;
  },

  regular_polygon(e) {
    const sides = Math.max(3, Math.min(24, Math.round(n(e.sides, 5))));
    const r = n(e.radius, 3);
    const rot = n(e.rotation, 90);
    const pts: [number, number][] = Array.from({ length: sides }, (_, i) => {
      const a = ((rot + (360 * i) / sides) * Math.PI) / 180;
      return [n(e.cx, 0) + r * Math.cos(a), n(e.cy, 0) + r * Math.sin(a)];
    });
    const out: El[] = [shape(pts, toneAt(0, e.color))];
    if (e.diagonals === true) for (let i = 0; i < sides; i++) for (let j = i + 2; j < sides; j++) if (!(i === 0 && j === sides - 1)) out.push(seg(pts[i][0], pts[i][1], pts[j][0], pts[j][1], { width: 1, dash: true, color: "gray" }));
    return out;
  },

  fraction_bar(e) {
    const parts = Math.max(1, Math.round(n(e.parts, 4)));
    const filled = Math.max(0, Math.min(parts, Math.round(n(e.filled, 1))));
    const w = 6 / parts;
    const out: El[] = [];
    for (let i = 0; i < parts; i++) out.push(rect(i * w, 0, w, 1.2, i < filled ? toneAt(0, e.color) : "gray", { opacity: i < filled ? 0.55 : 0.06 }));
    out.push(text(3, -0.6, `${filled}/${parts}`, { size: 16 }));
    return out;
  },

  fraction_disc(e) {
    const parts = Math.max(1, Math.round(n(e.parts, 4)));
    const filled = Math.max(0, Math.min(parts, Math.round(n(e.filled, 1))));
    const out: El[] = [];
    for (let i = 0; i < parts; i++) {
      const from = 90 - (360 * i) / parts;
      const to = 90 - (360 * (i + 1)) / parts;
      out.push(shape([[0, 0], ...arcPoints(0, 0, 2.5, from, to, Math.max(4, Math.round(360 / parts / 6)))], i < filled ? toneAt(0, e.color) : "gray", { opacity: i < filled ? 0.55 : 0.06 }));
    }
    out.push(text(0, -3.2, `${filled}/${parts}`, { size: 16 }));
    return out;
  },

  grid_paint(e) {
    const rows = Math.max(1, Math.round(n(e.rows, 3)));
    const cols = Math.max(1, Math.round(n(e.cols, 4)));
    const painted = Math.max(0, Math.round(n(e.painted, 0)));
    const out: El[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(rect(c, -r - 1, 1, 1, r * cols + c < painted ? toneAt(0, e.color) : "gray", { opacity: r * cols + c < painted ? 0.55 : 0.05 }));
    return out;
  },

  /** Tableau de cases (carré magique, tableau à compléter...) : une case « {{n}} » est un champ de réponse. */
  grid_cells(e) {
    const rows = (Array.isArray(e.rows) ? e.rows : []).map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")) : []));
    const cw = n(e.cellWidth, 1.6);
    const ch = n(e.cellHeight, 1.1);
    const out: El[] = [];
    rows.forEach((row, r) =>
      row.forEach((cell, c) => {
        out.push(rect(c * cw, -(r + 1) * ch, cw, ch, "navy", { opacity: 0.04, strokeColor: "navy" }));
        if (cell !== "") out.push(text(c * cw + cw / 2, -(r + 0.5) * ch, cell, { size: 16, w: cw * 28, h: ch * 26 }));
      }),
    );
    return out;
  },

  /** Pyramide de briques : la brique du haut en premier ; « {{n}} » = case à remplir. */
  pyramid(e) {
    const levels = (Array.isArray(e.levels) ? e.levels : []).map((l) => (Array.isArray(l) ? l.map((c) => String(c ?? "")) : []));
    const bw = n(e.brickWidth, 2);
    const bh = n(e.brickHeight, 1.1);
    const out: El[] = [];
    const total = levels.length;
    levels.forEach((row, r) => {
      const offset = ((total - row.length) * bw) / 2;
      row.forEach((cell, c) => {
        const x = offset + c * bw;
        out.push(rect(x, -(r + 1) * bh, bw, bh, r % 2 ? "gold" : "blue", { opacity: 0.12, strokeColor: "navy" }));
        if (cell !== "") out.push(text(x + bw / 2, -(r + 0.5) * bh, cell, { size: 16, w: bw * 24, h: bh * 26 }));
      });
    });
    return out;
  },
};

export const MACRO_KINDS = Object.keys(MACROS);

/** Remplace chaque macro par ses éléments de base ; les autres éléments passent tels quels. */
export function expandMacros(elements: JsxElement[]): JsxElement[] {
  const out: JsxElement[] = [];
  for (const e of elements) {
    const make = MACROS[e.kind as string];
    if (!make) out.push(e);
    else for (const child of make(e)) out.push(child as unknown as JsxElement);
    if (out.length > 1500) break;
  }
  return out;
}
