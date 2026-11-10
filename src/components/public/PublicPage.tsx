import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import FadeInSection from "@/components/home/FadeInSection";

/**
 * Briques communes des pages publiques (Calia, Programmes, Méthode, À propos, pages par niveau), reprises À
 * L'IDENTIQUE des pages Offres, Tarifs, FAQ et Contact : en-tête bleu nuit en deux colonnes (texte à gauche, aperçu à
 * droite), sections crème au titre centré, cartes blanches arrondies, bandeau final « Prêt à commencer ? ».
 * Aucune de ces pages n'a de bouton « retour » : on navigue par le menu, comme sur Offres.
 */

const SYM = [
  { s: "∑", x: 6, y: 10, z: 96, d: 0, t: 7.2 },
  { s: "π", x: 87, y: 7, z: 72, d: 1.3, t: 8.5 },
  { s: "√", x: 12, y: 62, z: 58, d: 0.6, t: 9.1 },
  { s: "∫", x: 91, y: 48, z: 104, d: 2.1, t: 7.4 },
  { s: "Δ", x: 43, y: 14, z: 50, d: 0.9, t: 10.2 },
  { s: "∞", x: 65, y: 70, z: 66, d: 1.8, t: 8.0 },
  { s: "α", x: 2, y: 40, z: 44, d: 2.7, t: 9.3 },
  { s: "×", x: 76, y: 26, z: 54, d: 0.4, t: 7.8 },
];

/** Carte blanche des pages publiques (même rendu que les piliers d'Offres). */
export const PUBLIC_CARD = "rounded-2xl p-7 bg-white border border-[var(--greek-border)] shadow-[0_2px_16px_rgba(15,30,58,0.05)]";
/** Pastille dorée qui porte l'icône d'une carte. */
export const PUBLIC_ICON_TILE = "w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-[rgba(197,161,72,0.1)] border border-[rgba(197,161,72,0.18)]";

export function PublicPage({ children }: { children: ReactNode }) {
  return <div className="flex flex-col min-h-screen" style={{ background: "var(--greek-blue)" }}>{children}</div>;
}

/** Ligne de l'aperçu de droite de l'en-tête (icône dorée + texte), comme sur Offres. */
export function HeroRows({ rows }: { rows: { icon: ReactNode; text: ReactNode }[] }) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="shrink-0" style={{ color: "var(--greek-gold)" }}>{row.icon}</span>
          <span className="text-sm" style={{ color: "rgba(240,237,232,0.75)" }}>{row.text}</span>
        </div>
      ))}
    </div>
  );
}

export function PublicHero({ eyebrow, title, highlight, intro, actions, aside }: {
  eyebrow: ReactNode;
  /** Première ligne du titre (blanc). */
  title: ReactNode;
  /** Seconde ligne du titre, en doré. */
  highlight?: ReactNode;
  intro?: ReactNode;
  /** Boutons sous l'introduction. */
  actions?: ReactNode;
  /** Aperçu de droite (masqué sur téléphone, comme sur les autres pages publiques). */
  aside?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden py-32" style={{ background: "var(--greek-blue)" }}>
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
        <div className={`grid grid-cols-1 ${aside ? "md:grid-cols-2" : ""} gap-12 items-center`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(197,161,72,0.85)" }}>{eyebrow}</p>
            <h1 className="font-[family-name:var(--font-display)] font-bold leading-tight mb-6 text-white" style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.4rem)" }}>
              {title}
              {highlight && <><br /><span style={{ color: "var(--greek-gold)" }}>{highlight}</span></>}
            </h1>
            {intro && <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.55)" }}>{intro}</p>}
            {actions && <div className="flex gap-3 flex-wrap">{actions}</div>}
          </div>
          {aside && <div className="hidden md:block">{aside}</div>}
        </div>
      </div>
    </section>
  );
}

/** Section crème au titre centré (petit sur-titre doré, grand titre, sous-titre). */
export function PublicSection({ id, eyebrow, title, highlight, intro, children, tight = false }: {
  id?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  highlight?: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  /** Espacement réduit (section qui en suit une autre de près). */
  tight?: boolean;
}) {
  return (
    <section id={id} className={`${tight ? "py-12" : "py-20"} scroll-mt-20`} style={{ background: "var(--greek-cream)" }}>
      <div className="container mx-auto px-6 max-w-5xl">
        {(eyebrow || title) && (
          <FadeInSection className="text-center mb-12 max-w-2xl mx-auto">
            {eyebrow && <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--greek-gold-text)" }}>{eyebrow}</span>}
            {title && (
              <h2 className="font-[family-name:var(--font-display)] font-bold leading-tight mt-3 mb-4" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", color: "var(--greek-blue)" }}>
                {title}{highlight && <> <span style={{ color: "var(--greek-gold-text)" }}>{highlight}</span></>}
              </h2>
            )}
            {intro && <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{intro}</p>}
          </FadeInSection>
        )}
        {children}
      </div>
    </section>
  );
}

/** Bandeau final bleu nuit (identique à celui d'Offres). */
export function PublicCta({ title = "Prêt à commencer ?", text = "7 jours d'essai gratuit, sans engagement, sans carte bancaire.", secondary }: {
  title?: ReactNode;
  text?: ReactNode;
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="py-24 text-center" style={{ background: "var(--greek-blue)" }}>
      <div className="container mx-auto px-6 max-w-2xl">
        <h2 className="font-[family-name:var(--font-display)] font-bold leading-tight mb-4 text-white" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)" }}>{title}</h2>
        <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.55)" }}>{text}</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <GlassButton href="/auth/inscription" variant="gold" className="font-[family-name:var(--font-display)] font-bold text-sm">
            <span className="inline-flex items-center gap-2">Commencer gratuitement <ArrowRight className="w-4 h-4" /></span>
          </GlassButton>
          {secondary && (
            <GlassButton href={secondary.href} variant="light" className="font-[family-name:var(--font-display)] font-semibold text-sm">{secondary.label}</GlassButton>
          )}
        </div>
      </div>
    </section>
  );
}

/** Carte à icône (même rendu que les piliers d'Offres). */
export function FeatureCard({ icon, title, subtitle, children, delayMs = 0 }: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  delayMs?: number;
}) {
  return (
    <FadeInSection delayMs={delayMs} className={`${PUBLIC_CARD} flex flex-col`}>
      <div className={PUBLIC_ICON_TILE} style={{ color: "var(--greek-gold)" }}>{icon}</div>
      <h3 className="font-[family-name:var(--font-display)] font-bold text-xl mb-1" style={{ color: "var(--greek-blue)" }}>{title}</h3>
      {subtitle && <p className="text-xs font-semibold mb-3" style={{ color: "var(--greek-gold-text)" }}>{subtitle}</p>}
      {children && <div className="text-sm leading-relaxed mt-1" style={{ color: "var(--text-muted)" }}>{children}</div>}
    </FadeInSection>
  );
}
