"use client";

import LiquidGlass from "liquid-glass-react";
import { ArrowRight, LogIn, Search } from "lucide-react";

// Test isolé du vrai effet "Liquid Glass" (paquet npm liquid-glass-react —
// SVG feDisplacementMap + aberration chromatique, pas juste un flou CSS).
// ATTENTION : la réfraction/déformation n'est visible que sous Chrome/Edge
// (moteur Blink) — Safari et Firefox ne rendent qu'un flou plat, le
// feDisplacementMap n'y étant pas supporté sur backdrop-filter.
const SYM = [
  { s: "∑", x: 8, y: 12, z: 90 }, { s: "π", x: 85, y: 8, z: 70 }, { s: "√", x: 14, y: 65, z: 56 },
  { s: "∫", x: 90, y: 50, z: 100 }, { s: "Δ", x: 45, y: 18, z: 48 }, { s: "∞", x: 65, y: 72, z: 64 },
  { s: "θ", x: 50, y: 80, z: 60 }, { s: "φ", x: 76, y: 84, z: 50 },
];

export default function LiquidGlassTest() {
  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center" style={{ background: "var(--greek-blue)" }}>
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        {SYM.map((cfg, i) => (
          <span
            key={i}
            className="absolute font-bold"
            style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, fontSize: `${cfg.z}px`, fontFamily: "Georgia, serif", color: "var(--greek-gold)", opacity: 0.16 }}
          >
            {cfg.s}
          </span>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-4xl px-6 pt-10">
        <p className="text-center text-white/50 text-xs mb-10">
          Test isolé — pas branché sur le vrai site. Ouvrir dans Chrome pour voir la déformation ;
          Safari/Firefox n&apos;afficheront qu&apos;un flou plat (limitation du navigateur, pas du code).
        </p>

        {/* Barre de nav flottante, façon pill */}
        <div className="flex justify-center mb-16">
          <LiquidGlass cornerRadius={999} padding="10px 14px" displacementScale={64} blurAmount={0.08} saturation={140} aberrationIntensity={2} elasticity={0.25}>
            <div className="flex items-center gap-6 px-3">
              <span className="text-white font-bold text-sm">Educalcul</span>
              <span className="text-white/70 text-sm">Offres</span>
              <span className="text-white/70 text-sm">Tarifs</span>
              <span className="text-white/70 text-sm">FAQ</span>
              <Search className="w-4 h-4 text-white/70" />
            </div>
          </LiquidGlass>
        </div>

        {/* Bouton CTA */}
        <div className="flex justify-center gap-4 mb-16">
          <LiquidGlass displacementScale={70} blurAmount={0.1} saturation={150} aberrationIntensity={2.5} elasticity={0.35} cornerRadius={100} padding="16px 32px">
            <span className="text-white font-bold text-sm flex items-center gap-2">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </span>
          </LiquidGlass>
          <LiquidGlass displacementScale={50} blurAmount={0.08} saturation={130} aberrationIntensity={1.5} elasticity={0.25} cornerRadius={100} padding="16px 32px">
            <span className="text-white font-semibold text-sm flex items-center gap-2">
              <LogIn className="w-4 h-4" /> Se connecter
            </span>
          </LiquidGlass>
        </div>

        {/* Carte plus grande, pour voir l'effet sur une grande surface */}
        <div className="flex justify-center pb-20">
          <LiquidGlass displacementScale={80} blurAmount={0.06} saturation={150} aberrationIntensity={3} elasticity={0.15} cornerRadius={28} padding="32px 36px">
            <div className="w-72 text-center">
              <h3 className="text-white font-bold text-lg mb-2">Suivi en direct</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Une carte "liquid glass" complète — déplace la souris dessus pour voir la déformation suivre le curseur.
              </p>
            </div>
          </LiquidGlass>
        </div>
      </div>
    </div>
  );
}
