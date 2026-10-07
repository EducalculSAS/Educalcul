import { expandMacros } from "@/lib/jsxMacros";

/**
 * « Figure libre » : n'importe quelle figure de maths (géométrie, constructions, courbes, tangentes, aires, vecteurs, champs,
 * transformations...) décrite par un petit JSON que l'admin crée et modifie sans coder, dessinée par JSXGraph
 * (bibliothèque libre MIT / LGPL, utilisable commercialement) dans le style Educalcul (papier quadrillé, bleu nuit, dorures).
 *
 * Le JSON ne contient AUCUN code : les formules passent par mathjs, les références entre éléments par leur `id`. Une porte
 * de sortie `raw` donne accès à tout type d'objet JSXGraph (coniques, lieux, transformations...) sans rien écrire en code.
 * Toute étiquette « {{n}} » devient un emplacement de réponse (même mécanisme que les autres figures, voir SlotHtml).
 */

export type JsxKind =
  | "point" | "segment" | "line" | "ray" | "vector" | "circle" | "arc" | "sector" | "polygon" | "angle"
  | "midpoint" | "perpendicular" | "parallel" | "bisector" | "perpendicular_bisector" | "intersection"
  | "function" | "parametric" | "tangent" | "integral" | "riemann" | "inequality" | "vectorfield" | "implicit"
  | "text" | "slider" | "toggle" | "reflect" | "rotate" | "translate" | "dilate" | "raw"
  // primitives à coordonnées (utilisées aussi par les figures toutes faites)
  | "rect" | "shape" | "seg"
  // figures toutes faites (développées en primitives par jsxMacros)
  | "bar_chart" | "histogram" | "pie_chart" | "number_line" | "box_plot" | "scatter" | "venn" | "prob_tree"
  | "regular_polygon" | "fraction_bar" | "fraction_disc" | "grid_paint" | "grid_cells" | "pyramid"
  // espace (3D)
  | "solid3d" | "point3d" | "segment3d" | "polygon3d" | "plane3d" | "sphere3d" | "surface3d" | "curve3d";

export interface JsxElement {
  kind: JsxKind;
  /** Nom de référence (A, B, f, s...) : les autres éléments et les formules s'y réfèrent. */
  id?: string;
  /** Étiquette affichée (peut valoir « {{1}} » pour un emplacement de réponse). */
  label?: string;
  /** Couleur : navy | blue | green | red | gold | gray. */
  color?: string;
  dash?: boolean;
  /** Épaisseur du trait. */
  width?: number;
  /** Afficher le nom de cet élément même si les noms sont masqués. */
  showLabel?: boolean;
  /** Point : déplaçable à la souris (défaut : fixe). */
  movable?: boolean;
  /** Élément auxiliaire non dessiné (sert de support à d'autres). */
  hidden?: boolean;
  [field: string]: unknown;
}

export interface JsxFigureSpec {
  type: "jsx_figure";
  caption: string;
  /** [xmin, ymax, xmax, ymin] */
  boundingBox: [number, number, number, number];
  axes: boolean;
  grid: boolean;
  keepAspect: boolean;
  /** Afficher le nom des points (A, B, C...) dans la figure : non par défaut, les noms vont dans l'énoncé. */
  showNames: boolean;
  /** « 3d » : figure dans l'espace (cubes, solides, surfaces), que l'élève fait tourner à la souris. */
  mode?: "2d" | "3d";
  /** Espace 3D : [xmin, xmax, ymin, ymax, zmin, zmax]. */
  box3d?: [number, number, number, number, number, number];
  /** Hauteur en pixels (180 à 520), ignorée si keepAspect donne le rapport. */
  height: number;
  elements: JsxElement[];
}

const KINDS: readonly JsxKind[] = [
  "point", "segment", "line", "ray", "vector", "circle", "arc", "sector", "polygon", "angle",
  "midpoint", "perpendicular", "parallel", "bisector", "perpendicular_bisector", "intersection",
  "function", "parametric", "tangent", "integral", "riemann", "inequality", "vectorfield", "implicit",
  "text", "slider", "toggle", "reflect", "rotate", "translate", "dilate", "raw",
  "rect", "shape", "seg",
  "bar_chart", "histogram", "pie_chart", "number_line", "box_plot", "scatter", "venn", "prob_tree",
  "regular_polygon", "fraction_bar", "fraction_disc", "grid_paint", "grid_cells", "pyramid",
  "solid3d", "point3d", "segment3d", "polygon3d", "plane3d", "sphere3d", "surface3d", "curve3d",
];

