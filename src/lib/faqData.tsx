import Link from "next/link";
import type { ReactNode } from "react";

export type FAQItem = { question: string; answer: ReactNode };
export type FAQSection = { title: string; items: FAQItem[] };

// Données pures partagées entre la page /faq (serveur) et FaqList (client) :
// un module "use client" ne doit exporter que des composants quand il est
// importé depuis un composant serveur, d'où ce fichier séparé sans directive.
export const FAQ_DATA: FAQSection[] = [
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
