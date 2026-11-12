import type { GeoItem, GeoTransform, GeometryFig } from "@/lib/figures/types";

export type Vec = { x: number; y: number };

export interface GeoScene {
  points: Map<string, Vec & { free?: boolean }>;
  circles: { center: string; r: number; draw: boolean }[];
  /** Ce que les constructions dessinent d'elles-mêmes (le polygone d'un triangle, son angle droit…). */
  autoItems: GeoItem[];
  errors: string[];
}

const deg = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
export const dist = (a: Vec, b: Vec) => Math.hypot(b.x - a.x, b.y - a.y);
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });

/** Nombre écrit à la française : virgule, deux décimales au plus, sans zéros inutiles. */
export function fmtNum(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "?";
  const r = Math.round(n * 10 ** decimals) / 10 ** decimals;
  return String(Object.is(r, -0) ? 0 : r).replace(".", ",");
}

/** Mesure de l'angle (en degrés) au sommet `b` entre les demi-droites [ba) et [bc). */
export function angleAt(a: Vec, b: Vec, c: Vec): number {
  const u = sub(a, b), v = sub(c, b);
  const cos = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) || 1);
  return toDeg(Math.acos(Math.max(-1, Math.min(1, cos))));
}

function rotateAbout(p: Vec, c: Vec, d: number): Vec {
  const r = deg(d), cos = Math.cos(r), sin = Math.sin(r);
  const v = sub(p, c);
  return { x: c.x + v.x * cos - v.y * sin, y: c.y + v.x * sin + v.y * cos };
}

function reflectLine(p: Vec, a: Vec, b: Vec): Vec {
  const d = sub(b, a);
  const len2 = d.x * d.x + d.y * d.y || 1;
  const t = ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / len2;
  const foot = add(a, mul(d, t));
  return sub(mul(foot, 2), p);
}

/** Clé d'un côté, quel que soit l'ordre des lettres : « BA » et « AB » désignent le même côté. */
const sideKey = (p: string, q: string) => [p, q].sort().join("|");

function readLengths(names: string[], raw: Record<string, number> | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const [key, value] of Object.entries(raw || {})) {
    if (!(value > 0)) continue;
    // « AB », « A'B' », « [AB] » : on retrouve les deux sommets parmi les noms du polygone.
    const clean = key.replace(/[[\]()\s]/g, "");
    const found = names.filter((n) => clean.includes(n));
    let pair: [string, string] | null = null;
    for (let i = 0; i < names.length && !pair; i++) {
      for (let j = 0; j < names.length && !pair; j++) {
        if (i !== j && clean === names[i] + names[j]) pair = [names[i], names[j]];
      }
    }
    if (!pair && found.length === 2) pair = [found[0], found[1]];
    if (pair) out.set(sideKey(pair[0], pair[1]), value);
  }
  return out;
}

/**
 * Les trois côtés d'un triangle à partir de ses données. `null` + raison si les données ne suffisent pas ou se
 * contredisent. Indices : côté i = celui opposé au sommet i.
 */
