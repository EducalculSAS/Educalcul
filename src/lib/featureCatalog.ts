/**
 * Catalogue de TOUTES les fonctionnalités qu'un admin peut couper, sans
 * clé à inventer : chaque entrée dit quelles pages et quelles API elle couvre.
 * Le proxy (src/proxy.ts) bloque réellement ces chemins quand l'entrée est
 * désactivée : page « momentanément indisponible » pour les pages, réponse 503
 * pour les API. Les admins ne sont jamais bloqués (ils peuvent tester).
 *
 * Ajouter une fonctionnalité = ajouter une entrée ici. Aucune migration.
 * Fichier sans dépendance serveur : lu aussi par l'interface admin.
 */

export type FeatureGroup = "global" | "learning" | "games" | "ai" | "community" | "family" | "account" | "support";

export interface FeatureDef {
  key: string;
  label: string;
  description: string;
  group: FeatureGroup;
  /** Nom d'icône lucide (affichage admin). */
  icon: string;
  /** Préfixes de pages couverts. */
  pages?: string[];
  /** Préfixes d'API couverts (optionnellement limités à certaines méthodes). */
  apis?: { prefix: string; methods?: string[] }[];
  /** Fonctionnalité parente : si elle est coupée, celle-ci l'est aussi. */
  parent?: string;
  /** Qui est concerné (affichage). */
  audience: "tous" | "élèves" | "parents";
}

export const FEATURE_GROUPS: { id: FeatureGroup; label: string; description: string }[] = [
  { id: "global", label: "Site entier", description: "Mode maintenance et accès au site." },
  { id: "learning", label: "Apprentissage", description: "Cours, exercices, quiz et test de niveau." },
  { id: "games", label: "Mini-jeux", description: "Chaque jeu et le classement." },
  { id: "ai", label: "Calia et IA", description: "Assistante, mode classe vocal et analyses automatiques." },
  { id: "community", label: "Communauté", description: "Forum, profils publics, trophées." },
  { id: "family", label: "Espace parent", description: "Gestion des enfants, calendrier, export de données." },
  { id: "account", label: "Comptes et paiements", description: "Inscriptions, abonnements, parrainage." },
  { id: "support", label: "Aide et contact", description: "Support, contact et notifications." },
];

export const MAINTENANCE_KEY = "maintenance";

