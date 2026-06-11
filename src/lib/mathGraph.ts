import { compile } from "mathjs";

const WIDTH = 320;
const HEIGHT = 220;
const PADDING = 30;

export function buildGraphSvg(expr: string, xMin: number, xMax: number, samples = 200) {
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
      y = compiled.evaluate({ x });
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
  const yMargin = (yMax - yMin) * 0.1;
  yMin -= yMargin;
  yMax += yMargin;

  const plotW = WIDTH - 2 * PADDING;
  const plotH = HEIGHT - 2 * PADDING;

  const sx = (x: number) => PADDING + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => PADDING + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`)
    .join(" ");

  const elements: string[] = [];

  if (xMin <= 0 && xMax >= 0) {
    elements.push(
      `<line class="graph-axis" x1="${sx(0).toFixed(2)}" y1="${PADDING}" x2="${sx(0).toFixed(2)}" y2="${HEIGHT - PADDING}" />`
    );
  }
  if (yMin <= 0 && yMax >= 0) {
    elements.push(
      `<line class="graph-axis" x1="${PADDING}" y1="${sy(0).toFixed(2)}" x2="${WIDTH - PADDING}" y2="${sy(0).toFixed(2)}" />`
    );
  }

  elements.push(
    `<rect class="graph-grid" x="${PADDING}" y="${PADDING}" width="${plotW}" height="${plotH}" fill="none" />`
  );

  elements.push(`<path class="graph-curve" d="${path}" />`);

  elements.push(`<text class="graph-label" x="${PADDING}" y="${HEIGHT - 6}">${xMin}</text>`);
  elements.push(`<text class="graph-label" x="${WIDTH - PADDING - 14}" y="${HEIGHT - 6}">${xMax}</text>`);
  elements.push(`<text class="graph-label" x="2" y="${PADDING + 4}">${yMax.toFixed(1)}</text>`);
  elements.push(`<text class="graph-label" x="2" y="${HEIGHT - PADDING}">${yMin.toFixed(1)}</text>`);

  const svg = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">${elements.join("")}</svg>`;
  return { svg, error: "" };
}

/**
 * Remplace les placeholders <div class="math-graph-placeholder" data-function="..." data-xmin="" data-xmax=""></div>
 * (générés par l'IA) par le SVG calculé du graphique.
 */
export function renderMathGraphPlaceholders(html: string): string {
  if (!html || !html.includes("math-graph-placeholder")) return html;

  return html.replace(
    /<div[^>]*class="[^"]*math-graph-placeholder[^"]*"[^>]*>\s*<\/div>/g,
    (match) => {
      const fnMatch = match.match(/data-function="([^"]*)"/);
      const xminMatch = match.match(/data-xmin="([^"]*)"/);
      const xmaxMatch = match.match(/data-xmax="([^"]*)"/);

      const expr = fnMatch ? fnMatch[1].replace(/^f\(x\)\s*=\s*/, "") : "x";
      const xMin = xminMatch ? parseFloat(xminMatch[1]) : -5;
      const xMax = xmaxMatch ? parseFloat(xmaxMatch[1]) : 5;

      const { svg, error } = buildGraphSvg(expr, isFinite(xMin) ? xMin : -5, isFinite(xMax) ? xMax : 5);
      if (error || !svg) return "";
      return `<div class="math-graph" data-function="f(x) = ${expr}">${svg}</div>`;
    }
  );
}
