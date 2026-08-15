"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { clampGlassTranslate, isRectOffscreen } from "@/lib/liquidGlassBounds";
import { splitPositionClasses } from "@/lib/splitPositionClasses";

const DEFAULT_TRANSITION = "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)";
const PRESS_TRANSITION = "transform 0.12s ease-out";
const RELEASE_TRANSITION = "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)";
const PRESS_SCALE = 0.88;
const ACTIVATION_ZONE = 70;
const MAX_GROW = 0.08;
const MAX_PULL = 1.5;

export type GlassIconButtonColor = "navy" | "gold" | "gray" | "orange" | "red" | "green" | "white";

// Une teinte par sens sémantique du bouton d'origine (voir/preview → gray,
// télécharger/exporter → gold, avertissement/bannir → orange, supprimer →
// red, valider/activer → green, action neutre → navy, sur fond sombre →
// white) — même flou verre liquide (.liquid-glass-btn) partout, seule la
// couleur change.
const COLOR_VARIANTS: Record<GlassIconButtonColor, string> = {
  navy: "bg-[rgba(15,30,58,0.08)] text-[var(--greek-blue)] hover:bg-[rgba(15,30,58,0.14)]",
  gold: "bg-[rgba(197,161,72,0.12)] text-[var(--greek-gold)] hover:bg-[rgba(197,161,72,0.2)]",
  gray: "bg-[rgba(15,30,58,0.06)] text-[var(--text-muted)] hover:bg-[rgba(15,30,58,0.1)] hover:text-[var(--greek-blue)]",
  orange: "bg-[rgba(234,88,12,0.1)] text-[#ea580c] hover:bg-[rgba(234,88,12,0.18)]",
  red: "bg-[rgba(220,38,38,0.1)] text-[#dc2626] hover:bg-[rgba(220,38,38,0.18)]",
  green: "bg-[rgba(22,163,74,0.1)] text-[#16a34a] hover:bg-[rgba(22,163,74,0.18)]",
  white: "bg-white/10 text-white hover:bg-white/20",
};

interface GlassIconButtonProps {
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  color?: GlassIconButtonColor;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
  "aria-label": string;
}

/** Bouton icône rond "verre liquide" — brique de base réutilisée par
 * GlassCloseButton (icône X figée) et par toute action icône-seule du site
 * (voir, télécharger, bannir, supprimer, retour...). Même flou réel
 * (.liquid-glass-btn), même grossissement/rapprochement du curseur à
 * l'approche, même rebond au clic que GlassButton/GlassCloseButton — la
 * couleur seule change selon `color`, pour rester lisible sur n'importe quel
 * fond tout en gardant le même matériau visuel partout.
 *
 * Le `transform` va sur un <span> englobant, jamais sur l'élément qui porte
 * `backdrop-blur` : Safari arrête de rendre le flou dès qu'un `transform`
 * change sur le même élément (même contrainte que GlassButton). */
export default function GlassIconButton({
  icon: Icon,
  onClick,
  href,
  color = "navy",
  size = "md",
  className = "",
  disabled = false,
  "aria-label": ariaLabel,
}: GlassIconButtonProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const elRef = useRef<HTMLElement | null>(null);
  const raf = useRef(0);
  const pressed = useRef(false);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const el = elRef.current;
    if (!wrapper || !el || disabled) return;

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

        // Cf. GlassButton.tsx : un ancêtre caché hors écran par transform
        // (sidebar mobile fermée...) ne clippe pas ce bouton, seulement sa
        // boîte se déplace — il ne doit plus du tout réagir au survol.
        if (isRectOffscreen(rect)) {
          grow = 1;
          tx = 0;
          ty = 0;
          applyTransform();
          return;
        }

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
        const pulledTx = nx * MAX_PULL * fade;
        const pulledTy = ny * MAX_PULL * fade;
        const clamped = clampGlassTranslate(wrapper, rect, pulledTx, pulledTy, grow, grow, 0.5, 0.5);
        tx = clamped.tx;
        ty = clamped.ty;
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
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeaveWindow);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(raf.current);
      clearTimeout(revertTimer.current);
    };
  }, [disabled]);

  const sizeClasses = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const disabledClass = disabled ? "opacity-40 pointer-events-none" : "cursor-pointer";
  // Les classes de position (fixed/absolute/top-*/left-*/z-*...) vont sur le
  // <span> englobant, pas ici : cet élément est un descendant d'un ancêtre
  // animé par transform, qui devient son containing block dès que le survol
  // s'active — voir splitPositionClasses.ts pour le détail du bug que ça évite.
  const { position: positionClasses, rest: restClassName } = splitPositionClasses(className);
  const combinedClassName = `liquid-glass-btn backdrop-blur-[32px] backdrop-saturate-[1.2] rounded-full inline-flex items-center justify-center shrink-0 transition-colors ${sizeClasses} ${COLOR_VARIANTS[color]} ${disabledClass} ${restClassName}`;

  return (
    <span
      ref={wrapperRef}
      className={`inline-block ${positionClasses}`}
      style={{ transition: DEFAULT_TRANSITION, willChange: "transform" }}
    >
      {href && !disabled ? (
        <Link
          ref={elRef as React.Ref<HTMLAnchorElement>}
          href={href}
          aria-label={ariaLabel}
          title={ariaLabel}
          className={combinedClassName}
        >
          <Icon className={iconSize} strokeWidth={2.25} />
        </Link>
      ) : (
        <button
          ref={elRef as React.Ref<HTMLButtonElement>}
          type="button"
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          aria-disabled={disabled}
          aria-label={ariaLabel}
          title={ariaLabel}
          className={combinedClassName}
        >
          <Icon className={iconSize} strokeWidth={2.25} />
        </button>
      )}
    </span>
  );
}
