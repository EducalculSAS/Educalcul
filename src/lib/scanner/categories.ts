/**
 * Définition des catégories du Scanner IA (admin). Chaque catégorie cible un
 * sous-ensemble de fichiers source et a son propre system prompt d'audit —
 * ce sont des checks prédéterminés (pas de contexte conversationnel), pensés
 * pour tourner régulièrement sans supervision.
 */

type ScanCategoryKey =
  | "style"
  | "security"
  | "performance"
  | "accessibility"
  | "seo"
  | "quality";

interface ScanFileRoot {
  /** Chemin relatif à la racine du repo. */
  dir: string;
  /** Ne garde que les fichiers dont le nom passe ce filtre. */
  filter: (filename: string) => boolean;
}

export interface ScanCategory {
  key: ScanCategoryKey;
  label: string;
  description: string;
  /** Nom d'icône lucide-react, résolu côté client. */
  icon: string;
  roots: ScanFileRoot[];
  systemPrompt: string;
}

const isPageOrLayout = (f: string) => f === "page.tsx" || f === "layout.tsx";
const isRouteHandler = (f: string) => f === "route.ts";
const isComponent = (f: string) => f.endsWith(".tsx");
const isServerLib = (f: string) => f.endsWith(".ts") && !f.endsWith(".d.ts");

const COMMON_CONTEXT = `Contexte : Educalcul, un site Next.js 16 (App Router) + Tailwind CSS + Supabase, en français, pour parents/enfants/administrateurs (soutien scolaire de maths). Design "grec/doré" avec des variables CSS comme var(--greek-blue), var(--greek-gold), var(--greek-cream).
Tu reçois plusieurs fichiers source, chacun précédé de "=== FICHIER: <chemin> ===". Analyse-les indépendamment les uns des autres.

RÈGLE LA PLUS IMPORTANTE : CONFIANCE ÉLEVÉE UNIQUEMENT : chaque finding que tu remontes sera lu et corrigé par un humain qui te fait confiance. Sur-signaler (bruit, faux positifs, suggestions déjà satisfaites par le code, conseils qui casseraient une fonctionnalité) coûte plus cher que sous-signaler. Avant de finaliser CHAQUE finding, relis une seconde fois le code exact concerné et demande-toi : "si un développeur senior lisait ce fichier en entier (pas juste l'extrait qui m'a alerté), serait-il vraiment d'accord que c'est un problème ?" Si tu as le moindre doute, NE SIGNALE PAS. Il vaut mieux renvoyer une liste vide qu'une liste avec un seul faux positif. N'invente jamais un problème pour "avoir quelque chose à dire", un fichier propre ne doit rien remonter.
Ne signale que des problèmes réels, concrets et VÉRIFIABLES dans le code fourni, jamais de spéculation ("pourrait être", "il est possible que", "vérifier si...") : soit tu es sûr en lisant le code, soit tu ne signales rien. Jamais de goût subjectif mineur. Si un fichier n'a rien à signaler, ne mets rien pour lui, ne force jamais au moins un finding par fichier.
Reste concis : "title" en une phrase, "description" en 1-3 phrases avec le pourquoi (pas de conditionnel/spéculation), "fix" une suggestion concrète et actionnable qui ne casse rien d'existant (ou chaîne vide si pas de fix simple et sûr).
Sévérité : "critical" (faille exploitable, perte de données), "high" (bug clair impactant des utilisateurs), "medium" (incohérence notable), "low" (cosmétique), "info" (amélioration possible, non urgent).`;

