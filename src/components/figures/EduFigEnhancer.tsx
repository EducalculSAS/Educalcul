"use client";

import { useEffect } from "react";
import { decodeFigAttr, renderEduFig } from "@/lib/figures/render";
import type { EduFig, GeometryFig } from "@/lib/figures/types";

/**
 * Redessine les figures EduFig de la page à partir de leur description : un changement de style ou de moteur
 * s'applique ainsi à tout le contenu déjà enregistré. Les figures « interactive » deviennent manipulables : on déplace
 * leurs points libres à la souris ou au doigt, et tout ce qui en dépend (images, milieux, mesures) suit.
 * Monté une seule fois à la racine.
 */
type FreePoint = Extract<GeometryFig["steps"][number], { op: "point" }>;

function frameOf(svg: SVGSVGElement) {
  const f = (svg.getAttribute("data-ef-frame") || "").split(" ").map(Number);
  if (f.length !== 6 || f.some((x) => !Number.isFinite(x))) return null;
  const [minX, minY, s, offX, offY, H] = f;
  return {
    toScreen: (x: number, y: number) => ({ x: offX + (x - minX) * s, y: H - offY - (y - minY) * s }),
    toFig: (X: number, Y: number) => ({ x: minX + (X - offX) / s, y: minY + (H - offY - Y) / s }),
  };
}

function pointerInSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const vb = svg.viewBox.baseVal, rect = svg.getBoundingClientRect();
  return { x: vb.x + ((clientX - rect.left) / rect.width) * vb.width, y: vb.y + ((clientY - rect.top) / rect.height) * vb.height };
}

function wire(el: HTMLElement, initial: EduFig) {
  let fig = initial;
  let frame: ReturnType<typeof frameOf> = null;

  const draw = () => {
    const tpl = document.createElement("template");
    tpl.innerHTML = renderEduFig(fig).svg;
    const next = tpl.content.firstElementChild as SVGSVGElement | null;
    if (!next) return;
    const current = el.querySelector<SVGSVGElement>(":scope > svg");
    if (current) {
      // Même élément conservé : le geste en cours (capture du pointeur) n'est pas interrompu.
      for (const attr of ["viewBox", "data-ef-frame", "aria-label"]) {
        const v = next.getAttribute(attr);
        if (v === null) current.removeAttribute(attr); else current.setAttribute(attr, v);
      }
      current.innerHTML = next.innerHTML;
      frame = frameOf(current);
    } else {
      el.prepend(next);
      frame = frameOf(next);
    }
  };
  draw();

  if (!(fig.interactive && fig.kind === "geometry")) return;
  const freePoints = () => (fig as GeometryFig).steps.filter((s): s is FreePoint => s.op === "point" && !!s.free);
  if (!freePoints().length) return;

  let dragging: string | null = null;
  el.addEventListener("pointerdown", (e) => {
    const svg = el.querySelector<SVGSVGElement>(":scope > svg");
    if (!svg || !frame) return;
    const at = pointerInSvg(svg, e.clientX, e.clientY);
    let best: string | null = null, bestD = 26;
    for (const p of freePoints()) {
      const q = frame.toScreen(p.x, p.y);
      const d = Math.hypot(q.x - at.x, q.y - at.y);
      if (d < bestD) { best = p.name; bestD = d; }
    }
    if (!best) return;
    dragging = best;
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => {
    const svg = el.querySelector<SVGSVGElement>(":scope > svg");
    if (!svg || !frame) return;
    const at = pointerInSvg(svg, e.clientX, e.clientY);
    if (!dragging) {
      // Curseur « main » au survol d'un point libre.
      const near = freePoints().some((p) => { const q = frame!.toScreen(p.x, p.y); return Math.hypot(q.x - at.x, q.y - at.y) < 26; });
      svg.style.cursor = near ? "grab" : "";
      return;
    }
    const target = frame.toFig(at.x, at.y);
    const name = dragging;
    const geo = fig as GeometryFig;
    // Arrondi au dixième : les mesures affichées restent lisibles.
    fig = { ...geo, steps: geo.steps.map((s) => (s.op === "point" && s.name === name ? { ...s, x: Math.round(target.x * 10) / 10, y: Math.round(target.y * 10) / 10 } : s)) };
    draw();
  });
  const stop = () => { dragging = null; };
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);
}

export default function EduFigEnhancer() {
  useEffect(() => {
    let scheduled = false;
    const scan = () => {
      scheduled = false;
      document.querySelectorAll<HTMLElement>("figure.edu-fig[data-edufig]:not([data-ef-wired])").forEach((el) => {
        el.setAttribute("data-ef-wired", "1");
        const fig = decodeFigAttr(el.getAttribute("data-edufig"));
        if (!fig) return;
        if (fig.interactive) el.setAttribute("data-interactive", "");
        try { wire(el, fig); } catch (error) { console.warn("[edufig]", error); }
      });
    };
    const schedule = () => { if (!scheduled) { scheduled = true; window.setTimeout(scan, 30); } };
    const observer = new MutationObserver((records) => {
      if (records.some((r) => !(r.target instanceof Element && r.target.closest("figure.edu-fig")))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => observer.disconnect();
  }, []);
  return null;
}
