"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CircleHelp, Info, UserCog, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

type FAQItem = {
  question: string;
  answer: React.ReactNode;
};

type FAQSection = {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: FAQItem[];
};

export default function FAQ() {
  // State to track open accordion items
  // Using a string ID like "sectionIndex-itemIndex"
  const [openItem, setOpenItem] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setOpenItem(openItem === id ? null : id);
  };

  const faqSections: FAQSection[] = [
    {
      id: "general",
      title: "Généralités",
      icon: <Info className="w-6 h-6 mr-2 text-[var(--greek-bronze)]" />,
      items: [
        {
          question: "Qu'est-ce qu'Educalculate ?",
          answer: "Educalculate est une plateforme d'apprentissage en ligne ludique et interactive conçue pour aider les enfants du primaire (CP au CM2) et début de collège (6ème) à maîtriser les mathématiques. Nous proposons des leçons claires, des exercices adaptés et des quiz amusants pour renforcer la compréhension et la confiance en soi."
        },
        {
          question: "À quels niveaux scolaires s'adresse Educalculate ?",
          answer: "Notre contenu couvre principalement les programmes de mathématiques de l'école primaire française, du CP au CM2, ainsi que le début du collège (classe de 6ème). Nous adaptons les exercices au niveau sélectionné par l'enfant lors de son inscription ou dans son profil."
        },
        {
          question: "Educalculate est-il conforme aux programmes scolaires ?",
          answer: "Oui, notre équipe pédagogique s'efforce d'aligner le contenu des leçons et exercices avec les compétences et notions clés des programmes de l'Éducation Nationale française pour les niveaux concernés. Cependant, Educalculate est un outil de soutien et de complément, il ne remplace pas l'enseignement scolaire."
        }
      ]
    },
    {
      id: "comptes",
      title: "Comptes et Inscription",
      icon: <UserCog className="w-6 h-6 mr-2 text-[var(--greek-bronze)]" />,
      items: [
        {
          question: "Comment inscrire mon enfant ?",
          answer: "L'inscription se fait via le compte Parent. Cliquez sur \"Inscription\" sur notre site, créez votre compte Parent, puis depuis votre tableau de bord Parent, vous pourrez ajouter un ou plusieurs profils pour vos enfants. Vous choisirez leur prénom (ou pseudo), leur niveau scolaire et leur mot de passe initial."
        },
        {
          question: "Quelle est la différence entre un compte Parent et un compte Enfant ?",
          answer: "Le compte Parent gère l'abonnement, les informations de facturation et la création/gestion des profils enfants. Il permet également de suivre la progression globale de chaque enfant. Le compte Enfant est l'interface d'apprentissage : accès aux leçons, exercices, quiz, et suivi de sa propre progression et de ses récompenses."
        },
        {
          question: "J'ai oublié mon mot de passe (Parent ou Enfant), comment faire ?",
          answer: "Sur la page de connexion correspondante (Parent ou Enfant), cliquez sur le lien \"Mot de passe oublié ?\". Suivez les instructions pour réinitialiser votre mot de passe via l'email associé au compte Parent. Si un enfant oublie son mot de passe, le Parent peut le réinitialiser depuis son propre tableau de bord."
        },
        {
          question: "Puis-je modifier le niveau scolaire de mon enfant ?",
          answer: "Oui, le niveau scolaire peut être ajusté. L'enfant peut le modifier depuis son profil (avec ou sans validation parentale selon les paramètres futurs). Le parent peut également ajuster le niveau depuis son tableau de bord de gestion des profils enfants. Cela adaptera le contenu proposé à l'enfant."
        }
      ]
    },
    {
      id: "abonnements",
      title: "Abonnements et Tarifs",
      icon: <CreditCard className="w-6 h-6 mr-2 text-[var(--greek-bronze)]" />,
      items: [
        {
          question: "Quelles sont les formules d'abonnement proposées ?",
          answer: (
            <span>
              Nous proposons généralement plusieurs formules (mensuelle, annuelle) avec des tarifs dégressifs pour plusieurs enfants. Vous trouverez tous les détails sur notre page <a href="/tarifs" className="text-[var(--greek-blue)] underline hover:text-[var(--greek-gold)]">Nos offres</a>.
            </span>
          )
        }
      ]
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />

      <main className="flex-grow pt-[64px]">
        {/* Hero Section */}
        <section className="bg-[var(--greek-cream)] py-20 text-center relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-4xl md:text-5xl mb-4 flex items-center justify-center gap-3">
                <CircleHelp className="w-10 h-10 md:w-12 md:h-12" />
                FAQ
              </h1>
              <p className="text-[var(--greek-blue)] text-xl opacity-80">
                Trouvez rapidement les réponses à vos questions sur Educalcul
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Sections */}
        <section className="pb-20">
          <div className="container mx-auto px-4 max-w-4xl">
            {faqSections.map((section, sIndex) => (
              <div key={section.id} className="mb-12">
                <h2 className="flex items-center text-2xl font-bold text-[var(--greek-blue)] mb-6 border-b-2 border-[var(--greek-bronze)] pb-2 font-[family-name:var(--font-display)]">
                  {section.icon}
                  {section.title}
                </h2>
                
                <div className="space-y-4">
                  {section.items.map((item, iIndex) => {
                    const itemId = `${sIndex}-${iIndex}`;
                    const isOpen = openItem === itemId;
                    
                    return (
                      <div 
                        key={iIndex} 
                        className="bg-white rounded-[6px] border border-[var(--card-border-antique)] shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                      >
                        <button
                          onClick={() => toggleItem(itemId)}
                          className={`w-full text-left px-6 py-4 flex justify-between items-center font-semibold transition-colors ${
                            isOpen 
                              ? 'text-[var(--greek-blue)] bg-[rgba(197,161,72,0.1)] border-b border-[var(--greek-bronze)]' 
                              : 'text-[var(--greek-blue)] hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-lg">{item.question}</span>
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5 text-[var(--greek-bronze)] flex-shrink-0 ml-4" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-[var(--greek-bronze)] flex-shrink-0 ml-4" />
                          )}
                        </button>
                        
                        {isOpen && (
                          <div className="px-6 py-4 text-gray-700 bg-white animate-in slide-in-from-top-2 duration-200">
                            {item.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
