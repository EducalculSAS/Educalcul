import type { ComponentType, CSSProperties } from "react";
import {
  Bird, BookOpen, Bookmark, Brain, CalendarCheck, Check, Crosshair, Crown, Diamond, Feather, Gem, Heart, Library, Medal,
  Mountain, Orbit, Pencil, Scroll, Shield, Sparkles, Star, Sun, Sword, Swords, Target, Trophy, Zap,
} from "lucide-react";
import StreakFlame from "@/components/StreakFlame";

/**
 * Emblème d'un badge : chaque badge a le sien. La FORME dit la catégorie (écu pour les exercices, hexagone pour les
 * cours, étoile pour les quiz, losange pour les quiz parfaits, cible pour les bonnes réponses, médaille à ruban pour la
 * série et les connexions), le MÉTAL dit le palier (bronze → argent → or → cristal → rubis → astral → divin), et le
 * SYMBOLE au centre est propre au badge (la flamme est la vraie flamme animée du site).
 * Composant sans état : utilisable côté serveur.
 */

type Glyph = ComponentType<{ className?: string; style?: CSSProperties; strokeWidth?: number }>;

const GLYPHS: Record<string, Glyph> = {
  pencil: Pencil, zap: Zap, sword: Sword, swords: Swords, star: Star, crown: Crown, trophy: Trophy,
  book: BookOpen, bookmark: Bookmark, library: Library, scroll: Scroll, owl: Bird, universe: Orbit,
  check: Check, target: Target, bullseye: Crosshair, shield: Shield, heart: Heart, calendar: CalendarCheck,
  mountain: Mountain, brain: Brain, medal: Medal, sparkles: Sparkles, gem: Gem, crystal: Diamond, divine: Sun,
  graduation: Feather,
};
const FLAME_ICONS = new Set(["flame", "fire"]);

/** Métal par palier (0 = premier badge de la catégorie). */
const METALS = [
  { dark: "#5b2a08", mid: "#c8782c", light: "#f6c08a" }, // bronze
  { dark: "#3f4959", mid: "#aab4c4", light: "#f2f5fa" }, // argent
  { dark: "#8a5a00", mid: "#f5b81c", light: "#fff2a8" }, // or
  { dark: "#0b5f8a", mid: "#3bb8f0", light: "#d9f5ff" }, // cristal
  { dark: "#6e0a1c", mid: "#e0314f", light: "#ffc2cd" }, // rubis
  { dark: "#3a1a78", mid: "#8a4bf0", light: "#dcbcff" }, // astral
  { dark: "#7a1060", mid: "#ec4899", light: "#ffd6ef" }, // divin
];

/** Contour de la forme, dans un repère 100 × 100. */
const SHAPES: Record<string, string> = {
  exercise_count: "M50 4 L90 16 V48 C90 72 72 88 50 97 C28 88 10 72 10 48 V16 Z", // écu
  course_count: "M50 4 L90 27 V73 L50 96 L10 73 V27 Z", // hexagone
  quiz_count: "M50 3 L61 20 L81 14 L78 35 L96 46 L80 59 L86 80 L64 79 L50 96 L36 79 L14 80 L20 59 L4 46 L22 35 L19 14 L39 20 Z", // étoile à 8 branches
  quiz_perfect: "M50 3 L95 50 L50 97 L5 50 Z", // losange
};
const ROUND = "circle";

export interface EmblemBadge {
  icon: string;
  requirement_type?: string | null;
  /** Rang du badge dans sa catégorie (0 = le plus facile). */
  tier: number;
}

export default function BadgeEmblem({ badge, size = 72, locked = false }: { badge: EmblemBadge; size?: number; locked?: boolean }) {
  const metal = METALS[Math.min(METALS.length - 1, Math.max(0, badge.tier))];
  const shape = SHAPES[badge.requirement_type || ""] ?? ROUND;
  const ribbon = badge.requirement_type === "login_streak" || badge.requirement_type === "login_count";
  const target = badge.requirement_type === "exercise_correct";
  const gid = `be-${badge.requirement_type}-${badge.tier}-${badge.icon}`;
  const Glyph = GLYPHS[badge.icon] ?? Star;
  const flame = FLAME_ICONS.has(badge.icon);
  const stars = Math.min(5, badge.tier + 1);

  return (
    <span className={`relative inline-block shrink-0 ${locked ? "grayscale opacity-60" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={metal.light} />
            <stop offset=".5" stopColor={metal.mid} />
            <stop offset="1" stopColor={metal.dark} />
          </linearGradient>
        </defs>
        {ribbon && (
          <g>
            <path d="M30 70 L22 99 L35 92 L42 100 L48 74 Z" fill={metal.dark} />
            <path d="M70 70 L78 99 L65 92 L58 100 L52 74 Z" fill={metal.dark} />
          </g>
        )}
        {shape === ROUND ? (
          <>
            <circle cx="50" cy="46" r="42" fill={metal.dark} />
            <circle cx="50" cy="46" r="37" fill={`url(#${gid})`} />
            <circle cx="50" cy="46" r="31" fill="none" stroke={metal.light} strokeOpacity=".7" strokeWidth="1.6" />
          </>
        ) : (
          <>
            <path d={shape} fill={metal.dark} />
            <path d={shape} fill={`url(#${gid})`} transform="translate(50 50) scale(.86) translate(-50 -50)" />
            <path d={shape} fill="none" stroke={metal.light} strokeOpacity=".7" strokeWidth="1.8" transform="translate(50 50) scale(.72) translate(-50 -50)" />
          </>
        )}
        {target && [26, 18].map((r) => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={metal.light} strokeOpacity=".55" strokeWidth="1.4" />)}
        {/* Paliers : une étoile par palier, en bas */}
        <g transform={`translate(${50 - (stars - 1) * 5.5} ${shape === ROUND ? 77 : 84})`}>
          {Array.from({ length: stars }, (_, i) => (
            <path key={i} transform={`translate(${i * 11} 0) scale(.42)`} d="M0 -10 L2.9 -3.1 L9.5 -3.1 L4.2 1.2 L6 8.1 L0 4.2 L-6 8.1 L-4.2 1.2 L-9.5 -3.1 L-2.9 -3.1Z" fill="#fff6c2" stroke={metal.dark} strokeWidth="2" />
          ))}
        </g>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: size * (shape === ROUND ? 0.12 : 0.08) }}>
        {flame ? (
          <StreakFlame lit={!locked} animate={false} size={Math.round(size * 0.46)} />
        ) : (
          <Glyph strokeWidth={2.4} style={{ width: size * 0.38, height: size * 0.38, color: "#fff", filter: `drop-shadow(0 1px 0 ${metal.dark}) drop-shadow(0 0 2px ${metal.dark})` }} />
        )}
      </span>
    </span>
  );
}

export { badgeTiers } from "@/lib/badgeTiers";
