"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Pré-rend tout le LaTeX dans une chaîne HTML avant de l'injecter dans le DOM.
 * Approche la plus fiable : pas de DOM traversal, pas de timing issues.
 */
export function renderLatexInHTML(html: string): string {
  if (!html) return html;

  // 1. Display math : $$...$$
  let result = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return match;
    }
  });

  // 2. Inline math : $...$ (on évite $$...$$ déjà traités)
  result = result.replace(/\$([^\$\r\n]+?)\$/g, (match, math) => {
    if (!math.trim()) return match;
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return match;
    }
  });

  // 3. \(...\) inline
  result = result.replace(/\\\((.+?)\\\)/gs, (match, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch { return match; }
  });

  // 4. \[...\] display
  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (match, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch { return match; }
  });

  return result;
}

// Fonctions gardées pour compatibilité (no-op)
export function ensureKaTeX(): Promise<void> { return Promise.resolve(); }
export function renderKaTeX(_container: HTMLElement | null) { /* no-op — utilise renderLatexInHTML */ }
export function renderKaTeXAsync(_container: HTMLElement | null): Promise<void> { return Promise.resolve(); }
