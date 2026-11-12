import { compile } from "mathjs";
import type { BarFig, GraphFig, LineChartFig, NumberLineFig, PieFig, ProgramFig, SolidFig, TreeBranch, TreeFig } from "@/lib/figures/types";
import { fmtNum } from "@/lib/figures/build";
import { DASH, SERIES, arrowHead, close, dot, esc, fill, fmt, hash, line, n, niceStep, open, stroke, text } from "@/lib/figures/svg";

const W = { s: 320, m: 440, l: 580 } as const;

/** Évalue « 2x + 1 », « x^2 - 3 », « 3/(x+1) »… ; null si l'expression n'est pas lisible. */
export function compileExpr(expr: string): ((x: number) => number) | null {
  try {
    const cleaned = expr.replace(/^\s*[a-zA-Z]\s*\(\s*x\s*\)\s*=\s*/, "").replace(/^\s*y\s*=\s*/, "").replace(/,/g, ".").replace(/\\/g, "").replace(/×/g, "*").replace(/−/g, "-");
    const code = compile(cleaned);
    const f = (x: number) => {
      const v = code.evaluate({ x, e: Math.E, pi: Math.PI });
      return typeof v === "number" ? v : NaN;
    };
    f(0.123);
    return f;
  } catch {
    return null;
  }
}

/* ───────────── Repère ───────────── */

