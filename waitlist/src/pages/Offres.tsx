/* Copie exacte de src/app/offres/page.tsx — sans Navbar/Footer/Link Next.js */
import { Star, Gift, GraduationCap, Gamepad2, LineChart, Smartphone, MessageCircle, ArrowRight, HelpCircle } from "lucide-react";

interface Props { onNavigate: (view: any) => void; }

export default function Offres({ onNavigate }: Props) {
  return (
    <main className="flex-grow pt-[64px]">
      {/* Hero Section */}
      <section className="bg-[var(--greek-cream)] py-16 text-center relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-4xl md:text-5xl mb-4 flex items-center justify-center gap-3">
              <Star className="w-12 h-12 text-[var(--greek-gold)]" />
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
            <Gift className="w-8 h-8 text-[var(--greek-gold)]" />
            Pourquoi choisir Educalcul ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-lg p-8 shadow-[0_2px_8px_rgba(169,113,66,0.15)] border border-[rgba(197,161,72,0.25)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-center">
              <GraduationCap className="w-12 h-12 text-[var(--greek-gold)] mx-auto mb-4" />
              <h5 className="text-xl font-bold text-[var(--greek-blue)] mb-3">Pédagogie Adaptée</h5>
              <p className="text-gray-600">Contenu aligné sur les programmes scolaires français, adapté au rythme de chaque enfant.</p>
            </div>
            <div className="bg-white rounded-lg p-8 shadow-[0_2px_8px_rgba(169,113,66,0.15)] border border-[rgba(197,161,72,0.25)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-center">
              <Gamepad2 className="w-12 h-12 text-[var(--greek-gold)] mx-auto mb-4" />
              <h5 className="text-xl font-bold text-[var(--greek-blue)] mb-3">Apprentissage Ludique</h5>
              <p className="text-gray-600">Jeux, badges et récompenses pour maintenir la motivation et l'engagement.</p>
            </div>
            <div className="bg-white rounded-lg p-8 shadow-[0_2px_8px_rgba(169,113,66,0.15)] border border-[rgba(197,161,72,0.25)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-center">
              <LineChart className="w-12 h-12 text-[var(--greek-gold)] mx-auto mb-4" />
              <h5 className="text-xl font-bold text-[var(--greek-blue)] mb-3">Suivi Personnalisé</h5>
              <p className="text-gray-600">Tableaux de bord détaillés pour parents et enfants, avec recommandations personnalisées.</p>
            </div>
            <div className="bg-white rounded-lg p-8 shadow-[0_2px_8px_rgba(169,113,66,0.15)] border border-[rgba(197,161,72,0.25)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-center">
              <Smartphone className="w-12 h-12 text-[var(--greek-gold)] mx-auto mb-4" />
              <h5 className="text-xl font-bold text-[var(--greek-blue)] mb-3">Multi-Appareils</h5>
              <p className="text-gray-600">Accessible sur ordinateur, tablette et smartphone, avec synchronisation automatique.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 relative z-10">
        <div className="container mx-auto px-4">
          <h2 className="text-center mb-12 font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl flex items-center justify-center gap-3">
            <MessageCircle className="w-8 h-8 text-[var(--greek-gold)]" />
            Ce que disent les parents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              { text: "Ma fille de CE1 adore Educalcul ! Elle fait ses exercices de maths avec plaisir et ses notes à l'école se sont nettement améliorées. Le système de badges la motive énormément.", by: "Marie, maman de Léa (CE1)" },
              { text: "Excellent outil pour réviser les bases. Mon fils de CM2 prépare son entrée en 6ème avec confiance grâce aux exercices progressifs et bien expliqués.", by: "Thomas, papa de Lucas (CM2)" },
              { text: "Le suivi parental est fantastique ! Je peux voir exactement où en sont mes enfants et les aider là où ils en ont besoin. Très pratique pour les devoirs.", by: "Sophie, maman de 3 enfants" },
              { text: "Interface très intuitive, même pour les plus jeunes. Mon fils de CP arrive à naviguer tout seul et fait ses exercices en autonomie.", by: "David, papa de Nathan (CP)" },
            ].map((t, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-[rgba(197,161,72,0.25)] italic text-gray-700 relative">
                <div className="absolute top-4 left-4 text-4xl text-[var(--greek-gold)] opacity-20 font-serif">"</div>
                <p className="mb-4 relative z-10">{t.text}</p>
                <div className="font-bold text-[var(--greek-blue)] not-italic">- {t.by}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick FAQ Section */}
      <section className="py-12 relative z-10">
        <div className="container mx-auto px-4">
          <h2 className="text-center mb-12 font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl flex items-center justify-center gap-3">
            <HelpCircle className="w-8 h-8 text-[var(--greek-gold)]" />
            Questions Fréquentes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-8">
            {[
              { q: "Comment fonctionne Educalcul ?", a: "Educalcul propose des exercices interactifs et des leçons adaptées au niveau de chaque enfant, avec un suivi personnalisé pour les parents." },
              { q: "Pour quels âges est-ce adapté ?", a: "Nos contenus couvrent du CP au CM2, soit les enfants de 6 à 11 ans, avec des niveaux progressifs adaptés à chaque classe." },
              { q: "Les contenus sont-ils régulièrement mis à jour ?", a: "Oui, nous ajoutons régulièrement de nouveaux exercices, leçons et fonctionnalités pour enrichir l'expérience d'apprentissage." },
              { q: "Comment puis-je suivre les progrès ?", a: "Un tableau de bord détaillé vous permet de suivre les progrès de vos enfants et de recevoir des recommandations personnalisées." },
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-[rgba(197,161,72,0.25)]">
                <h5 className="text-lg font-bold text-[var(--greek-blue)] mb-2">{item.q}</h5>
                <p className="text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <button onClick={() => onNavigate('faq')} className="btn-outline-light-greek inline-flex items-center gap-2 cursor-pointer">
              Voir toutes les questions <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
