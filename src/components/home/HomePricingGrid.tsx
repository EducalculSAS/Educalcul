"use client";

import { useRouter } from "next/navigation";
import { RevealGroup, RevealItem } from "@/components/home/Reveal";
import { PlanCard } from "@/components/tarifs/TarifsInteractive";
import type { Plan } from "@/lib/plans";

/** Client wrapper : PlanCard attend des handlers (onOpen, onToggleCompare) —
 * inutilisables en props depuis un Server Component.
 *
 * Comme sur /tarifs, seul le bouton "Voir les détails" doit être cliquable
 * (pas toute la fiche) — donc pas de <Link> englobant ici : `onOpen` navigue
 * lui-même vers /tarifs, le reste de la carte (en-tête, prix) reste inerte.
 *
 * `plans` arrive trié par prix croissant (même ordre que /tarifs) — on garde
 * cet ordre tel quel, sans réarrangement artificiel : la formule "Populaire"
 * (2e du tri par prix) se retrouve donc naturellement au centre. `items-stretch`
 * (comportement par défaut de la grille, comme sur /tarifs) pour que les
 * trois fiches aient la même hauteur quel que soit leur contenu. */
export default function HomePricingGrid({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const top3 = plans.slice(0, 3);

  return (
    <RevealGroup className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch pt-4" stagger={0.1}>
      {top3.map((plan, i) => (
        <RevealItem key={plan.id} className="h-full">
          <PlanCard
            plan={plan}
            idx={i}
            popular={top3.length > 1 && i === 1}
            hideChildren={false}
            cardsVisible
            onOpen={() => router.push("/tarifs")}
            compareChecked={false}
            onToggleCompare={() => {}}
            hideCompare
          />
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
