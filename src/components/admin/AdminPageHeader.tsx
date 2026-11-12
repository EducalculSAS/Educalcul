"use client";

import { History, MessageSquare, ScanSearch, Gamepad2, type LucideIcon } from "lucide-react";
import Emblem3D, { type EmblemKind } from "@/components/Emblem3D";

type ServerSafeAdminIcon = "history" | "message-square" | "scan-search" | "gamepad-2";

const SERVER_SAFE_ICONS: Record<ServerSafeAdminIcon, LucideIcon> = {
  history: History,
  "message-square": MessageSquare,
  "scan-search": ScanSearch,
  "gamepad-2": Gamepad2,
};

/** Emblème en relief associé à l'icône de chaque page (les pages continuent de passer leur icône Lucide). */
const EMBLEM_FOR_ICON: Record<string, EmblemKind> = {
  BarChart2: "target", ChartNoAxesColumn: "target", RotateCcwClock: "clock", BookOpen: "book", Bug: "alert", Calendar: "calendar", CreditCard: "card", Crown: "crown",
  FileText: "book", GraduationCap: "cap", Keyboard: "calculator", Mail: "mail", Scale: "shield", ShieldCheck: "shield",
  Shield: "shield", Star: "star", ToggleRight: "puzzle", Users: "family", History: "clock", MessageSquare: "chat",
  ScanSearch: "sparkles", Gamepad2: "gamepad",
};

interface AdminPageHeaderProps {
  /** Client Components may still pass a Lucide component directly. */
  icon?: LucideIcon;
  /** Server Components must pass this serializable name instead of a function. */
  iconName?: ServerSafeAdminIcon;
  title: string;
  subtitle?: string;
  /** Boutons d'action à droite du header (créer, exporter, actualiser...) — chaque page garde ses propres boutons. */
  actions?: React.ReactNode;
}

// Header standard de TOUTES les pages admin — même carte, mêmes tailles, même
// disposition partout (calqué sur le Tableau de bord). Ne pas re-styliser au
// cas par cas : passer icône/titre/sous-titre/actions ici à la place.
export default function AdminPageHeader({
  icon,
  iconName,
  title,
  subtitle,
  actions,
}: AdminPageHeaderProps) {
  const Icon = iconName ? SERVER_SAFE_ICONS[iconName] : icon;
  const emblem = Icon ? EMBLEM_FOR_ICON[(Icon as { displayName?: string }).displayName ?? ""] : undefined;

  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] flex items-center gap-3">
          {emblem ? <Emblem3D kind={emblem} size={42} float={false} className="shrink-0" /> : Icon ? <Icon className="text-[var(--greek-gold)]" size={30} aria-hidden="true" /> : null}
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
