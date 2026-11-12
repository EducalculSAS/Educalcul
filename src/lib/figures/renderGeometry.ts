import type { FigTone, GeoItem, GeometryFig } from "@/lib/figures/types";
import { angleAt, buildGeometry, dist, fmtNum, type GeoScene, type Vec } from "@/lib/figures/build";
import { DASH, arrowHead, close, dot, fill, line, n, open, stroke, text } from "@/lib/figures/svg";

const WIDTH = { s: 300, m: 420, l: 560 } as const;
const MAX_H = { s: 240, m: 320, l: 420 } as const;
const PAD = 38;

type Screen = (p: Vec) => Vec;

function unit(v: Vec): Vec {
  const l = Math.hypot(v.x, v.y);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}

/** Points liés à chaque point par un trait dessiné : sert à écarter son nom des traits. */
function neighbours(items: GeoItem[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!m.has(a)) m.set(a, new Set());
    if (!m.has(b)) m.set(b, new Set());
    m.get(a)!.add(b);
    m.get(b)!.add(a);
  };
  for (const it of items) {
    if (it.type === "polygon") it.points.forEach((p, i) => link(p, it.points[(i + 1) % it.points.length]));
    else if (it.type === "segment" || it.type === "vector") link(it.from, it.to);
    else if (it.type === "line") link(it.through[0], it.through[1]);
    else if (it.type === "ray") link(it.from, it.through);
  }
  return m;
}

/** Prolonge la droite (ab) jusqu'aux bords du cadre. */
function extend(a: Vec, b: Vec, w: number, h: number, both = true): [Vec, Vec] {
  const d = unit({ x: b.x - a.x, y: b.y - a.y });
  const far = w + h;
  const start = both ? { x: a.x - d.x * far, y: a.y - d.y * far } : a;
  const end = { x: a.x + d.x * far, y: a.y + d.y * far };
  // Découpe au rectangle [6, w-6] × [6, h-6] (Liang–Barsky).
  let t0 = 0, t1 = 1;
  const dx = end.x - start.x, dy = end.y - start.y;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  const m = 6;
  if (clip(-dx, start.x - m) && clip(dx, w - m - start.x) && clip(-dy, start.y - m) && clip(dy, h - m - start.y)) {
    return [{ x: start.x + dx * t0, y: start.y + dy * t0 }, { x: start.x + dx * t1, y: start.y + dy * t1 }];
  }
  return [a, b];
}

