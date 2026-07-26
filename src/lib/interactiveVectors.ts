/**
 * Schéma vectoriel manipulable : deux vecteurs $\vec{u}$, $\vec{v}$ tracés
 * depuis une origine fixe, dont on peut glisser la pointe — le produit
 * scalaire, les normes, l'angle (et la projection, en option) se recalculent
 * en direct. Placeholder généré par l'IA :
 *   <div class="course-interactive-vectors" data-ox="150" data-oy="150"
 *        data-ux="220" data-uy="80" data-vx="260" data-vy="150"
 *        data-ulabel="u" data-vlabel="v" data-show-projection="true"
 *        data-caption="Fais glisser u et v."></div>
 */

export interface InteractiveVectorConfig {
  viewBox: string;
  ox: number;
  oy: number;
  ux: number;
  uy: number;
  vx: number;
  vy: number;
  ulabel: string;
  vlabel: string;
  showProjection: boolean;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  if (!isFinite(n)) return "0";
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
}

function parseConfigFromPlaceholder(match: string): InteractiveVectorConfig | null {
  const attr = (name: string) => {
    const m = match.match(new RegExp(`data-${name}="([^"]*)"`));
    return m ? m[1] : null;
  };
  const viewBox = attr("viewbox") || "0 0 300 200";
  const ox = parseFloat(attr("ox") || "150");
  const oy = parseFloat(attr("oy") || "150");
  const ux = parseFloat(attr("ux") || "220");
  const uy = parseFloat(attr("uy") || "80");
  const vx = parseFloat(attr("vx") || "260");
  const vy = parseFloat(attr("vy") || "150");
  if ([ox, oy, ux, uy, vx, vy].some((n) => !isFinite(n))) return null;
  return {
    viewBox,
    ox, oy, ux, uy, vx, vy,
    ulabel: (attr("ulabel") || "u").replace(/"/g, ""),
    vlabel: (attr("vlabel") || "v").replace(/"/g, ""),
    showProjection: attr("show-projection") === "true",
  };
}

/** Calcule le produit scalaire, les normes, l'angle et (en option) la
 * projection de u sur v, à partir des coordonnées brutes de l'origine et
 * des deux pointes. Ces formules sont invariantes par réflexion d'axe : pas
 * besoin de convertir le repère écran (y vers le bas) en repère mathématique. */
export function computeVectorDerived(cfg: InteractiveVectorConfig) {
  const dux = cfg.ux - cfg.ox, duy = cfg.uy - cfg.oy;
  const dvx = cfg.vx - cfg.ox, dvy = cfg.vy - cfg.oy;
  const dot = dux * dvx + duy * dvy;
  const normU = Math.hypot(dux, duy);
  const normV = Math.hypot(dvx, dvy);
  let angleDeg = 0;
  if (normU > 1e-6 && normV > 1e-6) {
    const cos = Math.min(1, Math.max(-1, dot / (normU * normV)));
    angleDeg = (Math.acos(cos) * 180) / Math.PI;
  }
  let proj: { x: number; y: number } | null = null;
  if (cfg.showProjection && normV > 1e-6) {
    const k = dot / (normV * normV);
    proj = { x: cfg.ox + k * dvx, y: cfg.oy + k * dvy };
  }
  return { dux, duy, dvx, dvy, dot, normU, normV, angleDeg, proj };
}

function labelOffset(dx: number, dy: number, norm: number) {
  if (norm < 1e-6) return { x: 0, y: -10 };
  return { x: (dx / norm) * 16, y: (dy / norm) * 16 };
}

function buildMarkup(cfg: InteractiveVectorConfig): string {
  const d = computeVectorDerived(cfg);
  const uOff = labelOffset(d.dux, d.duy, d.normU);
  const vOff = labelOffset(d.dvx, d.dvy, d.normV);

  const projLine = d.proj
    ? `<line class="iv-proj" x1="${cfg.ox}" y1="${cfg.oy}" x2="${d.proj.x.toFixed(2)}" y2="${d.proj.y.toFixed(2)}" />`
    : "";

  const svg = `<svg class="iv-svg" viewBox="${escXml(cfg.viewBox)}" xmlns="http://www.w3.org/2000/svg" data-config='${JSON.stringify(cfg).replace(/'/g, "&apos;")}'>
    <defs>
      <marker id="iv-arrow-u" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" class="iv-arrowhead iv-arrowhead-u" /></marker>
      <marker id="iv-arrow-v" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" class="iv-arrowhead iv-arrowhead-v" /></marker>
    </defs>
    <g class="iv-proj-group">${projLine}</g>
    <line class="iv-vec iv-vec-v" x1="${cfg.ox}" y1="${cfg.oy}" x2="${cfg.vx}" y2="${cfg.vy}" marker-end="url(#iv-arrow-v)" />
    <line class="iv-vec iv-vec-u" x1="${cfg.ox}" y1="${cfg.oy}" x2="${cfg.ux}" y2="${cfg.uy}" marker-end="url(#iv-arrow-u)" />
    <circle class="iv-origin" cx="${cfg.ox}" cy="${cfg.oy}" r="3" />
    <text class="iv-label iv-label-u" x="${(cfg.ux + uOff.x).toFixed(2)}" y="${(cfg.uy + uOff.y).toFixed(2)}">${escXml(cfg.ulabel)}</text>
    <text class="iv-label iv-label-v" x="${(cfg.vx + vOff.x).toFixed(2)}" y="${(cfg.vy + vOff.y).toFixed(2)}">${escXml(cfg.vlabel)}</text>
    <circle class="iv-handle iv-handle-u" data-vec="u" cx="${cfg.ux}" cy="${cfg.uy}" r="8" />
    <circle class="iv-handle iv-handle-v" data-vec="v" cx="${cfg.vx}" cy="${cfg.vy}" r="8" />
  </svg>`;

  const panel = `<div class="iv-panel">
    <span>${escXml(cfg.ulabel)}&middot;${escXml(cfg.vlabel)} = ${fmt(d.dot)}</span>
    <span>&Vert;${escXml(cfg.ulabel)}&Vert; = ${fmt(d.normU)}</span>
    <span>&Vert;${escXml(cfg.vlabel)}&Vert; = ${fmt(d.normV)}</span>
    <span>&theta; = ${fmt(d.angleDeg)}&deg;</span>
  </div>`;

  const resetButton = `<button type="button" class="iv-reset-btn">Réinitialiser</button>`;

  return svg + panel + resetButton;
}

/** Remplace les placeholders <div class="course-interactive-vectors" ...></div>
 * par le schéma manipulable. */
export function renderInteractiveVectorPlaceholders(html: string): string {
  if (!html || !html.includes("course-interactive-vectors")) return html;

  return html.replace(
    /<div[^>]*class="[^"]*course-interactive-vectors[^"]*"[^>]*>\s*<\/div>/g,
    (match) => {
      const cfg = parseConfigFromPlaceholder(match);
      if (!cfg) return "";
      const captionMatch = match.match(/data-caption="([^"]*)"/);
      const caption = captionMatch
        ? captionMatch[1]
        : `Fais glisser ${cfg.ulabel} et ${cfg.vlabel}.`;
      return (
        `<figure class="course-figure course-interactive-vectors-figure">` +
        `${buildMarkup(cfg)}<figcaption>${escXml(caption)}</figcaption></figure>`
      );
    },
  );
}

function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/** Câble le glisser-déposer des deux pointes de vecteur et le recalcul en
 * direct du panneau (produit scalaire, normes, angle, projection). */
export function enhanceInteractiveVectors(root: ParentNode | null | undefined) {
  if (!root || typeof window === "undefined") return;

  root.querySelectorAll<SVGSVGElement>(".iv-svg").forEach((svg) => {
    if (svg.dataset.enhanced) return;
    svg.dataset.enhanced = "1";

    let cfg: InteractiveVectorConfig;
    try {
      cfg = JSON.parse(svg.dataset.config || "{}");
    } catch {
      return;
    }
    const initialCfg: InteractiveVectorConfig = { ...cfg };

    const viewBoxParts = cfg.viewBox.split(/\s+/).map(Number);
    const [vbX, vbY, vbW, vbH] = viewBoxParts.length === 4 ? viewBoxParts : [0, 0, 300, 200];
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

    const vecU = svg.querySelector<SVGLineElement>(".iv-vec-u")!;
    const vecV = svg.querySelector<SVGLineElement>(".iv-vec-v")!;
    const handleU = svg.querySelector<SVGCircleElement>(".iv-handle-u")!;
    const handleV = svg.querySelector<SVGCircleElement>(".iv-handle-v")!;
    const labelU = svg.querySelector<SVGTextElement>(".iv-label-u")!;
    const labelV = svg.querySelector<SVGTextElement>(".iv-label-v")!;
    const projGroup = svg.querySelector<SVGGElement>(".iv-proj-group")!;
    const panel = svg.parentElement?.querySelector<HTMLElement>(".iv-panel");
    if (!vecU || !vecV || !handleU || !handleV || !labelU || !labelV) return;

    const redraw = () => {
      const d = computeVectorDerived(cfg);
      vecU.setAttribute("x2", String(cfg.ux));
      vecU.setAttribute("y2", String(cfg.uy));
      vecV.setAttribute("x2", String(cfg.vx));
      vecV.setAttribute("y2", String(cfg.vy));
      handleU.setAttribute("cx", String(cfg.ux));
      handleU.setAttribute("cy", String(cfg.uy));
      handleV.setAttribute("cx", String(cfg.vx));
      handleV.setAttribute("cy", String(cfg.vy));
      const uOff = labelOffset(d.dux, d.duy, d.normU);
      const vOff = labelOffset(d.dvx, d.dvy, d.normV);
      labelU.setAttribute("x", (cfg.ux + uOff.x).toFixed(2));
      labelU.setAttribute("y", (cfg.uy + uOff.y).toFixed(2));
      labelV.setAttribute("x", (cfg.vx + vOff.x).toFixed(2));
      labelV.setAttribute("y", (cfg.vy + vOff.y).toFixed(2));
      projGroup.innerHTML = d.proj
        ? `<line class="iv-proj" x1="${cfg.ox}" y1="${cfg.oy}" x2="${d.proj.x.toFixed(2)}" y2="${d.proj.y.toFixed(2)}" />`
        : "";
      if (panel) {
        const spans = panel.querySelectorAll("span");
        if (spans[0]) spans[0].textContent = `${cfg.ulabel}·${cfg.vlabel} = ${fmt(d.dot)}`;
        if (spans[1]) spans[1].textContent = `‖${cfg.ulabel}‖ = ${fmt(d.normU)}`;
        if (spans[2]) spans[2].textContent = `‖${cfg.vlabel}‖ = ${fmt(d.normV)}`;
        if (spans[3]) spans[3].textContent = `θ = ${fmt(d.angleDeg)}°`;
      }
    };

    [handleU, handleV].forEach((handle) => {
      const key = handle.dataset.vec as "u" | "v";
      let dragging = false;

      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const p = toSvgPoint(svg, e.clientX, e.clientY);
        cfg[`${key}x`] = clamp(p.x, vbX, vbX + vbW);
        cfg[`${key}y`] = clamp(p.y, vbY, vbY + vbH);
        redraw();
      };
      const onUp = (e: PointerEvent) => {
        dragging = false;
        handle.releasePointerCapture(e.pointerId);
      };

      handle.addEventListener("pointerdown", (e) => {
        dragging = true;
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });

    svg.style.touchAction = "none";

    const resetButton = svg.parentElement?.querySelector<HTMLButtonElement>(".iv-reset-btn");
    resetButton?.addEventListener("click", () => {
      cfg.ux = initialCfg.ux;
      cfg.uy = initialCfg.uy;
      cfg.vx = initialCfg.vx;
      cfg.vy = initialCfg.vy;
      redraw();
    });
  });
}
