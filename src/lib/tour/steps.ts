/**
 * Étapes des tutoriels guidés (parent et élève). Le moteur est dans src/components/tour/GuidedTour.tsx.
 *
 * - action "next"  : on explique la zone éclairée, bouton « Suivant ».
 * - action "click" : l'utilisateur clique lui-même sur la zone éclairée, ce qui l'emmène sur la page `to`.
 * - action "form"  : la zone éclairée est un formulaire à remplir ; l'étape se termine en arrivant sur `to`.
 * `path` : page sur laquelle l'étape se joue (absent : n'importe quelle page, pour les liens du menu).
 * `opener` : élément à cliquer d'abord quand la cible est repliée (le bouton du menu).
 * `optional` : étape sautée (avec sa page d'arrivée) si la cible n'existe pas, par exemple une rubrique désactivée.
 */
export type TourRole = "parent" | "child";

export interface TourStep {
  id: string;
  path?: string;
  to?: string;
  title: string;
  text: string;
  target?: string;
  opener?: string;
  openerText?: string;
  action: "next" | "click" | "form";
  optional?: boolean;
  skipLabel?: string;
}

const MENU = '[data-tour="nav-menu"]';
const menuLink = (href: string) => `nav.navbar [data-glass-bounds] a[href="${href}"]`;

export const PARENT_TOUR: TourStep[] = [
  {
    id: "p-welcome", path: "/parent/dashboard", action: "next",
    title: "Bienvenue sur Educalcul",
    text: "En deux minutes, nous allons créer le profil de votre enfant et voir où trouver son suivi, votre formule et vos réglages. Suivez les zones éclairées.",
  },
  {
    id: "p-add", path: "/parent/dashboard", to: "/parent/add-child", action: "click",
    target: 'main a[href="/parent/add-child"]',
    title: "Ajoutez votre enfant",
    text: "Tout commence ici : cliquez sur ce bouton pour créer son profil.",
  },
  {
    id: "p-form", path: "/parent/add-child", to: "/parent/children", action: "form",
    target: '[data-tour="add-child-form"]', skipLabel: "Plus tard",
    title: "Créez son profil",
    text: "Prénom, pseudo, mot de passe et classe suffisent : l'e-mail est facultatif. Votre enfant se connectera avec son pseudo. Enregistrez pour continuer.",
  },
  {
    id: "p-children", path: "/parent/children", action: "next",
    target: '[data-tour="children-list"]',
    title: "Vos enfants",
    text: "Chaque enfant a sa carte : son suivi détaillé, son bulletin à imprimer et ses réglages (objectifs, heures de repos, sécurité).",
  },
  {
    id: "p-nav-sub", to: "/parent/subscription", action: "click", optional: true,
    target: menuLink("/parent/subscription"), opener: MENU,
    openerText: "Ouvrez le menu : toutes les rubriques s'y trouvent.",
    title: "Votre abonnement",
    text: "Cliquez sur « Abonnements ».",
  },
  {
    id: "p-sub", path: "/parent/subscription", action: "next",
    target: '[data-tour="subscription"]',
    title: "Formule et facturation",
    text: "C'est ici que vous voyez votre formule, la fin de l'essai gratuit, vos factures et votre moyen de paiement. Vous pouvez changer de formule ou arrêter à tout moment.",
  },
  {
    id: "p-nav-profile", to: "/parent/profile", action: "click",
    target: menuLink("/parent/profile"), opener: MENU,
    openerText: "Ouvrez de nouveau le menu.",
    title: "Votre profil",
    text: "Cliquez sur « Profil ».",
  },
  {
    id: "p-profile", path: "/parent/profile", action: "next",
    target: '[data-tour="profile"]',
    title: "Vos réglages",
    text: "Vos informations, les alertes que vous recevez, la sécurité de votre compte et l'export ou la suppression de vos données sont réunis sur cette page.",
  },
  {
    id: "p-nav-home", to: "/parent/dashboard", action: "click",
    target: menuLink("/parent/dashboard"), opener: MENU,
    openerText: "Une dernière fois : ouvrez le menu.",
    title: "Retour à l'accueil",
    text: "Cliquez sur « Tableau de bord ».",
  },
  {
    id: "p-end", path: "/parent/dashboard", action: "next",
    title: "Vous êtes prêt",
    text: "Le tableau de bord résume l'activité de vos enfants. Vous pouvez revoir ce tutoriel à tout moment depuis votre profil.",
  },
];

