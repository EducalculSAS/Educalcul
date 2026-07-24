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

/**
 * Charge une seule fois (CSS + katex.min.js + auto-render.min.js du CDN) les
 * ressources nécessaires à `window.renderMathInElement`, en les partageant
 * entre tous les composants qui en ont besoin (builders admin). Vérifie la
 * présence des tags avant d'en recréer — sans quoi chaque montage/démontage
 * d'un builder recharge/retire ces scripts, cassant le rendu des AUTRES
 * builders encore montés qui en dépendaient.
 */
let katexAutoRenderPromise: Promise<void> | null = null;

export function ensureKatexAutoRenderLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).renderMathInElement) return Promise.resolve();
  if (katexAutoRenderPromise) return katexAutoRenderPromise;

  katexAutoRenderPromise = new Promise((resolve, reject) => {
    if (!document.getElementById("katex-css")) {
      const link = document.createElement("link");
      link.id = "katex-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
      link.integrity = "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV";
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }

    const loadScript = (id: string, src: string, integrity: string): Promise<void> =>
      new Promise((res, rej) => {
        if (document.getElementById(id)) {
          // Déjà en cours de chargement (ou chargé) par un appel précédent.
          const existing = document.getElementById(id) as HTMLScriptElement;
          existing.addEventListener("load", () => res());
          existing.addEventListener("error", () => rej(new Error(`Failed to load ${src}`)));
          return;
        }
        const script = document.createElement("script");
        script.id = id;
        script.src = src;
        script.integrity = integrity;
        script.crossOrigin = "anonymous";
        script.defer = true;
        script.onload = () => res();
        script.onerror = () => rej(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });

    loadScript(
      "katex-js",
      "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js",
      "sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8"
    )
      .then(() =>
        loadScript(
          "katex-auto-render",
          "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js",
          "sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05"
        )
      )
      .then(() => resolve())
      .catch(reject);
  });

  return katexAutoRenderPromise;
}
