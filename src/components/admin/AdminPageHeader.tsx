"use client";

import { LucideIcon } from "lucide-react";

interface AdminPageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Boutons d'action à droite du header (créer, exporter, actualiser...) — chaque page garde ses propres boutons. */
  actions?: React.ReactNode;
}

// Header standard de TOUTES les pages admin — même carte, mêmes tailles, même
// disposition partout (calqué sur le Tableau de bord). Ne pas re-styliser au
// cas par cas : passer icône/titre/sous-titre/actions ici à la place.
export default function AdminPageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] flex items-center gap-3">
          <Icon className="text-[var(--greek-gold)]" size={30} aria-hidden="true" />
          {title}
        </h1>
        {subtitle && (
          <p className="text-[var(--greek-bronze)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
    </div>
  );
}
