"use client";

import { useEffect, useLayoutEffect, type DependencyList, type RefObject } from "react";
import { ensureKatexAutoRenderLoaded } from "@/lib/katexLoader";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type AutoRender = (el: HTMLElement, opts: Record<string, unknown>) => void;

const OPTIONS = {
  delimiters: [
    { left: "$$", right: "$$", display: true },
    { left: "$", right: "$", display: false },
    { left: "\\(", right: "\\)", display: false },
    { left: "\\[", right: "\\]", display: true },
  ],
  throwOnError: false,
};

/**
 * Rend les formules $…$ d'un bloc, EN PLACE et sans jamais le masquer.
 *
 * Avant, chaque liste (catalogues, admin, pages de détail) passait en
 * opacité 0 le temps du rendu puis réapparaissait : à chaque mise à jour, tout
 * clignotait. Ici, une fois le module chargé (une seule fois par session), le
 * rendu se fait avant l'affichage (layout effect) : rien ne bouge à l'écran.
 */
export function useKatexIn(ref: RefObject<HTMLElement | null>, deps: DependencyList) {
  useIsoLayoutEffect(() => {
    const render = () => {
      const el = ref.current;
      const fn = (window as unknown as { renderMathInElement?: AutoRender }).renderMathInElement;
      if (el && fn) {
        try {
          fn(el, OPTIONS);
        } catch {
          // Une formule invalide ne doit jamais casser la page.
        }
      }
    };
    if ((window as unknown as { renderMathInElement?: AutoRender }).renderMathInElement) render();
    else ensureKatexAutoRenderLoaded().then(render).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
