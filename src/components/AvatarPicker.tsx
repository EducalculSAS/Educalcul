"use client";

import { Check } from "lucide-react";
import { AVATARS } from "@/lib/constants";
import { presetAvatarSrc } from "@/lib/avatarUrl";

/** "avatar3.png" ou "/avatars/avatar3.png" → "avatar3.png". */
function bare(value: string | null | undefined): string {
  return (value || "").replace(/^\/avatars\//, "");
}

/**
 * Choix d'un avatar parmi ceux proposés par le site — le seul moyen d'en
 * changer (profil élève, profil parent, ajout et modification d'un enfant).
 * Même forme que l'avatar affiché partout (carré arrondi), sélection en doré.
 */
export default function AvatarPicker({
  value,
  onChange,
  disabled = false,
  columns = 8,
}: {
  value: string | null | undefined;
  onChange: (avatar: string) => void;
  disabled?: boolean;
  /** Colonnes sur grand écran (4 sur mobile). */
  columns?: 4 | 8;
}) {
  const selected = bare(value);
  return (
    <div
      role="radiogroup"
      aria-label="Choisir un avatar"
      className={`grid grid-cols-4 gap-3 ${columns === 8 ? "sm:grid-cols-8" : ""}`}
    >
      {AVATARS.map((a, i) => {
        const active = selected === a;
        return (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Avatar ${i + 1}`}
            disabled={disabled}
            onClick={() => onChange(a)}
            className={`relative aspect-square rounded-[28%] overflow-hidden transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--greek-blue)] ${
              active
                ? "ring-[3px] ring-[var(--greek-gold)] ring-offset-2 ring-offset-white scale-105 shadow-md"
                : "ring-1 ring-[rgba(197,161,72,0.35)] hover:ring-2 hover:ring-[var(--greek-gold)]/70 hover:scale-105"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- vignette statique de 4 Ko */}
            <img src={presetAvatarSrc(a)} alt="" width={96} height={96} loading="lazy" className="w-full h-full object-cover" />
            {active && (
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-[var(--greek-gold)] text-white flex items-center justify-center shadow">
                <Check className="w-3 h-3" aria-hidden="true" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
