"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Star, Gift, GraduationCap, Gamepad2, LineChart, Smartphone, MessageCircle, ArrowRight, HelpCircle } from "lucide-react";
import Link from "next/link";

export default function Offres() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />

      <main className="flex-grow pt-[64px]">
        {/* Hero Section */}
        <section className="bg-[var(--greek-cream)] py-16 text-center relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-4xl md:text-5xl mb-4 flex items-center justify-center gap-3">
                <Star className="w-10 h-10 md:w-12 md:h-12 text-[var(--greek-gold)] fill-current" />
                Nos Offres Educalcul
              </h1>
              <p className="text-[var(--greek-blue)] text-xl opacity-80">
                Découvrez les avantages d'Educalcul pour l'apprentissage des mathématiques de vos enfants.
              </p>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-12 relative z-10">
          <div className="container mx-auto px-4">
            <h2 className="text-center mb-12 font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl flex items-center justify-center gap-3">
              <Gift className="w-8 h-8 text-[var(--greek-bronze)]" />
              Pourquoi choisir Educalcul ?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Benefit 1 */}
              <div className="bg-white rounded-lg p-8 shadow-[0_2px_8px_rgba(169,113,66,0.15)] border border-[var(--card-border-antique)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[var(--greek-bronze)] to-[var(--greek-gold)] rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-md">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <h5 className="text-xl font-bold text-[var(--greek-blue)] mb-3">Pédagogie Adaptée</h5>
                <p className="text-gray-600">
                  Contenu aligné sur les programmes scolaires français, 
                  adapté au rythme de chaque enfant.
                </p>
              </div>
              
              {/* Benefit 2 */}
              <div className="bg-white rounded-lg p-8 shadow-[0_2px_8px_rgba(169,113,66,0.15)] border border-[var(--card-border-antique)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[var(--greek-bronze)] to-[var(--greek-gold)] rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-md">
                  <Gamepad2 className="w-8 h-8" />
                </div>
                <h5 className="text-xl font-bold text-[var(--greek-blue)] mb-3">Apprentissage Ludique</h5>
                <p className="text-gray-600">
                  Jeux, badges et récompenses pour maintenir 
                  la motivation et l'engagement.
                </p>
              </div>
              
              {/* Benefit 3 */}
              <div className="bg-white rounded-lg p-8 shadow-[0_2px_8px_rgba(169,113,66,0.15)] border border-[var(--card-border-antique)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[var(--greek-bronze)] to-[var(--greek-gold)] rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-md">
                  <LineChart className="w-8 h-8" />
                </div>
                <h5 className="text-xl font-bold text-[var(--greek-blue)] mb-3">Suivi Personnalisé</h5>
                <p className="text-gray-600">
                  Tableaux de bord détaillés pour parents et enfants, 
                  avec recommandations personnalisées.
                </p>
              </div>
              
              {/* Benefit 4 */}
              <div className="bg-white rounded-lg p-8 shadow-[0_2px_8px_rgba(169,113,66,0.15)] border border-[var(--card-border-antique)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[var(--greek-bronze)] to-[var(--greek-gold)] rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-md">
                  <Smartphone className="w-8 h-8" />
                </div>
                <h5 className="text-xl font-bold text-[var(--greek-blue)] mb-3">Multi-Appareils</h5>
                <p className="text-gray-600">
                  Accessible sur ordinateur, tablette et smartphone, 
                  avec synchronisation automatique.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-12 relative z-10 bg-white/50">
          <div className="container mx-auto px-4">
            <h2 className="text-center mb-12 font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl flex items-center justify-center gap-3">
              <MessageCircle className="w-8 h-8 text-[var(--greek-bronze)]" />
              Ce que disent les parents
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-[var(--card-border-antique)] italic text-gray-700 relative">
                <div className="absolute top-4 left-4 text-4xl text-[var(--greek-bronze)] opacity-20 font-serif">"</div>
                <p className="mb-4 relative z-10">
                  Ma fille de CE1 adore Educalcul ! Elle fait ses exercices de maths avec plaisir 
                  et ses notes à l'école se sont nettement améliorées. Le système de badges la motive énormément.
                </p>
                <div className="font-bold text-[var(--greek-blue)] not-italic">- Marie, maman de Léa (CE1)</div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-[var(--card-border-antique)] italic text-gray-700 relative">
                <div className="absolute top-4 left-4 text-4xl text-[var(--greek-bronze)] opacity-20 font-serif">"</div>
                <p className="mb-4 relative z-10">
                  Excellent outil pour réviser les bases. Mon fils de CM2 prépare son entrée en 6ème 
                  avec confiance grâce aux exercices progressifs et bien expliqués.
                </p>
                <div className="font-bold text-[var(--greek-blue)] not-italic">- Thomas, papa de Lucas (CM2)</div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-[var(--card-border-antique)] italic text-gray-700 relative">
                <div className="absolute top-4 left-4 text-4xl text-[var(--greek-bronze)] opacity-20 font-serif">"</div>
                <p className="mb-4 relative z-10">
                  Le suivi parental est fantastique ! Je peux voir exactement où en sont mes enfants 
                  et les aider là où ils en ont besoin. Très pratique pour les devoirs.
                </p>
                <div className="font-bold text-[var(--greek-blue)] not-italic">- Sophie, maman de 3 enfants</div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-[var(--card-border-antique)] italic text-gray-700 relative">
                <div className="absolute top-4 left-4 text-4xl text-[var(--greek-bronze)] opacity-20 font-serif">"</div>
                <p className="mb-4 relative z-10">
                  Interface très intuitive, même pour les plus jeunes. Mon fils de CP arrive 
                  à naviguer tout seul et fait ses exercices en autonomie.
                </p>
                <div className="font-bold text-[var(--greek-blue)] not-italic">- David, papa de Nathan (CP)</div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick FAQ Section */}
        <section className="py-12 relative z-10">
          <div className="container mx-auto px-4">
            <h2 className="text-center mb-12 font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl flex items-center justify-center gap-3">
              <HelpCircle className="w-8 h-8 text-[var(--greek-bronze)]" />
              Questions Fréquentes
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-[var(--card-border-antique)]">
                <h5 className="text-lg font-bold text-[var(--greek-blue)] mb-2">Comment fonctionne Educalcul ?</h5>
                <p className="text-gray-600">
                  Educalcul propose des exercices interactifs et des leçons adaptées au niveau de chaque enfant, 
                  avec un suivi personnalisé pour les parents.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-[var(--card-border-antique)]">
                <h5 className="text-lg font-bold text-[var(--greek-blue)] mb-2">Pour quels âges est-ce adapté ?</h5>
                <p className="text-gray-600">
                  Nos contenus couvrent du CP au CM2, soit les enfants de 6 à 11 ans, 
                  avec des niveaux progressifs adaptés à chaque classe.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-[var(--card-border-antique)]">
                <h5 className="text-lg font-bold text-[var(--greek-blue)] mb-2">Les contenus sont-ils régulièrement mis à jour ?</h5>
                <p className="text-gray-600">
                  Oui, nous ajoutons régulièrement de nouveaux exercices, leçons et fonctionnalités 
                  pour enrichir l'expérience d'apprentissage.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-[var(--card-border-antique)]">
                <h5 className="text-lg font-bold text-[var(--greek-blue)] mb-2">Comment puis-je suivre les progrès ?</h5>
                <p className="text-gray-600">
                  Un tableau de bord détaillé vous permet de suivre les progrès de vos enfants 
                  et de recevoir des recommandations personnalisées.
                </p>
              </div>
            </div>
            
            <div className="text-center">
              <Link href="/faq" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[var(--greek-bronze)] text-[var(--greek-bronze)] font-bold rounded-lg hover:bg-[var(--greek-bronze)] hover:text-white transition-all duration-300">
                Voir toutes les questions <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