export const CHILD_TOUR: TourStep[] = [
  {
    id: "c-welcome", path: "/child/dashboard", action: "next",
    title: "Bienvenue !",
    text: "On fait le tour ensemble : je te montre où trouver tes cours, tes exercices, tes quiz et tes trophées. Suis les zones éclairées.",
  },
  {
    id: "c-goals", path: "/child/dashboard", action: "next", optional: true,
    target: '[data-tour="goals"]',
    title: "Ton objectif du jour",
    text: "Ici tu vois ton objectif du jour et ta série : chaque jour où tu travailles fait grandir ta flamme.",
  },
  {
    id: "c-nav-cours", to: "/child/cours", action: "click", optional: true,
    target: menuLink("/child/cours"), opener: MENU,
    openerText: "Ouvre le menu : toutes les rubriques sont dedans.",
    title: "Tes cours",
    text: "Clique sur « Mes Cours ».",
  },
  {
    id: "c-cours", path: "/child/cours", action: "next",
    target: '[data-tour="catalog"]',
    title: "Les cours",
    text: "Chaque chapitre a un cours court et clair. Commence toujours par le cours : c'est là que tu comprends la notion.",
  },
  {
    id: "c-nav-ex", to: "/child/exercises", action: "click", optional: true,
    target: menuLink("/child/exercises"), opener: MENU,
    openerText: "Ouvre le menu.",
    title: "Tes exercices",
    text: "Clique sur « Exercices ».",
  },
  {
    id: "c-ex", path: "/child/exercises", action: "next",
    target: '[data-tour="catalog"]',
    title: "Les exercices",
    text: "Entraîne-toi après le cours. Chaque réponse est corrigée tout de suite, avec l'explication si tu t'es trompé.",
  },
  {
    id: "c-nav-quiz", to: "/child/quiz", action: "click", optional: true,
    target: menuLink("/child/quiz"), opener: MENU,
    openerText: "Ouvre le menu.",
    title: "Tes quiz",
    text: "Clique sur « Quiz & Défis ».",
  },
  {
    id: "c-quiz", path: "/child/quiz", action: "next",
    target: '[data-tour="catalog"]',
    title: "Les quiz",
    text: "Un quiz vérifie que tu as retenu le chapitre. Tu peux revoir ta correction à la fin.",
  },
  {
    id: "c-nav-badges", to: "/child/badges", action: "click", optional: true,
    target: menuLink("/child/badges"), opener: MENU,
    openerText: "Ouvre le menu.",
    title: "Tes trophées",
    text: "Clique sur « Mes Trophées ».",
  },
  {
    id: "c-badges", path: "/child/badges", action: "next",
    target: '[data-tour="badges"]',
    title: "Les trophées",
    text: "En travaillant, tu gagnes des trophées, des contours d'avatar et des couleurs pour ton nom.",
  },
  {
    id: "c-calia", action: "next", optional: true,
    target: '[data-tour="calia"]',
    title: "Calia, ton aide",
    text: "Bloqué ? Calia est toujours là, en bas de l'écran. Elle ne donne pas la réponse : elle te pose les bonnes questions pour que tu trouves.",
  },
  {
    id: "c-nav-profile", to: "/child/profile", action: "click",
    target: menuLink("/child/profile"), opener: MENU,
    openerText: "Ouvre le menu.",
    title: "Ton profil",
    text: "Clique sur « Profil ».",
  },
  {
    id: "c-profile", path: "/child/profile", action: "next",
    target: '[data-tour="profile"]',
    title: "Ton profil",
    text: "Change ton avatar, équipe tes contours et règle l'affichage comme tu préfères.",
  },
  {
    id: "c-nav-home", to: "/child/dashboard", action: "click",
    target: menuLink("/child/dashboard"), opener: MENU,
    openerText: "Ouvre le menu une dernière fois.",
    title: "Retour à l'accueil",
    text: "Clique sur « Tableau de bord ».",
  },
  {
    id: "c-end", path: "/child/dashboard", action: "next",
    title: "À toi de jouer !",
    text: "Tu connais le site. Commence par ton parcours du jour. Tu peux revoir ce tutoriel depuis ton profil.",
  },
];

export const TOURS: Record<TourRole, TourStep[]> = { parent: PARENT_TOUR, child: CHILD_TOUR };

export const tourStorageKey = (role: TourRole) => `edu-tour-step:${role}`;

/**
 * Étape suivante après `index`. Si l'étape `index` est sautée (`skipped`) et qu'elle menait à une page (`to`), les
 * étapes qui se jouent sur cette page sont sautées aussi : on n'y est jamais allé.
 */
export function nextStepIndex(steps: TourStep[], index: number, skipped = false): number {
  let i = index + 1;
  const to = steps[index]?.to;
  if (skipped && to) while (i < steps.length && steps[i].path === to) i++;
  return i;
}
