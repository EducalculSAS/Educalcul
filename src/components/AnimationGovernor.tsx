"use client";

import { useEffect } from "react";
import { COLORS } from "@/lib/cosmetics/catalog";

/**
 * Fluidité : les animations décoratives infinies (symboles flottants, contours d'avatar, titres animés, dégradés)
 * coûtent à chaque image, surtout derrière un flou « verre » (le flou est recalculé à chaque mouvement). On les met en
 * pause :
 *  - hors de la fenêtre (attribut data-anim-off posé par un IntersectionObserver) ;
 *  - pendant un défilement (html[data-scrolling]) : c'est là que les saccades se voient, elles reprennent à l'arrêt.
 * Rien ne change visuellement à l'écran immobile. Les règles CSS sont dans globals.css (« Gouverneur d'animations »).
 */
const DECOR_SELECTOR = [
  ".animate-float-symbol",
  ".ring-fx",
  ".text-gradient-gold",
  ".text-gradient-gold-dark",
  ".family-card",
  ...COLORS.filter((c) => c.cls.startsWith("name-")).map((c) => `.${c.cls}`),
].join(",");

export default function AnimationGovernor() {
  useEffect(() => {
    const root = document.documentElement;
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.removeAttribute("data-anim-off");
          else e.target.setAttribute("data-anim-off", "");
        }
      },
      { rootMargin: "200px 0px" },
    );
    const scan = () => {
      document.querySelectorAll(DECOR_SELECTOR).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    };
    scan();
    let pending = 0;
    const mo = new MutationObserver(() => {
      if (pending) return;
      pending = requestAnimationFrame(() => { pending = 0; scan(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    let timer = 0;
    const onScroll = () => {
      if (!timer) root.setAttribute("data-scrolling", "");
      else clearTimeout(timer);
      timer = window.setTimeout(() => { timer = 0; root.removeAttribute("data-scrolling"); }, 160);
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      if (pending) cancelAnimationFrame(pending);
      clearTimeout(timer);
      root.removeAttribute("data-scrolling");
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, []);
  return null;
}
