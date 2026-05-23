import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <main className="flex-grow flex items-center justify-center pt-[64px] px-4">
        <div className="text-center max-w-md">
          <div className="font-[family-name:var(--font-display)] text-8xl font-black text-[var(--greek-blue)] opacity-10 mb-0 leading-none">
            404
          </div>
          <img src="/logo.png" alt="Educalcul" className="w-16 h-16 object-contain mx-auto mb-4 opacity-30" />
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--greek-blue)] mb-3">
            Page introuvable
          </h1>
          <p className="text-gray-500 mb-8">
            Cette page n'existe pas ou a été déplacée. Retournez à l'accueil pour continuer.
          </p>
          <Link
            href="/"
            className="btn-primary-greek inline-flex items-center gap-2"
          >
            Retour à l'accueil
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
