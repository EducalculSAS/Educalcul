import { createElement } from "react";
import Emblem3D from "@/components/Emblem3D";
import { getFolderIcon } from "@/lib/folderIcons";

/**
 * Illustration d'un dossier du catalogue : le dossier en relief du site, avec en pastille l'icône et la couleur que
 * l'équipe a choisies pour ce dossier (on garde son repère sans casser l'unité visuelle).
 */
export default function FolderEmblem({ icon, color }: { icon?: string | null; color?: string | null }) {
  return (
    <span className="relative inline-block mb-3 transition-transform duration-300 group-hover:scale-110" aria-hidden="true">
      <Emblem3D kind="folder" size={84} float={false} />
      {/* La pastille n'apparaît que si l'équipe a choisi une icône propre au dossier : l'icône « dossier » par défaut ferait doublon. */}
      {icon && icon !== "folder" && (
        <span className="absolute -right-1 bottom-1 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-[rgba(197,161,72,0.4)]" style={{ color: color || "var(--greek-blue)" }}>
          {createElement(getFolderIcon(icon), { size: 16 })}
        </span>
      )}
    </span>
  );
}
