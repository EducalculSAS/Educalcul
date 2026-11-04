/**
 * Sous-ensemble de JSXGraph réellement utilisé par les figures (src/lib/jsxFigure.ts, jsxBoard3d.ts). Les types fournis par la
 * bibliothèque décrivent des centaines de signatures dont aucune ne couvre nos créations dynamiques (`board.create(type, ...)` avec un
 * type de la figure) : on décrit ici seulement ce qu'on appelle.
 */
export interface JxgElement {
  X(): number;
  /** Sur une courbe de fonction : image de `x`. */
  Y(x?: number): number;
  Value(): number;
  Radius(): number;
  center: JxgElement;
  elementClass: number;
  visProp?: { visible?: unknown };
  setAttribute(attributes: Record<string, unknown>): void;
  rendNodeCheckbox?: HTMLInputElement;
  /** Seulement sur une vue 3D (`view3d`) : crée un objet dans la vue. */
  create(type: string, parents: unknown[], attributes?: Record<string, unknown>): JxgElement;
  [key: string]: unknown;
}

export interface JxgBoard {
  create(type: string, parents: unknown[], attributes?: Record<string, unknown>): JxgElement;
  update(): JxgBoard;
  setBoundingBox(box: [number, number, number, number], keepAspect?: boolean): void;
  resizeContainer(width: number, height: number, ...rest: unknown[]): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  origin: { scrCoords: number[] };
  unitX: number;
  unitY: number;
  renderer: { svgRoot?: SVGElement; [key: string]: unknown };
  objectsList: JxgElement[];
  [key: string]: unknown;
}

/** Module jsxgraph tel qu'on l'utilise (`JXG.JSXGraph.initBoard`). */
export interface JxgModule {
  OBJECT_CLASS_POINT: number;
  OBJECT_CLASS_CIRCLE: number;
  OBJECT_CLASS_TEXT: number;
  JSXGraph: { initBoard(id: string, attributes: Record<string, unknown>): JxgBoard; freeBoard(board: JxgBoard): void };
  [key: string]: unknown;
}

/** Module mathjs tel qu'on l'utilise pour évaluer les fonctions de la figure. */
export interface MathJs {
  compile(expression: string): { evaluate(scope?: Record<string, unknown>): unknown };
  [key: string]: unknown;
}

/** Le module JSXGraph importé dynamiquement expose bien `JSXGraph.initBoard` / `freeBoard` ; sinon on le sait tout de suite. */
export function isJxgModule(v: unknown): v is JxgModule {
  if (typeof v !== "object" || v === null || !("JSXGraph" in v)) return false;
  const g = v.JSXGraph;
  return typeof g === "object" && g !== null && "initBoard" in g && typeof g.initBoard === "function" && "freeBoard" in g && typeof g.freeBoard === "function";
}