export function renderGraph(fig: GraphFig): { svg: string; errors: string[] } {
  const errors: string[] = [];
  const width = W[fig.size ?? "m"], height = Math.round(width * 0.72);
  const [x0, x1] = fig.x[0] < fig.x[1] ? fig.x : [-5, 5];
  const fns = (fig.curves ?? []).map((c) => {
    const f = compileExpr(c.expr);
    if (!f) errors.push(`L'expression « ${c.expr} » n'est pas lisible.`);
    return { c, f };
  });
  let y0: number, y1: number;
  if (fig.y && fig.y[0] < fig.y[1]) [y0, y1] = fig.y;
  else {
    const vals: number[] = [];
    for (const { c, f } of fns) {
      if (!f) continue;
      const [a, b] = c.domain ?? [x0, x1];
      for (let i = 0; i <= 100; i++) { const v = f(a + ((b - a) * i) / 100); if (Number.isFinite(v)) vals.push(v); }
    }
    (fig.points ?? []).forEach((p) => vals.push(p.y));
    vals.sort((a, b) => a - b);
    const lo = vals.length ? vals[Math.floor(vals.length * 0.02)] : -5, hi = vals.length ? vals[Math.ceil(vals.length * 0.98) - 1] : 5;
    const pad = Math.max((hi - lo) * 0.12, 1);
    y0 = Math.min(lo - pad, -1); y1 = Math.max(hi + pad, 1);
  }
  const pl = 34, pr = 18, pt = 16, pb = 30;
  const sx = (x: number) => pl + ((x - x0) / (x1 - x0)) * (width - pl - pr);
  const sy = (y: number) => height - pb - ((y - y0) / (y1 - y0)) * (height - pt - pb);
  const xs = fig.xStep ?? niceStep(x1 - x0, 10), ys = fig.yStep ?? niceStep(y1 - y0, 8);
  const ox = Math.min(Math.max(0, x0), x1), oy = Math.min(Math.max(0, y0), y1);
  const id = "efc" + hash(JSON.stringify(fig));
  let out = open(width, height, fig.alt ?? `Repère ; ${fns.map(({ c }) => c.name ? `${c.name}(x) = ${c.expr}` : c.expr).join(", ")}`);
  out += `<defs><clipPath id="${id}"><rect x="${pl}" y="${pt}" width="${width - pl - pr}" height="${height - pt - pb}"/></clipPath></defs>`;
  if (fig.grid !== false) {
    for (let x = Math.ceil(x0 / xs) * xs; x <= x1 + 1e-9; x += xs) out += `<line x1="${n(sx(x))}" y1="${pt}" x2="${n(sx(x))}" y2="${height - pb}" class="ef-grid" stroke="#e8ebf1" stroke-width="1"/>`;
    for (let y = Math.ceil(y0 / ys) * ys; y <= y1 + 1e-9; y += ys) out += `<line x1="${pl}" y1="${n(sy(y))}" x2="${width - pr}" y2="${n(sy(y))}" class="ef-grid" stroke="#e8ebf1" stroke-width="1"/>`;
  }
  // Axes et graduations.
  out += line(pl, sy(oy), width - pr, sy(oy), "ink", 1.4) + arrowHead(width - pr + 4, sy(oy), pl, sy(oy), "ink", 8);
  out += line(sx(ox), height - pb, sx(ox), pt, "ink", 1.4) + arrowHead(sx(ox), pt - 4, sx(ox), height - pb, "ink", 8);
  for (let x = Math.ceil(x0 / xs) * xs; x <= x1 + 1e-9; x += xs) {
    if (Math.abs(x) < 1e-9 && ox === 0 && oy === 0) continue;
    out += line(sx(x), sy(oy) - 3, sx(x), sy(oy) + 3, "ink", 1.2) + text(sx(x), sy(oy) + 13, fmt(x), { size: 10.5, weight: 500, tone: "gray", halo: true });
  }
  for (let y = Math.ceil(y0 / ys) * ys; y <= y1 + 1e-9; y += ys) {
    if (Math.abs(y) < 1e-9) continue;
    out += line(sx(ox) - 3, sy(y), sx(ox) + 3, sy(y), "ink", 1.2) + text(sx(ox) - 7, sy(y), fmt(y), { size: 10.5, weight: 500, tone: "gray", anchor: "end" });
  }
  if (x0 <= 0 && x1 >= 0 && y0 <= 0 && y1 >= 0) out += text(sx(0) - 7, sy(0) + 12, "0", { size: 10.5, weight: 500, tone: "gray", anchor: "end" });
  out += text(width - pr, sy(oy) - 11, fig.xLabel ?? "x", { size: 12, italic: true, anchor: "end" });
  out += text(sx(ox) + 9, pt + 4, fig.yLabel ?? "y", { size: 12, italic: true, anchor: "start" });
  // Courbes.
  fns.forEach(({ c, f }, i) => {
    if (!f) return;
    const tone = c.tone ?? SERIES[(i + 1) % SERIES.length];
    const [a, b] = c.domain ?? [x0, x1];
    let d = "", pen = false, last: [number, number] | null = null;
    const N = 400;
    for (let k = 0; k <= N; k++) {
      const x = a + ((b - a) * k) / N, y = f(x);
      if (!Number.isFinite(y) || Math.abs(y - (y0 + y1) / 2) > (y1 - y0) * 4) { pen = false; continue; }
      const X = sx(x), Y = sy(y);
      if (last && Math.abs(Y - last[1]) > height * 1.5) pen = false;
      d += `${pen ? "L" : "M"} ${n(X)} ${n(Y)} `;
      pen = true;
      if (y >= y0 && y <= y1) last = [X, Y];
    }
    out += `<path d="${d.trim()}" fill="none" clip-path="url(#${id})" ${stroke(tone, 2.2)}${c.dashed ? " " + DASH : ""}/>`;
    if (c.name && last) out += text(Math.min(last[0], width - pr - 10) - 6, last[1] - 12, c.name.startsWith("C") ? c.name : `𝒞${c.name}`, { tone, italic: true, anchor: "end" });
  });
  (fig.segments ?? []).forEach((sg) => {
    out += line(sx(sg.from[0]), sy(sg.from[1]), sx(sg.to[0]), sy(sg.to[1]), sg.tone ?? "ink", 1.8, sg.dashed);
    if (sg.arrow) out += arrowHead(sx(sg.to[0]), sy(sg.to[1]), sx(sg.from[0]), sy(sg.from[1]), sg.tone ?? "ink");
  });
  (fig.points ?? []).forEach((p) => {
    const X = sx(p.x), Y = sy(p.y), tone = p.tone ?? "red";
    if (p.guides) out += line(X, Y, X, sy(oy), "gray", 1.2, true) + line(X, Y, sx(ox), Y, "gray", 1.2, true);
    out += dot(X, Y, tone, 3.6);
    if (p.name) out += text(X + 8, Y - 11, p.name, { tone, anchor: "start", size: 13, weight: 700 });
  });
  return { svg: out + close(), errors };
}

/* ───────────── Droite graduée ───────────── */

