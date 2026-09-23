"use client";

/**
 * Interrupteur « verre liquide » (activer / désactiver) — même matériau que
 * les boutons Glass*, pastille qui glisse avec un léger rebond.
 * `tone="danger"` : la position ACTIVE est rouge (ex. mode maintenance).
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
  const on = tone === "danger" ? "bg-red-500/90 border-red-400/60" : "bg-emerald-500/90 border-emerald-400/60";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border backdrop-blur-md transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--greek-blue)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
        checked ? on : "bg-[rgba(15,30,58,0.12)] border-[rgba(15,30,58,0.15)]"
      }`}
    >
      <span
        aria-hidden="true"
        className="inline-block h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(15,30,58,0.25)]"
        style={{
          transform: `translateX(${checked ? 24 : 4}px)`,
          transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      />
    </button>
  );
}
