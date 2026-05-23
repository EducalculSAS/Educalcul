/* Copie exacte de src/app/faq/page.tsx — sans Navbar/Footer/Link Next.js */
import { useState } from "react";
import { CircleHelp, Info, UserCog, CreditCard, ChevronDown, ChevronUp } from "lucide-react";

interface Props { onNavigate: (view: any) => void; }

type FAQItem = { question: string; answer: React.ReactNode };
type FAQSection = { id: string; title: string; icon: React.ReactNode; items: FAQItem[] };

export default function FAQ({ onNavigate }: Props) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const toggleItem = (id: string) => setOpenItem(openItem === id ? null : id);

  const faqSections: FAQSection[] = [
    {
      id: "general",
      title: "Généralités",
      icon: <Info className="w-6 h-6 mr-2 text-[var(--greek-gold)]" />,
      items: [
        { question: "C'est quoi Educalcul ?", answer: "Educalcul est un site de maths pour les enfants. On y trouve des leçons simples, des exercices, des quiz et un suivi clair pour avancer pas à pas." },
        { question: "Pour quels niveaux c'est fait ?", answer: "Le contenu va du CP au CM2, avec aussi quelques activités pour la 6e. L'enfant choisit son niveau pour voir ce qui lui correspond." },
        { question: "Est-ce que ça suit le programme scolaire ?", answer: "Oui, les contenus sont pensés pour rester proches de ce qui est vu à l'école. L'idée est d'aider l'enfant à comprendre et à s'entraîner sans le perdre." },
        { question: "Est-ce que mon enfant peut travailler seul ?", answer: "Oui. Les consignes sont courtes, les exercices sont guidés et les corrections aident à avancer sans bloquer." },
        { question: "Sur quels appareils on peut l'utiliser ?", answer: "Educalcul fonctionne sur ordinateur, tablette et téléphone. Le site s'adapte à la taille de l'écran." },
      ]
    },
    {
      id: "comptes",
      title: "Comptes et accès",
      icon: <UserCog className="w-6 h-6 mr-2 text-[var(--greek-gold)]" />,
      items: [
        { question: "Comment créer un compte ?", answer: "Clique sur Inscription, choisis ton type de compte, puis remplis le formulaire. C'est rapide et tu peux commencer juste après." },
        { question: "Parent et enfant, c'est différent ?", answer: "Oui. Le compte Parent sert à gérer les enfants et l'abonnement. Le compte Enfant sert à faire les leçons, les exercices et les quiz." },
        { question: "J'ai oublié mon mot de passe, je fais quoi ?", answer: "Sur la page de connexion, clique sur Mot de passe oublié. Tu recevras les étapes par email pour le réinitialiser." },
        { question: "Je peux changer le niveau plus tard ?", answer: "Oui. Le niveau peut être ajusté si l'enfant progresse vite ou s'il faut revenir sur les bases." },
        { question: "Il faut un compte pour tester le site ?", answer: "Pour voir les offres et les explications, non. Pour faire les activités, oui, il faut se connecter." },
      ]
    },
    {
      id: "cours",
      title: "Cours, exercices et abonnements",
      icon: <CreditCard className="w-6 h-6 mr-2 text-[var(--greek-gold)]" />,
      items: [
        { question: "Qu'est-ce qu'on trouve dans les cours ?", answer: "Des explications simples, des exemples et des activités pour s'entraîner tout de suite après." },
        { question: "Les exercices corrigent aussi les erreurs ?", answer: "Oui, l'enfant voit ce qui est juste ou faux et peut comprendre où il s'est trompé." },
        { question: "Est-ce qu'il y a des quiz ?", answer: "Oui. Les quiz servent à vérifier ce qui a été compris et à revoir ce qui doit encore être travaillé." },
        { question: "Comment suivre les progrès ?", answer: "Le tableau de bord montre l'avancée, les exercices faits et les points à revoir." },
        {
          question: "Quels sont les abonnements proposés ?",
          answer: <span>Il y a plusieurs formules selon le besoin de la famille. Tu peux voir tous les détails sur la page <button onClick={() => onNavigate('tarifs')} className="text-[var(--greek-blue)] underline hover:text-[var(--greek-gold)] bg-transparent border-none cursor-pointer p-0">Tarifs</button>.</span>
        },
        { question: "L'abonnement se renouvelle tout seul ?", answer: "Ça dépend de la formule choisie. Les détails sont indiqués clairement sur la page Tarifs avant de valider." },
      ]
    }
  ];

  return (
    <main className="flex-grow pt-[64px]">
      {/* Hero Section */}
      <section className="bg-[var(--greek-cream)] py-20 text-center relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-4xl md:text-5xl mb-4 flex items-center justify-center gap-3">
              <CircleHelp className="w-10 h-10 md:w-12 md:h-12 text-[var(--greek-gold)]" />
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
              <h2 className="flex items-center text-2xl font-bold text-[var(--greek-blue)] mb-6 border-b-2 border-[rgba(197,161,72,0.25)] pb-2 font-[family-name:var(--font-display)]">
                {section.icon}
                {section.title}
              </h2>
              <div className="space-y-4">
                {section.items.map((item, iIndex) => {
                  const itemId = `${sIndex}-${iIndex}`;
                  const isOpen = openItem === itemId;
                  return (
                    <div key={iIndex} className="bg-white rounded-[6px] border border-[rgba(197,161,72,0.25)] shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                      <button
                        onClick={() => toggleItem(itemId)}
                        className={`w-full text-left px-6 py-4 flex justify-between items-center font-semibold transition-colors ${
                          isOpen ? 'text-[var(--greek-blue)] bg-[rgba(197,161,72,0.1)] border-b border-[rgba(197,161,72,0.25)]' : 'text-[var(--greek-blue)] hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-lg">{item.question}</span>
                        {isOpen
                          ? <ChevronUp className="w-5 h-5 text-[var(--greek-gold)] flex-shrink-0 ml-4" />
                          : <ChevronDown className="w-5 h-5 text-[var(--greek-gold)] flex-shrink-0 ml-4" />
                        }
                      </button>
                      {isOpen && (
                        <div className="px-6 py-4 text-gray-700 bg-white">
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
  );
}
