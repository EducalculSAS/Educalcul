"use client";

import StateScreen from "@/components/StateScreen";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-[var(--greek-cream)] flex items-center justify-center">
      <StateScreen emblem="calculator" title="Une erreur est survenue" actions={[{ label: "Réessayer", onClick: reset }, { label: "Accueil", href: "/" }]}>
        Quelque chose s&apos;est mal passé. Essayez de recharger la page ou revenez à l&apos;accueil.
      </StateScreen>
    </div>
  );
}
