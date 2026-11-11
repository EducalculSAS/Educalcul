"use client";

import { useEffect, useState } from "react";

/** Au-delà de cette hauteur, la barre n'est plus « en bas de l'écran » : la bulle peut rester dans le coin. */
const MAX_FLOOR = 160;

/**
 * Une barre d'actions en bas de l'écran (« Suivant », « Valider »…) ne doit jamais se retrouver sous Calia.
 * La barre s'enregistre avec la fonction renvoyée (`ref={caliaFloorRef}`) ; tant qu'elle est visible dans le bas de
 * la fenêtre, sa hauteur est publiée dans `--calia-floor`, et la bulle comme le panneau de discussion se posent
 * juste au-dessus (classes `calia-dock` et `calia-sheet`, voir globals.css).
 */
export function useCaliaFloor(): (el: HTMLElement | null) => void {
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!el) return;
    const root = document.documentElement;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const onScreen = r.bottom > 0 && r.top < vh;
      const floor = onScreen ? Math.round(vh - r.top) : 0;
      root.style.setProperty("--calia-floor", `${floor > 0 && floor <= MAX_FLOOR ? floor : 0}px`);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      root.style.removeProperty("--calia-floor");
    };
  }, [el]);

  return setEl;
}

/**
 * Clavier du téléphone : sur iPhone la fenêtre ne rétrécit pas quand il s'ouvre, donc un panneau collé en bas passerait
 * dessous. Tant que `active` est vrai, la hauteur masquée par le clavier est publiée dans `--calia-kb`.
 */
export function useCaliaKeyboardInset(active: boolean) {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) return;
    const root = document.documentElement;
    const update = () => {
      const hidden = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty("--calia-kb", `${hidden > 80 ? hidden : 0}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--calia-kb");
    };
  }, [active]);
}
