import { SCHOOL_LEVELS } from "@/lib/constants";

/**
 * Spécialités du lycée général, et niveaux visibles par un élève.
 *
 * Un élève a UNE classe principale (users.grade_level) et peut voir des
 * niveaux en plus (users.extra_levels) : l'option maths expertes, qui
 * s'ajoute à la spécialité maths de Terminale, ou un niveau attribué par
 * l'admin (ex. revoir la Première spé en Terminale). Ce sont les deux seules
 * façons d'en avoir plusieurs.
 */

export const EXPERTES_LEVEL = "terminale-generale-expertes";

export interface TrackOption {
  level: string;
  label: string;
  detail: string;
}

export const PREMIERE_TRACKS: TrackOption[] = [
  { level: "1ere-generale-maths", label: "Spécialité mathématiques", detail: "Le programme complet de maths de Première." },
  { level: "1ere-generale", label: "Sans spécialité maths", detail: "Les maths du tronc commun (enseignement scientifique)." },
];

export const TERMINALE_TRACKS: TrackOption[] = [
  { level: "terminale-generale-maths", label: "Spécialité mathématiques", detail: "Tu as gardé la spécialité maths en Terminale." },
  { level: "terminale-generale-complementaires", label: "Maths complémentaires", detail: "Tu as arrêté la spécialité et pris l'option complémentaires." },
  { level: "terminale-generale", label: "Sans maths", detail: "Uniquement le tronc commun." },
];

const KNOWN_LEVELS = new Set(SCHOOL_LEVELS.map((l) => l.value));

const isPremiere = (level: string | null | undefined) => !!level && level.startsWith("1ere");
export const isTerminale = (level: string | null | undefined) => !!level && level.startsWith("terminale");
/** L'élève a-t-il des spécialités à choisir (Première ou Terminale) ? */
export const hasSpecialtyChoice = (level: string | null | undefined) => isPremiere(level) || isTerminale(level);

/** Classe principale + niveaux en plus, sans doublon ni valeur inconnue. */
export function visibleLevels(gradeLevel: string | null | undefined, extraLevels: string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const l of [gradeLevel, ...(extraLevels ?? [])]) {
    if (l && KNOWN_LEVELS.has(l) && !out.includes(l)) out.push(l);
  }
  return out;
}

/** Valide un choix de spécialités ; renvoie la classe principale et les
 * niveaux en plus à enregistrer (les niveaux attribués par l'admin sont
 * conservés). */
export function applySpecialtyChoice(
  currentLevel: string | null | undefined,
  currentExtras: string[] | null | undefined,
  track: unknown,
  expertes: unknown,
): { error: string } | { gradeLevel: string; extraLevels: string[] } {
  const tracks = isPremiere(currentLevel) ? PREMIERE_TRACKS : isTerminale(currentLevel) ? TERMINALE_TRACKS : null;
  if (!tracks) return { error: "Le choix des spécialités concerne la Première et la Terminale." };
  if (typeof track !== "string" || !tracks.some((t) => t.level === track)) return { error: "Choix de spécialité invalide." };
  const wantsExpertes = expertes === true;
  if (wantsExpertes && track !== "terminale-generale-maths") {
    return { error: "Les maths expertes se prennent avec la spécialité maths de Terminale." };
  }
  // Les niveaux accordés par l'admin restent ; seule l'option expertes est recalculée.
  const kept = (currentExtras ?? []).filter((l) => KNOWN_LEVELS.has(l) && l !== EXPERTES_LEVEL && l !== track);
  return { gradeLevel: track, extraLevels: wantsExpertes ? [...kept, EXPERTES_LEVEL] : kept };
}

/** Niveaux « en plus » attribués par l'admin : uniquement des niveaux connus,
 * jamais la classe principale elle-même. */
export function sanitizeExtraLevels(gradeLevel: string | null | undefined, extras: unknown): string[] {
  if (!Array.isArray(extras)) return [];
  const out: string[] = [];
  for (const l of extras) {
    if (typeof l === "string" && KNOWN_LEVELS.has(l) && l !== gradeLevel && !out.includes(l)) out.push(l);
  }
  return out.slice(0, SCHOOL_LEVELS.length);
}
