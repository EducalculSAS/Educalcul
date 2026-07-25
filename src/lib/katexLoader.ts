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

/** Environnements LaTeX de type "grille" que l'IA écrit parfois sans les
 * entourer de $...$/$$...$$ (systèmes d'équations, matrices) : sans ce filet
 * de sécurité, ils s'affichent en texte brut (\begin{cases}...) au lieu
 * d'être rendus. */
const BARE_ENV_RE =
  /(\\left\s*(?:\\\{|[(\[.|])\s*)?\\begin\{(cases|array|pmatrix|bmatrix|vmatrix|Vmatrix|matrix|aligned)\}[\s\S]*?\\end\{\2\}(\s*\\right\s*(?:\\\}|[)\].|]))?/g;

const BARE_LATEX_COMMAND_RE = /(^|[\s>\[(\[{;:,])((?:\\(?:frac|sqrt|vec|cos|sin|tan|log|ln|exp|lim|sum|prod|int|left|right|cdot|times|le|ge|infty|pm|to|approx|text|alpha|beta|gamma|delta|theta|phi|pi|angle|subset|subseteq|supset|supseteq|cup|cap|in|forall|exists|neg|perp|parallel|ldots|cdots|dots|mathbb|mathcal|mathbf|mathrm|mathit|overrightarrow|underline|bar|hat|dot|ddot)[^$<>\n\r]*))/g;

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

  // 0. Filet de sécurité : encadre les environnements type "cases"/"array"
  // laissés sans délimiteurs $...$/$$...$$ par l'IA, pour qu'ils soient
  // traités par les passes suivantes au lieu de rester en texte brut.
  let result = html.replace(
    BARE_ENV_RE,
    (match, _left, _env, _right, offset, full) => {
      const before = full.slice(0, offset);
      const openDollars = (before.match(/\$/g) || []).length;
      // Un nombre pair de "$" avant ce point signifie qu'on N'EST PAS déjà
      // à l'intérieur d'un bloc $...$/$$...$$ — dans ce cas, on encadre.
      return openDollars % 2 === 0 ? `$$${match}$$` : match;
    },
  );

  // 0.5. Filet additionnel : si l'IA a écrit des commandes LaTeX sans les
  // encadrer de $...$, on tente de les entourer automatiquement pour éviter
  // qu'elles n'apparaissent en texte brut dans le rendu final.
  result = result.replace(BARE_LATEX_COMMAND_RE, (_, prefix, expr) => {
    return `${prefix}$${expr.trim()}$`;
  });

  // 1. Display math : $$...$$
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) =>
    safeRenderMath(math, true),
  );

  // 2. Inline math : $...$ (on évite $$...$$ déjà traités)
  result = result.replace(/\$([^\$\r\n]+?)\$/g, (match, math) => {
    if (!math.trim()) return match;
    return safeRenderMath(math, false);
  });

  // 3. \(...\) inline
  result = result.replace(/\\\(([\s\S]+?)\\\)/g, (match, math) =>
    safeRenderMath(math, false),
  );

  // 4. \[...\] display
  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (match, math) =>
    safeRenderMath(math, true),
  );

  // Nettoyage anti-XSS après le rendu LaTeX (conserve KaTeX/SVG/MathML).
  return sanitizeHtml(result);
}

// Fonctions gardées pour compatibilité (no-op)
export function ensureKaTeX(): Promise<void> {
  return Promise.resolve();
}
export function renderKaTeX(_container: HTMLElement | null) {
  /* no-op — utilise renderLatexInHTML */
}
export function renderKaTeXAsync(
  _container: HTMLElement | null,
): Promise<void> {
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
