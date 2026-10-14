"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface FadeInSectionProps {
  children: ReactNode;
  className?: string;
  /** Décalage vertical de départ (px) avant l'apparition. */
  translateY?: number;
  /** Décalage horizontal de départ (px), utilisé à la place de translateY quand fourni. */
  translateX?: number;
  durationMs?: number;
  delayMs?: number;
  threshold?: number;
  style?: CSSProperties;
}

/**
 * Enveloppe générique "apparition au scroll" (IntersectionObserver). Le
 * contenu (children) reste rendu côté serveur — seul ce wrapper est un
 * client component, ce qui évite de rendre toute la landing en client juste
 * pour quelques animations d'apparition.
 */
export default function FadeInSection({
  children,
  className,
  translateY = 28,
  translateX,
  durationMs = 700,
  delayMs = 0,
  threshold = 0.15,
  style,
}: FadeInSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < window.innerHeight * (1 - threshold)) {
      // Déjà dans le viewport au montage (contenu court / page rechargée
      // plus bas) : on affiche tout de suite, l'IntersectionObserver ne se
      // déclenchera pas puisqu'il n'y a pas de transition "hors -> dans" le
      // viewport à observer.
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translate(0, 0)"
          : translateX !== undefined
            ? `translateX(${translateX}px)`
            : `translateY(${translateY}px)`,
        transition: `opacity ${durationMs}ms ease ${delayMs}ms, transform ${durationMs}ms ease ${delayMs}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