export function renderGeometry(fig: GeometryFig): { svg: string; errors: string[]; scene: GeoScene } {
  const scene = buildGeometry(fig);
  const items: GeoItem[] = [...scene.autoItems, ...(fig.items ?? [])];
  const size = fig.size ?? "m";
  const pts = scene.points;
  const unitLabel = fig.unit ?? "cm";

  // Cadre : tous les points et cercles, à l'échelle.
  const xs: number[] = [], ys: number[] = [];
  pts.forEach((p) => { xs.push(p.x); ys.push(p.y); });
  for (const c of scene.circles) {
    const p = pts.get(c.center);
    if (p) { xs.push(p.x - c.r, p.x + c.r); ys.push(p.y - c.r, p.y + c.r); }
  }
  for (const it of items) {
    if (it.type === "circle") {
      const p = pts.get(it.center);
      const r = it.radius ?? (it.through && pts.get(it.through) && p ? dist(p, pts.get(it.through)!) : 0);
      if (p && r) { xs.push(p.x - r, p.x + r); ys.push(p.y - r, p.y + r); }
    }
  }
  if (xs.length === 0) { xs.push(0, 1); ys.push(0, 1); }
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);
  const W = WIDTH[size];
  const s = Math.min((W - 2 * PAD) / spanX, (MAX_H[size] - 2 * PAD) / spanY);
  const H = Math.max(150, spanY * s + 2 * PAD);
  const offX = (W - spanX * s) / 2, offY = (H - spanY * s) / 2;
  const S: Screen = (p) => ({ x: offX + (p.x - minX) * s, y: H - offY - (p.y - minY) * s });
  const P = (name: string) => { const p = pts.get(name); return p ? S(p) : null; };
  const all = [...pts.values()].map(S);
  const center = all.reduce((a, p) => ({ x: a.x + p.x / all.length, y: a.y + p.y / all.length }), { x: 0, y: 0 });

  const alt = fig.alt ?? `Figure : ${[...pts.keys()].join(", ")}`;
  const layers = { fill: "", grid: "", stroke: "", marks: "", dots: "", labels: "" };

  if (fig.grid && s >= 12) {
    let g = "";
    for (let x = Math.ceil(minX - offX / s); x <= maxX + offX / s; x++) { const X = S({ x, y: 0 }).x; g += `<line x1="${n(X)}" y1="0" x2="${n(X)}" y2="${n(H)}" class="ef-grid" stroke="#e8ebf1" stroke-width="1"/>`; }
    for (let y = Math.ceil(minY - offY / s); y <= maxY + offY / s; y++) { const Y = S({ x: 0, y }).y; g += `<line x1="0" y1="${n(Y)}" x2="${n(W)}" y2="${n(Y)}" class="ef-grid" stroke="#e8ebf1" stroke-width="1"/>`; }
    layers.grid = g;
  }

  /** Étiquettes à placer à la fin, sans chevauchement : chacune a des positions de repli, essayées dans l'ordre. */
  const pending: { candidates: Vec[]; text: string; tone: FigTone; size: number; weight: number; priority: number }[] = [];
  const labelSegment = (a: Vec, b: Vec, lab: string, tone: FigTone = "ink") => {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d = unit({ x: b.x - a.x, y: b.y - a.y });
    let nrm = unit({ x: -(b.y - a.y), y: b.x - a.x });
    if ((mid.x - center.x) * nrm.x + (mid.y - center.y) * nrm.y < 0) nrm = { x: -nrm.x, y: -nrm.y };
    const at = (k: number, t: number) => ({ x: mid.x + nrm.x * k + d.x * t, y: mid.y + nrm.y * k + d.y * t });
    pending.push({ candidates: [at(14, 0), at(-14, 0), at(14, 22), at(14, -22), at(-14, 22), at(-14, -22), at(28, 0)], text: lab, tone, size: 12.5, weight: 600, priority: 2 });
  };
  const lengthText = (a: string, b: string, label: string | boolean | undefined) => {
    if (label === true) {
      const pa = pts.get(a), pb = pts.get(b);
      return pa && pb ? `${fmtNum(dist(pa, pb))}${unitLabel ? " " + unitLabel : ""}` : "";
    }
    return typeof label === "string" ? label : "";
  };

  const vertices = new Set<string>();
  for (const it of items) {
    const tone = ("tone" in it && it.tone) || "ink";
    switch (it.type) {
      case "polygon": {
        const ps = it.points.map(P).filter(Boolean) as Vec[];
        if (ps.length < 2) break;
        it.points.forEach((p) => vertices.add(p));
        const d = ps.map((p) => `${n(p.x)},${n(p.y)}`).join(" ");
        if (it.fill !== false) layers.fill += `<polygon points="${d}" ${fill(tone, 0.1)} stroke="none"/>`;
        layers.stroke += `<polygon points="${d}" fill="none" ${stroke(tone)}${it.dashed ? " " + DASH : ""}/>`;
        break;
      }
      case "segment": {
        const a = P(it.from), b = P(it.to);
        if (!a || !b) break;
        layers.stroke += line(a.x, a.y, b.x, b.y, tone, 1.8, it.dashed);
        const lab = lengthText(it.from, it.to, it.label);
        if (lab) labelSegment(a, b, lab, tone);
        break;
      }
      case "line":
      case "ray": {
        const a = P(it.type === "line" ? it.through[0] : it.from), b = P(it.type === "line" ? it.through[1] : it.through);
        if (!a || !b) break;
        const [p, q] = extend(a, b, W, H, it.type === "line");
        layers.stroke += line(p.x, p.y, q.x, q.y, tone, 1.5, it.dashed);
        if (it.type === "line" && it.label) {
          // Le nom de la droite près de son extrémité, toujours à l'intérieur du cadre.
          const d = unit({ x: q.x - p.x, y: q.y - p.y });
          const lx = Math.min(W - 18, Math.max(18, q.x - d.x * 22 + 12)), ly = Math.min(H - 14, Math.max(14, q.y - d.y * 22));
          layers.labels += text(lx, ly, it.label, { tone, italic: true, anchor: "start" });
        }
        break;
      }
      case "vector": {
        const a = P(it.from), b = P(it.to);
        if (!a || !b) break;
        layers.stroke += line(a.x, a.y, b.x, b.y, tone, 1.8) + arrowHead(b.x, b.y, a.x, a.y, tone);
        if (it.label) labelSegment(a, b, it.label, tone);
        break;
      }
      case "circle": {
        const c = P(it.center);
        const pc = pts.get(it.center);
        const r = it.radius ?? (it.through && pts.get(it.through) && pc ? dist(pc, pts.get(it.through)!) : 0);
        if (!c || !r) break;
        layers.stroke += `<circle cx="${n(c.x)}" cy="${n(c.y)}" r="${n(r * s)}" ${it.fill ? fill(tone, 0.08) : 'fill="none"'} ${stroke(tone)}${it.dashed ? " " + DASH : ""}/>`;
        break;
      }
      case "angle": {
        const [pa, pb, pc] = it.points;
        const a = P(pa), b = P(pb), c = P(pc);
        if (!a || !b || !c) break;
        const r0 = 20;
        const a1 = Math.atan2(a.y - b.y, a.x - b.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
        let delta = a2 - a1;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        const sweep = delta > 0 ? 1 : 0;
        for (let k = 0; k < (it.marks ?? 1); k++) {
          const r = r0 + k * 4;
          const p1 = { x: b.x + r * Math.cos(a1), y: b.y + r * Math.sin(a1) };
          const p2 = { x: b.x + r * Math.cos(a1 + delta), y: b.y + r * Math.sin(a1 + delta) };
          layers.marks += `<path d="M ${n(p1.x)} ${n(p1.y)} A ${r} ${r} 0 0 ${sweep} ${n(p2.x)} ${n(p2.y)}" fill="none" ${stroke(tone === "ink" ? "accent" : tone, 1.6)}/>`;
        }
        const lab = it.label === true ? `${fmtNum(angleAt(pts.get(pa)!, pts.get(pb)!, pts.get(pc)!), 1)}°` : typeof it.label === "string" ? it.label : "";
        if (lab) {
          const mid = a1 + delta / 2;
          const rr = r0 + (it.marks ?? 1) * 4 + 14;
          pending.push({ candidates: [rr, rr + 10, rr + 20].map((r) => ({ x: b.x + r * Math.cos(mid), y: b.y + r * Math.sin(mid) })), text: lab, tone: tone === "ink" ? "accent" : tone, size: 12, weight: 600, priority: 3 });
        }
        break;
      }
      case "right": {
        const [pa, pb, pc] = it.points;
        const a = P(pa), b = P(pb), c = P(pc);
        if (!a || !b || !c) break;
        const u = unit({ x: a.x - b.x, y: a.y - b.y }), v = unit({ x: c.x - b.x, y: c.y - b.y });
        const k = 11;
        layers.marks += `<path d="M ${n(b.x + u.x * k)} ${n(b.y + u.y * k)} L ${n(b.x + (u.x + v.x) * k)} ${n(b.y + (u.y + v.y) * k)} L ${n(b.x + v.x * k)} ${n(b.y + v.y * k)}" fill="none" ${stroke("ink", 1.4)}/>`;
        break;
      }
      case "equal": {
        for (const [pa, pb] of it.segments) {
          const a = P(pa), b = P(pb);
          if (!a || !b) continue;
          const d = unit({ x: b.x - a.x, y: b.y - a.y });
          const nr = { x: -d.y, y: d.x };
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const count = it.marks ?? 1;
          for (let k = 0; k < count; k++) {
            const off = (k - (count - 1) / 2) * 4;
            const cx = mid.x + d.x * off, cy = mid.y + d.y * off;
            layers.marks += line(cx - nr.x * 5 - d.x * 2, cy - nr.y * 5 - d.y * 2, cx + nr.x * 5 + d.x * 2, cy + nr.y * 5 + d.y * 2, "accent", 1.6);
          }
        }
        break;
      }
      case "points":
        for (const name of it.names) { const p = P(name); if (p) layers.dots += dot(p.x, p.y, tone); }
        break;
      case "text": {
        const p = P(it.at);
        if (p) layers.labels += text(p.x + (it.dx ?? 0), p.y - (it.dy ?? 0), it.text, { tone });
        break;
      }
    }
  }

  // Cercles construits.
  for (const c of scene.circles) {
    if (!c.draw) continue;
    const p = P(c.center);
    if (p) layers.stroke = `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(c.r * s)}" fill="none" ${stroke("ink")}/>` + layers.stroke;
  }

  // Noms des points, écartés des traits qui y arrivent.
  const nb = neighbours(items);
  const hidden = new Set(fig.hideLabels ?? []);
  const circleCenters = new Set(scene.circles.map((c) => c.center));
  pts.forEach((raw, name) => {
    if (hidden.has(name)) return;
    const p = S(raw);
    let away = { x: 0, y: 0 };
    nb.get(name)?.forEach((other) => {
      const q = P(other);
      if (q) { const u = unit({ x: p.x - q.x, y: p.y - q.y }); away = { x: away.x + u.x, y: away.y + u.y }; }
    });
    if (Math.hypot(away.x, away.y) < 0.3) away = { x: p.x - center.x, y: p.y - center.y };
    if (Math.hypot(away.x, away.y) < 0.3) away = { x: 0.6, y: -1 };
    const u = unit(away);
    if (!vertices.has(name)) layers.dots += circleCenters.has(name)
      ? `<path d="M ${n(p.x - 4)} ${n(p.y - 4)} L ${n(p.x + 4)} ${n(p.y + 4)} M ${n(p.x - 4)} ${n(p.y + 4)} L ${n(p.x + 4)} ${n(p.y - 4)}" ${stroke("ink", 1.5)}/>`
      : dot(p.x, p.y);
    const rot = (v: Vec, a: number) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
    pending.push({ candidates: [0, 0.6, -0.6, 1.2, -1.2].map((a) => { const r = rot(u, a); return { x: p.x + r.x * 14, y: p.y + r.y * 14 }; }), text: name, tone: "ink", size: 14, weight: 700, priority: 1 });
  });

  // Placement : les noms de points d'abord, puis les longueurs, puis les angles ; chacun prend la première place libre.
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const boxOf = (c: Vec, t: string, size: number) => ({ x: c.x - (t.length * size * 0.58) / 2, y: c.y - size * 0.62, w: t.length * size * 0.58, h: size * 1.24 });
  const hits = (b: { x: number; y: number; w: number; h: number }) => boxes.some((o) => b.x < o.x + o.w + 2 && o.x < b.x + b.w + 2 && b.y < o.y + o.h + 1 && o.y < b.y + b.h + 1);
  for (const lab of pending.sort((a, b) => a.priority - b.priority)) {
    const inside = (c: Vec) => c.x > 6 && c.x < W - 6 && c.y > 8 && c.y < H - 8;
    const spot = lab.candidates.find((c) => inside(c) && !hits(boxOf(c, lab.text, lab.size))) ?? lab.candidates[0];
    boxes.push(boxOf(spot, lab.text, lab.size));
    layers.labels += text(spot.x, spot.y, lab.text, { tone: lab.tone, size: lab.size, weight: lab.weight });
  }

  // Repère écran publié pour les figures manipulables (conversion exacte pointeur → coordonnées).
  const frame = `data-ef-frame="${[minX, minY, s, offX, offY, H].map((v) => Math.round(v * 1000) / 1000).join(" ")}" `;
  const svg = open(W, H, alt).replace("<svg ", `<svg ${frame}`) + layers.grid + layers.fill + layers.stroke + layers.marks + layers.dots + layers.labels + close();
  return { svg, errors: scene.errors, scene };
}
