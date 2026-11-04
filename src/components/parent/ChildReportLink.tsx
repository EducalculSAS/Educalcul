"use client";

import { ArrowRight, Lock } from "lucide-react";
import { useSubscription } from "@/lib/useSubscription";
import GlassButton from "@/components/ui/GlassButton";

/** Le seul bout de /parent/dashboard qui dépend du plan d'abonnement (accès
 * au rapport détaillé ou non) : isolé en client island, le reste de la carte
 * enfant est rendu côté serveur. */
export default function ChildReportLink({ childId }: { childId: string }) {
  const sub = useSubscription();

  if (sub.features.detailed_reports) {
    return (
      <GlassButton href={`/parent/child/${childId}`} variant="navy" size="sm" fullWidth className="group font-bold whitespace-nowrap">
        Rapport complet <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </GlassButton>
    );
  }

  return (
    <GlassButton href="/parent/subscription" variant="ghost" size="sm" fullWidth className="whitespace-nowrap">
      <Lock className="w-4 h-4" /> Débloquer le rapport
    </GlassButton>
  );
}
