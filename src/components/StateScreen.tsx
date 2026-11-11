import type { ReactNode } from "react";
import Emblem3D, { type EmblemKind } from "@/components/Emblem3D";
import GlassButton from "@/components/ui/GlassButton";

interface Action { label: string; href?: string; onClick?: () => void; variant?: "navy" | "outline" }

/**
 * Écran d'état centré (page introuvable, erreur, accès refusé, contenu absent) : le même partout, pour qu'aucune
 * page ne retombe sur une ligne de texte nue. `code` affiche un grand filigrane (« 404 »).
 */
export default function StateScreen({ emblem = "compass", code, title, children, actions = [], fill = "screen" }: {
  emblem?: EmblemKind;
  code?: string;
  title: string;
  children?: ReactNode;
  actions?: Action[];
  /** « screen » occupe la hauteur de la fenêtre ; « block » se pose dans une page qui a déjà son en-tête. */
  fill?: "screen" | "block";
}) {
  return (
    <div className={`flex items-center justify-center px-4 text-center ${fill === "screen" ? "min-h-[70vh] pt-24 pb-16" : "py-16"}`}>
      <div className="max-w-md">
        {code && (
          <div className="font-[family-name:var(--font-display)] text-8xl font-black text-[var(--greek-blue)] opacity-10 leading-none mb-1" aria-hidden="true">{code}</div>
        )}
        <div className="mb-4"><Emblem3D kind={emblem} size={96} /></div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--greek-blue)] mb-3">{title}</h1>
        {children && <p className="text-gray-500 mb-8">{children}</p>}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-3 justify-center">
            {actions.map((a, i) => (
              <GlassButton key={a.label} href={a.href} onClick={a.onClick} variant={a.variant ?? (i === 0 ? "navy" : "outline")}>{a.label}</GlassButton>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
