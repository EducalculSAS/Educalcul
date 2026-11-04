/**
 * CATALOGUE UNIQUE des contours d'avatar et des couleurs de nom (titres).
 *
 * Chaque élément a UNE définition ici et c'est tout : libellé, d'où il vient, et ce qu'il faut faire pour l'obtenir.
 * Deux façons de l'obtenir, pas plus :
 *  - MISSION : on l'accomplit une fois, il est à vous pour toujours (enregistré dans user_cosmetics) ;
 *  - ABONNEMENT : la formule du parent le donne tant qu'elle est active (jamais enregistré : il disparaît avec elle).
 * Un élément peut avoir les deux ; il n'existe AUCUN élément réservé aux administrateurs.
 *
 * Ce fichier ne dépend de rien (ni base, ni serveur) : il sert aussi bien au serveur qu'à l'affichage.
 */

/** Ce que la base sait compter pour un élève (voir stats.ts). */
export type MissionStat = "exo" | "cours" | "quiz" | "quizPerfect" | "loginStreak" | "loginCount" | "mathador" | "exoCorrect" | "minigames" | "badges";
export type MissionStats = Record<MissionStat, number>;

export const STAT_LABEL: Record<MissionStat, string> = {
  exo: "Exercices réussis",
  cours: "Cours suivis",
  quiz: "Quiz réussis",
  quizPerfect: "Quiz parfaits",
  loginStreak: "Jours de série",
  loginCount: "Connexions",
  mathador: "Points Mathador",
  exoCorrect: "Bonnes réponses aux exercices",
  minigames: "Mini-jeux terminés",
  badges: "Badges obtenus",
};

export interface Requirement {
  stat: MissionStat;
  min: number;
}

/** Une mission débloque, pour toujours, un contour et/ou une couleur de nom. L'identifiant est la clé enregistrée dans user_cosmetics. */
export interface Mission {
  id: string;
  title: string;
  description: string;
  requirements: Requirement[];
  grants: { border?: string; color?: string };
}

export interface BorderDef {
  key: string;
  label: string;
  /** Classe Tailwind d'une pastille de repère (éditeur de formules). */
  preview: string;
  /** Une formule d'abonnement peut le donner. */
  subscription: boolean;
}

export interface ColorDef {
  key: string;
  label: string;
  /** Classe CSS du nom affiché (globals.css). */
  cls: string;
  subscription: boolean;
}

export const NO_BORDER = "none";
export const DEFAULT_COLOR = "default";

export const BORDERS: BorderDef[] = [
  { key: NO_BORDER, label: "Classique", preview: "border-gray-200", subscription: false },
  { key: "bronze", label: "Forge", preview: "border-amber-600", subscription: false },
  { key: "silver", label: "Acier", preview: "border-gray-400", subscription: false },
  { key: "gold", label: "Lauriers", preview: "border-yellow-400", subscription: false },
  { key: "diamond", label: "Cristal", preview: "border-cyan-400", subscription: false },
  { key: "mathador", label: "Constellation", preview: "border-indigo-500", subscription: false },
  { key: "aurore", label: "Aurore", preview: "border-emerald-400", subscription: false },
  { key: "sylve", label: "Sylve", preview: "border-green-700", subscription: false },
  { key: "foudre", label: "Foudre", preview: "border-violet-500", subscription: false },
  { key: "rubis", label: "Rubis", preview: "border-red-600", subscription: false },
  { key: "onyx", label: "Onyx", preview: "border-slate-700", subscription: false },
  { key: "camelia", label: "Camélia", preview: "border-pink-400", subscription: false },
  { key: "premium", label: "Royal", preview: "border-purple-500", subscription: true },
  { key: "famille", label: "Jardin", preview: "border-teal-400", subscription: true },
  { key: "flamme", label: "Brasier", preview: "border-orange-500", subscription: true },
  { key: "pro", label: "Ailes d'or", preview: "border-yellow-500", subscription: true },
  { key: "elite", label: "Astral", preview: "border-pink-500", subscription: true },
];

export const COLORS: ColorDef[] = [
  { key: DEFAULT_COLOR, label: "Classique", cls: "text-gray-800", subscription: false },
  { key: "bronze", label: "Forge", cls: "name-bronze-animated", subscription: false },
  { key: "silver", label: "Acier", cls: "name-silver-animated", subscription: false },
  { key: "gold", label: "Lauriers", cls: "name-gold-animated", subscription: false },
  { key: "diamond", label: "Cristal", cls: "name-diamond-animated", subscription: false },
  { key: "aurore", label: "Aurore", cls: "name-aurore", subscription: false },
  { key: "sylve", label: "Sylve", cls: "name-sylve", subscription: false },
  { key: "foudre", label: "Foudre", cls: "name-foudre", subscription: false },
  { key: "rubis", label: "Rubis", cls: "name-rubis", subscription: false },
  { key: "onyx", label: "Onyx", cls: "name-onyx", subscription: false },
  { key: "camelia", label: "Camélia", cls: "name-camelia", subscription: false },
  { key: "premium", label: "Royal", cls: "name-purple-animated", subscription: true },
  { key: "famille", label: "Jardin", cls: "name-teal-animated", subscription: true },
  { key: "pro", label: "Ailes d'or", cls: "name-pro-animated", subscription: true },
  { key: "flame", label: "Brasier", cls: "name-flame", subscription: true },
  { key: "elite", label: "Astral", cls: "name-elite", subscription: true },
];

