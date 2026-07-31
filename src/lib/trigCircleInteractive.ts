/**
 * Point mobile sur le cercle trigonométrique : au déplacement du curseur
 * d'angle, un point + un rayon sont redessinés en direct et (cos, sin)
 * s'affiche. Le tracé statique (cercle, axes, angles remarquables) reste
 * celui déjà compilé côté serveur — jamais recalculé ici — même pattern que
 * enhanceMathGraphs (src/lib/mathGraph.ts) : vanilla DOM, idempotent via
 * dataset.wired, câblé depuis le useEffect de CourseViewer.
 */

const TRIG_CIRCLE_CENTER_X = 100;
const TRIG_CIRCLE_CENTER_Y = 100;
const TRIG_CIRCLE_RADIUS = 68;

function trigCirclePoint(angleDeg: number): { x: number; y: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: TRIG_CIRCLE_CENTER_X + TRIG_CIRCLE_RADIUS * Math.cos(radians),
    y: TRIG_CIRCLE_CENTER_Y - TRIG_CIRCLE_RADIUS * Math.sin(radians),
  };
}

function wireTrigCircleSlider(figure: HTMLElement) {
  const slider = figure.querySelector<HTMLInputElement>(".tc-angle-slider");
  const valueLabel = figure.querySelector<HTMLElement>(".tc-angle-value");
  const svg = figure.querySelector<SVGSVGElement>("svg.tc-svg");
  const live = svg?.querySelector(".tc-live");
  if (!slider || !svg || !live || slider.dataset.wired) return;
  slider.dataset.wired = "1";

  const svgNS = "http://www.w3.org/2000/svg";
  const radiusLine = document.createElementNS(svgNS, "line");
  radiusLine.setAttribute("stroke", "#c89f36");
  radiusLine.setAttribute("stroke-width", "1.5");
  const dot = document.createElementNS(svgNS, "circle");
  dot.setAttribute("r", "4");
  dot.setAttribute("fill", "#2563eb");
  live.appendChild(radiusLine);
  live.appendChild(dot);

  const apply = (angleDeg: number) => {
    const point = trigCirclePoint(angleDeg);
    radiusLine.setAttribute("x1", String(TRIG_CIRCLE_CENTER_X));
    radiusLine.setAttribute("y1", String(TRIG_CIRCLE_CENTER_Y));
    radiusLine.setAttribute("x2", point.x.toFixed(1));
    radiusLine.setAttribute("y2", point.y.toFixed(1));
    dot.setAttribute("cx", point.x.toFixed(1));
    dot.setAttribute("cy", point.y.toFixed(1));
    if (valueLabel) {
      const radians = (angleDeg * Math.PI) / 180;
      const cos = Math.cos(radians).toFixed(2);
      const sin = Math.sin(radians).toFixed(2);
      valueLabel.textContent = `${Math.round(angleDeg)}° — (cos, sin) ≈ (${cos}, ${sin})`;
    }
  };

  slider.addEventListener("input", () => apply(parseFloat(slider.value)));
  apply(parseFloat(slider.value));
}

export function enhanceTrigCircles(root: ParentNode | null | undefined) {
  if (!root || typeof window === "undefined") return;
  root
    .querySelectorAll<HTMLElement>(".course-figure-trig-circle")
    .forEach(wireTrigCircleSlider);
}
