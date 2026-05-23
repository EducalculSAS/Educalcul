"use client";

import Link from "next/link";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)] items-center justify-center px-4">
      <div className="text-center max-w-md">
        <img src="/logo.png" alt="Educalcul" className="w-16 h-16 object-contain mx-auto mb-4 opacity-30" />
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--greek-blue)] mb-3">
          Une erreur est survenue
        </h1>
        <p className="text-gray-500 mb-8">
          Quelque chose s'est mal passé. Essayez de recharger la page ou revenez à l'accueil.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:opacity-90 transition-all"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="px-6 py-3 border-2 border-[var(--greek-blue)] text-[var(--greek-blue)] font-bold rounded-xl hover:bg-[var(--greek-blue)] hover:text-white transition-all"
          >
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
