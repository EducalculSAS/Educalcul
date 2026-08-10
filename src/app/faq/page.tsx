import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight, ChevronDown } from "lucide-react";
import JsonLd from "@/components/JsonLd";
import Image from "next/image";
import FadeInSection from "@/components/home/FadeInSection";
import FaqList from "@/components/faq/FaqList";
import { FAQ_DATA } from "@/lib/faqData";
import GlassButton from "@/components/ui/GlassButton";

// Page publique statique : ISR pour servir depuis le cache plutôt que de
// re-render à chaque visite.
export const revalidate = 300;

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "C'est quoi Educalcul ?", acceptedAnswer: { "@type": "Answer", text: "Educalcul est une plateforme de mathématiques pour les enfants. On y trouve des leçons claires, des exercices, des quiz et un suivi détaillé pour progresser pas à pas." } },
    { "@type": "Question", name: "Pour quels niveaux c'est fait ?", acceptedAnswer: { "@type": "Answer", text: "Le contenu couvre du CP à la Terminale. L'enfant choisit son niveau pour accéder aux contenus adaptés à sa classe." } },
    { "@type": "Question", name: "Est-ce que ça suit le programme scolaire ?", acceptedAnswer: { "@type": "Answer", text: "Oui, tous les contenus sont alignés sur le programme officiel de l'Éducation Nationale." } },
    { "@type": "Question", name: "Comment créer un compte ?", acceptedAnswer: { "@type": "Answer", text: "Cliquez sur Inscription, choisissez votre type de compte, puis remplissez le formulaire. C'est rapide et vous pouvez commencer immédiatement." } },
    { "@type": "Question", name: "Quels abonnements sont proposés ?", acceptedAnswer: { "@type": "Answer", text: "Educalcul propose une formule Gratuite, une formule Famille et une formule Premium. Consultez la page Tarifs pour le détail des fonctionnalités incluses." } },
    { "@type": "Question", name: "L'abonnement se renouvelle-t-il automatiquement ?", acceptedAnswer: { "@type": "Answer", text: "Cela dépend de la formule choisie. Tous les détails sont indiqués clairement avant validation, et vous pouvez annuler à tout moment." } },
    { "@type": "Question", name: "Sur quels appareils peut-on l'utiliser ?", acceptedAnswer: { "@type": "Answer", text: "Educalcul fonctionne sur ordinateur, tablette et téléphone. Le site s'adapte à toutes les tailles d'écran." } },
    { "@type": "Question", name: "Comment suivre les progrès de mon enfant ?", acceptedAnswer: { "@type": "Answer", text: "Le tableau de bord parent affiche l'avancée, les exercices réalisés, les badges obtenus et les points à revoir." } },
  ],
};

const SYM = [
  { s: "∑", x: 6, y: 10, z: 96, d: 0, t: 7.2 },
  { s: "π", x: 87, y: 7, z: 72, d: 1.3, t: 8.5 },
  { s: "√", x: 12, y: 62, z: 58, d: 0.6, t: 9.1 },
  { s: "∫", x: 91, y: 48, z: 104, d: 2.1, t: 7.4 },
  { s: "Δ", x: 43, y: 14, z: 50, d: 0.9, t: 10.2 },
  { s: "∞", x: 65, y: 70, z: 66, d: 1.8, t: 8.0 },
  { s: "α", x: 2, y: 40, z: 44, d: 2.7, t: 9.3 },
  { s: "×", x: 76, y: 26, z: 54, d: 0.4, t: 7.8 },
  { s: "θ", x: 50, y: 78, z: 62, d: 2.0, t: 8.8 },
  { s: "β", x: 28, y: 53, z: 42, d: 3.3, t: 10.5 },
  { s: "≠", x: 58, y: 30, z: 46, d: 1.1, t: 9.7 },
  { s: "÷", x: 19, y: 84, z: 38, d: 2.9, t: 7.3 },
];

export default function FAQ() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <JsonLd data={faqSchema} />
      <Navbar />
      <main className="flex-grow pt-[64px]">
        {/* HERO — split, aperçu questions à droite */}
        <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white py-32">
          {SYM.map((cfg, i) => (
            <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none"
              style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, fontSize: `${cfg.z}px`, fontFamily: "Georgia,serif", color: "var(--greek-gold)", opacity: 0.1, animationDuration: `${cfg.t}s`, animationDelay: `${cfg.d}s` }}
            >{cfg.s}</span>
          ))}
          <div className="relative container mx-auto px-6 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(197,161,72,0.6)" }}>Aide & réponses</p>
                <h1 className="font-[family-name:var(--font-display)] font-bold leading-tight mb-4 text-white"
                  style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.4rem)" }}>
                  Questions fréquentes
                </h1>
                <p className="text-white/55 text-lg leading-relaxed mb-6">
                  Tout ce que vous devez savoir avant de commencer.
                </p>
              </div>
              <div className="hidden md:flex flex-col gap-3">
                {FAQ_DATA.map((section, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4 rounded-xl gap-4"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div>
                      <p className="text-sm font-[family-name:var(--font-display)] font-semibold" style={{ color: "rgba(240,237,232,0.8)" }}>{section.title}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(197,161,72,0.45)" }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-[var(--greek-cream)]">
          <div className="container mx-auto px-6 max-w-3xl">
            <FaqList />

            {/* Badge programme EN */}
            <FadeInSection
              translateY={20}
              durationMs={500}
              className="mt-10 mb-4 flex flex-col sm:flex-row items-center justify-between gap-5 p-5 rounded-2xl"
              style={{ background: "#fff", border: "1px solid var(--greek-border)", boxShadow: "0 2px 12px rgba(15,30,58,0.04)" }}
            >
              <div className="flex items-center gap-5 flex-shrink-0">
                <Image src="/logo-men.svg" alt="Ministère de l'Éducation Nationale" width={80} height={80} className="w-auto object-contain flex-shrink-0" style={{ height: 80 }} unoptimized />
                <div className="w-px h-10 hidden sm:block" style={{ background: "var(--greek-border)" }} />
                <Image src="/eduscol.svg" alt="Eduscol" width={80} height={26} className="w-auto object-contain flex-shrink-0" style={{ height: 26 }} unoptimized />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-sm font-bold" style={{ color: "var(--greek-blue)" }}>
                  100% aligné sur le programme officiel
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Du CP à la Terminale, toutes filières
                </p>
              </div>
              <GlassButton href="/programmes" variant="navy" size="sm" className="flex-shrink-0">
                Voir les programmes <ArrowRight size={14} />
              </GlassButton>
            </FadeInSection>

            {/* CTA */}
            <FadeInSection
              translateY={24}
              delayMs={150}
              className="mt-4 text-center p-10 rounded-2xl text-white"
              style={{ background: "var(--greek-blue)" }}
            >
              <h3 className="font-[family-name:var(--font-display)] font-bold text-xl mb-3">Vous n&apos;avez pas trouvé votre réponse ?</h3>
              <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.55)" }}>Notre équipe répond généralement en moins de 24h.</p>
              <GlassButton href="/contact" variant="gold">
                Nous contacter <ArrowRight className="w-4 h-4" />
              </GlassButton>
            </FadeInSection>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
