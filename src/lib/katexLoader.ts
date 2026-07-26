"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import DOMPurify from "dompurify";
import {
  repairLatex,
  stripFigureNumberPrefix,
  renderMathAsPlainTextInSvg,
  normalizeSvgArrowMarkers,
} from "@/lib/latexRepair";

/**
 * Nettoie le HTML avant injection (anti-XSS) tout en conservant le rendu KaTeX,
 * les graphiques SVG et la mise en forme du cours.
 * - Client : DOMPurify (autorise HTML + SVG + MathML, retire scripts, on*, javascript:).
 * - SSR (pas de DOM) : repli minimal retirant les vecteurs principaux ; le client re-nettoie.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window !== "undefined" && "sanitize" in DOMPurify) {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
      ADD_ATTR: ["target"],
      // Le profil mathMl de DOMPurify ne whitelist pas <semantics>/<annotation>
      // (les dépaquette en gardant leur texte, aplati) : KaTeX les utilise
      // pourtant pour embarquer la source LaTeX d'origine de chaque formule
      // (<annotation encoding="application/x-tex">), dont on a besoin pour
      // reconstruire du "$latex$" propre quand l'élève sélectionne du texte
      // contenant une formule (cf. getCleanSelectionText dans CourseViewer).
      // Contenu inerte (texte brut, aucun attribut sensible) : sans risque.
      ADD_TAGS: ["semantics", "annotation"],
    });
  }
  return html
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}


/** Rendu KaTeX d'une formule avec repli propre : si la source est invalide
 * (souvent parce que l'IA a mélangé une balise HTML dans la formule), on
 * retire les balises et on retente, puis en dernier recours on affiche le
 * texte brut nettoyé — jamais le message d'erreur technique de KaTeX (rouge,
 * illisible pour un élève) ni le HTML qui a fuité dedans. */
function safeRenderMath(math: string, displayMode: boolean): string {
  const trimmed = math.trim();
  const tryRender = (src: string) =>
    katex.renderToString(src, {
      displayMode,
      throwOnError: true,
      strict: false,
    });
  try {
    return tryRender(trimmed);
  } catch {
    const cleaned = trimmed.replace(/<[^>]*>/g, "").trim();
    if (cleaned && cleaned !== trimmed) {
      try {
        return tryRender(cleaned);
      } catch {
        /* repli ci-dessous */
      }
    }
    const escaped = (cleaned || trimmed)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return displayMode
      ? `<div class="katex-fallback katex-fallback-display">${escaped}</div>`
      : `<span class="katex-fallback">${escaped}</span>`;
  }
}

/**
 * Pré-rend tout le LaTeX dans une chaîne HTML avant de l'injecter dans le DOM.
 * Approche la plus fiable : pas de DOM traversal, pas de timing issues.
 */
export function renderLatexInHTML(html: string): string {
  if (!html) return html;

  // 0. Réparation en amont (formules sans délimiteur, $$ non refermé…).
  // Appliquée aussi à l'affichage — et pas seulement à la génération — pour
  // que les cours déjà enregistrés avant ce correctif s'affichent proprement.
  let result = stripFigureNumberPrefix(repairLatex(html));

  // 0bis. Un <text> SVG ne peut afficher que des glyphes bruts — jamais les
  // <span> imbriqués que produit KaTeX (mise en page HTML/CSS). Injecter du
  // HTML KaTeX dedans le fait disparaître ou s'afficher déformé. On rend
  // donc les formules d'un schéma en texte lisible avant le rendu KaTeX
  // normal, pour qu'il ne leur reste plus aucun $ à traiter.
  result = result.replace(/<svg[\s\S]*?<\/svg>/g, (svgBlock) =>
    normalizeSvgArrowMarkers(renderMathAsPlainTextInSvg(svgBlock)),
  );

  // 1. Display math : $$...$$
  // [^<>] : une formule ne peut JAMAIS traverser une balise HTML. Sans cette
  // contrainte, un $$ non refermé « cherchait » sa fermeture plusieurs
  // paragraphes plus loin et avalait tout le HTML intermédiaire, produisant
  // un mélange illisible de morceaux rendus et de LaTeX brut.
  result = result.replace(/\$\$([^<>]*?)\$\$/g, (match, math) =>
    math.trim() ? safeRenderMath(math, true) : match,
  );

  // 2. Inline math : $...$ (les $$...$$ sont déjà traités)
  result = result.replace(/\$([^$<>\r\n]+?)\$/g, (match, math) =>
    math.trim() ? safeRenderMath(math, false) : match,
  );

  // 3. \(...\) inline
  result = result.replace(/\\\(([^<>]+?)\\\)/g, (match, math) =>
    safeRenderMath(math, false),
  );

  // 4. \[...\] display
  result = result.replace(/\\\[([^<>]+?)\\\]/g, (match, math) =>
    safeRenderMath(math, true),
  );

  // 5. Filet final : un délimiteur resté orphelin ne doit jamais s'afficher.
  result = result.replace(/\$\$/g, "");

  // Nettoyage anti-XSS après le rendu LaTeX (conserve KaTeX/SVG/MathML).
  return sanitizeHtml(result);
}

// Fonctions gardées pour compatibilité (no-op)
export function ensureKaTeX(): Promise<void> {
  return Promise.resolve();
}
export function renderKaTeX(_container: HTMLElement | null) {
  void _container;
  /* no-op — utilise renderLatexInHTML */
}
export function renderKaTeXAsync(
  _container: HTMLElement | null,
): Promise<void> {
  void _container;
  return Promise.resolve();
}

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
  if (typeof (window as Window & { renderMathInElement?: unknown }).renderMathInElement === "function") {
    return Promise.resolve();
  }
  if (katexAutoRenderPromise) return katexAutoRenderPromise;

  katexAutoRenderPromise = new Promise((resolve, reject) => {
    if (!document.getElementById("katex-css")) {
      const link = document.createElement("link");
      link.id = "katex-css";
      link.rel = "stylesheet";
      link.href =
        "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
      link.integrity =
        "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV";
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }

    const loadScript = (
      id: string,
      src: string,
      integrity: string,
    ): Promise<void> =>
      new Promise((res, rej) => {
        if (document.getElementById(id)) {
          // Déjà en cours de chargement (ou chargé) par un appel précédent.
          const existing = document.getElementById(id) as HTMLScriptElement;
          existing.addEventListener("load", () => res());
          existing.addEventListener("error", () =>
            rej(new Error(`Failed to load ${src}`)),
          );
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
      "sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8",
    )
      .then(() =>
        loadScript(
          "katex-auto-render",
          "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js",
          "sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05",
        ),
      )
      .then(() => resolve())
      .catch(reject);
  });

  return katexAutoRenderPromise;
}
