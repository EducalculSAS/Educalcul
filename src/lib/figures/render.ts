import type { EduFig } from "@/lib/figures/types";
import { renderGeometry } from "@/lib/figures/renderGeometry";
import { renderBar, renderGraph, renderLineChart, renderNumberLine, renderPie, renderProgram, renderSolid, renderTree } from "@/lib/figures/renderOther";
import { normalizeEduFig } from "@/lib/figures/normalize";
import { esc } from "@/lib/figures/svg";

/** Le dessin SVG d'une figure, et les problèmes relevés en la construisant (triangle impossible, point inconnu…). */
export function renderEduFig(fig: EduFig): { svg: string; errors: string[] } {
  switch (fig.kind) {
    case "geometry": { const r = renderGeometry(fig); return { svg: r.svg, errors: r.errors }; }
    case "graph": return renderGraph(fig);
    case "numberline": return renderNumberLine(fig);
    case "bar": return renderBar(fig);
    case "pie": return renderPie(fig);
    case "linechart": return renderLineChart(fig);
    case "tree": return renderTree(fig);
    case "solid": return renderSolid(fig);
    case "program": return renderProgram(fig);
  }
}

/** Description rangée dans l'attribut : JSON, caractères spéciaux du HTML échappés. */
export function encodeFigAttr(fig: EduFig): string {
  return JSON.stringify(fig).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
}

export function decodeFigAttr(value: string | null | undefined): EduFig | null {
  if (!value) return null;
  const json = value.includes("&quot;") || value.includes("&amp;")
    ? value.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    : value;
  return normalizeEduFig(json).fig;
}

/**
 * La figure prête à ranger dans un contenu : description + dessin + légende. Le dessin est déjà là pour un affichage
 * immédiat (et hors du site) ; dans le site, il est redessiné à partir de la description avec le style du moment.
 */
export function eduFigHtml(fig: EduFig): string {
  const { svg } = renderEduFig(fig);
  const caption = fig.caption ? `<figcaption>${esc(fig.caption)}</figcaption>` : "";
  return `<figure class="edu-fig" data-size="${fig.size ?? "m"}" data-edufig="${encodeFigAttr(fig)}">${svg}${caption}</figure>`;
}

export const EDUFIG_RE = /<figure class="edu-fig"[^>]*\sdata-edufig="([^"]*)"[^>]*>[\s\S]*?<\/figure>/g;

/** Toutes les figures d'un contenu HTML, avec leur position (pour les modifier dans l'admin). */
export function findEduFigs(html: string): { html: string; fig: EduFig; index: number }[] {
  const out: { html: string; fig: EduFig; index: number }[] = [];
  for (const m of html.matchAll(EDUFIG_RE)) {
    const fig = decodeFigAttr(m[1]);
    if (fig) out.push({ html: m[0], fig, index: m.index ?? 0 });
  }
  return out;
}

/** Redessine toutes les figures d'un contenu (après un changement de moteur ou de style). */
export function rerenderEduFigs(html: string): string {
  return html.replace(EDUFIG_RE, (whole, attr: string) => {
    const fig = decodeFigAttr(attr);
    return fig ? eduFigHtml(fig) : whole;
  });
}
