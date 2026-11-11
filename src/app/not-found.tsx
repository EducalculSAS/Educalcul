import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StateScreen from "@/components/StateScreen";

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <main className="flex-grow flex items-center justify-center">
        <StateScreen code="404" title="Page introuvable" actions={[{ label: "Retour à l'accueil", href: "/" }]}>
          Cette page n&apos;existe pas ou a été déplacée. Retournez à l&apos;accueil pour continuer.
        </StateScreen>
      </main>
      <Footer />
    </div>
  );
}
