"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ChevronDown, ArrowRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const SYM = [
  { s: "∑", x: 6,  y: 10, z: 96,  d: 0,   t: 7.2  },
  { s: "π", x: 87, y: 7,  z: 72,  d: 1.3, t: 8.5  },
  { s: "√", x: 12, y: 62, z: 58,  d: 0.6, t: 9.1  },
  { s: "∫", x: 91, y: 48, z: 104, d: 2.1, t: 7.4  },
  { s: "Δ", x: 43, y: 14, z: 50,  d: 0.9, t: 10.2 },
  { s: "∞", x: 65, y: 70, z: 66,  d: 1.8, t: 8.0  },
  { s: "α", x: 2,  y: 40, z: 44,  d: 2.7, t: 9.3  },
  { s: "×", x: 76, y: 26, z: 54,  d: 0.4, t: 7.8  },
  { s: "θ", x: 50, y: 78, z: 62,  d: 2.0, t: 8.8  },
  { s: "β", x: 28, y: 53, z: 42,  d: 3.3, t: 10.5 },
  { s: "≠", x: 58, y: 30, z: 46,  d: 1.1, t: 9.7  },
  { s: "÷", x: 19, y: 84, z: 38,  d: 2.9, t: 7.3  },
];

type FAQItem = { question: string; answer: React.ReactNode };
type FAQSection = { title: string; items: FAQItem[] };

const FAQ_DATA: FAQSection[] = [
  {
    title: "Généralités",
    items: [
      { question: "C'est quoi Educalcul ?", answer: "Educalcul est une plateforme de mathématiques pour les enfants. On y trouve des leçons claires, des exercices, des quiz et un suivi détaillé pour progresser pas à pas." },
      { question: "Pour quels niveaux c'est fait ?", answer: "Le contenu couvre du CP à la Terminale. L'enfant choisit son niveau pour accéder aux contenus adaptés à sa classe." },
      { question: "Est-ce que ça suit le programme scolaire ?", answer: "Oui, tous les contenus sont alignés sur le programme officiel de l'Éducation Nationale." },
      { question: "Mon enfant peut-il travailler seul ?", answer: "Oui. Les consignes sont courtes, les exercices sont guidés et les corrections expliquées permettent d'avancer sans bloquer." },
      { question: "Sur quels appareils peut-on l'utiliser ?", answer: "Educalcul fonctionne sur ordinateur, tablette et téléphone. Le site s'adapte à toutes les tailles d'écran." },
    ],
  },
  {
    title: "Comptes et accès",
    items: [
      { question: "Comment créer un compte ?", answer: "Cliquez sur Inscription, choisissez votre type de compte, puis remplissez le formulaire. C'est rapide et vous pouvez commencer immédiatement." },
      { question: "Quelle est la différence entre compte Parent et Enfant ?", answer: "Le compte Parent permet de gérer les enfants, les abonnements et de suivre les progrès. Le compte Enfant est dédié aux leçons, exercices et quiz." },
      { question: "J'ai oublié mon mot de passe, que faire ?", answer: "Sur la page de connexion, cliquez sur « Mot de passe oublié ». Vous recevrez un lien par email pour le réinitialiser." },
      { question: "Peut-on changer de niveau en cours d'année ?", answer: "Oui. Le niveau peut être ajusté à tout moment depuis l'espace parent si l'enfant progresse vite ou s'il faut revoir les bases." },
    ],
  },
  {
    title: "Cours, exercices & abonnements",
    items: [
      { question: "Qu'est-ce qu'on trouve dans les cours ?", answer: "Des explications claires, des exemples concrets et des activités pour s'entraîner immédiatement après chaque leçon." },
      { question: "Les exercices corrigent-ils les erreurs ?", answer: "Oui, l'enfant voit ce qui est juste ou faux et peut comprendre ses erreurs grâce aux explications détaillées." },
      { question: "Comment suivre les progrès de mon enfant ?", answer: "Le tableau de bord parent affiche l'avancée, les exercices réalisés, les badges obtenus et les points à revoir." },
      {
        question: "Quels abonnements sont proposés ?",
        answer: (
          <span>
            Plusieurs formules sont disponibles selon vos besoins. Retrouvez tous les détails sur la page{" "}
            <Link href="/tarifs" className="text-[var(--greek-blue)] underline hover:text-[var(--greek-gold)] transition-colors">Tarifs</Link>.
          </span>
        ),
      },
      { question: "L'abonnement se renouvelle-t-il automatiquement ?", answer: "Cela dépend de la formule choisie. Tous les détails sont indiqués clairement avant validation, et vous pouvez annuler à tout moment." },
    ],
  },
];