export const FEATURES: FeatureDef[] = [
  // ── Site entier ───────────────────────────────────────────────
  {
    key: MAINTENANCE_KEY, group: "global", icon: "Construction", audience: "tous",
    label: "Mode maintenance",
    description: "Ferme tout le site aux élèves et aux parents (page de maintenance). L'admin, la connexion et les paiements Stripe continuent de fonctionner.",
  },

  // ── Apprentissage ─────────────────────────────────────────────
  {
    key: "courses", group: "learning", icon: "BookOpen", audience: "élèves",
    label: "Cours", description: "Catalogue et lecture des cours, mini-exercices intégrés.",
    pages: ["/child/cours"], apis: [{ prefix: "/api/child/courses" }, { prefix: "/api/child/grade-mini-exercise" }],
  },
  {
    key: "exercises", group: "learning", icon: "Brain", audience: "élèves",
    label: "Exercices", description: "Catalogue, résolution, correction et historique des exercices.",
    pages: ["/child/exercises"], apis: [{ prefix: "/api/child/exercises" }],
  },
  {
    key: "quizzes", group: "learning", icon: "Trophy", audience: "élèves",
    label: "Quiz", description: "Catalogue, passage, correction et historique des quiz.",
    pages: ["/child/quiz"], apis: [{ prefix: "/api/child/quizzes" }],
  },
  {
    key: "placement_quiz", group: "learning", icon: "ClipboardCheck", audience: "élèves",
    label: "Test de niveau", description: "Test de positionnement proposé à l'arrivée d'un élève.",
    apis: [{ prefix: "/api/placement-quiz" }],
  },

  // ── Mini-jeux ─────────────────────────────────────────────────
  {
    key: "minigames", group: "games", icon: "Gamepad2", audience: "élèves",
    label: "Tous les mini-jeux", description: "Coupe l'espace mini-jeux en entier.",
    pages: ["/child/minigames"], apis: [{ prefix: "/api/child/minigames" }],
  },
  { key: "minigame_mathador", parent: "minigames", group: "games", icon: "Calculator", audience: "élèves",
    label: "Mathador", description: "Atteindre un nombre cible avec des opérations.",
    pages: ["/child/minigames/mathador"], apis: [{ prefix: "/api/child/minigames/mathador" }] },
  { key: "minigame_calcul_mental", parent: "minigames", group: "games", icon: "Zap", audience: "élèves",
    label: "Calcul mental", description: "Feuilles de calcul mental quotidiennes.",
    pages: ["/child/minigames/calcul-mental"], apis: [{ prefix: "/api/child/minigames/calcul-mental" }] },
  { key: "minigame_enigmes", parent: "minigames", group: "games", icon: "Puzzle", audience: "élèves",
    label: "Énigmes", description: "Énigmes mathématiques du jour.",
    pages: ["/child/minigames/enigmes"], apis: [{ prefix: "/api/child/minigames/enigmes" }] },
  { key: "minigame_suites", parent: "minigames", group: "games", icon: "ListOrdered", audience: "élèves",
    label: "Suites logiques", description: "Trouver le terme suivant d'une suite.",
    pages: ["/child/minigames/suites"], apis: [{ prefix: "/api/child/minigames/suites" }] },
  { key: "minigame_langues", parent: "minigames", group: "games", icon: "Languages", audience: "élèves",
    label: "Maths en langues", description: "Vocabulaire mathématique en langues étrangères.",
    pages: ["/child/minigames/langues"], apis: [{ prefix: "/api/child/minigames/langues" }] },
  { key: "minigames_leaderboard", parent: "minigames", group: "games", icon: "Medal", audience: "élèves",
    label: "Classement des mini-jeux", description: "Classements par jeu et par niveau.",
    apis: [{ prefix: "/api/child/minigames/leaderboard" }] },

  // ── Calia et IA ───────────────────────────────────────────────
  { key: "calia_chat", group: "ai", icon: "MessageCircle", audience: "élèves",
    label: "Calia, assistante", description: "La bulle d'aide Calia pendant les cours et exercices.",
    apis: [{ prefix: "/api/child/ai-tutor" }] },
  { key: "calia_classe", group: "ai", icon: "GraduationCap", audience: "élèves",
    label: "Calia, mode classe", description: "La classe vocale avec Calia (tableau, lecture des dessins, résumé de séance).",
    apis: [{ prefix: "/api/calia/classe-turn" }, { prefix: "/api/calia/read-drawing" }, { prefix: "/api/calia/session-summary" }] },
  { key: "calia_voice", group: "ai", icon: "Volume2", audience: "élèves",
    label: "Voix de Calia", description: "Synthèse vocale Azure (sinon la voix du navigateur prend le relais).",
    apis: [{ prefix: "/api/calia/tts" }] },
  { key: "parent_ai_report", group: "ai", icon: "Sparkles", audience: "parents",
    label: "Analyse IA d'un enfant", description: "Bilan automatique de la progression pour les parents.",
    apis: [{ prefix: "/api/parent/child-analysis" }] },
  { key: "calendar_ai_suggest", group: "ai", icon: "CalendarClock", audience: "parents",
    label: "Suggestions de révisions", description: "Planning de révisions proposé par l'IA dans le calendrier.",
    apis: [{ prefix: "/api/calendar/suggest" }] },
  { key: "support_chat", group: "ai", icon: "Bot", audience: "parents",
    label: "Assistant du support", description: "Réponses automatiques de Calia dans l'aide parent.",
    apis: [{ prefix: "/api/parent/support-chat" }] },

  // ── Communauté ────────────────────────────────────────────────
  { key: "forum", group: "community", icon: "MessagesSquare", audience: "tous",
    label: "Forum", description: "Tout le forum (lecture et écriture).",
    pages: ["/child/forum", "/parent/forum"], apis: [{ prefix: "/api/forum" }] },
  { key: "forum_posting", parent: "forum", group: "community", icon: "PenLine", audience: "tous",
    label: "Publier sur le forum", description: "Désactivé : le forum reste lisible, mais plus personne ne peut publier, répondre ou aimer.",
    apis: [
      { prefix: "/api/forum/posts", methods: ["POST", "PATCH"] },
      { prefix: "/api/forum/comments", methods: ["POST", "PATCH"] },
      { prefix: "/api/forum/likes", methods: ["POST"] },
    ] },
  { key: "public_profiles", group: "community", icon: "UserRound", audience: "tous",
    label: "Profils publics", description: "Pages de profil ouvertes depuis le forum.",
    pages: ["/u/"] },
  { key: "badges", group: "community", icon: "Award", audience: "élèves",
    label: "Trophées et personnalisation", description: "Page trophées, attribution des badges, contours et couleurs.",
    pages: ["/child/badges"], apis: [{ prefix: "/api/child/check-badges" }, { prefix: "/api/child/equip" }, { prefix: "/api/child/featured-badges" }] },

  // ── Espace parent ─────────────────────────────────────────────
  { key: "calendar", group: "family", icon: "Calendar", audience: "tous",
    label: "Calendrier", description: "Calendriers élève et parent, export ICS.",
    pages: ["/child/calendar", "/parent/calendar"], apis: [{ prefix: "/api/calendar" }] },
  { key: "add_child", group: "family", icon: "UserPlus", audience: "parents",
    label: "Ajout d'enfants", description: "Création de nouveaux comptes élève par les parents.",
    pages: ["/parent/add-child"], apis: [{ prefix: "/api/create-child" }] },
  { key: "edit_child", group: "family", icon: "UserCog", audience: "parents",
    label: "Modification des enfants", description: "Modifier le profil, l'identifiant ou le mot de passe d'un enfant.",
    pages: ["/parent/edit-child"], apis: [{ prefix: "/api/parent/edit-child" }, { prefix: "/api/update-child-auth" }] },
  { key: "data_export", group: "family", icon: "Download", audience: "parents",
    label: "Export des données", description: "Téléchargement des données personnelles (RGPD).",
    apis: [{ prefix: "/api/parent/export-data" }] },

  // ── Comptes et paiements ──────────────────────────────────────
  { key: "signups", group: "account", icon: "UserRoundPlus", audience: "parents",
    label: "Inscriptions", description: "Création de nouveaux comptes parent (les comptes existants se connectent normalement).",
    pages: ["/auth/inscription"], apis: [{ prefix: "/api/auth/create-account" }, { prefix: "/api/auth/validate-signup" }, { prefix: "/api/auth/signup-session" }] },
  { key: "payments", group: "account", icon: "CreditCard", audience: "parents",
    label: "Paiements et abonnements", description: "Souscription, changement de formule et portail de facturation Stripe.",
    pages: ["/parent/subscription", "/auth/inscription/select-plan"],
    apis: [{ prefix: "/api/create-checkout-session" }, { prefix: "/api/create-portal-session" }, { prefix: "/api/parent/sync-subscription" }] },
  { key: "referrals", group: "account", icon: "Gift", audience: "parents",
    label: "Parrainage", description: "Codes de parrainage et leur utilisation.",
    apis: [{ prefix: "/api/parent/my-referral-code" }, { prefix: "/api/parent/validate-referral" }, { prefix: "/api/auth/use-referral" }] },

  // ── Aide et contact ───────────────────────────────────────────
  { key: "support_tickets", group: "support", icon: "LifeBuoy", audience: "tous",
    label: "Tickets de support", description: "Écrire à l'équipe depuis l'espace élève ou parent.",
    pages: ["/child/support", "/parent/support"], apis: [{ prefix: "/api/support" }, { prefix: "/api/parent/support" }] },
  { key: "contact_form", group: "support", icon: "Mail", audience: "tous",
    label: "Formulaire de contact", description: "Page contact publique.",
    pages: ["/contact"], apis: [{ prefix: "/api/contact" }] },
  { key: "notifications", group: "support", icon: "Bell", audience: "tous",
    label: "Notifications", description: "La cloche de notifications dans la barre du site.",
    apis: [{ prefix: "/api/notifications" }] },
];

