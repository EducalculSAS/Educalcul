"use client";

import Image from "next/image";
import GlassButton from "@/components/ui/GlassButton";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)] items-center justify-center px-4">
      <div className="text-center max-w-md">
        <Image src="/logo.png" alt="Educalcul" width={64} height={64} className="w-16 h-16 object-contain mx-auto mb-4 opacity-30" />
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--greek-blue)] mb-3">
          Une erreur est survenue
        </h1>
        <p className="text-gray-500 mb-8">
          Quelque chose s&apos;est mal passé. Essayez de recharger la page ou revenez à l&apos;accueil.
        </p>
        <div className="flex gap-4 justify-center">
          <GlassButton onClick={reset} variant="navy" size="sm">
            Réessayer
          </GlassButton>
          <GlassButton href="/" variant="outline" size="sm">
            Accueil
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