const req = (stat: MissionStat, min: number): Requirement => ({ stat, min });

export const MISSIONS: Mission[] = [
  { id: "bronze", title: "Forge", description: "Les bases solides : exercices, cours et quiz.", requirements: [req("exo", 25), req("cours", 5), req("quiz", 15)], grants: { border: "bronze", color: "bronze" } },
  { id: "silver", title: "Acier", description: "Le rythme s'installe.", requirements: [req("exo", 75), req("cours", 15), req("quiz", 50)], grants: { border: "silver", color: "silver" } },
  { id: "gold", title: "Lauriers", description: "Un vrai travail de fond.", requirements: [req("exo", 200), req("cours", 40), req("quiz", 150)], grants: { border: "gold", color: "gold" } },
  { id: "diamond", title: "Cristal", description: "Régulier et précis.", requirements: [req("exo", 500), req("cours", 100), req("quizPerfect", 5)], grants: { border: "diamond", color: "diamond" } },
  { id: "flamme", title: "Brasier", description: "Reviens chaque jour : 30 jours de série et 30 connexions.", requirements: [req("loginStreak", 30), req("loginCount", 30)], grants: { border: "flamme", color: "flame" } },
  { id: "elite_text", title: "Titre Astral", description: "Le titre des plus assidus.", requirements: [req("exo", 1000), req("cours", 100), req("quizPerfect", 15), req("loginCount", 100)], grants: { color: "elite" } },
  { id: "elite", title: "Astral", description: "Le sommet : tout accomplir, jusqu'à un an de série.", requirements: [req("exo", 2500), req("cours", 200), req("quizPerfect", 40), req("loginStreak", 365), req("loginCount", 365)], grants: { border: "elite", color: "elite" } },
  { id: "mathador", title: "Constellation", description: "Cumule des points au Mathador.", requirements: [req("mathador", 150)], grants: { border: "mathador" } },
  // Nouvelles missions
  { id: "aurore", title: "Aurore", description: "Deux semaines de suite sans manquer un jour.", requirements: [req("loginStreak", 14), req("loginCount", 14)], grants: { border: "aurore", color: "aurore" } },
  { id: "sylve", title: "Sylve", description: "Explore la forêt des cours.", requirements: [req("cours", 30)], grants: { border: "sylve", color: "sylve" } },
  { id: "foudre", title: "Foudre", description: "Rapide et juste : 300 bonnes réponses aux exercices.", requirements: [req("exoCorrect", 300)], grants: { border: "foudre", color: "foudre" } },
  { id: "rubis", title: "Rubis", description: "Collectionne les badges.", requirements: [req("badges", 12)], grants: { border: "rubis", color: "rubis" } },
  { id: "onyx", title: "Onyx", description: "Des quiz sans aucune faute.", requirements: [req("quizPerfect", 10), req("quiz", 30)], grants: { border: "onyx", color: "onyx" } },
  { id: "camelia", title: "Camélia", description: "Détends-toi : 30 mini-jeux terminés.", requirements: [req("minigames", 30)], grants: { border: "camelia", color: "camelia" } },
];

export const BORDER_BY_KEY: Record<string, BorderDef> = Object.fromEntries(BORDERS.map((b) => [b.key, b]));
export const COLOR_BY_KEY: Record<string, ColorDef> = Object.fromEntries(COLORS.map((c) => [c.key, c]));
export const MISSION_BY_ID: Record<string, Mission> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

/** Missions qui débloquent ce contour / cette couleur. */
export const missionsForBorder = (key: string): Mission[] => MISSIONS.filter((m) => m.grants.border === key);
export const missionsForColor = (key: string): Mission[] => MISSIONS.filter((m) => m.grants.color === key);

/** Contours et couleurs débloqués par un ensemble de missions accomplies (identifiants). */
export function grantsOfMissions(ids: Iterable<string>): { borders: Set<string>; colors: Set<string> } {
  const borders = new Set<string>();
  const colors = new Set<string>();
  for (const id of ids) {
    const m = MISSION_BY_ID[id];
    if (!m) continue;
    if (m.grants.border) borders.add(m.grants.border);
    if (m.grants.color) colors.add(m.grants.color);
  }
  return { borders, colors };
}

/** Contour / couleur valides (connus du catalogue) ; tout le reste (ancienne clé, « admin »…) devient « aucun ». */
export const normalizeBorder = (key: string | null | undefined): string => {
  const k = (key || NO_BORDER).replace(/^border-/, "");
  return BORDER_BY_KEY[k] ? k : NO_BORDER;
};
export const normalizeColor = (key: string | null | undefined): string => (key && COLOR_BY_KEY[key] ? key : DEFAULT_COLOR);