export function renderNumberLine(fig: NumberLineFig): { svg: string; errors: string[] } {
  const errors: string[] = [];
  const width = W[fig.size ?? "m"], height = 96;
  if (!(fig.max > fig.min) || !(fig.step > 0)) return { svg: "", errors: ["La droite graduée a besoin d'un minimum, d'un maximum plus grand et d'un pas positif."] };
  const pl = 22, pr = 26, y = 52;
  const sx = (v: number) => pl + ((v - fig.min) / (fig.max - fig.min)) * (width - pl - pr);
  let out = open(width, height, fig.alt ?? `Droite graduée de ${fmt(fig.min)} à ${fmt(fig.max)}`);
  for (const iv of fig.intervals ?? []) {
    const tone = iv.tone ?? "accent";
    const a = sx(Math.max(iv.from, fig.min)), b = sx(Math.min(iv.to, fig.max));
    out += `<rect x="${n(a)}" y="${y - 5}" width="${n(b - a)}" height="10" rx="3" ${fill(tone, 0.25)}/>`;
    const bracket = (x: number, closed: boolean, left: boolean) => {
      const dir = (left ? 1 : -1) * (closed ? 1 : -1);
      return `<path d="M ${n(x + dir * 6)} ${y - 12} L ${n(x)} ${y - 12} L ${n(x)} ${y + 12} L ${n(x + dir * 6)} ${y + 12}" fill="none" ${stroke(tone, 2.2)}/>`;
    };
    if (iv.from >= fig.min) out += bracket(a, iv.closedFrom !== false, true);
    if (iv.to <= fig.max) out += bracket(b, iv.closedTo !== false, false);
  }
  out += line(pl - 8, y, width - pr + 10, y, "ink", 1.6) + arrowHead(width - pr + 16, y, pl, y, "ink", 9);
  const count = Math.round((fig.max - fig.min) / fig.step);
  const minor = fig.minor ?? 0;
  for (let i = 0; i <= count; i++) {
    const v = fig.min + i * fig.step, X = sx(v);
    out += line(X, y - 7, X, y + 7, "ink", 1.5);
    const show = (fig.labels ?? "all") === "all" || ((fig.labels === "ends") && (i === 0 || i === count || Math.abs(v) < 1e-9));
    if (show) out += text(X, y + 20, fmt(v), { size: 11.5, weight: 500 });
    if (minor > 0 && i < count) for (let k = 1; k < minor; k++) { const Xm = sx(v + (fig.step * k) / minor); out += line(Xm, y - 3.5, Xm, y + 3.5, "ink", 1); }
  }
  for (const p of fig.points ?? []) {
    if (p.value < fig.min || p.value > fig.max) { errors.push(`Le point ${p.name ?? fmt(p.value)} est hors de la droite.`); continue; }
    const X = sx(p.value), tone = p.tone ?? "red";
    out += dot(X, y, tone, 4.2);
    if (p.name) out += text(X, y - 19, p.name, { tone, size: 13.5, weight: 700 });
  }
  return { svg: out + close(), errors };
}

/* ───────────── Diagrammes ───────────── */

function valueAxis(values: number[], height: number, pt: number, pb: number) {
  const max = Math.max(...values, 0) || 1;
  const step = niceStep(max, 5);
  const top = Math.ceil((max * 1.08) / step) * step;
  const sy = (v: number) => height - pb - (v / top) * (height - pt - pb);
  return { top, step, sy };
}

