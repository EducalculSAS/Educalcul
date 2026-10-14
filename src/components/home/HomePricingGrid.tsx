"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlansGrid } from "@/components/tarifs/TarifsInteractive";
import type { Plan } from "@/lib/plans";
import type { BillingPeriod } from "@/lib/billingPeriods";
import type { PricingLayout } from "@/lib/pricingConfig";

/**
 * Aperçu des tarifs de la page d'accueil : les mêmes fiches, dans le même ordre et avec le même choix de durée
 * (1 mois, 3 mois, 1 an) que la page Tarifs, car c'est le même composant (PlansGrid) avec les mêmes réglages admin.
 * Seul le bouton « Voir les détails » est cliquable : il mène à /tarifs.
 */
export default function HomePricingGrid({
  plans,
  periods,
  layout,
  popularAuto,
}: {
  plans: Plan[];
  periods: BillingPeriod[];
  layout: PricingLayout;
  popularAuto: boolean;
}) {
  const router = useRouter();
  const [cardsVisible, setCardsVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCardsVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="pt-4">
      <style>{`@keyframes cardIn { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <PlansGrid
        plans={plans}
        periods={periods}
        layout={layout}
        popularAuto={popularAuto}
        cardsVisible={cardsVisible}
        hideCompare
        comparePlanIds={new Set()}
        onToggleCompare={() => {}}
        onOpen={() => router.push("/tarifs")}
      />
    </div>
  );
}