export function solveTriangle(
  names: [string, string, string],
  lengths: Record<string, number> | undefined,
  angles: Record<string, number> | undefined,
  right: string | undefined,
): { sides: [number, number, number]; error?: string } | { sides: null; error: string } {
  const L = readLengths(names, lengths);
  const side: (number | undefined)[] = [0, 1, 2].map((i) => L.get(sideKey(names[(i + 1) % 3], names[(i + 2) % 3])));
  const ang: (number | undefined)[] = names.map((n) => {
    if (right === n) return 90;
    const a = angles?.[n];
    return a && a > 0 && a < 180 ? a : undefined;
  });
  const label = names.join("");
  const knownAngles = ang.filter((a) => a !== undefined) as number[];
  if (knownAngles.reduce((s, a) => s + a, 0) >= 180 - 1e-9 && knownAngles.length >= 2) {
    return { sides: null, error: `Le triangle ${label} est impossible : la somme de ses angles dépasse 180°.` };
  }
  // Deux angles connus → le troisième.
  if (knownAngles.length === 2) {
    const missing = ang.findIndex((a) => a === undefined);
    ang[missing] = 180 - knownAngles[0] - knownAngles[1];
  }
  for (let pass = 0; pass < 3; pass++) {
    const known = side.filter((s) => s !== undefined).length;
    if (known === 3) break;
    if (known === 2) {
      const m = side.findIndex((s) => s === undefined);
      const i = (m + 1) % 3, j = (m + 2) % 3;
      if (ang[m] !== undefined) {
        // Angle compris : loi des cosinus.
        side[m] = Math.sqrt(side[i]! ** 2 + side[j]! ** 2 - 2 * side[i]! * side[j]! * Math.cos(deg(ang[m]!)));
      } else if (ang[i] !== undefined) {
        // Angle opposé à un côté connu (cas ambigu : on retient la solution où l'angle restant est le plus grand).
        const sinJ = (side[j]! * Math.sin(deg(ang[i]!))) / side[i]!;
        if (sinJ > 1 + 1e-9) return { sides: null, error: `Le triangle ${label} est impossible avec ces mesures.` };
        const aj = toDeg(Math.asin(Math.min(1, sinJ)));
        ang[j] = aj;
        ang[m] = 180 - ang[i]! - aj;
        side[m] = (side[i]! * Math.sin(deg(ang[m]!))) / Math.sin(deg(ang[i]!));
      } else if (ang[j] !== undefined) {
        const sinI = (side[i]! * Math.sin(deg(ang[j]!))) / side[j]!;
        if (sinI > 1 + 1e-9) return { sides: null, error: `Le triangle ${label} est impossible avec ces mesures.` };
        const ai = toDeg(Math.asin(Math.min(1, sinI)));
        ang[i] = ai;
        ang[m] = 180 - ang[j]! - ai;
        side[m] = (side[j]! * Math.sin(deg(ang[m]!))) / Math.sin(deg(ang[j]!));
      } else {
        return { sides: null, error: `Il manque une donnée pour construire le triangle ${label} (un troisième côté ou un angle).` };
      }
    } else if (known === 1) {
      const k = side.findIndex((s) => s !== undefined);
      const allAngles = ang.every((a) => a !== undefined);
      if (!allAngles || ang[k] === undefined) return { sides: null, error: `Il manque des données pour construire le triangle ${label}.` };
      const ratio = side[k]! / Math.sin(deg(ang[k]!));
      for (let i = 0; i < 3; i++) if (side[i] === undefined) side[i] = ratio * Math.sin(deg(ang[i]!));
    } else {
      return { sides: null, error: `Il manque des longueurs pour construire le triangle ${label}.` };
    }
  }
  const [a, b, c] = side as [number, number, number];
  const sorted = [a, b, c].sort((x, y) => x - y);
  if (sorted[0] + sorted[1] <= sorted[2] + 1e-9) {
    return { sides: null, error: `Le triangle ${label} est impossible : ${fmtNum(sorted[0])} + ${fmtNum(sorted[1])} n'est pas plus grand que ${fmtNum(sorted[2])}.` };
  }
  // Données surabondantes : on vérifie qu'elles s'accordent (ex. 3 côtés + angle droit).
  if (right) {
    const r = names.indexOf(right);
    if (r >= 0) {
      const hyp = side[r]!, l1 = side[(r + 1) % 3]!, l2 = side[(r + 2) % 3]!;
      if (Math.abs(hyp * hyp - l1 * l1 - l2 * l2) > 1e-6 * Math.max(1, hyp * hyp)) {
        return { sides: [a, b, c], error: `Le triangle ${label} n'est pas rectangle en ${right} avec ces longueurs.` };
      }
    }
  }
  return { sides: [a, b, c] };
}

/** Place un triangle de côtés connus : le côté `base` à l'horizontale, le troisième sommet au-dessus. */
function placeTriangle(names: [string, string, string], sides: [number, number, number], base: [number, number]): Vec[] {
  const [i, j] = base;
  const k = 3 - i - j;
  const lenIJ = sides[k], lenIK = sides[j], lenJK = sides[i];
  const x = (lenIK * lenIK - lenJK * lenJK + lenIJ * lenIJ) / (2 * lenIJ);
  const y = Math.sqrt(Math.max(0, lenIK * lenIK - x * x));
  const pts: Vec[] = [];
  pts[i] = { x: 0, y: 0 };
  pts[j] = { x: lenIJ, y: 0 };
  pts[k] = { x, y };
  void names;
  return pts;
}

function centroid(pts: Vec[]): Vec {
  const s = pts.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
  return mul(s, 1 / (pts.length || 1));
}

