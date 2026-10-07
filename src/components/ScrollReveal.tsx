"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Apparition progressive façon Apple sur TOUT le site : chaque carte (ou section) du contenu arrive en fondu, avec une
 * légère montée et un petit zoom, les unes après les autres quand on les voit. Un seul composant dans le layout : les
 * pages n'ont rien à déclarer.
 *
 * Ce qui est animé : les blocs « carte » les plus extérieurs de <main> (sections, articles, rounded-2xl avec bordure
 * ou ombre). Pas animés : ce qui est déjà animé par ailleurs (Reveal de l'accueil, squelettes de chargement), les
 * fenêtres, la navigation, les éléments fixes ou en position absolue, et tout si « réduire les animations » est activé.
 *
 * Aucune classe ne reste une fois l'animation finie (pas de transform résiduel qui gênerait un survol ou un menu).
 */
const CANDIDATES = [
  "section",
  "article",
  ".card-academic",
  ".family-card",
  '[class*="rounded-2xl"]',
  '[class*="rounded-3xl"]',
  '[class*="rounded-[2"]',
].join(",");

const LOOKS_LIKE_CARD = /(shadow|border|bg-white|glass|card)/;
const ALREADY_ANIMATED = /(animate-|appear-late|page-enter|skeleton|reveal-)/;
const EXCLUDED = '[data-no-reveal],[role="dialog"],dialog,header,nav,footer,aside,[aria-hidden="true"],[style*="opacity"]';
const STAGGER = 70;
const MAX_STAGGER = 420;

export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const seen = new WeakSet<Element>();
    let raf = 0;

    const reveal = (els: HTMLElement[]) => {
      els.forEach((el, i) => {
        el.style.animationDelay = `${Math.min(i * STAGGER, MAX_STAGGER)}ms`;
        el.classList.remove("reveal-pre");
        el.classList.add("reveal-run");
        const done = () => {
          el.classList.remove("reveal-run");
          el.style.animationDelay = "";
          el.removeEventListener("animationend", done);
        };
        el.addEventListener("animationend", done);
        // Si l'onglet est en arrière-plan, animationend peut ne jamais arriver : on nettoie quand même.
        window.setTimeout(done, Math.min(i * STAGGER, MAX_STAGGER) + 1400);
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        visible.forEach((el) => io.unobserve(el));
        if (visible.length) reveal(visible);
      },
      { threshold: 0.06, rootMargin: "0px 0px -5% 0px" },
    );

    const tagBlock = (el: HTMLElement) => {
      if (el.classList.contains("reveal-target")) return;
      el.classList.add("reveal-target", "reveal-pre");
      io.observe(el);
    };

    /** Bande pleine largeur avec son propre fond : on ne la masque jamais (le fond du <body> apparaîtrait un instant,
     * un éclair de bleu sur du blanc). On anime à la place son contenu, une ligne de blocs après l'autre. */
    const isBand = (el: HTMLElement, rect: DOMRect) => {
      if (rect.width < window.innerWidth * 0.94) return false;
      const cs = getComputedStyle(el);
      return cs.backgroundImage !== "none" || !/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(cs.backgroundColor);
    };
    const animatable = (el: HTMLElement) => {
      if (el.closest(EXCLUDED) || el.classList.contains("reveal-target")) return false;
      const cls = typeof el.className === "string" ? el.className : "";
      if (ALREADY_ANIMATED.test(cls)) return false;
      const r = el.getBoundingClientRect();
      if (r.height < 28 || r.width < 60) return false;
      const pos = getComputedStyle(el).position;
      return pos !== "fixed" && pos !== "absolute" && pos !== "sticky";
    };

    const scan = () => {
      raf = 0;
      try {
        const root = document.querySelector("main") ?? document.body;
        root.querySelectorAll<HTMLElement>(CANDIDATES).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          if (el.closest(EXCLUDED)) return;
          if (el.parentElement?.closest(".reveal-target")) return; // le bloc extérieur porte déjà l'animation
          const cls = typeof el.className === "string" ? el.className : "";
          if (ALREADY_ANIMATED.test(cls)) return;
          const tag = el.tagName;
          if (tag !== "SECTION" && tag !== "ARTICLE" && !LOOKS_LIKE_CARD.test(cls)) return;
          const rect = el.getBoundingClientRect();
          if (rect.height < 64 || rect.width < 120) return;
          const pos = getComputedStyle(el).position;
          if (pos === "fixed" || pos === "absolute" || pos === "sticky") return;
          if (isBand(el, rect)) {
            let kids = Array.from(el.children) as HTMLElement[];
            if (kids.length === 1 && kids[0].children.length > 1) kids = Array.from(kids[0].children) as HTMLElement[]; // conteneur max-w-*
            kids.filter(animatable).forEach(tagBlock);
            return;
          }
          tagBlock(el);
        });
      } catch {
        /* l'animation est un confort : jamais d'erreur visible */
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(scan);
    };

    scan();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });

    // Filet de sécurité : si un bloc masqué n'a jamais été vu (conteneur caché, mesure ratée), on le montre.
    const failsafe = window.setInterval(() => {
      document.querySelectorAll<HTMLElement>(".reveal-pre").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight && r.width > 0) reveal([el]);
      });
    }, 3000);

    return () => {
      mo.disconnect();
      io.disconnect();
      window.clearInterval(failsafe);
      if (raf) cancelAnimationFrame(raf);
      document.querySelectorAll<HTMLElement>(".reveal-pre,.reveal-run").forEach((el) => el.classList.remove("reveal-pre", "reveal-run"));
    };
  }, [pathname]);

  return null;
}
