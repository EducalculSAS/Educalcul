

export const HIGHLIGHT_CLASS = "calia-scene-highlight";

// Élève silencieux : Calia continue le cours après SILENCE_MS, et la séance se met en pause après MAX_SILENT_TURNS relances sans réponse.
export const SILENCE_MS = 5000;

export const MAX_SILENT_TURNS = 5;

export const OUTLINE_SELECTORS: Record<OutlineKind, string> = {
  heading: "h3, h4",
  // Un encadré (définition, remarque) est UNE étape du cours, pas un paragraphe par ligne.
  paragraph: "p, .course-definition, blockquote.course-callout",
  figure: ".course-figure",
  exercise: "[data-mini-exercise]",
  // Cibles fines : Calia pointe la formule, la ligne du tableau ou l'élément de
  // liste dont elle parle plutôt que tout le bloc qui les contient.
  formula: ".katex-display",
  item: "li",
  row: "tr",
};

// Plafond par type : le plan de la leçon envoyé à chaque tour reste court.
export const OUTLINE_MAX_PER_KIND = 30;

export const OUTLINE_PREVIEW_CHARS: Record<OutlineKind, number> = {
  heading: 160, paragraph: 500, figure: 500, exercise: 500, formula: 160, item: 240, row: 200,
};


export type OutlineKind = "heading" | "paragraph" | "figure" | "exercise" | "formula" | "item" | "row";

export interface OutlineItem { kind: OutlineKind; index: number; preview: string; el: HTMLElement; visible: boolean }


export interface TurnAction {
  atSentence?: number;
  kind: "highlight" | "scroll_to" | "point_at" | "board_write" | "board_clear" | "ask_student_to_write" | "next_lesson" | "prev_lesson" | "goto_lesson";
  targetKind: OutlineKind | null;
  targetIndex: number | null;
  latex: string | null;
  label: string | null;
}

export interface TurnResult { say: string; actions?: TurnAction[]; action?: TurnAction | null }

export interface HistoryMsg { role: "user" | "assistant"; content: string }

export interface CaliaCourseContext {
  courseId?: number | string | null;
  courseTitle: string;
  level?: string | null;
  lessons: { title: string; current: boolean; summary?: string; exercises: { question: string; hint?: string | null; answer: string }[] }[];
}




/**
 * Découpe une réplique de Calia en morceaux à synthétiser séparément.
 *
 * Azure ne rend le son qu'une fois la synthèse de TOUT le texte envoyé bien
 * avancée : une réplique de trois phrases mettait ~1,5 à 2 s, contre ~0,5 s
 * pour sa première phrase seule. En synthétisant phrase par phrase, la voix
 * démarre dès la première. Les morceaux trop courts (« Bravo ! ») sont
 * rattachés au suivant : une phrase isolée de deux mots sonne haché.
 */
export function splitForSpeech(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+(?=\S)/);
  const chunks: string[] = [];
  let pending = "";
  for (const sentence of sentences) {
    pending = pending ? `${pending} ${sentence}` : sentence;
    if (pending.length >= 20) {
      chunks.push(pending);
      pending = "";
    }
  }
  if (pending) {
    if (chunks.length) chunks[chunks.length - 1] += ` ${pending}`;
    else chunks.push(pending);
  }
  // La route plafonne chaque synthèse à 400 caractères.
  return chunks.flatMap((c) => (c.length <= 400 ? [c] : c.match(/.{1,400}(\s|$)/g) ?? [c]));
}


/** Signature stable d'une figure (même contenu = même description réutilisée). */
export function figureSignature(el: HTMLElement): string {
  const html = el.innerHTML;
  let h = 0;
  for (let i = 0; i < html.length; i++) h = (Math.imul(31, h) + html.charCodeAt(i)) | 0;
  return `${html.length}:${h}`;
}


