"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MathBackground from "@/components/MathBackground";
import {
  BookOpen,
  CheckCircle,
  TrendingUp,
  UserPlus,
  CreditCard,
  GraduationCap,
  Trophy,
  ArrowRight,
  LogIn,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-grow pt-[64px] relative">
        <MathBackground />
        {/* Hero Section */}
        <header className="hero-section text-center relative flex items-center justify-center min-h-[calc(100vh-64px)] p-0">
          <div className="container mx-auto px-4 z-10 relative">
            <div className="bg-white/95 rounded-[15px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border-[2px] border-[rgba(52,73,94,0.1)] p-8 my-8 max-w-4xl mx-auto backdrop-blur-sm">
              <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-4xl md:text-5xl lg:text-6xl mb-4">
                Educalcul : Maîtrisez les Mathématiques
              </h1>
              <p className="text-[var(--greek-blue)] text-xl mb-8">
                Votre parcours personnalisé vers la réussite en maths, étape par
                étape, avec un suivi adapté.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col items-center gap-4 mt-8">
                <Link
                  href="/auth/inscription"
                  className="btn-primary-greek flex items-center gap-2 text-lg"
                >
                  Commencez l'aventure <ArrowRight className="w-5 h-5" />
                </Link>

                <div className="mt-4">
                  <p className="mb-2 text-gray-500">Déjà membre ?</p>
                  <Link
                    href="/auth/connexion"
                    className="btn-outline-light-greek flex items-center gap-2"
                  >
                    <LogIn className="w-5 h-5" /> Connectez-vous
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Features Section */}
        <section className="py-10 bg-[var(--greek-cream)] relative z-10">
          <div className="container mx-auto px-4">
            <h2 className="text-center mb-12 font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl md:text-4xl">
              Pourquoi choisir Educalcul ?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {/* Feature 1 */}
              <div className="dashboard-card h-full p-6">
                <div className="flex flex-col items-center h-full">
                  <BookOpen className="w-12 h-12 text-[var(--greek-bronze)] mb-4" />
                  <h5 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-3">
                    Apprentissage Guidé
                  </h5>
                  <p className="text-gray-600">
                    Des cours et exercices structurés avec indices et
                    corrections pour ne jamais être bloqué.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="dashboard-card h-full p-6">
                <div className="flex flex-col items-center h-full">
                  <CheckCircle className="w-12 h-12 text-[var(--greek-bronze)] mb-4" />
                  <h5 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-3">
                    Évaluation Continue
                  </h5>
                  <p className="text-gray-600">
                    Des QCM et quiz pour valider vos connaissances et identifier
                    les points à renforcer.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="dashboard-card h-full p-6">
                <div className="flex flex-col items-center h-full">
                  <TrendingUp className="w-12 h-12 text-[var(--greek-bronze)] mb-4" />
                  <h5 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-xl mb-3">
                    Suivi Parents & Élèves
                  </h5>
                  <p className="text-gray-600">
                    Visualisez les progrès et l'avancement grâce à des
                    statistiques claires et une barre de complétion.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works Section */}
        <section className="py-20 relative z-10">
          <div className="container mx-auto px-4">
            <div className="bg-white/95 rounded-[15px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border-[2px] border-[rgba(52,73,94,0.1)] p-8 backdrop-blur-sm">
              <h2 className="text-center mb-12 font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl md:text-4xl">
                Comment ça marche ?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
                {/* Step 1 */}
                <div className="flex flex-col items-center group">
                  <div className="mb-4 transform transition-transform duration-300 group-hover:scale-110">
                    <UserPlus className="w-12 h-12 text-[var(--greek-bronze)] group-hover:text-[var(--greek-gold)]" />
                  </div>
                  <h5 className="font-[family-name:var(--font-display)] font-bold text-lg mb-2 text-[var(--greek-blue)]">
                    1. Inscrivez-vous
                  </h5>
                  <p className="text-gray-600">
                    Créez votre compte élève ou parent en quelques clics.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center group">
                  <div className="mb-4 transform transition-transform duration-300 group-hover:scale-110">
                    <CreditCard className="w-12 h-12 text-[var(--greek-bronze)] group-hover:text-[var(--greek-gold)]" />
                  </div>
                  <h5 className="font-[family-name:var(--font-display)] font-bold text-lg mb-2 text-[var(--greek-blue)]">
                    2. Abonnez-vous
                  </h5>
                  <p className="text-gray-600">
                    Choisissez l'offre qui vous convient pour débloquer tout le
                    contenu.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center group">
                  <div className="mb-4 transform transition-transform duration-300 group-hover:scale-110">
                    <GraduationCap className="w-12 h-12 text-[var(--greek-bronze)] group-hover:text-[var(--greek-gold)]" />
                  </div>
                  <h5 className="font-[family-name:var(--font-display)] font-bold text-lg mb-2 text-[var(--greek-blue)]">
                    3. Apprenez
                  </h5>
                  <p className="text-gray-600">
                    Accédez aux cours, exercices et QCM adaptés à votre niveau.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="flex flex-col items-center group">
                  <div className="mb-4 transform transition-transform duration-300 group-hover:scale-110">
                    <Trophy className="w-12 h-12 text-[var(--greek-bronze)] group-hover:text-[var(--greek-gold)]" />
                  </div>
                  <h5 className="font-[family-name:var(--font-display)] font-bold text-lg mb-2 text-[var(--greek-blue)]">
                    4. Progressez
                  </h5>
                  <p className="text-gray-600">
                    Suivez vos résultats et voyez votre progression en temps
                    réel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