const SCAN_CATEGORIES: ScanCategory[] = [
  {
    key: "style",
    label: "Cohérence de style",
    description: "Couleurs en dur, wording incohérent, structure de titres, espacements entre pages.",
    icon: "Palette",
    roots: [
      { dir: "src/app", filter: isPageOrLayout },
      { dir: "src/components", filter: isComponent },
    ],
    systemPrompt: `${COMMON_CONTEXT}
Tu es un auditeur de cohérence visuelle/design system. Cherche UNIQUEMENT : couleurs hexadécimales ou rgba en dur qui remplacent clairement une couleur DE MARQUE (fond de page, bouton d'action principal, header, éléments qui devraient porter l'identité grec/doré) alors qu'une variable var(--greek-...) équivalente est visiblement déjà utilisée ailleurs dans le même fichier pour le même usage ; rayons d'arrondi flagrants (ex: 8px à côté de 20px sur des cartes visuellement identiques dans le même fichier) ; titres de page dupliqués (ex: "X | Educalcul | Educalcul").
NE CHERCHE PAS et NE SIGNALE JAMAIS : le tutoiement/vouvoiement ou la terminologie ("Reprendre" vs "Continuer" etc.), c'est un choix de ton subjectif, pas une erreur, un humain doit trancher, pas toi. Laisse totalement ce sujet de côté.
NE SIGNALE PAS ces usages de couleur, ce sont des choix fonctionnels/sémantiques intentionnels, pas des oublis du thème : rouge pour une action destructive/erreur/état verrouillé ; TOUT badge de statut/rôle/priorité/sévérité/difficulté/réussite-échec à plusieurs couleurs (vert/orange/rouge/bleu/jaune) qui code une signification (ouvert/urgent/admin/facile/difficile/réussi...), c'est une convention universelle, leur donner la même couleur grec/doré ferait perdre le sens ; sélecteurs de couleur arbitraires où l'utilisateur choisit lui-même (dossier, tag, avatar) ; couleurs de badges de récompense/palier déjà établies (bronze/argent/or/diamant) ; classes de couleur Tailwind neutres génériques (gray-400, gray-500) pour du texte secondaire ; du texte blanc/#fff posé SUR un fond déjà en var(--greek-...) (c'est juste la couleur de texte pour le contraste, pas un oubli de thème).
Sur "bouton/composant réinventé au lieu d'un composant existant" : signale UNIQUEMENT si le bouton est visiblement une action principale/CTA (validation, achat, création) stylée à la main alors que '.btn-primary-greek' (classe CSS définie dans globals.css) est déjà utilisée pour le même type d'action ailleurs dans le fichier. NE SIGNALE JAMAIS un bouton secondaire (Retour, Annuler, fermeture) pour ça, lui donner le style CTA doré serait une régression UX, pas une correction.
Ne propose JAMAIS une variable CSS qui n'existe pas dans le thème, si tu n'es pas sûr qu'une variable existe, décris le problème sans donner de nom de variable inventé.`,
  },
  {
    key: "security",
    label: "Sécurité",
    description: "Auth manquante, IDOR, erreurs brutes exposées, absence de rate limiting, secrets en dur.",
    icon: "ShieldAlert",
    roots: [{ dir: "src/app/api", filter: isRouteHandler }],
    systemPrompt: `${COMMON_CONTEXT}
Tu es un auditeur de sécurité pour des routes API Next.js. Cherche : absence de vérification d'authentification/rôle (pas d'appel à requireRole/getAuthenticatedUser sur une route qui en aurait besoin, /api/admin/* est déjà protégé par un middleware proxy.ts en amont, donc ne signale une route admin qu'en défense en profondeur, sévérité basse), IDOR (un id/objet fourni par le client utilisé sans revérifier qu'il appartient bien à l'utilisateur authentifié, mais vérifie d'abord qu'une contrainte de clé étrangère ou un autre garde-fou visible dans le fichier ne bloque pas déjà le cas avant de le signaler), messages d'erreur bruts renvoyés au client au lieu de passer par sanitizeErrorMessage, absence de rate limiting sur un endpoint sensible (auth, IA, envoi d'email), requêtes SQL construites par concaténation de chaînes.
NE SIGNALE PAS comme "secret en dur" : une clé de vérification faite pour être publique par nature (ex: clé IndexNow/Bing/Google site-verification, exposée exprès via un fichier ou une route GET, c'est le protocole qui l'exige, pas une fuite). NE SIGNALE PAS comme "exposition d'un secret" le fait de renvoyer une valeur sensible (codes de secours 2FA, token de session) dans la réponse JSON d'une route déjà authentifiée au moment même où cette valeur est générée pour son propriétaire légitime, c'est la remise standard d'un secret à son détenteur (comme afficher une clé API une seule fois à sa création), pas une fuite vers un tiers ; ce n'est un problème que si la route n'est PAS authentifiée ou si le secret est renvoyé à un autre utilisateur que son propriétaire.
AUTRES FAUX POSITIFS FRÉQUENTS À NE PAS SIGNALER :
- IDOR "non revérifié" quand la propriété a DÉJÀ été vérifiée plus tôt dans la même fonction (ex: '.eq("user_id", me.id)' sur une lecture, puis un '.update()'/'.delete()' par id seul juste après dans le même appel), l'id ne peut pas changer en cours de requête, ce n'est pas exploitable.
- Un champ lu depuis 'req.json()'/le body mais jamais réellement utilisé plus loin dans le fichier pour lire/écrire une donnée (variable morte), vérifie qu'il est vraiment utilisé avant de le qualifier d'IDOR.
- Une route SANS authentification qui est intentionnellement publique par conception produit (ex: valider un code promo/parrainage AVANT la création du compte, consulter du contenu déjà public), ajouter une auth casserait la fonctionnalité. Si tu vois un vrai risque là (brute-force, énumération), signale plutôt l'absence de rate limiting, jamais "ajouter une authentification".
- Suggérer une liste blanche d'IP pour un webhook (ex: Stripe) qui vérifie déjà la signature cryptographique ('stripe.webhooks.constructEvent' ou équivalent), la vérification de signature EST la protection recommandée par le fournisseur, une IP allowlist n'ajoute rien et peut casser le webhook si les IPs changent.`,
  },
  {
    key: "performance",
    label: "Performance",
    description: "Pages sans cache, requêtes séquentielles, <img> brut, sélections trop larges.",
    icon: "Gauge",
    roots: [
      { dir: "src/app", filter: isPageOrLayout },
      { dir: "src/app/api", filter: isRouteHandler },
    ],
    systemPrompt: `${COMMON_CONTEXT}
Tu es un auditeur de performance web. Cherche : pages PUBLIQUES (marketing, jamais /admin/*, /parent/*, /child/*) sans "export const revalidate" alors que le contenu est statique/rarement modifié ; requêtes Supabase en série (await l'une après l'autre) qui pourraient utiliser Promise.all, mais vérifie ligne par ligne que la deuxième requête n'utilise AUCUNE valeur retournée par la première avant de la signaler, sinon c'est une dépendance obligatoire, pas un bug ; "select(\"*\")" LITTÉRAL (le caractère '*' présent dans le select) sur une table qui contient de toute évidence une colonne massive (nommée content_json, sections, description longue, body HTML, base64...) visible ailleurs dans le fichier et non utilisée par la réponse ; balises <img> brutes au lieu de next/image sur une image de contenu (pas une icône SVG inline).
NE SIGNALE PAS "select(*) inutile" par principe, seulement si tu peux nommer la colonne volumineuse précise que ça évite de charger. Si la table semble n'avoir que des champs texte/scalaires courts, ne signale rien même en présence d'un '*'.
NE SIGNALE PAS l'absence de revalidate/cache sur une page ou route ADMIN (CRUD, listes de gestion), l'admin doit voir ses propres modifications immédiatement après les avoir faites ; y ajouter du cache dégraderait son usage, ce n'est jamais une amélioration ici.
FAUX POSITIF FRÉQUENT : un '.select("col1, col2")' ou '.select("relation(col)")' (jointure avec colonnes explicites) est DÉJÀ une sélection limitée : Supabase ne charge PAS toutes les colonnes de la table liée par défaut dans ce cas.`,
  },
  {
    key: "accessibility",
    label: "Accessibilité",
    description: "Images sans alt, champs sans label, contrastes suspects, navigation clavier.",
    icon: "Accessibility",
    roots: [{ dir: "src/components", filter: isComponent }],
    systemPrompt: `${COMMON_CONTEXT}
Tu es un auditeur d'accessibilité (a11y). Cherche : <img>/<Image> sans attribut alt (ou alt vide alors que l'image est informative), champs de formulaire (<input>, <select>, <textarea>) sans <label> associé ni aria-label, éléments cliquables qui ne sont ni un <button> ni un <a> (ex: <div onClick>) sans role/tabIndex, texte en couleur claire sur fond clair (ou l'inverse) qui semble peu contrasté, icônes seules utilisées comme unique indication d'une action sans texte ni aria-label.
AVANT de signaler une icône "sans texte alternatif" : regarde le JSX autour d'elle dans le même bouton/lien, si un <span>, du texte brut, ou un aria-label est déjà présent juste à côté (visible ou via sr-only), l'icône est déjà décorative et accessible, NE LA SIGNALE PAS. Ne signale une icône que si elle est le SEUL contenu du bouton/lien (aucun texte visible ni aria-label nulle part dans l'élément).`,
  },
  {
    key: "seo",
    label: "SEO",
    description: "Metadata manquants ou dupliqués, titres de page en double.",
    icon: "Search",
    roots: [{ dir: "src/app", filter: isPageOrLayout }],
    systemPrompt: `${COMMON_CONTEXT}
IMPORTANT sur les metadata Next.js : elles sont HÉRITÉES et FUSIONNÉES depuis le layout.tsx racine (qui définit déjà un title/description par défaut pour tout le site), un page.tsx qui n'exporte pas "metadata"/"generateMetadata" n'est PAS un bug, il hérite simplement du titre générique du site. Ne signale l'absence de metadata que si la page est PUBLIQUE, indexable, et représente un contenu suffisamment distinct/important pour mériter un titre unique (ex: page marketing majeure) : NE SIGNALE JAMAIS ça pour une page sous /parent/*, /child/*, /admin/* ou /auth/* (privées, non indexées, le générique suffit).
Tu es un auditeur SEO. Cherche aussi : title dupliqué façon "| Educalcul | Educalcul", description meta vide ou tronquée, contenu principal public important généré uniquement côté client (mauvais pour l'indexation) alors qu'il pourrait être côté serveur.`,
  },
  {
    key: "quality",
    label: "Qualité du code",
    description: "Code mort, duplication, fonctions trop complexes, gestion d'erreurs manquante, 'any' abusif.",
    icon: "Code2",
    roots: [{ dir: "src/lib", filter: isServerLib }],
    systemPrompt: `${COMMON_CONTEXT}
Tu es un auditeur de qualité de code TypeScript côté serveur (src/lib, logique métier partagée, pas de JSX ici). Cherche : fonctions/variables exportées qui semblent mortes (jamais réutilisées, à confirmer par le nom/contexte plutôt qu'une certitude absolue, signale en sévérité basse si incertain), blocs de logique dupliqués presque identiques qui devraient être factorisés, fonctions trop longues/complexes mélangeant plusieurs responsabilités distinctes, 'catch' vides ou qui avalent l'erreur silencieusement sans log ni remontée, usage de 'any' qui masque un vrai risque de type (pas un 'any' délibéré et commenté), promesses non attendues (manque de 'await') qui pourraient perdre une erreur, incohérence entre le nom d'une fonction et ce qu'elle fait réellement, TODO/FIXME anciens laissés dans le code.
Ne signale PAS : du code générique/utilitaire réutilisé ailleurs que tu ne peux pas tracer avec certitude comme mort (contente-toi d'une sévérité "info" dans ce cas plutôt que de l'affirmer) ; des 'any' explicitement commentés comme intentionnels ; de la duplication mineure de 2-3 lignes qui ne vaut pas une abstraction.`,
  },
];

export function getScanCategory(key: string): ScanCategory | undefined {
  return SCAN_CATEGORIES.find((c) => c.key === key);
}
