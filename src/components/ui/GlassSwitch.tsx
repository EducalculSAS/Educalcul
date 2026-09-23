"use client";

import { useState } from "react";

/**
 * Interrupteur « verre liquide » (activer / désactiver) — le seul du site :
 * toute case oui/non passe par lui. Piste en creux légèrement translucide,
 * pastille de verre qui s'étire à l'appui (comme sur iOS) puis glisse avec
 * un rebond. `tone="danger"` : la position ACTIVE est rouge (ex. maintenance).
 */
export default function GlassSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  tone = "default",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Texte lu par les lecteurs d'écran. */
  label: string;
  tone?: "default" | "danger";
}) {
  const [pressed, setPressed] = useState(false);
  const onTrack =
    tone === "danger"
      ? "linear-gradient(180deg, rgba(239,68,68,0.95), rgba(220,38,38,0.95))"
      : "linear-gradient(180deg, rgba(34,197,94,0.95), rgba(22,163,74,0.95))";
  // Pastille : 20 px, 26 px pendant l'appui ; ancrée du côté où elle repart.
  const w = pressed ? 26 : 20;
  const x = checked ? 48 - 4 - w : 4;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-[background,border-color] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--greek-blue)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      style={{
        background: checked ? onTrack : "rgba(15,30,58,0.12)",
        borderColor: checked ? "rgba(255,255,255,0.35)" : "rgba(15,30,58,0.14)",
        boxShadow: "inset 0 1px 2px rgba(15,30,58,0.18)",
        touchAction: "manipulation",
      }}
    >
      <span
        aria-hidden="true"
        className="absolute top-1/2 h-5 rounded-full"
        style={{
          left: 0,
          width: w,
          transform: `translate(${x}px, -50%)`,
          background: "linear-gradient(180deg, #fff 0%, rgba(245,247,250,0.96) 100%)",
          boxShadow: "0 2px 6px rgba(15,30,58,0.28), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 1px rgba(15,30,58,0.06)",
          transition: "transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.22s ease",
        }}
      />
    </button>
  );
}
