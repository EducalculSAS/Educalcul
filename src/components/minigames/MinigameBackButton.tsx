"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";

/** Bouton "retour" affiché en haut à gauche de tous les mini-jeux. Annule la
 * partie en cours (si une session a été créée et n'est pas déjà terminée)
 * pour qu'elle ne compte pas dans la limite quotidienne — revenir plus tard
 * sur le jeu relance donc une partie normale plutôt que de rester bloqué. */
export default function MinigameBackButton({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();

  const handleBack = async () => {
    if (sessionId) {
      try {
        await fetch(`/api/child/minigames/session/${sessionId}/abandon`, { method: "POST" });
      } catch {
        // Best-effort — un abandon manqué n'empêche pas de revenir au catalogue.
      }
    }
    router.push("/child/minigames");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4">
      <GlassIconButton icon={ArrowLeft} onClick={handleBack} color="navy" size="sm" aria-label="Retour aux mini-jeux" />
    </div>
  );
}
