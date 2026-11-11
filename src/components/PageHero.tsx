import type { ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import Emblem3D, { type EmblemKind } from "@/components/Emblem3D";

/**
 * En-tête bleu nuit des pages élève et parent — une seule définition (il en
 * existait une copie par page, avec des marges différentes d'une page à
 * l'autre).
 */
export default function PageHero({
  icon: Icon,
  emblem,
  title,
  badge,
  subtitle,
  actions,
  top,
  back,
  width = "6xl",
}: {
  icon?: LucideIcon;
  /** Emblème en relief de la rubrique (le même que sur sa tuile du tableau de bord) ; remplace `icon`. */
  emblem?: EmblemKind;
  title: ReactNode;
  /** Pastille dorée au-dessus du titre (« Élèves », « Entraînement »…). */
  badge?: string;
  subtitle?: ReactNode;
  /** Contenu à droite (bouton d'action, statistiques). */
  actions?: ReactNode;
  /** Au-dessus du titre (contenu libre). */
  top?: ReactNode;
  /** Bouton retour Liquid Glass au-dessus du titre (ex. vers le tableau de bord). */
  back?: { href: string; label: string };
  width?: "4xl" | "6xl";
}) {
  return (
    <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" aria-hidden="true" />
      <div className={`relative z-10 mx-auto ${width === "4xl" ? "max-w-4xl" : "max-w-6xl"}`}>
        {(top || back) && (
          <div className="mb-6">
            {top ?? (
              <GlassButton href={back!.href} variant="light" size="sm">
                <ArrowLeft className="w-4 h-4" /> {back!.label}
              </GlassButton>
            )}
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="min-w-0">
            {badge && (
              <span className="inline-block bg-[var(--greek-gold)] text-[var(--greek-blue)] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">
                {badge}
              </span>
            )}
            <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
              {emblem
                ? <Emblem3D kind={emblem} size={60} float={false} onDark className="shrink-0" />
                : Icon && <Icon className="w-10 h-10 md:w-12 md:h-12 text-[var(--greek-gold)] shrink-0" aria-hidden="true" />}
              {title}
            </h1>
            {subtitle && <p className="text-lg opacity-85 max-w-2xl">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
