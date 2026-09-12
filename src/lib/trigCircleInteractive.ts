/**
 * Cercle trigonométrique interactif : un point mobile (poignée dorée) se
 * déplace sur le cercle, avec le rayon, les projections cos/sin en pointillés
 * et une lecture « θ° · cos · sin ». Le tracé statique (cercle, axes, angles
 * remarquables) reste celui compilé côté serveur. Vanilla DOM, idempotent.
 */

const NS = "http://www.w3.org/2000/svg";

function wire(figure: HTMLElement) {
  const svg = figure.querySelector<SVGSVGElement>("svg.tc-svg");
  const live = svg?.querySelector<SVGGElement>(".tc-live");
  const readout = figure.querySelector<HTMLElement>(".tc-angle-value");
  if (!svg || !live || svg.dataset.wired) return;
  svg.dataset.wired = "1";

  const cx = Number(svg.dataset.cx ?? "114");
  const cy = Number(svg.dataset.cy ?? "114");
  const r = Number(svg.dataset.r ?? "84");

  const mk = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  const cosLine = mk("line", { stroke: "#2563eb", "stroke-width": "1.2", "stroke-dasharray": "4 3" });
  const sinLine = mk("line", { stroke: "#15803d", "stroke-width": "1.2", "stroke-dasharray": "4 3" });
  const radius = mk("line", { stroke: "#c89f36", "stroke-width": "1.6" });
  const handle = mk("circle", { r: "5.5", fill: "#c89f36", stroke: "#ffffff", "stroke-width": "1.5", style: "cursor:grab" });
  live.append(cosLine, sinLine, radius, handle);

  const render = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    const px = cx + r * Math.cos(rad);
    const py = cy - r * Math.sin(rad);
    radius.setAttribute("x1", String(cx));
    radius.setAttribute("y1", String(cy));
    radius.setAttribute("x2", px.toFixed(1));
    radius.setAttribute("y2", py.toFixed(1));
    cosLine.setAttribute("x1", px.toFixed(1));
    cosLine.setAttribute("y1", py.toFixed(1));
    cosLine.setAttribute("x2", px.toFixed(1));
    cosLine.setAttribute("y2", String(cy));
    sinLine.setAttribute("x1", px.toFixed(1));
    sinLine.setAttribute("y1", py.toFixed(1));
    sinLine.setAttribute("x2", String(cx));
    sinLine.setAttribute("y2", py.toFixed(1));
    handle.setAttribute("cx", px.toFixed(1));
    handle.setAttribute("cy", py.toFixed(1));
    if (readout) {
      readout.textContent = `${Math.round(((deg % 360) + 360) % 360)}° · cos ${Math.cos(rad).toFixed(2)} · sin ${Math.sin(rad).toFixed(2)}`;
    }
  };

  let dragging = false;
  const angleAt = (ev: PointerEvent) => {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const x = ((ev.clientX - rect.left) / rect.width) * vb.width - cx;
    const y = ((ev.clientY - rect.top) / rect.height) * vb.height - cy;
    return (Math.atan2(-y, x) * 180) / Math.PI;
  };
  const move = (ev: PointerEvent) => {
    if (!dragging) return;
    ev.preventDefault();
    render(angleAt(ev));
  };
  handle.addEventListener("pointerdown", (ev) => {
    dragging = true;
    handle.setAttribute("style", "cursor:grabbing");
    (ev.target as Element).setPointerCapture?.((ev as PointerEvent).pointerId);
  });
  svg.addEventListener("pointerdown", (ev) => {
    // clic ailleurs sur le cercle = déplacer le point là
    dragging = true;
    render(angleAt(ev as PointerEvent));
  });
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", () => {
    dragging = false;
    handle.setAttribute("style", "cursor:grab");
  });
  svg.style.touchAction = "none";

  render(Number(svg.dataset.angle ?? "45"));
}

export function enhanceTrigCircles(root: ParentNode | null | undefined) {
  if (!root || typeof window === "undefined") return;
  root.querySelectorAll<HTMLElement>(".course-figure-trig-circle").forEach(wire);
}
