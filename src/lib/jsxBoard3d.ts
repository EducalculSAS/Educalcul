/**
 * Figures dans l'espace (mode « 3d » du système unique de figures) : solides, points, segments, plans, surfaces,
 * courbes. L'élève fait tourner la figure à la souris ou au doigt. Même style Educalcul que les figures plates.
 */
import type { JsxElement, JsxFigureSpec } from "@/lib/jsxFigure";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const TONES: Record<string, string> = { navy: "#10213d", blue: "#2563eb", green: "#15803d", red: "#dc2626", gold: "#c89f36", gray: "#64748b" };
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const vec = (v: unknown, d: [number, number, number] = [0, 0, 0]): [number, number, number] =>
  Array.isArray(v) && v.length >= 2 ? [num(v[0], 0), num(v[1], 0), num(v[2], 0)] : d;

/** Sommets et faces d'un solide à faces planes, centré en `at`. */
function polyhedron(e: JsxElement): { vertices: number[][]; faces: number[][] } | null {
  const [cx, cy, cz] = vec(e.at);
  const a = num(e.a, 2), b = num(e.b, a), c = num(e.c, a);
  const shape = String(e.shape ?? "cube");
  const move = (v: number[]) => [v[0] + cx, v[1] + cy, v[2] + cz];
  if (shape === "cube" || shape === "box") {
    const [x, y, z] = shape === "cube" ? [a / 2, a / 2, a / 2] : [a / 2, b / 2, c / 2];
    return {
      vertices: [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]].map(move),
      faces: [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]],
    };
  }
  if (shape === "pyramid") {
    const h = num(e.h, a);
    const x = a / 2, y = b / 2;
    return {
      vertices: [[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [0, 0, h]].map(move),
      faces: [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
    };
  }
  if (shape === "tetra") {
    const s = a;
    return {
      vertices: [[0, 0, 0], [s, 0, 0], [s / 2, (s * Math.sqrt(3)) / 2, 0], [s / 2, (s * Math.sqrt(3)) / 6, (s * Math.sqrt(6)) / 3]].map((v) => move([v[0] - s / 2, v[1] - s / 3, v[2]])),
      faces: [[0, 1, 2], [0, 1, 3], [1, 2, 3], [2, 0, 3]],
    };
  }
  if (shape === "prism") {
    // Prisme droit à base triangulaire (a = côté de la base, c = hauteur).
    const h = num(e.h, c);
    const r = a / Math.sqrt(3);
    const base = [0, 1, 2].map((i) => [r * Math.cos((Math.PI * 2 * i) / 3 + Math.PI / 2), r * Math.sin((Math.PI * 2 * i) / 3 + Math.PI / 2)]);
    return {
      vertices: [...base.map((p) => [p[0], p[1], 0]), ...base.map((p) => [p[0], p[1], h])].map(move),
      faces: [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]],
    };
  }
  return null;
}

