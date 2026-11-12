import type { StructuredCourseBlock } from "@/lib/ai/structuredFigures";
import type { EduFig, FigTone, GeoItem } from "@/lib/figures/types";

/**
 * Anciens blocs de figure (générés avant EduFig) traduits dans le nouveau format : ils profitent du même dessin et,
 * pour les polygones, d'une construction à l'échelle dès que l'énoncé donne les longueurs (avant, un « rectangle
 * 12 × 5 » sortait presque carré et l'angle droit d'un triangle n'était pas forcément au bon sommet).
 */
const TONES: Record<string, FigTone> = { navy: "ink", gold: "accent", blue: "blue", green: "green", red: "red", gray: "gray" };
const tone = (t: string | undefined): FigTone | undefined => (t ? TONES[t] : undefined);

/** « 5 cm » → 5 ; « 7,5 » → 7.5 ; « ? » ou « x » → undefined. */
function measure(label: string | undefined): number | undefined {
  if (!label) return undefined;
  const m = label.replace(/\\,|\s/g, "").replace(",", ".").match(/^\$?(\d+(?:\.\d+)?)\$?(?:cm|mm|m|dm|km|u)?\$?$/);
  return m ? Number(m[1]) : undefined;
}

type Legacy = Extract<StructuredCourseBlock, { type: "labeled_polygon" | "pie_chart" | "bar_chart" | "number_line" | "probability_tree" | "line_chart" }>;
export const LEGACY_FIGURE_TYPES = new Set(["labeled_polygon", "pie_chart", "bar_chart", "number_line", "probability_tree", "line_chart"]);

