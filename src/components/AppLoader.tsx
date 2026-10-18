import Image from "next/image";

/** Écran d'attente plein écran (connexion, déconnexion, paiement…). N'apparaît
 * qu'après 150 ms : une attente courte ne produit aucun flash. */
export default function AppLoader() {
  return (
    <div className="min-h-screen bg-[var(--greek-cream)] flex items-center justify-center appear-late" aria-busy="true" aria-label="Chargement">
      <div className="text-center">
        <Image src="/logo.png" alt="Educalcul" width={64} height={64} priority className="w-16 h-16 mx-auto mb-4 animate-pulse" />
        <div className="flex gap-1.5 justify-center">
          <span className="w-2 h-2 bg-[var(--greek-blue)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-[var(--greek-gold)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-[var(--greek-blue)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
