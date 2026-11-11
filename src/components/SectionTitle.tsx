import type { ReactNode } from "react";
import Emblem3D, { type EmblemKind } from "@/components/Emblem3D";

/**
 * Titre d'une carte de section : le même partout (emblème en relief, texte bleu nuit, même taille, même police).
 * `divider` ajoute le filet doré sous le titre (cartes de réglages).
 */
export default function SectionTitle({ emblem, children, divider = false, tone = "blue", className = "" }: {
  emblem: EmblemKind;
  children: ReactNode;
  divider?: boolean;
  tone?: "blue" | "danger";
  className?: string;
}) {
  return (
    <h2 className={`text-xl font-bold flex items-center gap-3 ${tone === "danger" ? "text-red-700" : "text-[var(--greek-blue)]"} ${divider ? "mb-6 pb-3 border-b border-[rgba(197,161,72,0.25)]" : "mb-4"} ${className}`}>
      <span className="shrink-0 inline-flex"><Emblem3D kind={emblem} size={28} float={false} /></span>
      <span className="min-w-0">{children}</span>
    </h2>
  );
}
