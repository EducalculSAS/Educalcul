import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

/** Mêmes symboles flottants que les pages Offres / Tarifs / Programmes (animation CSS, mise en pause hors écran). */
const SYM = [
  { s: "∑", x: 6, y: 18, z: 96, d: 0, t: 7.2 },
  { s: "π", x: 87, y: 14, z: 72, d: 1.3, t: 8.5 },
  { s: "√", x: 12, y: 66, z: 58, d: 0.6, t: 9.1 },
  { s: "∫", x: 91, y: 52, z: 104, d: 2.1, t: 7.4 },
  { s: "Δ", x: 43, y: 20, z: 50, d: 0.9, t: 10.2 },
  { s: "∞", x: 65, y: 72, z: 66, d: 1.8, t: 8.0 },
  { s: "α", x: 2, y: 44, z: 44, d: 2.7, t: 9.3 },
  { s: "×", x: 76, y: 30, z: 54, d: 0.4, t: 7.8 },
  { s: "θ", x: 50, y: 80, z: 62, d: 2.0, t: 8.8 },
  { s: "÷", x: 22, y: 86, z: 38, d: 2.9, t: 7.3 },
];

/** En-tête bleu nuit des pages publiques de contenu (Calia, niveaux, À propos, Méthode). */
export default function PublicHero({ back, eyebrow, title, intro, children }: {
  /** Bouton retour Liquid Glass en haut à gauche, comme dans les espaces élève et parent. */
  back?: { href: string; label: string };
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  /** Boutons d'action sous l'introduction. */
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white pt-[calc(var(--nav-h)+1.5rem)] pb-16">
      {SYM.map((c, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute font-bold animate-float-symbol select-none pointer-events-none"
          style={{ left: `${c.x}%`, top: `${c.y}%`, fontSize: `${c.z}px`, fontFamily: "Georgia,serif", color: "var(--greek-gold)", opacity: 0.1, animationDuration: `${c.t}s`, animationDelay: `${c.d}s` }}
        >
          {c.s}
        </span>
      ))}
      <div className="relative container mx-auto px-6 max-w-5xl">
        <div className="min-h-9 mb-8">
          {back && (
            <GlassButton href={back.href} variant="light" size="sm">
              <ArrowLeft className="w-4 h-4" /> {back.label}
            </GlassButton>
          )}
        </div>
        <div className="max-w-3xl mx-auto text-center">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(197,161,72,0.85)" }}>{eyebrow}</p>}
          <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-5xl font-bold mb-5">{title}</h1>
          {intro && <p className="text-white/70 text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-8">{intro}</p>}
          {children && <div className="flex flex-col sm:flex-row gap-3 justify-center">{children}</div>}
        </div>
      </div>
    </section>
  );
}