export function renderBar(fig: BarFig): { svg: string; errors: string[] } {
  const errors: string[] = [];
  if (fig.categories.length !== fig.values.length) errors.push("Il faut autant de valeurs que de catégories.");
  const width = W[fig.size ?? "m"], height = Math.round(width * 0.66);
  const pl = 42, pr = 14, pt = 22, pb = fig.xLabel ? 46 : 34;
  const vals = fig.values.slice(0, fig.categories.length);
  const { top, step, sy } = valueAxis(vals, height, pt, pb);
  let out = open(width, height, fig.alt ?? `Diagramme en barres : ${fig.categories.map((c, i) => `${c} ${fmt(vals[i] ?? 0)}`).join(", ")}`);
  for (let v = 0; v <= top + 1e-9; v += step) {
    out += `<line x1="${pl}" y1="${n(sy(v))}" x2="${width - pr}" y2="${n(sy(v))}" class="ef-grid" stroke="#e8ebf1" stroke-width="1"/>`;
    out += text(pl - 7, sy(v), fmt(v), { size: 10.5, weight: 500, tone: "gray", anchor: "end", halo: false });
  }
  const slot = (width - pl - pr) / Math.max(vals.length, 1);
  const bw = fig.joined ? slot : Math.min(slot * 0.62, 56);
  vals.forEach((v, i) => {
    const x = pl + slot * i + (slot - bw) / 2, y = sy(v);
    out += `<rect x="${n(x)}" y="${n(y)}" width="${n(bw)}" height="${n(sy(0) - y)}" rx="${fig.joined ? 0 : 5}" ${fill(fig.tone ?? "accent", 0.85)} ${stroke(fig.tone ?? "accent", fig.joined ? 1.2 : 0)}/>`;
    out += text(x + bw / 2, y - 9, fmt(v), { size: 11, weight: 700 });
    out += text(pl + slot * i + slot / 2, sy(0) + 13, fig.categories[i], { size: vals.length > 7 ? 9.5 : 11, weight: 500 });
  });
  out += line(pl, sy(0), width - pr, sy(0), "ink", 1.4) + line(pl, sy(0), pl, pt - 6, "ink", 1.4);
  if (fig.yLabel) out += text(pl - 4, pt - 12, fig.yLabel, { size: 11, anchor: "start", italic: true });
  if (fig.xLabel) out += text((pl + width - pr) / 2, height - 12, fig.xLabel, { size: 11, italic: true });
  return { svg: out + close(), errors };
}

export function renderLineChart(fig: LineChartFig): { svg: string; errors: string[] } {
  const width = W[fig.size ?? "m"], height = Math.round(width * 0.62);
  const pl = 42, pr = 18, pt = 22, pb = 34;
  const all = fig.series.flatMap((s) => s.values);
  const { top, step, sy } = valueAxis(all, height, pt, pb);
  const sx = (i: number) => pl + (fig.labels.length <= 1 ? 0 : (i / (fig.labels.length - 1)) * (width - pl - pr));
  let out = open(width, height, fig.alt ?? "Graphique en courbe");
  for (let v = 0; v <= top + 1e-9; v += step) {
    out += `<line x1="${pl}" y1="${n(sy(v))}" x2="${width - pr}" y2="${n(sy(v))}" class="ef-grid" stroke="#e8ebf1" stroke-width="1"/>`;
    out += text(pl - 7, sy(v), fmt(v), { size: 10.5, weight: 500, tone: "gray", anchor: "end", halo: false });
  }
  fig.labels.forEach((l, i) => { out += text(sx(i), sy(0) + 14, l, { size: 10.5, weight: 500 }); });
  out += line(pl, sy(0), width - pr, sy(0), "ink", 1.4) + line(pl, sy(0), pl, pt - 6, "ink", 1.4);
  fig.series.forEach((s, k) => {
    const tone = s.tone ?? SERIES[k % SERIES.length];
    const ptsStr = s.values.map((v, i) => `${n(sx(i))},${n(sy(v))}`).join(" ");
    out += `<polyline points="${ptsStr}" fill="none" ${stroke(tone, 2.2)}/>`;
    s.values.forEach((v, i) => { out += dot(sx(i), sy(v), tone, 3.4); });
    if (s.name) out += text(width - pr, sy(s.values[s.values.length - 1] ?? 0) - 12, s.name, { tone, anchor: "end", size: 11.5 });
  });
  if (fig.yLabel) out += text(pl - 4, pt - 12, fig.yLabel, { size: 11, anchor: "start", italic: true });
  return { svg: out + close(), errors: [] };
}

