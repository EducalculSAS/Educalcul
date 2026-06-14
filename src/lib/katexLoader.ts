"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import DOMPurify from "dompurify";

/**
 * Nettoie le HTML avant injection (anti-XSS) tout en conservant le rendu KaTeX,
 * les graphiques SVG et la mise en forme du cours.
 * - Client : DOMPurify (autorise HTML + SVG + MathML, retire scripts, on*, javascript:).
 * - SSR (pas de DOM) : repli minimal retirant les vecteurs principaux ; le client re-nettoie.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window !== "undefined" && (DOMPurify as any)?.sanitize) {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
      ADD_ATTR: ["target"],
    });
  }
  return html
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

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
  result = result.replace(/\\\(([\s\S]+?)\\\)/g, (match, math) => {
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

  // Nettoyage anti-XSS après le rendu LaTeX (conserve KaTeX/SVG/MathML).
  return sanitizeHtml(result);
}

// Fonctions gardées pour compatibilité (no-op)
export function ensureKaTeX(): Promise<void> { return Promise.resolve(); }
export function renderKaTeX(_container: HTMLElement | null) { /* no-op — utilise renderLatexInHTML */ }
export function renderKaTeXAsync(_container: HTMLElement | null): Promise<void> { return Promise.resolve(); }
