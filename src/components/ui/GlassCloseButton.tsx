"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const DEFAULT_TRANSITION = "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)";
const PRESS_TRANSITION = "transform 0.12s ease-out";
const RELEASE_TRANSITION = "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)";
const PRESS_SCALE = 0.88;
const ACTIVATION_ZONE = 70;
const MAX_GROW = 0.16;
const MAX_PULL = 3;

export type GlassCloseButtonVariant = "light" | "dark";

// "light" = sur fond clair (modales blanches, cartes) — cercle sombre translucide.
// "dark"  = sur fond sombre (headers navy, overlays plein écran) — cercle clair translucide.
const VARIANTS: Record<GlassCloseButtonVariant, string> = {
  light: "bg-[rgba(15,30,58,0.06)] text-[var(--text-muted)] hover:bg-[rgba(15,30,58,0.1)] hover:text-[var(--greek-blue)]",
  dark: "bg-white/10 text-white hover:bg-white/20",
};

interface GlassCloseButtonProps {
  onClick: () => void;
  variant?: GlassCloseButtonVariant;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

/** Croix de fermeture "verre liquide" — cercle à bordure translucide fine
 * (même classe .liquid-glass-btn que GlassButton) qui grossit légèrement et
 * se rapproche du curseur dès qu'il entre dans sa zone d'activation, avec
 * rebond au clic — même famille de comportement que GlassButton, simplifiée
 * pour une icône isolée (pas d'étirement directionnel ni d'arbitrage entre
 * boutons voisins, inutile pour une croix seule en coin de modale/panel).
 * Un seul composant pour toutes les croix de fermeture du site — changer ici
 * change tout.
 *
 * Le `transform` va sur un <span> englobant, jamais sur le <button> qui
 * porte `backdrop-blur` : Safari arrête de rendre le flou dès qu'un
 * `transform` change sur le même élément (même contrainte que GlassButton). */
export default function GlassCloseButton({
  onClick,
  variant = "light",
  size = "md",
  className = "",
  "aria-label": ariaLabel = "Fermer",
}: GlassCloseButtonProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const raf = useRef(0);
  const pressed = useRef(false);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const btn = btnRef.current;
    if (!wrapper || !btn) return;

    let grow = 1;
    let tx = 0;
    let ty = 0;

    const applyTransform = () => {
      const p = pressed.current ? PRESS_SCALE : 1;
      wrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${grow * p})`;
    };

    const onMove = (e: MouseEvent) => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        const rect = wrapper.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;

        const edgeX = Math.max(0, Math.abs(dx) - rect.width / 2);
        const edgeY = Math.max(0, Math.abs(dy) - rect.height / 2);
        const edgeDist = Math.hypot(edgeX, edgeY);

        if (edgeDist > ACTIVATION_ZONE) {
          grow = 1;
          tx = 0;
          ty = 0;
          applyTransform();
          return;
        }

        const fade = 1 - edgeDist / ACTIVATION_ZONE;
        const nx = Math.max(-1, Math.min(1, dx / ACTIVATION_ZONE));
        const ny = Math.max(-1, Math.min(1, dy / ACTIVATION_ZONE));

        grow = 1 + MAX_GROW * fade;
        tx = nx * MAX_PULL * fade;
        ty = ny * MAX_PULL * fade;
        applyTransform();
      });
    };

    const onLeaveWindow = () => {
      grow = 1;
      tx = 0;
      ty = 0;
      applyTransform();
    };

    const onDown = () => {
      pressed.current = true;
      wrapper.style.transition = PRESS_TRANSITION;
      applyTransform();
    };
    const onUp = () => {
      if (!pressed.current) return;
      pressed.current = false;
      wrapper.style.transition = RELEASE_TRANSITION;
      applyTransform();
      revertTimer.current = setTimeout(() => {
        wrapper.style.transition = DEFAULT_TRANSITION;
      }, 450);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeaveWindow);
    btn.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeaveWindow);
      btn.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(raf.current);
      clearTimeout(revertTimer.current);
    };
  }, []);

  const sizeClasses = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <span
      ref={wrapperRef}
      className="inline-block"
      style={{ transition: DEFAULT_TRANSITION, willChange: "transform" }}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={`liquid-glass-btn backdrop-blur-[32px] backdrop-saturate-[1.2] rounded-full inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors ${sizeClasses} ${VARIANTS[variant]} ${className}`}
      >
        <X className={iconSize} strokeWidth={2.5} />
      </button>
    </span>
  );
}
