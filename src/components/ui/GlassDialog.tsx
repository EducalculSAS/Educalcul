"use client";

import { useEffect, useId, type ReactNode } from "react";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

/**
 * Boîte de dialogue du site (forum, calendrier…) : fond flouté, fenêtre en
 * verre qui arrive en douceur, fermeture par Échap, clic à l'extérieur ou la
 * croix, défilement de la page bloqué pendant l'ouverture. Sur téléphone,
 * elle monte du bas de l'écran.
 */
export default function GlassDialog({
  title, onClose, children, footer, wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** true : large ; "xl" : très large (éditeurs avec aperçu). */
  wide?: boolean | "xl";
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 overlay-enter"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`dialog-enter w-full ${wide === "xl" ? "sm:max-w-5xl" : wide ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[92dvh] flex flex-col glass-panel rounded-t-3xl sm:rounded-3xl backdrop-blur-[32px] backdrop-saturate-[1.4]`}
      >
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
          <h2 id={titleId} className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--greek-blue)]">{title}</h2>
          <GlassCloseButton onClick={onClose} variant="light" size="sm" />
        </div>
        <div className="px-6 pb-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-[rgba(197,161,72,0.2)] flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

