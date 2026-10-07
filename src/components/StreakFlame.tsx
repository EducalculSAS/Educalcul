"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Flamme de série animée, dans l'esprit de celle de Duolingo : vectorielle (net à toutes les tailles, pas de GIF),
 * trois couches qui vacillent à des rythmes différents, un halo qui respire et de petites étincelles qui montent.
 * Éteinte (série à zéro), elle devient grise et immobile. Elle respecte « réduire les animations ».
 *
 * La taille vient de `size` (px) ou, à défaut, des classes `w-… h-…` passées dans `className` : le composant peut donc
 * remplacer une icône lucide telle quelle.
 */

// Trois silhouettes de la même flamme (mêmes commandes, seuls les points bougent) : le navigateur les fond en douceur.
const OUTER = [
  "M50 6 C57 26 82 42 82 74 C82 98 68 114 50 114 C32 114 18 98 18 74 C18 56 28 46 34 32 C38 44 42 48 45 44 C49 36 46 18 50 6 Z",
  "M46 2 C56 24 84 40 80 72 C80 97 67 114 50 114 C33 114 20 98 20 76 C20 58 30 44 33 28 C38 42 41 48 45 44 C49 34 44 14 46 2 Z",
  "M55 9 C58 28 80 46 83 76 C83 99 69 114 50 114 C31 114 17 98 17 72 C17 56 26 48 36 36 C39 46 43 47 46 42 C50 34 52 20 55 9 Z",
];
const MIDDLE = [
  "M50 40 C55 56 70 64 70 84 C70 100 61 110 50 110 C39 110 30 100 30 84 C30 72 37 66 40 56 C43 64 46 66 48 62 C51 56 49 48 50 40 Z",
  "M47 36 C54 54 72 62 69 84 C69 100 60 110 50 110 C40 110 31 101 31 86 C31 74 38 64 40 52 C43 62 46 66 48 62 C51 54 46 44 47 36 Z",
  "M53 42 C56 56 70 66 71 84 C71 100 61 110 50 110 C39 110 29 100 29 82 C29 72 36 66 42 58 C44 64 47 66 49 62 C52 56 52 50 53 42 Z",
];
const CORE = [
  "M50 72 C53 82 61 88 61 98 C61 106 56 110 50 110 C44 110 39 106 39 98 C39 90 44 86 46 80 C48 84 49 84 50 80 C51 77 50 75 50 72 Z",
  "M49 70 C53 82 62 88 60 99 C60 106 55 110 50 110 C45 110 40 106 40 99 C40 91 44 85 46 78 C48 83 49 84 50 80 C51 76 49 73 49 70 Z",
  "M51 73 C53 83 61 89 62 98 C62 106 56 110 50 110 C44 110 38 106 38 97 C38 90 43 86 47 81 C48 84 50 84 51 80 C52 77 51 75 51 73 Z",
];

const SPARKS = [
  { x: 28, delay: 0, dur: 2.2, r: 2.2 },
  { x: 72, delay: 0.8, dur: 2.6, r: 1.8 },
  { x: 52, delay: 1.5, dur: 2.0, r: 1.5 },
];

interface Props {
  /** Série en cours : éteinte à 0. Par défaut, allumée. */
  lit?: boolean;
  /** Nombre affiché sur la flamme (la série). */
  count?: number;
  /** Taille en pixels (sinon : classes w-/h- de `className`, 24 px par défaut). */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function StreakFlame({ lit = true, count, size, className = "", style }: Props) {
  const reduced = useReducedMotion();
  const animated = lit && !reduced;
  const uid = useId().replace(/:/g, "");
  const hasSizeClass = /(^|\s)(w|h|size)-/.test(className);
  const box: React.CSSProperties = size ? { width: size, height: size } : hasSizeClass ? {} : { width: 24, height: 24 };

  const outer = lit ? ["#ff8a00", "#ff4d00"] : ["#cbd5e1", "#94a3b8"];
  const middle = lit ? ["#ffd23f", "#ff9c00"] : ["#e2e8f0", "#cbd5e1"];
  const core = lit ? ["#fffbe0", "#ffe27a"] : ["#f8fafc", "#e2e8f0"];

  const flicker = (frames: string[], duration: number, delay = 0) =>
    animated ? { d: [frames[0], frames[1], frames[2], frames[0]], transition: { duration, repeat: Infinity, ease: "easeInOut" as const, delay } } : undefined;

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center align-middle ${className}`} style={{ ...box, containerType: "inline-size", ...style }} role="img" aria-label={lit ? "Flamme de série allumée" : "Série éteinte"}>
      <svg viewBox="0 0 100 120" className="w-full h-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={`o${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={outer[0]} />
            <stop offset="1" stopColor={outer[1]} />
          </linearGradient>
          <linearGradient id={`m${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={middle[0]} />
            <stop offset="1" stopColor={middle[1]} />
          </linearGradient>
          <linearGradient id={`c${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={core[0]} />
            <stop offset="1" stopColor={core[1]} />
          </linearGradient>
          <radialGradient id={`g${uid}`} cx="50%" cy="62%" r="55%">
            <stop offset="0" stopColor="#ff9c00" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ff9c00" stopOpacity="0" />
          </radialGradient>
        </defs>

        {lit && (
          <motion.ellipse cx="50" cy="76" rx="62" ry="58" fill={`url(#g${uid})`} animate={animated ? { opacity: [0.55, 1, 0.65, 0.9, 0.55], scale: [0.96, 1.06, 0.98, 1.04, 0.96] } : undefined} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "50px 90px", transformBox: "fill-box" }} />
        )}

        {/* La flamme respire : léger étirement vertical depuis la base */}
        <motion.g animate={animated ? { scaleY: [1, 1.05, 0.98, 1.04, 1], scaleX: [1, 0.97, 1.02, 0.98, 1], rotate: [0, -1.4, 1.2, -0.6, 0] } : undefined} transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "50px 114px", transformBox: "view-box" }}>
          <motion.path d={OUTER[0]} fill={`url(#o${uid})`} animate={flicker(OUTER, 1.7)} />
          <motion.path d={MIDDLE[0]} fill={`url(#m${uid})`} animate={flicker(MIDDLE, 1.3, 0.15)} />
          <motion.path d={CORE[0]} fill={`url(#c${uid})`} animate={flicker(CORE, 1.0, 0.3)} />
          {/* Reflet façon vernis, comme sur la flamme de Duolingo */}
          <path d="M31 70 C29 82 33 94 40 101" stroke="#ffffff" strokeOpacity={lit ? 0.45 : 0.35} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        </motion.g>

        {animated &&
          SPARKS.map((s, i) => (
            <motion.circle key={i} cx={s.x} cy={50} r={s.r} fill="#ffb347" animate={{ y: [24, -34], opacity: [0, 1, 0], x: [0, i % 2 ? 5 : -5] }} transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: "easeOut" }} />
          ))}
      </svg>
      {typeof count === "number" && (
        <span className="absolute inset-x-0 bottom-[6%] text-center font-[family-name:var(--font-display)] font-bold leading-none text-white" style={{ fontSize: "46cqw", WebkitTextStroke: "4cqw #b45309", paintOrder: "stroke fill", textShadow: "0 1px 4px rgba(120,40,0,0.7)" }}>
          {count}
        </span>
      )}
    </span>
  );
}