export function buildBoard3d(JXG: Any, math: Any, container: HTMLElement, spec: JsxFigureSpec, id: string, width: number): { board: Any; destroy: () => void } {
  const height = spec.height > 0 ? Math.max(spec.height, Math.min(520, width)) : width;
  container.style.width = "100%";
  container.style.minHeight = "0";
  container.style.height = `${Math.min(520, Math.max(240, Math.round(height)))}px`;

  const board: Any = JXG.JSXGraph.initBoard(id, {
    boundingbox: [-8, 8, 8, -8],
    axis: false,
    grid: false,
    showCopyright: false,
    showNavigation: false,
    // La taille suit la carte : c'est nous qui la gérons (voir le ResizeObserver), pas la bibliothèque.
    resize: { enabled: false },
    keepAspectRatio: true,
    pan: { enabled: false },
    zoom: { enabled: false },
  });
  const [x0, x1, y0, y1, z0, z1] = spec.box3d ?? [-3, 3, -3, 3, -3, 3];
  const hidden = { slider: { visible: false } };
  const view: Any = board.create("view3d", [[-5, -5], [10, 10], [[x0, x1], [y0, y1], [z0, z1]]], {
    projection: "parallel",
    trackball: { enabled: true },
    axesPosition: spec.axes ? "center" : "none",
    depthOrder: { enabled: true },
    xPlaneRear: { visible: spec.grid, fillOpacity: 0.04, strokeColor: "rgba(15,30,58,0.15)" },
    yPlaneRear: { visible: spec.grid, fillOpacity: 0.04, strokeColor: "rgba(15,30,58,0.15)" },
    zPlaneRear: { visible: spec.grid, fillOpacity: 0.06, strokeColor: "rgba(15,30,58,0.15)" },
    xPlaneFront: { visible: false },
    yPlaneFront: { visible: false },
    zPlaneFront: { visible: false },
    az: hidden,
    el: hidden,
    bank: hidden,
  });

  const compile = (expr: string) => {
    const code = math.compile(expr.replace(/\bln\(/g, "log(").replace(/²/g, "^2").replace(/³/g, "^3"));
    return (vars: Record<string, number>) => {
      try {
        const v = code.evaluate(vars);
        return typeof v === "number" ? v : Number.NaN;
      } catch {
        return Number.NaN;
      }
    };
  };

  // Sphère : disque translucide + trois grands cercles (équateur et deux méridiens), sans point central affiché.
  const sphere = (c: [number, number, number], r: number, color = TONES.navy) => {
    view.create("sphere3d", [c, r], { fillColor: color, fillOpacity: 0.08, strokeColor: color, strokeWidth: 1.5, highlight: false, center: { visible: false, withLabel: false }, point: { visible: false } });
    const ring = (fx: (t: number) => number, fy: (t: number) => number, fz: (t: number) => number) => view.create("curve3d", [fx, fy, fz, [0, Math.PI * 2]], { strokeColor: color, strokeWidth: 1.2, highlight: false });
    ring((t) => c[0] + r * Math.cos(t), (t) => c[1] + r * Math.sin(t), () => c[2]);
    ring((t) => c[0] + r * Math.cos(t), () => c[1], (t) => c[2] + r * Math.sin(t));
    ring(() => c[0], (t) => c[1] + r * Math.cos(t), (t) => c[2] + r * Math.sin(t));
  };

  for (const e of spec.elements) {
    const color = TONES[String(e.color)] ?? TONES.navy;
    const line = { strokeColor: color, strokeWidth: typeof e.width === "number" ? e.width : 2, dash: e.dash ? 2 : 0, highlight: false };
    try {
      switch (e.kind) {
        case "solid3d": {
          const poly = polyhedron(e);
          const shape = String(e.shape ?? "cube");
          const [cx, cy, cz] = vec(e.at);
          if (poly) {
            view.create("polyhedron3d", [poly.vertices, poly.faces], {
              fillColor: color,
              fillOpacity: num(e.opacity, 0.14),
              strokeColor: color,
              strokeWidth: 2,
              highlight: false,
              vertices: { visible: false },
              layer: 6,
            });
          } else if (shape === "cylinder" || shape === "cone") {
            const r = num(e.r, 1.5), h = num(e.h, 3);
            const ring = (z: number) =>
              view.create("curve3d", [(t: number) => cx + r * Math.cos(t), (t: number) => cy + r * Math.sin(t), () => cz + z, [0, Math.PI * 2]], { ...line, strokeWidth: 2 });
            ring(0);
            if (shape === "cylinder") {
              ring(h);
              for (const ang of [0, Math.PI]) {
                view.create("line3d", [[cx + r * Math.cos(ang), cy + r * Math.sin(ang), cz], [cx + r * Math.cos(ang), cy + r * Math.sin(ang), cz + h]], { ...line, straightFirst: false, straightLast: false });
              }
            } else {
              for (const ang of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
                view.create("line3d", [[cx + r * Math.cos(ang), cy + r * Math.sin(ang), cz], [cx, cy, cz + h]], { ...line, straightFirst: false, straightLast: false, dash: ang > 0 && ang < Math.PI ? 0 : 0 });
              }
            }
          } else if (shape === "sphere") {
            sphere([cx, cy, cz], num(e.r, 2), color);
          }
          break;
        }
        case "point3d": {
          const [px, py, pz] = [num(e.x, 0), num(e.y, 0), num(e.z, 0)];
          view.create("point3d", [px, py, pz], { size: 3.5, fillColor: color, strokeColor: "#ffffff", withLabel: false, fixed: true, highlight: false });
          break;
        }
        case "segment3d":
          view.create("line3d", [vec(e.from), vec(e.to)], { ...line, straightFirst: false, straightLast: false });
          break;
        case "polygon3d": {
          const pts = (Array.isArray(e.points) ? e.points : []).map((p) => vec(p));
          if (pts.length >= 3) view.create("polygon3d", pts, { fillColor: color, fillOpacity: num(e.opacity, 0.2), borders: line, highlight: false, vertices: { visible: false } });
          break;
        }
        case "plane3d": {
          const r: [number, number] = Array.isArray(e.range) && e.range.length === 2 ? [num(e.range[0], -2), num(e.range[1], 2)] : [-2, 2];
          view.create("plane3d", [vec(e.point), vec(e.dir1, [1, 0, 0]), vec(e.dir2, [0, 1, 0]), r, r], { fillColor: color, fillOpacity: num(e.opacity, 0.15), strokeColor: color, highlight: false, mesh3d: { visible: false } });
          break;
        }
        case "sphere3d":
          sphere(vec(e.center), num(e.radius, 2), color);
          break;
        case "surface3d": {
          const f = compile(String(e.expr ?? "x^2+y^2"));
          const xr = Array.isArray(e.xRange) ? (e.xRange as number[]) : [x0, x1];
          const yr = Array.isArray(e.yRange) ? (e.yRange as number[]) : [y0, y1];
          view.create("functiongraph3d", [(x: number, y: number) => f({ x, y }), xr, yr], { strokeColor: color, strokeWidth: 1, fillColor: color, fillOpacity: 0.25, stepsU: 16, stepsV: 16, highlight: false });
          break;
        }
        case "curve3d": {
          const fx = compile(String(e.x ?? "cos(t)"));
          const fy = compile(String(e.y ?? "sin(t)"));
          const fz = compile(String(e.z ?? "t/3"));
          const t = Array.isArray(e.t) && e.t.length === 2 ? (e.t as number[]) : [0, 6.2832];
          view.create("curve3d", [(tt: number) => fx({ t: tt }), (tt: number) => fy({ t: tt }), (tt: number) => fz({ t: tt }), t], { ...line, strokeWidth: 3 });
          break;
        }
        case "text": {
          view.create("text3d", [num(e.x, 0), num(e.y, 0), num(e.z, 0), String(e.text ?? "")], { fontSize: num(e.size, 14), strokeColor: color, anchorX: "middle", anchorY: "middle", fixed: true });
          break;
        }
      }
    } catch (error) {
      console.warn(`[jsx_figure 3d] élément « ${e.kind} » ignoré :`, error instanceof Error ? error.message : error);
    }
  }
  board.update();

  return {
    board,
    destroy: () => {
      try {
        JXG.JSXGraph.freeBoard(board);
      } catch {
        /* déjà libéré */
      }
      container.innerHTML = "";
    },
  };
}