export const FEATURE_BY_KEY = new Map(FEATURES.map((f) => [f.key, f]));

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`) || (prefix.endsWith("/") && pathname.startsWith(prefix));
}

/**
 * Fonctionnalité désactivée qui couvre ce chemin (la plus précise d'abord),
 * ou null. `disabled` = clés désactivées. Une fonctionnalité dont le parent
 * est coupé est coupée aussi.
 */
export function blockingFeature(pathname: string, method: string, disabled: Set<string>): FeatureDef | null {
  if (disabled.size === 0) return null;
  const isApi = pathname.startsWith("/api/");
  let best: { f: FeatureDef; len: number } | null = null;
  for (const f of FEATURES) {
    const off = disabled.has(f.key) || (f.parent ? disabled.has(f.parent) : false);
    if (!off) continue;
    if (isApi) {
      for (const a of f.apis ?? []) {
        if (a.methods && !a.methods.includes(method)) continue;
        if (matchesPrefix(pathname, a.prefix) && (!best || a.prefix.length > best.len)) best = { f, len: a.prefix.length };
      }
    } else {
      for (const p of f.pages ?? []) {
        if (matchesPrefix(pathname, p) && (!best || p.length > best.len)) best = { f, len: p.length };
      }
    }
  }
  return best?.f ?? null;
}

/** Chemins jamais bloqués par la maintenance. */
export function exemptFromMaintenance(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/api/health" ||
    pathname === "/api/features" ||
    pathname === "/indisponible" ||
    pathname === "/maintenance"
  );
}