export function renderPie(fig: PieFig): { svg: string; errors: string[] } {
  const width = W[fig.size ?? "m"], height = Math.round(width * 0.68);
  const total = fig.items.reduce((s, it) => s + Math.max(0, it.value), 0);
  if (!(total > 0)) return { svg: "", errors: ["Le diagramme circulaire a besoin de valeurs positives."] };
  const cx = width / 2, cy = height / 2, r = Math.min(width, height) * 0.32;
  let out = open(width, height, fig.alt ?? `Diagramme circulaire : ${fig.items.map((it) => it.label).join(", ")}`);
  let a = -Math.PI / 2;
  fig.items.forEach((it, i) => {
    const frac = Math.max(0, it.value) / total;
    const b = a + frac * 2 * Math.PI;
    const tone = SERIES[i % SERIES.length];
    const p1 = [cx + r * Math.cos(a), cy + r * Math.sin(a)], p2 = [cx + r * Math.cos(b), cy + r * Math.sin(b)];
    out += frac >= 0.9999
      ? `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${fill(tone, 0.85)} stroke="#ffffff" class="ef-f-${tone} ef-sep" stroke-width="2"/>`
      : `<path d="M ${n(cx)} ${n(cy)} L ${n(p1[0])} ${n(p1[1])} A ${n(r)} ${n(r)} 0 ${frac > 0.5 ? 1 : 0} 1 ${n(p2[0])} ${n(p2[1])} Z" ${fill(tone, 0.85)} stroke="#ffffff" stroke-width="2"/>`;
    const mid = (a + b) / 2;
    const lx = cx + (r + 22) * Math.cos(mid), ly = cy + (r + 18) * Math.sin(mid);
    const value = fig.percent !== false ? `${fmtNum(frac * 100, 1)} %` : fmt(it.value);
    out += text(lx, ly - 7, it.label, { size: 11.5, anchor: Math.cos(mid) > 0.25 ? "start" : Math.cos(mid) < -0.25 ? "end" : "middle" });
    out += text(lx, ly + 8, value, { size: 11, weight: 500, tone: "gray", anchor: Math.cos(mid) > 0.25 ? "start" : Math.cos(mid) < -0.25 ? "end" : "middle" });
    a = b;
  });
  return { svg: out + close(), errors: [] };
}

/* ───────────── Arbre de probabilités ───────────── */

export function renderTree(fig: TreeFig): { svg: string; errors: string[] } {
  const leaves = (b: TreeBranch[]): number => b.reduce((s, x) => s + (x.children?.length ? leaves(x.children) : 1), 0);
  const depth = (b: TreeBranch[]): number => 1 + Math.max(0, ...b.map((x) => (x.children?.length ? depth(x.children) : 0)));
  const L = Math.max(1, leaves(fig.branches)), D = depth(fig.branches);
  const width = W[fig.size ?? "m"], rowH = 36, height = Math.max(120, L * rowH + 20);
  const colW = (width - 46) / D;
  const root: [number, number] = [22, height / 2];
  let lines = "", labels = "";
  let leaf = 0;
  /** Place une liste de branches partant de `from` et renvoie rien : chaque nœud se met au milieu de ses feuilles. */
  const place = (branches: TreeBranch[], level: number, from: [number, number]) => {
    for (const b of branches) {
      const x = 22 + colW * (level + 1);
      let y: number;
      if (b.children?.length) {
        const first = leaf, count = leaves(b.children);
        y = 10 + (first + count / 2) * rowH;
        place(b.children, level + 1, [x + 14, y]);
      } else {
        y = 10 + (leaf + 0.5) * rowH;
        leaf++;
      }
      lines += line(from[0], from[1], x - 16, y, "ink", 1.5);
      if (b.p) {
        const t = 0.55, mx = from[0] + (x - 16 - from[0]) * t, my = from[1] + (y - from[1]) * t;
        labels += text(mx, my + (y < from[1] ? -10 : y > from[1] ? 10 : -10), b.p, { size: 11.5, tone: "accent" });
      }
      labels += text(x, y, b.label, { size: 13, weight: 700 });
    }
  };
  place(fig.branches, 0, root);
  const out = open(width, height, fig.alt ?? "Arbre de probabilités") + lines + dot(root[0], root[1], "ink", 3) + labels + close();
  return { svg: out, errors: [] };
}

/* ───────────── Solides (perspective cavalière) ───────────── */

