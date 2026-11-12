import type { FigTone } from "@/lib/figures/types";

/**
 * Briques SVG communes à toutes les figures. Les couleurs passent par des classes (`ef-s-ink`, `ef-f-accent`…) que la
 * feuille de style du site traduit selon le thème clair ou sombre ; l'attribut de couleur écrit à côté n'est qu'un repli
 * pour un affichage hors du site (PDF, e-mail).
 */

export const PALETTE: Record<FigTone, string> = {
  ink: "#0f1e3a",
  accent: "#b8902f",
  blue: "#2563eb",
  green: "#15803d",
  red: "#dc2626",
  gray: "#94a3b8",
};

/** Ordre des couleurs pour les séries et les secteurs. */
export const SERIES: FigTone[] = ["accent", "ink", "blue", "green", "red", "gray"];

export const n = (v: number) => String(Math.round(v * 100) / 100);

export function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Petits raccourcis d'écriture dans les étiquettes : x^2 → x², racine, symboles. */
export function pretty(text: string): string {
  return text
    .replace(/\^2\b/g, "²").replace(/\^3\b/g, "³")
    .replace(/\\?sqrt\(([^)]*)\)/g, "√$1")
    .replace(/\\pi\b/g, "π").replace(/\\alpha\b/g, "α").replace(/\\beta\b/g, "β").replace(/\\theta\b/g, "θ")
    .replace(/\\times/g, "×").replace(/\\div/g, "÷").replace(/<=/g, "≤").replace(/>=/g, "≥")
    .replace(/\$/g, "");
}

export const stroke = (tone: FigTone = "ink", width = 1.8, extra = "") =>
  `class="ef-s-${tone}${extra ? " " + extra : ""}" stroke="${PALETTE[tone]}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;

export const fill = (tone: FigTone = "ink", opacity = 1) =>
  `class="ef-f-${tone}" fill="${PALETTE[tone]}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ""}`;

export const DASH = `stroke-dasharray="6 5"`;

export function text(x: number, y: number, content: string, opts: { tone?: FigTone; size?: number; anchor?: "start" | "middle" | "end"; weight?: number; italic?: boolean; halo?: boolean } = {}): string {
  const tone = opts.tone ?? "ink";
  return `<text x="${n(x)}" y="${n(y)}" class="ef-text ef-t-${tone}${opts.halo === false ? "" : " ef-halo"}" fill="${PALETTE[tone]}" font-size="${opts.size ?? 13}" font-weight="${opts.weight ?? 600}" text-anchor="${opts.anchor ?? "middle"}" dominant-baseline="central"${opts.italic ? ' font-style="italic"' : ""}>${esc(pretty(content))}</text>`;
}

export function line(x1: number, y1: number, x2: number, y2: number, tone: FigTone = "ink", width = 1.8, dashed = false): string {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${stroke(tone, width)}${dashed ? " " + DASH : ""}/>`;
}

/** Pointe de flèche dessinée (pas de <marker> : plusieurs figures sur une page partageraient les mêmes identifiants). */
export function arrowHead(x: number, y: number, fromX: number, fromY: number, tone: FigTone = "ink", size = 9): string {
  const a = Math.atan2(y - fromY, x - fromX);
  const p1 = [x - size * Math.cos(a - 0.4), y - size * Math.sin(a - 0.4)];
  const p2 = [x - size * Math.cos(a + 0.4), y - size * Math.sin(a + 0.4)];
  return `<polygon points="${n(x)},${n(y)} ${n(p1[0])},${n(p1[1])} ${n(p2[0])},${n(p2[1])}" ${fill(tone)}/>`;
}

export function dot(x: number, y: number, tone: FigTone = "ink", r = 3.2): string {
  return `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" ${fill(tone)} class="ef-f-${tone} ef-dot"/>`;
}

/** Ouvre la figure : fond « papier », bord arrondi géré par la feuille de style. */
export function open(width: number, height: number, alt: string): string {
  return `<svg class="ef-svg" viewBox="0 0 ${n(width)} ${n(height)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(alt)}"><rect class="ef-paper" x="0" y="0" width="${n(width)}" height="${n(height)}" rx="14" fill="#ffffff"/>`;
}

export const close = () => "</svg>";

/** Pas « rond » (1, 2, 5, 10…) pour environ `target` graduations. */
export function niceStep(range: number, target = 8): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
}

export function fmt(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r).replace(".", ",");
}

/** Empreinte courte et stable d'une figure (identifiants SVG uniques par figure). */
export function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