export function legacyToEduFig(block: StructuredCourseBlock): EduFig | null {
  if (!LEGACY_FIGURE_TYPES.has(block.type)) return null;
  const b = block as Legacy;
  const caption = b.caption || undefined;
  switch (b.type) {
    case "labeled_polygon": {
      const L = b.labels ?? {};
      const seg = (from: string, to: string, label: string | undefined): GeoItem[] => (label ? [{ type: "segment", from, to, label }] : []);
      if (b.shape === "rectangle" || b.shape === "square") {
        const [A, B, C, D] = b.vertices.length === 4 ? b.vertices : ["A", "B", "C", "D"];
        const sq = b.shape === "square";
        const lw = sq ? L.side ?? L.length : L.length;
        const lh = sq ? undefined : L.width ?? L.height;
        let w = measure(lw), h = sq ? w : measure(lh);
        if (w === undefined && h === undefined) { w = sq ? 4 : 6; h = sq ? 4 : 3.75; }
        else if (w === undefined) w = sq ? h : h! * 1.6;
        else if (h === undefined) h = sq ? w : w / 1.6;
        return {
          v: 1, kind: "geometry", caption,
          steps: [sq ? { op: "square", names: [A, B, C, D], side: w! } : { op: "rectangle", names: [A, B, C, D], width: w!, height: h! }],
          items: [...seg(A, B, lw), ...seg(B, C, lh), { type: "right", points: [D, A, B] }, { type: "right", points: [A, B, C] }, { type: "right", points: [B, C, D] }, { type: "right", points: [C, D, A] }],
        };
      }
      if (b.shape === "right_triangle") {
        // Ancien dessin : angle droit au premier sommet ; b = base (AB), a = hauteur (CA), c = hypoténuse (BC).
        const [A, B, C] = b.vertices.length === 3 ? b.vertices : ["A", "B", "C"];
        const lb = L.b ?? L.base, la = L.a ?? L.height, lc = L.c ?? L.hypotenuse;
        const lengths: Record<string, number> = {};
        const mb = measure(lb), ma = measure(la), mc = measure(lc);
        if (mb) lengths[A + B] = mb;
        if (ma) lengths[A + C] = ma;
        if (mc && Object.keys(lengths).length < 2) lengths[B + C] = mc;
        if (Object.keys(lengths).length < 2) { lengths[A + B] = mb ?? 4; if (!lengths[A + C] && !lengths[B + C]) lengths[A + C] = ma ?? 3; }
        return {
          v: 1, kind: "geometry", caption,
          steps: [{ op: "triangle", names: [A, B, C], right: A, lengths }],
          items: [...seg(A, B, lb), ...seg(A, C, la), ...seg(B, C, lc)],
        };
      }
      if (b.shape === "triangle") {
        const [A, B, C] = b.vertices.length === 3 ? b.vertices : ["A", "B", "C"];
        const base = measure(L.base) ?? 6, h = measure(L.height) ?? 3.5;
        return {
          v: 1, kind: "geometry", caption, hideLabels: ["H"],
          steps: [{ op: "point", name: A, x: 0, y: 0 }, { op: "point", name: B, x: base, y: 0 }, { op: "point", name: C, x: base * 0.35, y: h }, { op: "foot", name: "H", from: C, line: [A, B] }],
          items: [{ type: "polygon", points: [A, B, C] }, { type: "segment", from: C, to: "H", dashed: true, label: L.height }, { type: "right", points: [A, "H", C] }, ...seg(A, B, L.base)],
        };
      }
      if (b.shape === "parallelogram") {
        const [A, B, C, D] = b.vertices.length === 4 ? b.vertices : ["A", "B", "C", "D"];
        const base = measure(L.base) ?? 6, h = measure(L.height) ?? 3;
        return {
          v: 1, kind: "geometry", caption, hideLabels: ["H"],
          steps: [{ op: "point", name: A, x: 0, y: 0 }, { op: "point", name: B, x: base, y: 0 }, { op: "point", name: C, x: base + base * 0.3, y: h }, { op: "point", name: D, x: base * 0.3, y: h }, { op: "foot", name: "H", from: D, line: [A, B] }],
          items: [{ type: "polygon", points: [A, B, C, D] }, { type: "segment", from: D, to: "H", dashed: true, label: L.height }, { type: "right", points: [A, "H", D] }, ...seg(A, B, L.base)],
        };
      }
      if (b.shape === "trapezoid") {
        const [A, B, C, D] = b.vertices.length === 4 ? b.vertices : ["A", "B", "C", "D"];
        const big = measure(L.big_base ?? L.base) ?? 7, small = measure(L.small_base) ?? 4, h = measure(L.height) ?? 3;
        return {
          v: 1, kind: "geometry", caption,
          steps: [{ op: "trapezoid", names: [A, B, C, D], base: big, top: small, height: h }],
          items: [...seg(A, B, L.big_base ?? L.base), ...seg(D, C, L.small_base)],
        };
      }
      return null;
    }
    case "pie_chart":
      return { v: 1, kind: "pie", caption, items: b.slices.map((s) => ({ label: s.label, value: s.value })) };
    case "bar_chart":
      return { v: 1, kind: "bar", caption, categories: b.bars.map((x) => x.label), values: b.bars.map((x) => x.value), tone: tone(b.bars[0]?.tone) };
    case "line_chart":
      return { v: 1, kind: "linechart", caption, labels: b.xValues, yLabel: b.yLabel || undefined, series: b.series.map((s) => ({ name: s.name || undefined, values: s.values, tone: tone(s.tone) })) };
    case "number_line": {
      const span = b.max - b.min;
      const step = span <= 12 ? 1 : span <= 24 ? 2 : span <= 60 ? 5 : Math.ceil(span / 10);
      return {
        v: 1, kind: "numberline", caption, min: b.min, max: b.max, step,
        points: b.points.map((p) => ({ value: p.value, name: p.label || undefined })),
        intervals: b.intervals.map((iv) => ({ from: iv.from, to: iv.to, closedFrom: iv.fromIncluded, closedTo: iv.toIncluded, tone: tone(iv.tone) })),
      };
    }
    case "probability_tree":
      return {
        v: 1, kind: "tree", caption,
        branches: b.branches.map((br) => ({ label: br.label, p: br.probability || undefined, children: br.children.length ? br.children.map((c) => ({ label: c.label, p: c.probability || undefined })) : undefined })),
      };
  }
  return null;
}
