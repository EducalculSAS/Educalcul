"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import DOMPurify from "dompurify";
import { sanitizeHtmlServer } from "@/lib/htmlSanitizeServer";
import { mathToReadableText, normalizeStructuredLatex } from "@/lib/ai/structuredContent";

/**
 * Renderer strict du nouveau pipeline. Il ne tente plus de reconstruire un
 * document HTML/LaTeX corrompu : les seules formules stockées sont celles que
 * le serveur a déjà validées avec KaTeX. Le repli reste cependant sûr pour les
 * feedbacks IA ou les modifications manuelles.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window !== "undefined" && "sanitize" in DOMPurify) {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
      ADD_ATTR: [
        "target",
        "data-function",
        "data-xmin",
        "data-xmax",
        "data-param",
        "data-param-min",
        "data-param-max",
        "data-param-default",
        "data-caption",
        "data-vectors",
        "data-exercise-id",
        "data-ox",
        "data-oy",
        "data-ux",
        "data-uy",
        "data-vx",
        "data-vy",
        "data-ulabel",
        "data-vlabel",
        "data-show-projection",
      ],
      ADD_TAGS: ["semantics", "annotation"],
    });
  }
  // Rendu serveur (pas de navigateur pour DOMPurify) : liste de tags et d'attributs autorisés, voir htmlSanitizeServer.ts.
  return sanitizeHtmlServer(html);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeRenderMath(source: string, displayMode: boolean): string {
  const latex = normalizeStructuredLatex(source);
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      strict: false,
      output: "htmlAndMathml",
    });
  } catch {
    const readable = mathToReadableText(latex) || "Formule mathématique";
    const tag = displayMode ? "div" : "span";
    const css = displayMode
      ? "katex-fallback katex-fallback-display"
      : "katex-fallback";
    return `<${tag} class="${css}">${escapeHtml(readable)}</${tag}>`;
  }
}

/**
 * Rend les délimiteurs produits par le compilateur déterministe. Les
 * placeholders empêchent les expressions régulières suivantes de retraverser
 * le HTML généré par KaTeX.
 */
export function renderLatexInHTML(html: string): string {
  if (!html) return html;

  const rendered: string[] = [];
  const protect = (value: string): string => {
    const token = `@@EDUCALCUL_KATEX_${rendered.length}@@`;
    rendered.push(value);
    return token;
  };

  let result = String(html);
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math: string) =>
    protect(safeRenderMath(math, true)),
  );
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math: string) =>
    protect(safeRenderMath(math, true)),
  );
  result = result.replace(/\$([^$\r\n]+?)\$/g, (_match, math: string) =>
    protect(safeRenderMath(math, false)),
  );
  result = result.replace(/\\\(([^\r\n]*?)\\\)/g, (_match, math: string) =>
    protect(safeRenderMath(math, false)),
  );

  // Un délimiteur isolé ne doit jamais être visible, même après une édition
  // manuelle. On ne tente pas de le réparer : on le supprime simplement.
  result = result.replace(/\$\$?|\\\[|\\\]|\\\(|\\\)/g, "");

  rendered.forEach((value, index) => {
    result = result.split(`@@EDUCALCUL_KATEX_${index}@@`).join(value);
  });

  return sanitizeHtml(result);
}

/**
 * Texte saisi par un utilisateur (forum, messages à Calia) → HTML sûr : tout
 * est échappé, SAUF les formules `$…$` / `$$…$$` rendues par KaTeX et le gras
 * `**…**`. Les formules sont repérées AVANT l'échappement : échapper d'abord
 * casserait celles qui contiennent « < » ou « > » (ex. $a<0$).
 * Afficher le résultat dans un conteneur `white-space: pre-wrap`.
 */
export function renderUserText(text: string): string {
  const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return String(text || "")
    .split(/(\$\$[\s\S]*?\$\$|\$[^$\r\n]+?\$)/g)
    .map((part) =>
      /^\$/.test(part)
        ? renderLatexInHTML(part)
        : escapeHtml(part).replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>"),
    )
    .join("");
}

export function ensureKaTeX(): Promise<void> {
  return Promise.resolve();
}

export function renderKaTeX(_container: HTMLElement | null): void {
  void _container;
}

export function renderKaTeXAsync(
  _container: HTMLElement | null,
): Promise<void> {
  void _container;
  return Promise.resolve();
}

let autoRenderPromise: Promise<void> | null = null;

/** Charge le module auto-render installé dans le projet, sans CDN externe. */
export function ensureKatexAutoRenderLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const globalWindow = window as Window & {
    renderMathInElement?: (
      element: HTMLElement,
      options?: Record<string, unknown>,
    ) => void;
  };
  if (typeof globalWindow.renderMathInElement === "function") {
    return Promise.resolve();
  }
  if (autoRenderPromise) return autoRenderPromise;

  autoRenderPromise = import("katex/contrib/auto-render")
    .then((module) => {
      globalWindow.renderMathInElement = module.default;
    })
    .catch((error) => {
      autoRenderPromise = null;
      throw error;
    });
  return autoRenderPromise;
}