/** Construit la scène : positions de tous les points, cercles et éléments dessinés automatiquement. */
export function buildGeometry(fig: Pick<GeometryFig, "steps">): GeoScene {
  const scene: GeoScene = { points: new Map(), circles: [], autoItems: [], errors: [] };
  const P = scene.points;
  const need = (name: string, where: string): Vec | null => {
    const p = P.get(name);
    if (!p) scene.errors.push(`Le point ${name} n'est pas défini avant « ${where} ».`);
    return p ?? null;
  };
  const put = (names: string[], pts: Vec[], rotate = 0, flip = false) => {
    let out = pts.map((p) => (flip ? { x: -p.x, y: p.y } : p));
    if (rotate) {
      const c = centroid(out);
      out = out.map((p) => rotateAbout(p, c, rotate));
    }
    // Une nouvelle forme se pose à droite de ce qui existe déjà (jamais par-dessus).
    if (P.size > 0) {
      const maxX = Math.max(...[...P.values()].map((p) => p.x));
      const minNewX = Math.min(...out.map((p) => p.x));
      const shift = maxX + 1.5 - minNewX;
      out = out.map((p) => ({ x: p.x + shift, y: p.y }));
    }
    names.forEach((n, i) => P.set(n, out[i]));
  };
  const polygon = (names: string[], draw?: boolean) => {
    if (draw !== false) scene.autoItems.push({ type: "polygon", points: names, fill: true });
  };

  for (const step of fig.steps) {
    switch (step.op) {
      case "point":
        P.set(step.name, { x: step.x, y: step.y, free: step.free });
        break;
      case "triangle": {
        const res = solveTriangle(step.names, step.lengths, step.angles, step.right);
        if (res.error) scene.errors.push(res.error);
        if (!res.sides) break;
        let base: [number, number];
        if (step.base) {
          const pair = step.names.map((n, i) => (step.base!.includes(n) ? i : -1)).filter((i) => i >= 0);
          base = pair.length === 2 ? [pair[0], pair[1]] : [0, 1];
          // Garde l'ordre des lettres écrit (« BC » : B à gauche).
          if (step.base.indexOf(step.names[base[0]]) > step.base.indexOf(step.names[base[1]])) base = [base[1], base[0]];
        } else if (step.right && step.names.includes(step.right)) {
          const r = step.names.indexOf(step.right);
          base = [r, (r + 1) % 3];
        } else {
          const longest = res.sides.indexOf(Math.max(...res.sides));
          base = [(longest + 1) % 3, (longest + 2) % 3];
        }
        put(step.names, placeTriangle(step.names, res.sides, base), step.rotate, step.flip);
        polygon(step.names, step.draw);
        if (step.right && step.names.includes(step.right) && step.draw !== false) {
          const r = step.names.indexOf(step.right);
          scene.autoItems.push({ type: "right", points: [step.names[(r + 1) % 3], step.right, step.names[(r + 2) % 3]] });
        }
        break;
      }
      case "rectangle":
      case "square": {
        const w = step.op === "square" ? step.side : step.width;
        const h = step.op === "square" ? step.side : step.height;
        put(step.names, [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], step.rotate);
        polygon(step.names, step.draw);
        break;
      }
      case "parallelogram":
      case "rhombus": {
        const b = step.op === "rhombus" ? step.side : step.base;
        const d = { x: step.side * Math.cos(deg(step.angle)), y: step.side * Math.sin(deg(step.angle)) };
        put(step.names, [{ x: 0, y: 0 }, { x: b, y: 0 }, add({ x: b, y: 0 }, d), d], step.rotate);
        polygon(step.names, step.draw);
        break;
      }
      case "trapezoid": {
        const off = step.offset ?? (step.base - step.top) / 2;
        put(step.names, [{ x: 0, y: 0 }, { x: step.base, y: 0 }, { x: off + step.top, y: step.height }, { x: off, y: step.height }], step.rotate);
        polygon(step.names, step.draw);
        break;
      }
      case "regular": {
        const n = step.names.length;
        if (n < 3) { scene.errors.push("Un polygone régulier a au moins 3 sommets."); break; }
        const R = step.side / (2 * Math.sin(Math.PI / n));
        const start = -90 - 180 / n;
        put(step.names, step.names.map((_, i) => ({ x: R * Math.cos(deg(start + (360 * i) / n)), y: R * Math.sin(deg(start + (360 * i) / n)) })), step.rotate);
        polygon(step.names, step.draw);
        break;
      }
      case "circle": {
        if (!P.has(step.center)) P.set(step.center, { x: step.x ?? 0, y: step.y ?? 0 });
        if (step.radius > 0) scene.circles.push({ center: step.center, r: step.radius, draw: step.draw !== false });
        else scene.errors.push(`Le cercle de centre ${step.center} doit avoir un rayon positif.`);
        break;
      }
      case "onCircle": {
        const c = need(step.center, `point ${step.name}`);
        if (c) P.set(step.name, { x: c.x + step.radius * Math.cos(deg(step.angle)), y: c.y + step.radius * Math.sin(deg(step.angle)) });
        break;
      }
      case "onSegment": {
        const a = need(step.from, `point ${step.name}`), b = need(step.to, `point ${step.name}`);
        if (!a || !b) break;
        const t = step.t ?? (step.distance !== undefined ? step.distance / (dist(a, b) || 1) : 0.5);
        P.set(step.name, add(a, mul(sub(b, a), t)));
        break;
      }
      case "midpoint": {
        const a = need(step.of[0], `milieu ${step.name}`), b = need(step.of[1], `milieu ${step.name}`);
        if (a && b) P.set(step.name, mul(add(a, b), 0.5));
        break;
      }
      case "foot": {
        const p = need(step.from, `pied ${step.name}`), a = need(step.line[0], `pied ${step.name}`), b = need(step.line[1], `pied ${step.name}`);
        if (p && a && b) P.set(step.name, mul(add(reflectLine(p, a, b), p), 0.5));
        break;
      }
      case "intersection": {
        const [[p1, p2], [p3, p4]] = step.lines;
        const a = need(p1, step.name), b = need(p2, step.name), c = need(p3, step.name), d = need(p4, step.name);
        if (!a || !b || !c || !d) break;
        const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
        if (Math.abs(den) < 1e-12) { scene.errors.push(`Les droites (${p1}${p2}) et (${p3}${p4}) sont parallèles.`); break; }
        const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
        P.set(step.name, add(a, mul(sub(b, a), t)));
        break;
      }
      case "thales": {
        const [A, B, C, M, N] = step.names;
        const lengths: Record<string, number> = { [A + B]: step.AB, [A + C]: step.AC };
        if (step.BC) lengths[B + C] = step.BC;
        const res = solveTriangle([A, B, C], lengths, step.BC ? undefined : { [A]: 50 }, undefined);
        if (res.error) scene.errors.push(res.error);
        if (!res.sides) break;
        if (!(step.AM > 0)) { scene.errors.push(`La longueur ${A}${M} doit être positive.`); break; }
        if (!step.butterfly && step.AM >= step.AB) scene.errors.push(`${M} doit être sur le segment [${A}${B}] : ${A}${M} < ${A}${B}.`);
        const tri = placeTriangle([A, B, C], res.sides, [1, 2]);
        const k = (step.butterfly ? -1 : 1) * (step.AM / step.AB);
        const m = add(tri[0], mul(sub(tri[1], tri[0]), k));
        const n = add(tri[0], mul(sub(tri[2], tri[0]), k));
        put([A, B, C, M, N], [tri[0], tri[1], tri[2], m, n], step.rotate);
        if (step.draw !== false) {
          if (step.butterfly) {
            scene.autoItems.push(
              { type: "segment", from: B, to: C }, { type: "segment", from: M, to: N },
              { type: "segment", from: B, to: M }, { type: "segment", from: C, to: N },
            );
          } else {
            scene.autoItems.push({ type: "polygon", points: [A, B, C], fill: true }, { type: "segment", from: M, to: N });
          }
        }
        break;
      }
      case "image": {
        const t: GeoTransform = step.transform;
        const sources = Object.keys(step.map);
        for (const src of sources) {
          const p = need(src, `image de ${src}`);
          if (!p) continue;
          let q: Vec | null = null;
          if (t.type === "symmetryPoint") { const c = need(t.center, "symétrie"); if (c) q = sub(mul(c, 2), p); }
          else if (t.type === "symmetryLine") { const a = need(t.line[0], "symétrie"), b = need(t.line[1], "symétrie"); if (a && b) q = reflectLine(p, a, b); }
          else if (t.type === "rotation") { const c = need(t.center, "rotation"); if (c) q = rotateAbout(p, c, t.angle); }
          else if (t.type === "translation") { const a = need(t.from, "translation"), b = need(t.to, "translation"); if (a && b) q = add(p, sub(b, a)); }
          else if (t.type === "homothety") { const c = need(t.center, "homothétie"); if (c) q = add(c, mul(sub(p, c), t.k)); }
          if (q) P.set(step.map[src], q);
        }
        if (step.polygon !== false && sources.length >= 3) {
          scene.autoItems.push({ type: "polygon", points: sources.map((s) => step.map[s]), fill: true, tone: "accent" });
        }
        break;
      }
    }
  }
  return scene;
}
