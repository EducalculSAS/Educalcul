"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { useSubscription } from "@/lib/useSubscription";

/** Le seul bout de /parent/dashboard qui dépend du plan d'abonnement (accès
 * au rapport détaillé ou non) : isolé en client island, le reste de la carte
 * enfant est rendu côté serveur. */
export default function ChildReportLink({ childId }: { childId: string }) {
  const sub = useSubscription();

  if (sub.features.detailed_reports) {
    return (
      <Link href={`/parent/child/${childId}`} className="flex items-center justify-center w-full py-2.5 px-4 bg-[var(--greek-blue)] text-white rounded-xl hover:opacity-90 transition-all font-bold text-sm group shadow-sm">
        Rapport complet <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </Link>
    );
  }

  return (
    <Link href="/parent/subscription" className="flex items-center justify-center w-full py-2.5 px-4 bg-gray-100 border border-[rgba(197,161,72,0.25)] text-gray-500 rounded-xl hover:bg-gray-200 transition-all font-medium text-sm">
      <Lock className="w-4 h-4 mr-2" /> Débloquer le rapport
    </Link>
  );
}
