"use client";

import { X } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";

export type GlassCloseButtonVariant = "light" | "dark";

interface GlassCloseButtonProps {
  onClick: () => void;
  variant?: GlassCloseButtonVariant;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

/** Croix de fermeture "verre liquide" — fine couche au-dessus de
 * GlassIconButton (icône X figée, couleur dérivée de `variant`). Un seul
 * composant pour toutes les croix de fermeture du site — changer
 * GlassIconButton change tout, y compris cette croix. */
export default function GlassCloseButton({
  onClick,
  variant = "light",
  size = "md",
  className = "",
  "aria-label": ariaLabel = "Fermer",
}: GlassCloseButtonProps) {
  return (
    <GlassIconButton
      icon={X}
      onClick={onClick}
      color={variant === "dark" ? "white" : "gray"}
      size={size}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
