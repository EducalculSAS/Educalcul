"use client";

import { useState, type DragEvent } from "react";
import { ChevronRight, Home } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

interface Crumb {
  id: number;
  name: string;
}

/**
 * Fil d'Ariane des bibliothèques admin (cours, exercices, quiz) — partagé
 * par les trois, qui en avaient chacune une copie.
 *
 * Boutons liquid glass, comme le reste du site : le dossier courant en navy,
 * les ancêtres en contour. Chaque étape reste une CIBLE DE DÉPÔT (on y lâche un
 * élément pour le ranger dans ce dossier) : GlassButton ne gère pas le
 * glisser-déposer, d'où l'enveloppe qui porte les événements de drag.
 *
 * Le parent passe un fil d'Ariane DÉRIVÉ de la liste des dossiers en mémoire :
 * il change au clic, sans attendre le réseau.
 */
export default function AdminBreadcrumbs({
  crumbs,
  currentFolderId,
  onNavigate,
  onDropOnto,
}: {
  crumbs: Crumb[];
  currentFolderId: number | null;
  onNavigate: (folderId: number | null) => void;
  onDropOnto: (e: DragEvent, folderId: number | null) => void;
}) {
  const [dragOver, setDragOver] = useState<number | "root" | null>(null);

  const dropZone = (target: number | null) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(target ?? "root");
    },
    onDragLeave: () => setDragOver(null),
    onDrop: (e: DragEvent) => {
      setDragOver(null);
      onDropOnto(e, target);
    },
  });

  const highlight = (key: number | "root") =>
    dragOver === key ? "rounded-full ring-2 ring-[var(--greek-gold)] ring-offset-2 ring-offset-transparent" : "";

  return (
    <nav
      aria-label="Fil d'Ariane"
      className="flex items-center gap-1.5 overflow-x-auto p-2 rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm backdrop-blur-[20px] backdrop-saturate-[1.2]"
      style={{ background: "rgba(255,255,255,0.6)" }}
    >
      <div {...dropZone(null)} className={`shrink-0 transition-shadow ${highlight("root")}`}>
        <GlassButton
          size="sm"
          variant={currentFolderId === null ? "navy" : "outline"}
          onClick={() => onNavigate(null)}
        >
          <Home size={15} aria-hidden="true" />
          Racine
        </GlassButton>
      </div>

      {crumbs.map((crumb, index) => {
        const isCurrent = index === crumbs.length - 1;
        return (
          <div key={crumb.id} className="flex items-center gap-1.5 shrink-0">
            <ChevronRight size={14} className="text-gray-400" aria-hidden="true" />
            <div {...dropZone(crumb.id)} className={`transition-shadow ${highlight(crumb.id)}`}>
              <GlassButton
                size="sm"
                variant={isCurrent ? "navy" : "outline"}
                onClick={() => onNavigate(crumb.id)}
              >
                <span className="whitespace-nowrap">{crumb.name}</span>
              </GlassButton>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
