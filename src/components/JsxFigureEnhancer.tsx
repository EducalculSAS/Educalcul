"use client";

import { useEffect } from "react";
import { buildJsxBoard, decodeJsxSpec, type JsxBoardHandle } from "@/lib/jsxFigure";

/**
 * Dessine toutes les « figures libres » (div.jsx-board[data-jsx-spec]) présentes dans la page : cours, exercices, quiz,
 * aperçus de l'admin. Monté une seule fois à la racine ; la bibliothèque JSXGraph n'est chargée que si une figure existe.
 */
export default function JsxFigureEnhancer() {
  useEffect(() => {
    const live = new Set<{ el: HTMLElement; handle: JsxBoardHandle }>();
    let scheduled = false;
    let stopped = false;

    const scan = () => {
      scheduled = false;
      if (stopped) return;
      // Libère les figures retirées de la page.
      live.forEach((item) => {
        if (!item.el.isConnected) {
          item.handle.destroy();
          live.delete(item);
        }
      });
      document.querySelectorAll<HTMLElement>(".jsx-board[data-jsx-spec]:not([data-wired])").forEach((el) => {
        const spec = decodeJsxSpec(el.getAttribute("data-jsx-spec"));
        el.setAttribute("data-wired", "1");
        if (!spec) return;
        void buildJsxBoard(el, spec)
          .then((handle) => {
            if (stopped || !el.isConnected) handle.destroy();
            else live.add({ el, handle });
          })
          .catch((error) => console.warn("[jsx_figure]", error));
      });
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.setTimeout(scan, 30);
    };

    const observer = new MutationObserver((records) => {
      // Les mutations du tableau lui-même (JSXGraph redessine en continu) ne comptent pas.
      if (records.some((r) => !(r.target instanceof Element && r.target.closest(".jsx-board")))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => {
      stopped = true;
      observer.disconnect();
      live.forEach((item) => item.handle.destroy());
      live.clear();
    };
  }, []);

  return null;
}