/* Animation au scroll */
function useScrollVisible() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) { setVisible(true); return; }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.05 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

export default function FAQ() {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const { ref: contentRef, visible: contentVisible } = useScrollVisible();
  const { ref: ctaRef, visible: ctaVisible } = useScrollVisible();

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <main className="flex-grow pt-[64px]">

        {/* HERO */}
        <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white py-24 text-center">
          {SYM.map((cfg, i) => (
            <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none"
              style={{ left:`${cfg.x}%`, top:`${cfg.y}%`, fontSize:`${cfg.z}px`, fontFamily:"Georgia,serif", color:"var(--greek-gold)", opacity:0.13, animationDuration:`${cfg.t}s`, animationDelay:`${cfg.d}s` }}
            >{cfg.s}</span>
          ))}
          <div className="relative container mx-auto px-6 max-w-3xl">
            <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl font-bold mb-5">Questions fréquentes</h1>
            <p className="text-white/60 text-lg max-w-xl mx-auto leading-relaxed">
              Tout ce que vous devez savoir avant de commencer.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-[var(--greek-cream)]">
          <div className="container mx-auto px-6 max-w-3xl">
            <div
              ref={contentRef}
              style={{
                opacity: contentVisible ? 1 : 0,
                transform: contentVisible ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 0.5s, transform 0.5s",
              }}
            >
              {FAQ_DATA.map((section, sIdx) => (
                <div key={sIdx} className="mb-10">
                  {/* Section header */}
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-6 h-px opacity-60" style={{ background: "var(--greek-gold)" }} />
                    <h2 className="font-[family-name:var(--font-display)] font-bold text-base text-[var(--greek-blue)] uppercase tracking-wider">{section.title}</h2>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  <div className="space-y-2.5">
                    {section.items.map((item, iIdx) => {
                      const id = `${sIdx}-${iIdx}`;
                      const isOpen = openItem === id;
                      return (
                        <div
                          key={id}
                          className="bg-white rounded-xl overflow-hidden transition-shadow duration-200 hover:shadow-sm"
                          style={{ border: "1px solid #e5e7eb" }}
                        >
                          <button
                            onClick={() => setOpenItem(isOpen ? null : id)}
                            className="w-full text-left px-6 py-4 flex justify-between items-center gap-4 transition-colors"
                            style={{ background: isOpen ? "rgba(197,161,72,0.05)" : "transparent" }}
                          >
                            <span className="font-[family-name:var(--font-display)] font-semibold text-sm text-[var(--greek-blue)] leading-snug">{item.question}</span>
                            <ChevronDown
                              className="w-4 h-4 flex-shrink-0 transition-transform duration-300"
                              style={{
                                color: isOpen ? "var(--greek-gold)" : "#9ca3af",
                                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                              }}
                            />
                          </button>
                          <div
                            style={{
                              maxHeight: isOpen ? 400 : 0,
                              overflow: "hidden",
                              transition: "max-height 0.3s ease",
                            }}
                          >
                            <div className="px-6 pb-5 pt-4 text-sm text-[var(--text-muted)] leading-relaxed border-t border-gray-100">
                              {item.answer}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div
              ref={ctaRef}
              className="mt-8 text-center p-10 rounded-2xl text-white"
              style={{
                background: "var(--greek-blue)",
                opacity: ctaVisible ? 1 : 0,
                transform: ctaVisible ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 0.5s 0.15s, transform 0.5s 0.15s",
              }}
            >
              <h3 className="font-[family-name:var(--font-display)] font-bold text-xl mb-3">Vous n&apos;avez pas trouvé votre réponse ?</h3>
              <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.55)" }}>Notre équipe répond généralement en moins de 24h.</p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg font-[family-name:var(--font-display)]"
                style={{ background: "var(--greek-gold)", color: "#000" }}
              >
                Nous contacter <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
