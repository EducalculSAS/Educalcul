"use client";

import { useEffect, useState } from "react";
import type { Season } from "@/lib/season";

/**
 * Décor animé du thème de saison : quelques éléments légers qui tombent doucement par-dessus la page (jamais
 * cliquables, jamais devant une fenêtre). Transformations seules (aucun flou), en pause pendant un défilement
 * (AnimationGovernor) et absent pour « réduire les animations ».
 */
const COUNT = 14;

function Shape({ season }: { season: Season }) {
  switch (season) {
    case "noel":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 2px rgba(120,160,220,.9))" }}>
          <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 3 3-3M9 20l3-3 3 3" />
        </svg>
      );
    case "paques":
      return (
        <svg viewBox="0 0 24 30">
          <ellipse cx="12" cy="16" rx="10" ry="13" fill="#ffd6e8" stroke="#c45a8c" strokeWidth="1.4" />
          <path d="M3 14 Q7 10 12 14 T21 14" fill="none" stroke="#8fd16e" strokeWidth="2" />
          <path d="M4 20 Q8 17 12 20 T20 20" fill="none" stroke="#9ab8ff" strokeWidth="2" />
        </svg>
      );
    case "foot":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10.5" fill="#fff" stroke="#1f2937" strokeWidth="1.2" />
          <path d="M12 7.5l3.6 2.6-1.4 4.2H9.8L8.4 10.1z" fill="#1f2937" />
          <path d="M12 7.5V2M15.6 10.1l5-1.8M14.2 14.3l3 4.3M9.8 14.3l-3 4.3M8.4 10.1l-5-1.8" stroke="#1f2937" strokeWidth="1.1" />
        </svg>
      );
    case "halloween":
      return (
        <svg viewBox="0 0 32 16" style={{ filter: "drop-shadow(0 0 2px rgba(255,122,24,.95))" }}>
          <path d="M16 6.5C15.2 4.8 14.3 4 13.2 3.6l.5 2C11.2 4.6 7.8 2.7 1.5 3.6c3 1.8 4 4 3.2 7 3-2 5.2-1.4 6.3.8 1.2-1.8 3.2-1.8 5 1.4 1.8-3.2 3.8-3.2 5-1.4 1.1-2.2 3.3-2.8 6.3-.8-.8-3 .2-5.2 3.2-7-6.3-.9-9.7 1-12.2 2l.5-2c-1.1.4-2 1.2-2.8 2.9Z" fill="#1c0b26" stroke="#ff9a3c" strokeWidth=".7" strokeLinejoin="round" />
          <circle cx="15" cy="6.6" r=".7" fill="#ffd23c" /><circle cx="17" cy="6.6" r=".7" fill="#ffd23c" />
        </svg>
      );
    default:
      return null;
  }
}

export default function SeasonalDecor() {
  const [season, setSeason] = useState<Season | null>(null);
  useEffect(() => {
    const read = () => {
      const s = document.documentElement.getAttribute("data-season");
      setSeason(s === "noel" || s === "paques" || s === "foot" || s === "halloween" ? s : null);
    };
    read();
    window.addEventListener("educalcul:season", read);
    return () => window.removeEventListener("educalcul:season", read);
  }, []);
  if (!season) return null;
  return (
    <div aria-hidden="true" className="season-decor pointer-events-none fixed inset-0 z-[40] overflow-hidden motion-reduce:hidden">
      {Array.from({ length: COUNT }, (_, i) => {
        // Placement déterministe (aucune valeur aléatoire : pas d'écart entre deux rendus).
        const left = (i * 61 + 7) % 100;
        const size = (season === "halloween" ? 22 : 14) + ((i * 7) % 4) * 5;
        const duration = 11 + ((i * 5) % 7) * 2;
        const delay = -((i * 13) % duration);
        return (
          <span key={i} className={`season-particle season-${season}`} style={{ left: `${left}%`, width: size, height: size, animationDuration: `${duration}s`, animationDelay: `${delay}s` }}>
            <Shape season={season} />
          </span>
        );
      })}
    </div>
  );
}
