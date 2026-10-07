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
  | "text" | "slider" | "reflect" | "rotate" | "translate" | "dilate" | "raw";

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
  /** Hauteur en pixels (180 à 520), ignorée si keepAspect donne le rapport. */
  height: number;
  elements: JsxElement[];
}

const KINDS: readonly JsxKind[] = [
  "point", "segment", "line", "ray", "vector", "circle", "arc", "sector", "polygon", "angle",
  "midpoint", "perpendicular", "parallel", "bisector", "perpendicular_bisector", "intersection",
  "function", "parametric", "tangent", "integral", "riemann", "inequality", "vectorfield", "implicit",
  "text", "slider", "reflect", "rotate", "translate", "dilate", "raw",
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
    .slice(0, 80)
    .map((e) => JSON.parse(JSON.stringify(e)) as JsxElement);
  return {
    type: "jsx_figure",
    caption: typeof r.caption === "string" ? r.caption.slice(0, 200) : "",
    boundingBox: bb,
    axes: r.axes !== false,
    grid: r.grid !== false,
    keepAspect: r.keepAspect !== false,
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
  const [xmin, ymax, xmax, ymin] = spec.boundingBox;

  // Taille : la largeur du conteneur ; la hauteur suit le rapport du repère (repère orthonormé) ou `height`.
  const width = Math.max(220, container.clientWidth || 360);
  const ratio = (ymax - ymin) / (xmax - xmin);
  const height = spec.keepAspect ? Math.min(520, Math.max(180, Math.round(width * ratio))) : spec.height;
  container.style.width = "100%";
  container.style.minHeight = "0";
  container.style.height = `${height}px`;
  const id = `jsxb-${Math.random().toString(36).slice(2)}`;
  container.id = id;

  const board: Any = JXG.JSXGraph.initBoard(id, {
    boundingbox: spec.boundingBox,
    axis: false,
    grid: false,
    showCopyright: false,
    showNavigation: false,
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
  const sliders = new Map<string, Any>();
  const scope = () => {
    const s: Record<string, number> = {};
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

  const slotMarks: { n: number; x: number; y: number }[] = [];
  const movable: { key: string; el: Any }[] = [];

  for (const e of spec.elements) {
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
            withLabel: !!label && !slot,
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
          const center = ref(e.center);
          const through = ref(e.through);
          created = board.create("circle", [center, through ?? val(e.radius, 1)], {
            ...lineAttrs(e),
            fillColor: colorOf(e, JSX_TONES.navy),
            fillOpacity: e.filled === false ? 0 : 0.1,
            highlightFillOpacity: e.filled === false ? 0 : 0.1,
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
          created = board.create("midpoint", [ref(arr(e.of)[0]), ref(arr(e.of)[1])], { size: 2.5, strokeColor: "#ffffff", fillColor: colorOf(e, JSX_TONES.navy), name: typeof e.label === "string" ? e.label : "", withLabel: !!e.label, fixed: true, visible: !e.hidden, showInfobox: false });
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
          created = board.create("intersection", [ref(arr(e.of)[0]), ref(arr(e.of)[1]), num(e.index, 0)], { size: 3, strokeColor: "#ffffff", fillColor: colorOf(e, JSX_TONES.red), name: typeof e.label === "string" ? e.label : "", withLabel: !!e.label, fixed: true, visible: !e.hidden, showInfobox: false });
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
            slotMarks.push({ n: Number(slot[1]), x: num(e.x, 0), y: num(e.y, 0) });
            break;
          }
          created = board.create("text", [val(e.x), val(e.y), text], {
            fontSize: num(e.size, 15),
            strokeColor: colorOf(e, JSX_TONES.navy),
            anchorX: "middle",
            anchorY: "middle",
            fixed: true,
            highlight: false,
            display: "internal",
            cssStyle: "font-family: inherit; font-weight: 600;",
          });
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
          created = board.create("reflection", [ref(e.of), ref(e.over)], { size: 3, fillColor: colorOf(e, JSX_TONES.green), strokeColor: "#ffffff", name: typeof e.label === "string" ? e.label : "", withLabel: !!e.label, fixed: true, visible: !e.hidden, showInfobox: false });
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
            withLabel: !!e.label,
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
    if (created && e.id) byId.set(e.id, created);
  }

  // Emplacements de réponse : un rectangle SVG repéré par data-slot (SlotHtml y pose son champ), qui suit le repère.
  const slotRects: { n: number; x: number; y: number; rect: SVGRectElement }[] = [];
  const svgRoot: SVGElement | undefined = board.renderer?.svgRoot;
  if (svgRoot && slotMarks.length) {
    for (const s of slotMarks) {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("data-slot", String(s.n));
      rect.setAttribute("width", "46");
      rect.setAttribute("height", "26");
      rect.setAttribute("rx", "6");
      rect.setAttribute("fill", "#ffffff");
      rect.setAttribute("fill-opacity", "0.94");
      rect.setAttribute("stroke", JSX_TONES.gold);
      rect.setAttribute("stroke-width", "1.4");
      rect.setAttribute("stroke-dasharray", "3 2");
      svgRoot.appendChild(rect);
      slotRects.push({ ...s, rect });
    }
    const place = () => {
      for (const s of slotRects) {
        const px = board.origin.scrCoords[1] + s.x * board.unitX;
        const py = board.origin.scrCoords[2] - s.y * board.unitY;
        s.rect.setAttribute("x", String(px - 23));
        s.rect.setAttribute("y", String(py - 13));
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
    const h = spec.keepAspect ? Math.min(520, Math.max(180, Math.round(w * ratio))) : spec.height;
    container.style.height = `${h}px`;
    board.resizeContainer(w, h, true, true);
    board.setBoundingBox(spec.boundingBox, spec.keepAspect);
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

/* ------------------------------------------------------------------ */
/*  Préréglages : figures usuelles prêtes à modifier                    */
/* ------------------------------------------------------------------ */

const P = (id: string, x: number | string, y: number | string, label = id, extra: Partial<JsxElement> = {}): JsxElement => ({ kind: "point", id, x, y, label, ...extra });
const base = (caption: string, bb: [number, number, number, number], elements: JsxElement[], extra: Partial<JsxFigureSpec> = {}): JsxFigureSpec => ({
  type: "jsx_figure", caption, boundingBox: bb, axes: false, grid: true, keepAspect: true, height: 300, elements, ...extra,
});

export const JSX_PRESETS: { id: string; label: string; group: string; spec: JsxFigureSpec }[] = [
  { id: "triangle", label: "Triangle ABC", group: "Géométrie plane", spec: base("Triangle ABC", [-1, 6, 9, -1], [P("A", 1, 1), P("B", 8, 1), P("C", 3, 5), { kind: "polygon", vertices: ["A", "B", "C"] }]) },
  { id: "right_triangle", label: "Triangle rectangle", group: "Géométrie plane", spec: base("Triangle rectangle en A", [-1, 6, 9, -1], [P("A", 1, 1), P("B", 7, 1), P("C", 1, 5), { kind: "polygon", vertices: ["A", "B", "C"] }, { kind: "angle", points: ["B", "A", "C"], label: "" }]) },
  { id: "parallelogram", label: "Parallélogramme", group: "Géométrie plane", spec: base("Parallélogramme ABCD", [-1, 6, 10, -1], [P("A", 1, 1), P("B", 6, 1), P("C", 8, 5), P("D", 3, 5), { kind: "polygon", vertices: ["A", "B", "C", "D"] }]) },
  { id: "circle", label: "Cercle et rayon", group: "Géométrie plane", spec: base("Cercle de centre O", [-5, 5, 5, -5], [P("O", 0, 0), P("M", 3, 0), { kind: "circle", center: "O", through: "M" }, { kind: "segment", from: "O", to: "M", dash: true, color: "gold" }]) },
  { id: "thales", label: "Théorème de Thalès", group: "Géométrie plane", spec: base("Configuration de Thalès", [-1, 7, 10, -1], [P("A", 1, 1), P("B", 9, 1), P("C", 4, 6), P("M", 3.25, 1), P("N", 2.5, 3.5), { kind: "polygon", vertices: ["A", "B", "C"], filled: false }, { kind: "segment", from: "M", to: "N", color: "red" }]) },
  { id: "mediatrice", label: "Médiatrice d'un segment", group: "Constructions", spec: base("Médiatrice de [AB]", [-1, 6, 10, -1], [P("A", 2, 3), P("B", 8, 3), { kind: "segment", from: "A", to: "B" }, { kind: "perpendicular_bisector", of: ["A", "B"] }, { kind: "midpoint", of: ["A", "B"], label: "I" }]) },
  { id: "bisectrice", label: "Bissectrice d'un angle", group: "Constructions", spec: base("Bissectrice de l'angle AOB", [-1, 7, 10, -1], [P("O", 1, 1), P("A", 8, 1), P("B", 5, 6), { kind: "segment", from: "O", to: "A" }, { kind: "segment", from: "O", to: "B" }, { kind: "bisector", points: ["A", "O", "B"] }, { kind: "angle", points: ["A", "O", "B"], label: "" }]) },
  { id: "tangent_circle", label: "Tangente à un cercle", group: "Constructions", spec: base("Tangente en M", [-5, 5, 5, -5], [P("O", 0, 0), P("M", 3, 0), { kind: "circle", center: "O", through: "M" }, { kind: "segment", from: "O", to: "M", dash: true, color: "gold" }, { kind: "line", id: "OM", through: ["O", "M"], hidden: true }, { kind: "perpendicular", line: "OM", through: "M", color: "red" }]) },
  { id: "symmetry", label: "Symétrie axiale", group: "Transformations", spec: base("Symétrie par rapport à (d)", [-7, 6, 7, -1], [P("A", -4, 1), P("B", -1, 1), P("C", -3, 4), P("D", 0, -0.5, "", { hidden: true }), P("E", 0, 6, "", { hidden: true }), { kind: "line", id: "d", through: ["D", "E"], color: "gold", dash: true }, { kind: "polygon", vertices: ["A", "B", "C"] }, { kind: "reflect", id: "A2", of: "A", over: "d", label: "A'" }, { kind: "reflect", id: "B2", of: "B", over: "d", label: "B'" }, { kind: "reflect", id: "C2", of: "C", over: "d", label: "C'" }, { kind: "polygon", vertices: ["A2", "B2", "C2"], color: "green" }]) },
  { id: "translation", label: "Translation", group: "Transformations", spec: base("Translation de vecteur (4 ; 1)", [-1, 7, 12, -1], [P("A", 1, 1), P("B", 3, 1), P("C", 2, 4), { kind: "polygon", vertices: ["A", "B", "C"] }, { kind: "translate", id: "A2", of: "A", dx: 4, dy: 1, label: "A'" }, { kind: "translate", id: "B2", of: "B", dx: 4, dy: 1, label: "B'" }, { kind: "translate", id: "C2", of: "C", dx: 4, dy: 1, label: "C'" }, { kind: "polygon", vertices: ["A2", "B2", "C2"], color: "green" }]) },
  { id: "rotation", label: "Rotation", group: "Transformations", spec: base("Rotation de centre O et d'angle 90°", [-6, 6, 6, -4], [P("O", 0, 0), P("A", 2, 1), P("B", 4, 1), P("C", 3, 3), { kind: "polygon", vertices: ["A", "B", "C"] }, { kind: "rotate", id: "A2", of: "A", center: "O", angle: 90, label: "A'" }, { kind: "rotate", id: "B2", of: "B", center: "O", angle: 90, label: "B'" }, { kind: "rotate", id: "C2", of: "C", center: "O", angle: 90, label: "C'" }, { kind: "polygon", vertices: ["A2", "B2", "C2"], color: "green" }]) },
  { id: "homothety", label: "Homothétie", group: "Transformations", spec: base("Homothétie de centre O et de rapport 2", [-1, 9, 12, -1], [P("O", 1, 1), P("A", 2, 1), P("B", 3.5, 1), P("C", 2.5, 2.5), { kind: "polygon", vertices: ["A", "B", "C"] }, { kind: "dilate", id: "A2", of: "A", center: "O", ratio: 2, label: "A'" }, { kind: "dilate", id: "B2", of: "B", center: "O", ratio: 2, label: "B'" }, { kind: "dilate", id: "C2", of: "C", center: "O", ratio: 2, label: "C'" }, { kind: "polygon", vertices: ["A2", "B2", "C2"], color: "green" }]) },
  { id: "line_graph", label: "Droite y = ax + b", group: "Fonctions", spec: base("Droite d'équation y = ax + b", [-6, 6, 6, -6], [{ kind: "slider", id: "a", label: "a", x1: -5, y1: -4.2, x2: -1.5, y2: -4.2, min: -3, value: 1, max: 3, step: 0.5 }, { kind: "slider", id: "b", label: "b", x1: -5, y1: -5.2, x2: -1.5, y2: -5.2, min: -4, value: 1, max: 4, step: 0.5 }, { kind: "function", expr: "a*x+b", color: "blue" }], { axes: true }) },
  { id: "parabola", label: "Parabole", group: "Fonctions", spec: base("Parabole d'équation y = x² − 2x − 3", [-5, 8, 6, -6], [{ kind: "function", id: "f", expr: "x^2-2*x-3", color: "blue" }, P("S", 1, -4, "S", { color: "red" })], { axes: true }) },
  { id: "two_curves", label: "Deux courbes et intersection", group: "Fonctions", spec: base("Résolution graphique", [-4, 6, 5, -3], [{ kind: "function", id: "f", expr: "x^2-1", color: "blue" }, { kind: "function", id: "g", expr: "x+1", color: "red" }, { kind: "intersection", of: ["f", "g"], index: 0, label: "A" }, { kind: "intersection", of: ["f", "g"], index: 1, label: "B" }], { axes: true }) },
  { id: "tangent_curve", label: "Tangente à une courbe", group: "Fonctions", spec: base("Tangente à la courbe de f", [-4, 7, 5, -2], [{ kind: "function", id: "f", expr: "x^2/2", color: "blue" }, { kind: "tangent", graph: "f", x: 1, color: "red" }], { axes: true }) },
  { id: "area", label: "Aire sous une courbe", group: "Fonctions", spec: base("Aire sous la courbe", [-1, 5, 6, -1], [{ kind: "function", id: "f", expr: "0.5*x^2", color: "blue", domain: [0, 5.5] }, { kind: "integral", graph: "f", from: 1, to: 4, color: "blue" }], { axes: true }) },
  { id: "riemann", label: "Rectangles de Riemann", group: "Fonctions", spec: base("Somme de Riemann (n = 8)", [-1, 5, 6, -1], [{ kind: "function", id: "f", expr: "0.5*x^2", color: "blue", domain: [0, 5.5] }, { kind: "riemann", graph: "f", n: 8, type: "left", from: 0, to: 4 }], { axes: true }) },
  { id: "unit_circle", label: "Cercle trigonométrique", group: "Fonctions", spec: base("Cercle trigonométrique", [-1.7, 1.5, 1.7, -1.5], [P("O", 0, 0), P("I", 1, 0), P("J", 0, 1), { kind: "circle", center: "O", through: "I", filled: false }, { kind: "slider", id: "t", label: "θ", x1: -1.4, y1: -1.25, x2: 0.4, y2: -1.25, min: 0, value: 1, max: 6.28 }, P("M", "cos(t)", "sin(t)", "M", { color: "red" })], { axes: true }) },
  { id: "vectors", label: "Vecteurs et somme", group: "Vecteurs", spec: base("Somme de deux vecteurs", [-1, 6, 9, -1], [P("O", 1, 1), P("A", 5, 2, "A"), P("B", 3, 4, "B"), P("C", 7, 5, "C"), { kind: "vector", from: "O", to: "A" }, { kind: "vector", from: "O", to: "B", color: "red" }, { kind: "vector", from: "O", to: "C", color: "green" }]) },
  { id: "field", label: "Champ de vecteurs", group: "Vecteurs", spec: base("Champ de vecteurs (−y ; x)", [-5, 5, 5, -5], [{ kind: "vectorfield", fx: "-y", fy: "x" }], { axes: true }) },
  { id: "inequality", label: "Inéquation du plan", group: "Fonctions", spec: base("Demi-plan y ≥ x − 1", [-5, 5, 5, -5], [P("A", 0, -1, "", { hidden: true }), P("B", 3, 2, "", { hidden: true }), { kind: "line", id: "d", through: ["A", "B"], color: "navy" }, { kind: "inequality", line: "d", inverse: true }], { axes: true }) },
  { id: "conic", label: "Conique (ellipse)", group: "Courbes", spec: base("Ellipse x²/9 + y²/4 = 1", [-5, 4, 5, -4], [{ kind: "implicit", expr: "x^2/9+y^2/4-1", color: "blue" }], { axes: true }) },
  { id: "parametric", label: "Courbe paramétrée", group: "Courbes", spec: base("Cardioïde", [-4, 4, 3, -4], [{ kind: "parametric", x: "2*(1-cos(t))*cos(t)", y: "2*(1-cos(t))*sin(t)", t: [0, 6.2832], color: "red" }], { axes: true }) },
];