/** Ce qu'on peut lire d'une figure sans vision : légende, titre/desc du SVG, alt, textes. */
export function figureTextHints(el: HTMLElement): string {
  const parts = [
    el.querySelector("figcaption")?.textContent,
    el.querySelector("svg > title")?.textContent,
    el.querySelector("svg > desc")?.textContent,
    el.querySelector("svg")?.getAttribute("aria-label"),
    el.querySelector("img")?.getAttribute("alt"),
  ];
  return parts.map((p) => (p || "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" | ");
}


export function inViewport(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.bottom > 80 && r.top < window.innerHeight - 40 && r.right > 0 && r.left < window.innerWidth;
}


/**
 * Texte lisible d'un élément du cours. KaTeX écrit chaque formule trois fois dans le DOM (rendu visuel, MathML et
 * source TeX) : `textContent` donnait « x2x2x^2 ». On remplace chaque formule par sa source TeX entre `$…$`, que
 * Calia sait dire à voix haute.
 */
export function readableText(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".katex-display, .katex").forEach((k) => {
    if (!clone.contains(k)) return; // formule déjà remplacée avec son bloc d'affichage
    const tex = k.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
    k.replaceWith(document.createTextNode(tex ? ` $${tex}$ ` : " "));
  });
  clone.querySelectorAll("script, style, button, .course-definition-badge, [aria-hidden='true']").forEach((n) => n.remove());
  // textContent recolle les blocs (« À retenirUn polynôme ») : une espace après chaque bloc les sépare.
  clone.querySelectorAll("p, li, div, tr, td, th, br, h3, h4, blockquote, figcaption").forEach((n) => n.append(" "));
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
}


// Unités du « fil du cours » : ce que Calia explique, dans l'ordre de lecture.
export const SCRIPT_CONTAINERS: OutlineKind[] = ["paragraph", "figure", "exercise", "item", "row"];

export const SCRIPT_CHARS = 900;

export interface ScriptUnit { kind: OutlineKind; index: number; text: string; visible: boolean; el: HTMLElement }


/**
 * La leçon affichée, DANS L'ORDRE DE LECTURE (titre, paragraphe, formule, figure…), sans doublon : un élément contenu
 * dans un autre (un paragraphe dans un mini-exercice, une formule dans un paragraphe) n'est pas une étape à part.
 * Avant, le plan était envoyé trié par TYPE (tous les titres, puis tous les paragraphes…) : Calia ne pouvait pas
 * suivre le cours dans l'ordre.
 */
export function buildScript(items: OutlineItem[]): ScriptUnit[] {
  const containers = items.filter((o) => SCRIPT_CONTAINERS.includes(o.kind));
  return items
    .filter((o) => !containers.some((c) => c !== o && c.el !== o.el && c.el.contains(o.el)))
    .sort((a, b) => (a.el === b.el ? 0 : a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((o) => ({
      kind: o.kind,
      index: o.index,
      el: o.el,
      visible: o.visible,
      // Les figures gardent leur description (vision) ; le reste est relu en texte propre.
      text: o.kind === "figure" ? o.preview : readableText(o.el).slice(0, SCRIPT_CHARS),
    }))
    .filter((u) => u.text);
}


export function buildOutline(root: HTMLElement | null, figureDescs?: Map<string, string>): OutlineItem[] {
  if (!root) return [];
  const items: OutlineItem[] = [];
  (Object.keys(OUTLINE_SELECTORS) as OutlineKind[]).forEach((kind) => {
    const els = root.querySelectorAll<HTMLElement>(OUTLINE_SELECTORS[kind]);
    let kept = 0;
    els.forEach((el, index) => {
      // Élément invisible (masqué, replié, vide) : jamais proposé à Calia —
      // elle pointait sinon des zones vides.
      if (!el.offsetParent || el.getBoundingClientRect().height < 4) return;
      if (kept >= OUTLINE_MAX_PER_KIND) return;
      const text = readableText(el).slice(0, OUTLINE_PREVIEW_CHARS[kind]);
      let preview = text;
      if (kind === "figure") {
        // Vision : description de l'image (modèle de vision) + légende, même sans texte dans la figure.
        const seen = figureDescs?.get(figureSignature(el));
        preview = [seen ? `Image : ${seen}` : "", figureTextHints(el), text].filter(Boolean).join(" | ").slice(0, 700)
          || "Image sans texte (description en cours)";
      }
      if (!preview) return;
      kept += 1;
      items.push({ kind, index, preview, el, visible: inViewport(el) });
    });
  });
  return items;
}


/** Retire les codes internes (« [point_at#1] », noms de gestes) que le modèle recopie parfois dans sa parole. */
export function cleanSpokenText(text: string): string {
  return text
    .replace(/\[[^\]\n]{0,40}#\d+\]/g, " ")
    .replace(/\b(?:point_at|highlight|scroll_to|board_write|board_clear|next_lesson|prev_lesson|goto_lesson|ask_student_to_write)\b(?:#\d+)?/gi, " ")
    .replace(/\b(?:heading|paragraph|figure|exercise|formula|item|row)#\d+\b/gi, " ")
    .replace(/[*`]+/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}


/**
 * Convertit une figure du cours en image (JPEG base64) pour le modèle de vision.
 * SVG : styles calculés recopiés en ligne (les classes CSS du site ne s'appliquent
 * pas dans une image SVG isolée). <img> de même origine : dessinée telle quelle.
 * Renvoie null si la figure n'est pas convertible (figure interactive en HTML).
 */
export async function figureToDataUrl(el: HTMLElement): Promise<string | null> {
  try {
    const svg = el.querySelector("svg");
    const img = el.querySelector("img");
    const source = svg ?? img;
    if (!source) return null;
    const rect = source.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return null;
    const width = Math.min(720, Math.max(240, Math.round(rect.width)));
    const height = Math.max(40, Math.round((rect.height * width) / rect.width));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    let image: HTMLImageElement;
    if (svg) {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      const srcNodes = [svg, ...Array.from(svg.querySelectorAll("*"))];
      const dstNodes = [clone, ...Array.from(clone.querySelectorAll("*"))];
      const props = ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "font-size", "font-family", "font-weight", "text-anchor"];
      srcNodes.forEach((node, i) => {
        const dst = dstNodes[i] as SVGElement | undefined;
        if (!dst) return;
        const cs = getComputedStyle(node);
        dst.setAttribute("style", `${dst.getAttribute("style") || ""};${props.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";")}`);
      });
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${Math.round(rect.width)} ${Math.round(rect.height)}`);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
      image = new window.Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("svg"));
        image.src = url;
      }).finally(() => URL.revokeObjectURL(url));
    } else {
      image = img as HTMLImageElement;
      if (!image.complete || !image.naturalWidth) return null;
    }
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    // Image d'une autre origine (canvas « teinté ») ou SVG illisible : pas de description par vision.
    return null;
  }
}


export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
