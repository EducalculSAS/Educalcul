import { compile } from "mathjs";

const WIDTH = 500;
const HEIGHT = 340;
const PAD_L = 46;
const PAD_R = 18;
const PAD_T = 18;
const PAD_B = 34;

/** Choisit un pas "rond" (1, 2, 5, 10…) pour ~`target` graduations sur une plage. */
function niceStep(range: number, target = 8): number {
  if (!isFinite(range) || range <= 0) return 1;
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * mag;
}

function fmt(n: number): string {
  if (Math.abs(n) < 1e-9) return "0";
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}

function ticks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 1e-6; v += step) {
    out.push(Math.round(v / step) * step);
  }
  return out;
}

export function buildGraphSvg(
  expr: string,
  xMin: number,
  xMax: number,
  samples = 240,
  scope: Record<string, number> = {},
) {
  let compiled;
  try {
    compiled = compile(expr);
  } catch {
    return { svg: "", error: "Expression invalide." };
  }

  const points: { x: number; y: number }[] = [];
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    let y: number;
    try {
      y = compiled.evaluate({ x, ...scope });
    } catch {
      continue;
    }
    if (typeof y !== "number" || !isFinite(y)) continue;
    points.push({ x, y });
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }

  if (!points.length || !isFinite(yMin) || !isFinite(yMax)) {
    return { svg: "", error: "Impossible d'évaluer cette fonction sur cet intervalle." };
  }

  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const yMargin = (yMax - yMin) * 0.12;
  yMin -= yMargin;
  yMax += yMargin;

  const plotW = WIDTH - PAD_L - PAD_R;
  const plotH = HEIGHT - PAD_T - PAD_B;

  const sx = (x: number) => PAD_L + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => PAD_T + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

  const xStep = niceStep(xMax - xMin);
  const yStep = niceStep(yMax - yMin);
  const xTicks = ticks(xMin, xMax, xStep);
  const yTicks = ticks(yMin, yMax, yStep);

  const el: string[] = [];

  // Cadre du graphe
  el.push(
    `<rect class="g-frame" x="${PAD_L}" y="${PAD_T}" width="${plotW}" height="${plotH}" rx="6" />`
  );

  // Grille verticale + graduations X
  for (const t of xTicks) {
    const x = sx(t);
    el.push(`<line class="g-grid" x1="${x.toFixed(2)}" y1="${PAD_T}" x2="${x.toFixed(2)}" y2="${PAD_T + plotH}" />`);
    el.push(`<line class="g-tick" x1="${x.toFixed(2)}" y1="${PAD_T + plotH}" x2="${x.toFixed(2)}" y2="${PAD_T + plotH + 4}" />`);
    el.push(`<text class="g-axlabel" x="${x.toFixed(2)}" y="${PAD_T + plotH + 16}" text-anchor="middle">${fmt(t)}</text>`);
  }
  // Grille horizontale + graduations Y
  for (const t of yTicks) {
    const y = sy(t);
    el.push(`<line class="g-grid" x1="${PAD_L}" y1="${y.toFixed(2)}" x2="${PAD_L + plotW}" y2="${y.toFixed(2)}" />`);
    el.push(`<line class="g-tick" x1="${PAD_L - 4}" y1="${y.toFixed(2)}" x2="${PAD_L}" y2="${y.toFixed(2)}" />`);
    el.push(`<text class="g-axlabel" x="${PAD_L - 8}" y="${(y + 3).toFixed(2)}" text-anchor="end">${fmt(t)}</text>`);
  }

  // Axes principaux (x=0 / y=0) s'ils sont visibles
  if (xMin <= 0 && xMax >= 0) {
    el.push(`<line class="g-axis" x1="${sx(0).toFixed(2)}" y1="${PAD_T}" x2="${sx(0).toFixed(2)}" y2="${PAD_T + plotH}" />`);
  }
  if (yMin <= 0 && yMax >= 0) {
    el.push(`<line class="g-axis" x1="${PAD_L}" y1="${sy(0).toFixed(2)}" x2="${PAD_L + plotW}" y2="${sy(0).toFixed(2)}" />`);
  }

  // Courbe
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`)
    .join(" ");
  el.push(`<path class="g-curve" d="${path}" />`);

  // Données pour l'interactivité (échantillonnées pour rester légères)
  const downs: [number, number][] = [];
  const stepN = Math.max(1, Math.floor(points.length / 160));
  for (let i = 0; i < points.length; i += stepN) {
    downs.push([+points[i].x.toFixed(3), +points[i].y.toFixed(3)]);
  }
  const dataAttrs =
    `data-points='${JSON.stringify(downs)}' ` +
    `data-xmin="${xMin}" data-xmax="${xMax}" data-ymin="${yMin}" data-ymax="${yMax}" ` +
    `data-padl="${PAD_L}" data-padt="${PAD_T}" data-plotw="${plotW}" data-ploth="${plotH}" data-w="${WIDTH}" data-h="${HEIGHT}"`;

  const svg = `<svg class="g-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" ${dataAttrs}>${el.join("")}</svg>`;
  return { svg, error: "" };
}

/**
 * Remplace les placeholders <div class="math-graph-placeholder" ...></div> par le SVG du graphique.
 * Si data-param est présent, le graphique reçoit un curseur qui fait varier ce
 * paramètre et redessine la courbe en direct (cf. enhanceMathGraphs).
 */
export function renderMathGraphPlaceholders(html: string): string {
  if (!html || !html.includes("math-graph-placeholder")) return html;

  return html.replace(
    /<div[^>]*class="[^"]*math-graph-placeholder[^"]*"[^>]*>\s*<\/div>/g,
    (match) => {
      const fnMatch = match.match(/data-function="([^"]*)"/);
      const xminMatch = match.match(/data-xmin="([^"]*)"/);
      const xmaxMatch = match.match(/data-xmax="([^"]*)"/);
      const paramMatch = match.match(/data-param="([^"]*)"/);
      const paramMinMatch = match.match(/data-param-min="([^"]*)"/);
      const paramMaxMatch = match.match(/data-param-max="([^"]*)"/);
      const paramDefaultMatch = match.match(/data-param-default="([^"]*)"/);

      const expr = fnMatch ? fnMatch[1].replace(/^f\(x\)\s*=\s*/, "") : "x";
      const xMin = xminMatch ? parseFloat(xminMatch[1]) : -5;
      const xMax = xmaxMatch ? parseFloat(xmaxMatch[1]) : 5;
      const safeXMin = isFinite(xMin) ? xMin : -5;
      const safeXMax = isFinite(xMax) ? xMax : 5;

      const param = paramMatch ? paramMatch[1] : "";
      const paramMin = paramMinMatch ? parseFloat(paramMinMatch[1]) : -5;
      const paramMax = paramMaxMatch ? parseFloat(paramMaxMatch[1]) : 5;
      const paramDefault = paramDefaultMatch
        ? parseFloat(paramDefaultMatch[1])
        : (paramMin + paramMax) / 2;
      const hasParam = !!param && isFinite(paramMin) && isFinite(paramMax);

      const { svg, error } = buildGraphSvg(
        expr,
        safeXMin,
        safeXMax,
        240,
        hasParam ? { [param]: paramDefault } : {},
      );
      if (error || !svg) return "";
      const label = (fnMatch ? fnMatch[1] : `f(x) = ${expr}`).replace(/"/g, "");
      const exprAttr = expr.replace(/"/g, "&quot;");
      // La légende est en LaTeX ($...$) pour s'afficher comme les autres formules
      // (rendu ensuite par renderLatexInHTML qui s'exécute après).
      const caption = `<figcaption class="g-caption">$${label}$</figcaption>`;
      if (!hasParam) {
        return `<figure class="math-graph" data-function="${label}">${svg}${caption}</figure>`;
      }
      const slider =
        `<div class="g-param-control">` +
        `<label>$${param}$ = <span class="g-param-value">${paramDefault}</span></label>` +
        `<input type="range" class="g-param-slider" min="${paramMin}" max="${paramMax}" step="0.1" value="${paramDefault}" />` +
        `</div>`;
      return (
        `<figure class="math-graph math-graph-interactive" data-function="${label}" ` +
        `data-expr="${exprAttr}" data-xmin="${safeXMin}" data-xmax="${safeXMax}" ` +
        `data-param="${param}" data-param-min="${paramMin}" data-param-max="${paramMax}">` +
        `${svg}${caption}${slider}</figure>`
      );
    }
  );
}

/** Câble le curseur de survol (ligne + point + étiquette x;y) sur un graphique
 * déjà inséré dans le DOM. Extrait pour être réappliqué après qu'un curseur
 * de paramètre ait remplacé le <svg> par une version redessinée. */
function wireGraphCursor(svg: SVGSVGElement) {
  if (svg.dataset.enhanced) return;
  svg.dataset.enhanced = "1";
  const svgNS = "http://www.w3.org/2000/svg";

  let pts: [number, number][];
  try {
    pts = JSON.parse(svg.dataset.points || "[]");
  } catch {
    return;
  }
  if (!pts.length) return;

  const xMin = +svg.dataset.xmin!, xMax = +svg.dataset.xmax!;
  const yMin = +svg.dataset.ymin!, yMax = +svg.dataset.ymax!;
  const padL = +svg.dataset.padl!, padT = +svg.dataset.padt!;
  const plotW = +svg.dataset.plotw!, plotH = +svg.dataset.ploth!;
  const W = +svg.dataset.w!;

  const sx = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => padT + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

  const group = document.createElementNS(svgNS, "g");
  group.setAttribute("class", "g-cursor");
  group.style.opacity = "0";
  const vline = document.createElementNS(svgNS, "line");
  vline.setAttribute("class", "g-cursor-line");
  vline.setAttribute("y1", String(padT));
  vline.setAttribute("y2", String(padT + plotH));
  const dot = document.createElementNS(svgNS, "circle");
  dot.setAttribute("class", "g-cursor-dot");
  dot.setAttribute("r", "4.5");
  const labelBg = document.createElementNS(svgNS, "rect");
  labelBg.setAttribute("class", "g-cursor-bg");
  labelBg.setAttribute("rx", "5");
  labelBg.setAttribute("height", "20");
  const label = document.createElementNS(svgNS, "text");
  label.setAttribute("class", "g-cursor-text");
  group.appendChild(vline);
  group.appendChild(dot);
  group.appendChild(labelBg);
  group.appendChild(label);
  svg.appendChild(group);

  const move = (e: PointerEvent) => {
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const mathX = xMin + ((svgX - padL) / plotW) * (xMax - xMin);
    // point le plus proche en x
    let best = pts[0];
    let bestD = Infinity;
    for (const p of pts) {
      const d = Math.abs(p[0] - mathX);
      if (d < bestD) { bestD = d; best = p; }
    }
    const px = sx(best[0]);
    const py = sy(best[1]);
    vline.setAttribute("x1", px.toFixed(2));
    vline.setAttribute("x2", px.toFixed(2));
    dot.setAttribute("cx", px.toFixed(2));
    dot.setAttribute("cy", py.toFixed(2));
    const txt = `x=${(+best[0].toFixed(2))} ; y=${(+best[1].toFixed(2))}`;
    label.textContent = txt;
    const tw = txt.length * 6.2 + 12;
    let lx = px + 8;
    if (lx + tw > W - 4) lx = px - 8 - tw;
    const ly = Math.max(padT + 2, py - 26);
    labelBg.setAttribute("x", lx.toFixed(2));
    labelBg.setAttribute("y", ly.toFixed(2));
    labelBg.setAttribute("width", tw.toFixed(2));
    label.setAttribute("x", (lx + 6).toFixed(2));
    label.setAttribute("y", (ly + 14).toFixed(2));
    group.style.opacity = "1";
  };

  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerleave", () => { group.style.opacity = "0"; });
  svg.style.touchAction = "none";
}

/** Câble le curseur de paramètre d'un graphique interactif : au déplacement,
 * recalcule la courbe pour la nouvelle valeur et remplace le <svg>. */
function wireGraphParamSlider(figure: HTMLElement) {
  const slider = figure.querySelector<HTMLInputElement>(".g-param-slider");
  const valueLabel = figure.querySelector<HTMLElement>(".g-param-value");
  if (!slider || slider.dataset.wired) return;
  slider.dataset.wired = "1";

  const expr = figure.dataset.expr || "";
  const param = figure.dataset.param || "";
  const xMin = parseFloat(figure.dataset.xmin || "-5");
  const xMax = parseFloat(figure.dataset.xmax || "5");
  if (!expr || !param) return;

  slider.addEventListener("input", () => {
    const value = parseFloat(slider.value);
    if (valueLabel) valueLabel.textContent = String(value);
    const { svg, error } = buildGraphSvg(expr, xMin, xMax, 240, { [param]: value });
    if (error || !svg) return;
    const oldSvg = figure.querySelector("svg.g-svg");
    if (!oldSvg) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = svg;
    const newSvg = wrapper.firstElementChild as SVGSVGElement | null;
    if (!newSvg) return;
    oldSvg.replaceWith(newSvg);
    wireGraphCursor(newSvg);
  });
}

/**
 * Rend les graphiques interactifs : au survol, un curseur suit la courbe et
 * affiche les coordonnées (x ; y) ; si le graphique a un curseur de
 * paramètre, le fait varier redessine la courbe en direct. À appeler après
 * l'insertion du HTML.
 */
export function enhanceMathGraphs(root: ParentNode | null | undefined) {
  if (!root || typeof window === "undefined") return;

  root
    .querySelectorAll<SVGSVGElement>(".math-graph svg[data-points]")
    .forEach(wireGraphCursor);

  root
    .querySelectorAll<HTMLElement>(".math-graph-interactive")
    .forEach(wireGraphParamSlider);
}