export const JSX_TONES: Record<string, string> = {
  navy: "#10213d",
  blue: "#2563eb",
  green: "#15803d",
  red: "#dc2626",
  gold: "#c89f36",
  gray: "#64748b",
};

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Valide et nettoie un JSON de figure libre ; renvoie null s'il est inutilisable. */
export function normalizeJsxSpec(raw: unknown): JsxFigureSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const bb = Array.isArray(r.boundingBox) && r.boundingBox.length === 4 && r.boundingBox.every((n) => typeof n === "number" && Number.isFinite(n))
    ? (r.boundingBox as [number, number, number, number])
    : ([-6, 5, 6, -5] as [number, number, number, number]);
  if (bb[2] <= bb[0] || bb[1] <= bb[3]) return null;
  const elements = (Array.isArray(r.elements) ? r.elements : [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object" && KINDS.includes((e as { kind?: JsxKind }).kind as JsxKind))
    .slice(0, 200)
    .map((e) => JSON.parse(JSON.stringify(e)) as JsxElement);
  return {
    type: "jsx_figure",
    caption: typeof r.caption === "string" ? r.caption.slice(0, 200) : "",
    boundingBox: bb,
    axes: r.axes !== false,
    grid: r.grid !== false,
    keepAspect: r.keepAspect !== false,
    showNames: r.showNames === true,
    mode: r.mode === "3d" ? "3d" : "2d",
    box3d: Array.isArray(r.box3d) && r.box3d.length === 6 && r.box3d.every((v) => typeof v === "number" && Number.isFinite(v)) ? (r.box3d as JsxFigureSpec["box3d"]) : [-3, 3, -3, 3, -3, 3],
    height: Math.min(520, Math.max(180, num(r.height, 300))),
    elements,
  };
}

export const encodeJsxSpec = (spec: JsxFigureSpec): string => encodeURIComponent(JSON.stringify(spec));

export function decodeJsxSpec(attr: string | null | undefined): JsxFigureSpec | null {
  if (!attr) return null;
  try {
    return normalizeJsxSpec(JSON.parse(decodeURIComponent(attr)));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Construction du tableau JSXGraph                                    */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export interface JsxBoardHandle {
  board: Any;
  /** Positions actuelles des points déplaçables (pour les ré-enregistrer dans le JSON). */
  readPoints: () => Record<string, [number, number]>;
  destroy: () => void;
}

const SLOT_MARK = /^\{\{(\d+)\}\}$/;

export async function buildJsxBoard(
  container: HTMLElement,
  spec: JsxFigureSpec,
  options: { editable?: boolean } = {},
): Promise<JsxBoardHandle> {
  const [{ default: JXG }, math] = await Promise.all([import("jsxgraph") as Promise<Any>, import("mathjs")]);
  let boundingBox: [number, number, number, number] = [...spec.boundingBox];
  const [xmin, ymax, xmax, ymin] = boundingBox;

  // Taille : la largeur du conteneur ; la hauteur suit le rapport du repère (repère orthonormé) ou `height`.
  const width = Math.max(220, container.clientWidth || 360);
  let ratio = (ymax - ymin) / (xmax - xmin);
  const heightFor = (w: number) => (spec.keepAspect ? Math.min(560, Math.max(180, Math.round(w * ratio))) : spec.height);
  const height = heightFor(width);
  container.style.width = "100%";
  container.style.minHeight = "0";
  container.style.height = `${height}px`;
  const id = `jsxb-${Math.random().toString(36).slice(2)}`;
  container.id = id;

  if (spec.mode === "3d") {
    const { buildBoard3d } = await import("@/lib/jsxBoard3d");
    const three = buildBoard3d(JXG, math, container, spec, id, width);
    return { board: three.board, readPoints: () => ({}), destroy: three.destroy };
  }

  const board: Any = JXG.JSXGraph.initBoard(id, {
    boundingbox: boundingBox,
    axis: false,
    grid: false,
    showCopyright: false,
    showNavigation: false,
    // La taille suit la carte : c'est nous qui la gérons (voir le ResizeObserver), pas la bibliothèque.
    resize: { enabled: false },
    keepAspectRatio: spec.keepAspect,
    pan: { enabled: false },
    zoom: { enabled: false },
    drag: { enabled: true },
  });

  if (spec.grid) {
    board.create("grid", [], { majorStep: 1, minorElements: 0, strokeColor: "rgba(15,30,58,0.10)", strokeWidth: 1, highlight: false });
  }
  if (spec.axes) {
    const axisStyle = { strokeColor: JSX_TONES.navy, strokeWidth: 1.4, highlight: false, ticks: { strokeColor: JSX_TONES.navy, majorHeight: 8, minorTicks: 0, drawZero: false, strokeWidth: 1.2, label: { fontSize: 11, color: JSX_TONES.navy } } };
    board.create("axis", [[0, 0], [1, 0]], axisStyle);
    board.create("axis", [[0, 0], [0, 1]], axisStyle);
  }

  const byId = new Map<string, Any>();
  const hiddenObjects = new Set<Any>();
  const sliders = new Map<string, Any>();
  // Mesures utilisables dans les formules et les textes « {dist(A,B)} » : elles suivent les points quand on les déplace.
  const measures: Record<string, (...a: Any[]) => number> = {
    dist: (a, b) => Math.hypot(a.X() - b.X(), a.Y() - b.Y()),
    px: (a) => a.X(),
    py: (a) => a.Y(),
    slope: (a, b) => (b.Y() - a.Y()) / (b.X() - a.X()),
    angle: (a, o, b) => {
      const d = Math.atan2(b.Y() - o.Y(), b.X() - o.X()) - Math.atan2(a.Y() - o.Y(), a.X() - o.X());
      return Math.abs((((d * 180) / Math.PI) % 360 + 540) % 360 - 180);
    },
    area: (...pts) => {
      let sum = 0;
      pts.forEach((p, i) => {
        const q = pts[(i + 1) % pts.length];
        sum += p.X() * q.Y() - q.X() * p.Y();
      });
      return Math.abs(sum) / 2;
    },
  };
  const scope = () => {
    const s: Record<string, unknown> = { ...measures };
    byId.forEach((obj, key) => {
      if (obj?.elementClass === JXG.OBJECT_CLASS_POINT) s[key] = obj;
    });
    sliders.forEach((sl, key) => (s[key] = sl.Value()));
    return s;
  };

  const compile = (expr: string) => {
    const code = math.compile(expr.replace(/\bln\(/g, "log(").replace(/²/g, "^2").replace(/³/g, "^3"));
    return (vars: Record<string, number>) => {
      try {
        const v = code.evaluate({ ...scope(), ...vars });
        return typeof v === "number" ? v : Number.NaN;
      } catch {
        return Number.NaN;
      }
    };
  };
  /** Nombre fixe ou formule vivante (qui suit les curseurs). */
  const val = (v: unknown, fallback = 0): number | (() => number) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const f = compile(v);
      return () => f({});
    }
    return fallback;
  };
  const ref = (key: unknown): Any => (typeof key === "string" ? byId.get(key) : undefined);
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

  const colorOf = (e: JsxElement, fallback: string) => JSX_TONES[String(e.color)] ?? fallback;
  const lineAttrs = (e: JsxElement, fallback = "navy") => ({
    strokeColor: colorOf(e, JSX_TONES[fallback]),
    strokeWidth: num(e.width, 1.75),
    dash: e.dash ? 2 : 0,
    highlight: false,
    fixed: true,
    visible: !e.hidden,
    withLabel: false,
  });

  const names = spec.showNames === true;
  const showsName = (e: JsxElement) => !!e.label && (names || e.showLabel === true);

  const slotMarks: { n: number; x: number; y: number; w?: number; h?: number }[] = [];
  const elements = expandMacros(spec.elements);
  const movable: { key: string; el: Any }[] = [];

  for (const e of elements) {
    let created: Any = null;
    try {
      switch (e.kind) {
        case "point": {
          const isMovable = (e.movable === true || options.editable === true) && typeof e.x === "number" && typeof e.y === "number" && !e.hidden;
          const label = typeof e.label === "string" ? e.label : "";
          const slot = SLOT_MARK.exec(label);
          if (slot) slotMarks.push({ n: Number(slot[1]), x: num(e.x, 0), y: num(e.y, 0) });
          created = board.create("point", [val(e.x), val(e.y)], {
            name: slot ? "" : label,
            withLabel: showsName(e) && !slot,
            size: num(e.width, 3),
            strokeColor: "#ffffff",
            fillColor: colorOf(e, JSX_TONES.navy),
            highlightFillColor: colorOf(e, JSX_TONES.navy),
            highlightStrokeColor: "#ffffff",
            fixed: !isMovable,
            snapToGrid: options.editable === true,
            snapSizeX: 0.5,
            snapSizeY: 0.5,
            visible: !e.hidden,
            showInfobox: false,
            label: { fontSize: 14, color: JSX_TONES.navy, offset: [8, 8], highlight: false },
          });
          if (isMovable && e.id) movable.push({ key: e.id, el: created });
          break;
        }
        case "segment":
          created = board.create("segment", [ref(e.from), ref(e.to)], lineAttrs(e));
          break;
        case "line":
          created = board.create("line", [ref(arr(e.through)[0]), ref(arr(e.through)[1])], lineAttrs(e));
          break;
        case "ray":
          created = board.create("line", [ref(e.from), ref(e.to)], { ...lineAttrs(e), straightFirst: false });
          break;
        case "vector":
          created = board.create("arrow", [ref(e.from), ref(e.to)], { ...lineAttrs(e, "blue"), lastArrow: { type: 2, size: 7 } });
          break;
        case "circle": {
          let center = ref(e.center);
          if (!center && typeof e.x === "number" && typeof e.y === "number") {
            center = board.create("point", [e.x, e.y], { visible: false, fixed: true, withLabel: false });
          }
          const through = ref(e.through);
          const opacity = e.filled === false ? 0 : num(e.opacity, e.whiteFill ? 1 : 0.1);
          created = board.create("circle", [center, through ?? val(e.radius, 1)], {
            ...lineAttrs(e),
            fillColor: e.whiteFill ? "#ffffff" : colorOf(e, JSX_TONES.navy),
            fillOpacity: opacity,
            highlightFillOpacity: opacity,
          });
          break;
        }
        case "arc":
          created = board.create("arc", [ref(e.center), ref(e.from), ref(e.to)], lineAttrs(e));
          break;
        case "sector":
          created = board.create("sector", [ref(e.center), ref(e.from), ref(e.to)], { ...lineAttrs(e), fillColor: colorOf(e, JSX_TONES.navy), fillOpacity: 0.14 });
          break;
        case "polygon": {
          const verts = arr(e.vertices).map(ref).filter(Boolean);
          created = board.create("polygon", verts, {
            fillColor: colorOf(e, JSX_TONES.navy),
            fillOpacity: e.filled === false ? 0 : 0.14,
            highlightFillOpacity: e.filled === false ? 0 : 0.14,
            borders: { strokeColor: colorOf(e, JSX_TONES.navy), strokeWidth: num(e.width, 1.75), highlight: false, dash: e.dash ? 2 : 0 },
            vertices: { visible: false },
            highlight: false,
            fixed: true,
            withLabel: false,
            visible: !e.hidden,
          });
          break;
        }
        case "angle": {
          const pts = arr(e.points).map(ref);
          const label = typeof e.label === "string" ? e.label : "";
          const slot = SLOT_MARK.exec(label);
          if (slot) {
            const b = pts[1];
            if (b) slotMarks.push({ n: Number(slot[1]), x: b.X() + 0.9, y: b.Y() + 0.5 });
          }
          created = board.create("angle", pts, {
            radius: num(e.radius, 0.8),
            name: slot ? "" : label,
            withLabel: !!label && !slot,
            fillColor: colorOf(e, JSX_TONES.gold),
            fillOpacity: 0.3,
            strokeColor: colorOf(e, JSX_TONES.gold),
            strokeWidth: 1.4,
            highlight: false,
            label: { fontSize: 13, color: JSX_TONES.navy },
          });
          break;
        }
        case "midpoint":
          created = board.create("midpoint", [ref(arr(e.of)[0]), ref(arr(e.of)[1])], { size: 2.5, strokeColor: "#ffffff", fillColor: colorOf(e, JSX_TONES.navy), name: typeof e.label === "string" ? e.label : "", withLabel: showsName(e), fixed: true, visible: !e.hidden, showInfobox: false });
          break;
        case "perpendicular":
          created = board.create("perpendicular", [ref(e.line), ref(e.through)], lineAttrs(e, "gold"));
          break;
        case "parallel":
          created = board.create("parallel", [ref(e.line), ref(e.through)], lineAttrs(e, "gold"));
          break;
        case "bisector": {
          const p = arr(e.points).map(ref);
          created = board.create("bisector", p, lineAttrs(e, "gold"));
          break;
        }
        case "perpendicular_bisector": {
          const a = ref(arr(e.of)[0]);
          const b = ref(arr(e.of)[1]);
          const seg = board.create("segment", [a, b], { visible: false, fixed: true });
          const mid = board.create("midpoint", [a, b], { visible: false });
          created = board.create("perpendicular", [seg, mid], lineAttrs(e, "gold"));
          break;
        }
        case "intersection":
          created = board.create("intersection", [ref(arr(e.of)[0]), ref(arr(e.of)[1]), num(e.index, 0)], { size: 3, strokeColor: "#ffffff", fillColor: colorOf(e, JSX_TONES.red), name: typeof e.label === "string" ? e.label : "", withLabel: showsName(e), fixed: true, visible: !e.hidden, showInfobox: false });
          break;
        case "function": {
          const f = compile(String(e.expr ?? "x"));
          const dom = Array.isArray(e.domain) && e.domain.length === 2 ? (e.domain as number[]) : [xmin, xmax];
          created = board.create("functiongraph", [(x: number) => f({ x }), dom[0], dom[1]], { ...lineAttrs(e, "blue"), strokeWidth: num(e.width, 2.2) });
          break;
        }
        case "parametric": {
          const fx = compile(String(e.x ?? "cos(t)"));
          const fy = compile(String(e.y ?? "sin(t)"));
          const t = Array.isArray(e.t) && e.t.length === 2 ? (e.t as number[]) : [0, 2 * Math.PI];
          created = board.create("curve", [(tt: number) => fx({ t: tt }), (tt: number) => fy({ t: tt }), t[0], t[1]], { ...lineAttrs(e, "blue"), strokeWidth: num(e.width, 2.2) });
          break;
        }
        case "tangent": {
          const graph = ref(e.graph);
          const x0 = val(e.x, 0);
          const start = typeof x0 === "number" ? x0 : x0();
          const g = board.create("glider", [start, 0, graph], { size: 3.5, strokeColor: "#ffffff", fillColor: colorOf(e, JSX_TONES.red), name: "", withLabel: false, fixed: options.editable ? false : true, showInfobox: false });
          created = board.create("tangent", [g], { ...lineAttrs(e, "red"), strokeWidth: num(e.width, 1.6) });
          break;
        }
        case "integral": {
          const curve = ref(e.graph);
          created = board.create("integral", [[num(e.from, xmin), num(e.to, xmax)], curve], {
            fillColor: colorOf(e, JSX_TONES.blue),
            fillOpacity: 0.25,
            highlightFillOpacity: 0.25,
            axis: { visible: false },
            curveLeft: { visible: false },
            curveRight: { visible: false },
            label: { visible: false },
            withLabel: false,
            fixed: true,
          });
          break;
        }
        case "riemann": {
          const curve = ref(e.graph);
          const n = Math.min(60, Math.max(1, Math.round(num(e.n, 8))));
          created = board.create("riemannsum", [curve.Y ? (x: number) => curve.Y(x) : (x: number) => x, n, String(e.type ?? "left"), num(e.from, xmin), num(e.to, xmax)], {
            fillColor: colorOf(e, JSX_TONES.blue),
            fillOpacity: 0.25,
            strokeColor: colorOf(e, JSX_TONES.blue),
            strokeWidth: 1,
            highlight: false,
          });
          break;
        }
        case "inequality":
          created = board.create("inequality", [ref(e.line)], { inverse: e.inverse === true, fillColor: colorOf(e, JSX_TONES.blue), fillOpacity: 0.18, highlight: false });
          break;
        case "vectorfield": {
          const fx = compile(String(e.fx ?? "-y"));
          const fy = compile(String(e.fy ?? "x"));
          created = board.create("vectorfield", [[(x: number, y: number) => fx({ x, y }), (x: number, y: number) => fy({ x, y })], [xmin, Math.round(num(e.xSteps, 14)), xmax], [ymin, Math.round(num(e.ySteps, 10)), ymax]], { strokeColor: colorOf(e, JSX_TONES.blue), strokeWidth: 1.2, highlight: false, scale: 0.55 });
          break;
        }
        case "implicit": {
          const f = compile(String(e.expr ?? "x^2+y^2-4"));
          created = board.create("implicitcurve", [(x: number, y: number) => f({ x, y })], { ...lineAttrs(e, "blue"), strokeWidth: num(e.width, 2.2) });
          break;
        }
        case "text": {
          const text = String(e.text ?? "");
          const slot = SLOT_MARK.exec(text.trim());
          if (slot) {
            slotMarks.push({ n: Number(slot[1]), x: num(e.x, 0), y: num(e.y, 0), w: typeof e.w === "number" ? e.w : undefined, h: typeof e.h === "number" ? e.h : undefined });
            break;
          }
          // Texte vivant : « AB = {dist(A,B)} cm » se met à jour quand on déplace les points ou les curseurs.
          let content: string | (() => string) = text;
          if (/\{[^{}]+\}/.test(text)) {
            const parts = text.split(/(\{[^{}]+\})/).map((part) => (part.startsWith("{") && part.endsWith("}") ? compile(part.slice(1, -1)) : part));
            content = () =>
              parts
                .map((part) => {
                  if (typeof part === "string") return part;
                  const v = part({});
                  return Number.isFinite(v) ? String(Math.round(v * 100) / 100).replace(".", ",") : "?";
                })
                .join("");
          }
          created = board.create("text", [val(e.x), val(e.y), content], {
            fontSize: num(e.size, 15),
            strokeColor: colorOf(e, JSX_TONES.navy),
            anchorX: e.anchor === "left" || e.anchor === "right" ? e.anchor : "middle",
            anchorY: "middle",
            fixed: true,
            highlight: false,
            display: "internal",
            cssStyle: "font-family: inherit; font-weight: 600;",
          });
          break;
        }
        case "rect": {
          const x = num(e.x, 0), y = num(e.y, 0), w = num(e.w, 1), h = num(e.h, 1);
          const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => board.create("point", [px, py], { visible: false, fixed: true, withLabel: false }));
          const fill = colorOf(e, JSX_TONES.navy);
          const opacity = e.filled === false ? 0 : num(e.opacity, 0.14);
          created = board.create("polygon", corners, {
            fillColor: fill,
            fillOpacity: opacity,
            highlightFillOpacity: opacity,
            borders: { strokeColor: JSX_TONES[String(e.strokeColor)] ?? fill, strokeWidth: num(e.width, 1.5), highlight: false },
            vertices: { visible: false },
            highlight: false,
            fixed: true,
            withLabel: false,
            visible: !e.hidden,
          });
          break;
        }
        case "shape": {
          const pts = (Array.isArray(e.points) ? e.points : []).filter((q): q is [number, number] => Array.isArray(q) && q.length === 2 && q.every((v) => typeof v === "number"));
          if (pts.length < 2) break;
          const fill = colorOf(e, JSX_TONES.navy);
          if (e.closed === false) {
            created = board.create("curve", [pts.map((q) => q[0]), pts.map((q) => q[1])], { ...lineAttrs(e), strokeColor: fill });
            break;
          }
          const verts = pts.map(([px, py]) => board.create("point", [px, py], { visible: false, fixed: true, withLabel: false }));
          const opacity = e.filled === false ? 0 : num(e.opacity, 0.14);
          created = board.create("polygon", verts, {
            fillColor: fill,
            fillOpacity: opacity,
            highlightFillOpacity: opacity,
            borders: { strokeColor: JSX_TONES[String(e.strokeColor)] ?? fill, strokeWidth: num(e.width, 1.5), highlight: false, dash: e.dash ? 2 : 0 },
            vertices: { visible: false },
            highlight: false,
            fixed: true,
            withLabel: false,
            visible: !e.hidden,
          });
          break;
        }
        case "seg": {
          const a = board.create("point", [num(e.x1, 0), num(e.y1, 0)], { visible: false, fixed: true, withLabel: false });
          const b = board.create("point", [num(e.x2, 1), num(e.y2, 0)], { visible: false, fixed: true, withLabel: false });
          created = board.create("segment", [a, b], lineAttrs(e));
          break;
        }
        case "toggle": {
          created = board.create("checkbox", [num(e.x, xmin + 0.5), num(e.y, ymax - 0.8), String(e.label ?? "Afficher")], { fixed: true });
          const targets = arr(e.targets).map(String);
          const apply = () => {
            const on = !!created.Value();
            targets.forEach((key) => byId.get(key)?.setAttribute({ visible: on }));
            board.update();
          };
          created.rendNodeCheckbox?.addEventListener("change", apply);
          if (e.checked === false) {
            created.rendNodeCheckbox && (created.rendNodeCheckbox.checked = false);
            apply();
          }
          break;
        }
        case "slider": {
          created = board.create("slider", [[num(e.x1, xmin + 1), num(e.y1, ymin + 0.8)], [num(e.x2, xmin + 4), num(e.y2, ymin + 0.8)], [num(e.min, 0), num(e.value, 1), num(e.max, 5)]], {
            name: String(e.label ?? e.id ?? ""),
            withLabel: true,
            snapWidth: num(e.step, 0),
            strokeColor: JSX_TONES.gold,
            fillColor: JSX_TONES.gold,
            highlightStrokeColor: JSX_TONES.gold,
            baseline: { strokeColor: JSX_TONES.gray },
            highline: { strokeColor: JSX_TONES.gold },
            label: { fontSize: 13, color: JSX_TONES.navy },
            size: 5,
          });
          if (e.id) sliders.set(e.id, created);
          break;
        }
        case "reflect":
          created = board.create("reflection", [ref(e.of), ref(e.over)], { size: 3, fillColor: colorOf(e, JSX_TONES.green), strokeColor: "#ffffff", name: typeof e.label === "string" ? e.label : "", withLabel: showsName(e), fixed: true, visible: !e.hidden, showInfobox: false });
          break;
        case "rotate":
        case "translate":
        case "dilate": {
          // Image d'un point : coordonnées vivantes (suivent le point d'origine, le centre et les curseurs).
          const src = ref(e.of);
          const center = ref(e.center);
          const k = val(e.ratio, 2);
          const ang = val(e.angle, 90);
          const dx = val(e.dx, 1);
          const dy = val(e.dy, 0);
          const get = (v: number | (() => number)) => (typeof v === "number" ? v : v());
          const image = (axis: 0 | 1) => () => {
            const px = src.X();
            const py = src.Y();
            if (e.kind === "translate") return axis === 0 ? px + get(dx) : py + get(dy);
            const cx = center ? center.X() : 0;
            const cy = center ? center.Y() : 0;
            if (e.kind === "dilate") return axis === 0 ? cx + get(k) * (px - cx) : cy + get(k) * (py - cy);
            const a = (get(ang) * Math.PI) / 180;
            const rx = px - cx;
            const ry = py - cy;
            return axis === 0 ? cx + rx * Math.cos(a) - ry * Math.sin(a) : cy + rx * Math.sin(a) + ry * Math.cos(a);
          };
          created = board.create("point", [image(0), image(1)], {
            size: 3,
            fillColor: colorOf(e, JSX_TONES.green),
            strokeColor: "#ffffff",
            name: typeof e.label === "string" ? e.label : "",
            withLabel: showsName(e),
            fixed: true,
            visible: !e.hidden,
            showInfobox: false,
            label: { fontSize: 14, color: JSX_TONES.navy, offset: [8, 8], highlight: false },
          });
          break;
        }
        case "raw": {
          // Porte de sortie : tout objet JSXGraph. Les parents « @A » désignent l'élément d'id A ; les chaînes entre guillemets
          // simples sont des formules (mathjs) évaluées en x.
          const parents = arr(e.parents).map((p) => {
            if (typeof p === "string" && p.startsWith("@")) return byId.get(p.slice(1));
            if (typeof p === "string" && p.startsWith("=")) {
              const f = compile(p.slice(1));
              return (x: number, y: number) => f({ x, y, t: x });
            }
            return p;
          });
          created = board.create(String(e.type ?? "point"), parents, { ...(typeof e.attributes === "object" && e.attributes ? (e.attributes as object) : {}), highlight: false });
          break;
        }
      }
    } catch (error) {
      console.warn(`[jsx_figure] élément « ${e.kind} ${e.id ?? ""} » ignoré :`, error instanceof Error ? error.message : error);
    }
    if (created && e.hidden) hiddenObjects.add(created);
    if (created && e.id) byId.set(e.id, created);
  }

  // Cadrage automatique : si un élément sort du repère, on dézoome (jamais de figure rognée) au lieu d'agrandir.
  {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const grow = (x: number, y: number, r = 0) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r);
    };
    for (const obj of board.objectsList as Any[]) {
      if (hiddenObjects.has(obj)) continue;
      try {
        if (obj.elementClass === JXG.OBJECT_CLASS_POINT) grow(obj.X(), obj.Y());
        else if (obj.elementClass === JXG.OBJECT_CLASS_CIRCLE) grow(obj.center.X(), obj.center.Y(), obj.Radius());
        else if (obj.elementClass === JXG.OBJECT_CLASS_TEXT && obj.visProp?.visible !== false) grow(obj.X(), obj.Y());
      } catch {
        /* objet sans position : ignoré */
      }
    }
    if (Number.isFinite(x0)) {
      const padX = Math.max(0.6, (x1 - x0) * 0.12);
      const padY = Math.max(0.6, (y1 - y0) * 0.12);
      const next: [number, number, number, number] = [Math.min(boundingBox[0], x0 - padX), Math.max(boundingBox[1], y1 + padY), Math.max(boundingBox[2], x1 + padX), Math.min(boundingBox[3], y0 - padY)];
      if (next.some((v, i) => v !== boundingBox[i])) {
        boundingBox = next;
        ratio = (boundingBox[1] - boundingBox[3]) / (boundingBox[2] - boundingBox[0]);
        const h = heightFor(container.clientWidth || width);
        container.style.height = `${h}px`;
        board.resizeContainer(container.clientWidth || width, h, true, true);
        board.setBoundingBox(boundingBox, spec.keepAspect);
        board.update();
      }
    }
  }

  // Emplacements de réponse : un rectangle SVG repéré par data-slot (SlotHtml y pose son champ), qui suit le repère.
  const slotRects: { n: number; x: number; y: number; w?: number; h?: number; rect: SVGRectElement }[] = [];
  const svgRoot: SVGElement | undefined = board.renderer?.svgRoot;
  if (svgRoot && slotMarks.length) {
    for (const s of slotMarks) {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("data-slot", String(s.n));
      rect.setAttribute("width", String(s.w ?? 46));
      rect.setAttribute("height", String(s.h ?? 26));
      rect.setAttribute("rx", "6");
      // Invisible : seul le champ de saisie de l'exercice (SlotHtml) s'affiche à cet endroit, jamais une case vide.
      rect.setAttribute("fill", "none");
      rect.setAttribute("stroke", "none");
      rect.setAttribute("pointer-events", "none");
      svgRoot.appendChild(rect);
      slotRects.push({ ...s, rect });
    }
    const place = () => {
      for (const s of slotRects) {
        const px = board.origin.scrCoords[1] + s.x * board.unitX;
        const py = board.origin.scrCoords[2] - s.y * board.unitY;
        s.rect.setAttribute("x", String(px - (s.w ?? 46) / 2));
        s.rect.setAttribute("y", String(py - (s.h ?? 26) / 2));
      }
    };
    place();
    board.on("update", place);
  }

  // Suit la largeur de la carte (rotation du téléphone, fenêtre redimensionnée) sans redessiner la figure.
  let lastWidth = width;
  const resizer = new ResizeObserver(() => {
    const w = container.clientWidth;
    if (!w || Math.abs(w - lastWidth) < 2) return;
    lastWidth = w;
    const h = heightFor(w);
    container.style.height = `${h}px`;
    board.resizeContainer(w, h, true, true);
    board.setBoundingBox(boundingBox, spec.keepAspect);
    board.update();
  });
  resizer.observe(container);

  return {
    board,
    readPoints: () => {
      const out: Record<string, [number, number]> = {};
      for (const m of movable) out[m.key] = [Math.round(m.el.X() * 100) / 100, Math.round(m.el.Y() * 100) / 100];
      return out;
    },
    destroy: () => {
      resizer.disconnect();
      try {
        JXG.JSXGraph.freeBoard(board);
      } catch {
        /* déjà libéré */
      }
      container.innerHTML = "";
    },
  };
}