export function renderSolid(fig: SolidFig): { svg: string; errors: string[] } {
  const width = W[fig.size ?? "m"], height = Math.round(width * 0.72);
  const d = fig.dims ?? {};
  const unitLabel = fig.unit ?? "cm";
  const L = (v: number | undefined) => (v !== undefined ? `${fmtNum(v)} ${unitLabel}` : "");
  const k = 0.5, ang = Math.PI / 4;
  let out = open(width, height, fig.alt ?? `Solide : ${fig.shape}`);
  const labelNames = fig.names ?? [];
  type P2 = [number, number];
  const draw = (pts: P2[], hiddenEdges: [number, number][], edges: [number, number][], scale: number, ox: number, oy: number) => {
    const S = (p: P2): P2 => [ox + p[0] * scale, oy - p[1] * scale];
    for (const [i, j] of hiddenEdges) { const a = S(pts[i]), b = S(pts[j]); out += line(a[0], a[1], b[0], b[1], "ink", 1.4, true); }
    for (const [i, j] of edges) { const a = S(pts[i]), b = S(pts[j]); out += line(a[0], a[1], b[0], b[1], "ink", 1.8); }
    return S;
  };
  const fit = (w: number, h: number) => Math.min((width - 90) / w, (height - 70) / h);

  if (fig.shape === "cube" || fig.shape === "box") {
    const a = d.a ?? 4, b = fig.shape === "cube" ? a : d.b ?? 2.5, c = fig.shape === "cube" ? a : d.c ?? 3;
    const dx = b * k * Math.cos(ang), dy = b * k * Math.sin(ang);
    const pts: P2[] = [[0, 0], [a, 0], [a, c], [0, c], [dx, dy], [a + dx, dy], [a + dx, c + dy], [dx, c + dy]];
    const s = fit(a + dx, c + dy), ox = (width - (a + dx) * s) / 2, oy = height - (height - (c + dy) * s) / 2;
    out += `<polygon points="${[0, 1, 2, 3].map((i) => `${n(ox + pts[i][0] * s)},${n(oy - pts[i][1] * s)}`).join(" ")}" ${fill("accent", 0.1)} stroke="none"/>`;
    const S = draw(pts, [[0, 4], [4, 5], [4, 7]], [[0, 1], [1, 2], [2, 3], [3, 0], [1, 5], [5, 6], [6, 7], [7, 3], [2, 6]], s, ox, oy);
    labelNames.slice(0, 8).forEach((nm, i) => { const p = S(pts[i]); const c0 = S([(a + dx) / 2, (c + dy) / 2]); const u = [p[0] - c0[0], p[1] - c0[1]]; const l = Math.hypot(u[0], u[1]) || 1; out += text(p[0] + (u[0] / l) * 13, p[1] + (u[1] / l) * 13, nm, { size: 13, weight: 700 }); });
    if (fig.showDims) {
      const A = S(pts[0]), B = S(pts[1]), C = S(pts[2]), F = S(pts[5]);
      out += text((A[0] + B[0]) / 2, A[1] + 15, L(a), { size: 12 });
      if (fig.shape === "box") { out += text((B[0] + F[0]) / 2 + 12, (B[1] + F[1]) / 2 + 6, L(b), { size: 12, anchor: "start" }); out += text(A[0] - 10, (A[1] + S(pts[3])[1]) / 2, L(c), { size: 12, anchor: "end" }); }
      void C;
    }
  } else if (fig.shape === "pyramid") {
    const a = d.a ?? 4, h = d.h ?? 4.5;
    const dx = a * k * Math.cos(ang), dy = a * k * Math.sin(ang);
    const pts: P2[] = [[0, 0], [a, 0], [a + dx, dy], [dx, dy], [(a + dx) / 2, h + dy / 2], [(a + dx) / 2, dy / 2]];
    const s = fit(a + dx, h + dy), ox = (width - (a + dx) * s) / 2, oy = height - (height - (h + dy / 2) * s) / 2 + 4;
    const S = draw(pts, [[0, 3], [3, 2], [3, 4], [4, 5]], [[0, 1], [1, 2], [0, 4], [1, 4], [2, 4]], s, ox, oy);
    labelNames.slice(0, 5).forEach((nm, i) => { const p = S(pts[i]); out += text(p[0] + (i === 4 ? 0 : i === 0 || i === 3 ? -12 : 12), p[1] + (i === 4 ? -13 : 10), nm, { size: 13, weight: 700 }); });
    if (fig.showDims) { const T = S(pts[4]), O = S(pts[5]); out += text(T[0] + 8, (T[1] + O[1]) / 2, L(h), { size: 12, anchor: "start" }); const A = S(pts[0]), B = S(pts[1]); out += text((A[0] + B[0]) / 2, A[1] + 15, L(a), { size: 12 }); }
  } else if (fig.shape === "prism") {
    const a = d.a ?? 4, h = d.h ?? 3, len = d.b ?? 4;
    const dx = len * k * Math.cos(ang), dy = len * k * Math.sin(ang);
    const pts: P2[] = [[0, 0], [a, 0], [a / 2, h], [dx, dy], [a + dx, dy], [a / 2 + dx, h + dy]];
    const s = fit(a + dx, h + dy), ox = (width - (a + dx) * s) / 2, oy = height - (height - (h + dy) * s) / 2;
    draw(pts, [[0, 3], [3, 4], [3, 5]], [[0, 1], [1, 2], [2, 0], [1, 4], [4, 5], [2, 5]], s, ox, oy);
  } else if (fig.shape === "cylinder" || fig.shape === "cone") {
    const r = d.r ?? 2, h = d.h ?? 4;
    const s = fit(2 * r, h + r * 0.6), cx = width / 2, base = height - (height - (h + r * 0.6) * s) / 2 - r * 0.3 * s;
    const rx = r * s, ry = r * s * 0.3;
    out += `<path d="M ${n(cx - rx)} ${n(base)} A ${n(rx)} ${n(ry)} 0 0 1 ${n(cx + rx)} ${n(base)}" fill="none" ${stroke("ink", 1.4)} ${DASH}/>`;
    out += `<path d="M ${n(cx - rx)} ${n(base)} A ${n(rx)} ${n(ry)} 0 0 0 ${n(cx + rx)} ${n(base)}" fill="none" ${stroke("ink")}/>`;
    const topY = base - h * s;
    if (fig.shape === "cylinder") {
      out += `<ellipse cx="${n(cx)}" cy="${n(topY)}" rx="${n(rx)}" ry="${n(ry)}" ${fill("accent", 0.12)} ${stroke("ink")}/>`;
      out += line(cx - rx, base, cx - rx, topY) + line(cx + rx, base, cx + rx, topY);
    } else {
      out += line(cx - rx, base, cx, topY) + line(cx + rx, base, cx, topY);
      out += line(cx, topY, cx, base, "gray", 1.2, true);
    }
    out += line(cx, base, cx + rx, base, "accent", 1.4) + dot(cx, base, "ink", 2.6);
    if (fig.showDims) { out += text(cx + rx / 2, base - 10, L(r), { size: 12 }); out += text(cx + rx + 8, (base + topY) / 2, L(h), { size: 12, anchor: "start" }); }
  } else if (fig.shape === "sphere") {
    const r = d.r ?? 3;
    const s = fit(2 * r, 2 * r), cx = width / 2, cy = height / 2, R = r * s;
    out += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}" ${fill("accent", 0.08)} ${stroke("ink")}/>`;
    out += `<path d="M ${n(cx - R)} ${n(cy)} A ${n(R)} ${n(R * 0.28)} 0 0 1 ${n(cx + R)} ${n(cy)}" fill="none" ${stroke("ink", 1.3)} ${DASH}/>`;
    out += `<path d="M ${n(cx - R)} ${n(cy)} A ${n(R)} ${n(R * 0.28)} 0 0 0 ${n(cx + R)} ${n(cy)}" fill="none" ${stroke("ink", 1.5)}/>`;
    out += line(cx, cy, cx + R, cy, "accent", 1.4) + dot(cx, cy, "ink", 2.6);
    if (fig.showDims) out += text(cx + R / 2, cy - 11, L(r), { size: 12 });
  }
  return { svg: out + close(), errors: [] };
}

/* ───────────── Programme de calcul ───────────── */

export function renderProgram(fig: ProgramFig): { svg: string; errors: string[] } {
  const width = W[fig.size ?? "m"];
  const boxH = 34, gap = 22, bw = Math.min(width - 60, 320);
  const height = 20 + fig.steps.length * (boxH + gap) - gap + 20;
  let out = open(width, height, fig.alt ?? `Programme de calcul : ${fig.steps.join(" ; ")}`);
  fig.steps.forEach((st, i) => {
    const x = (width - bw) / 2, y = 20 + i * (boxH + gap);
    const first = i === 0, last = i === fig.steps.length - 1;
    const tone = first || last ? "accent" : "ink";
    out += `<rect x="${n(x)}" y="${n(y)}" width="${n(bw)}" height="${boxH}" rx="${first || last ? boxH / 2 : 9}" ${fill(tone, 0.1)} ${stroke(tone, 1.6)}/>`;
    out += text(width / 2, y + boxH / 2, st, { size: 12.5, weight: first || last ? 700 : 600 });
    if (!last) out += line(width / 2, y + boxH + 2, width / 2, y + boxH + gap - 4, "ink", 1.5) + arrowHead(width / 2, y + boxH + gap - 1, width / 2, y + boxH, "ink", 7);
  });
  return { svg: out + close(), errors: [] };
}

export { esc };
