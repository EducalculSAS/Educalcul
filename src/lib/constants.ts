export const AVATARS = [
  "avatar1.png", "avatar2.png", "avatar3.png", "avatar4.png",
  "avatar5.png", "avatar6.png", "avatar7.png", "avatar8.png",
];

export const SCHOOL_LEVELS = [
  { value: "cp", label: "CP" },
  { value: "ce1", label: "CE1" },
  { value: "ce2", label: "CE2" },
  { value: "cm1", label: "CM1" },
  { value: "cm2", label: "CM2" },
  { value: "6eme", label: "6ème" },
  { value: "5eme", label: "5ème" },
  { value: "4eme", label: "4ème" },
  { value: "3eme", label: "3ème" },
  { value: "2nde", label: "Seconde (Générale & Techno)" },
  { value: "1ere-generale", label: "Première Générale (sans spé maths)" },
  { value: "1ere-generale-maths", label: "Première Générale (spé maths)" },
  { value: "terminale-generale", label: "Terminale Générale (sans maths)" },
  { value: "terminale-generale-maths", label: "Terminale Générale (spé maths)" },
  { value: "terminale-generale-expertes", label: "Terminale Générale (maths expertes)" },
  { value: "terminale-generale-complementaires", label: "Terminale Générale (maths complémentaires)" },
];

/** Grouped levels for student creation form (lycée needs voie selection) */
export const SCHOOL_LEVEL_GROUPS = [
  {
    label: "Primaire",
    levels: ["cp", "ce1", "ce2", "cm1", "cm2"],
  },
  {
    label: "Collège",
    levels: ["6eme", "5eme", "4eme", "3eme"],
  },
  {
    label: "Lycée",
    levels: [
      "2nde",
      "1ere-generale", "1ere-generale-maths",
      "terminale-generale", "terminale-generale-maths", "terminale-generale-expertes", "terminale-generale-complementaires",
    ],
  },
];

/** Cycles scolaires, pour filtrer un catalogue sans lister les 16 niveaux. */
export const SCHOOL_CYCLES = [
  { value: "primaire", label: "Primaire" },
  { value: "college", label: "Collège" },
  { value: "lycee", label: "Lycée" },
] as const;

export type SchoolCycle = (typeof SCHOOL_CYCLES)[number]["value"];

const CYCLE_BY_LEVEL: Record<string, SchoolCycle> = (() => {
  const byLabel: Record<string, SchoolCycle> = {
    Primaire: "primaire",
    Collège: "college",
    Lycée: "lycee",
  };
  const map: Record<string, SchoolCycle> = {};
  for (const group of SCHOOL_LEVEL_GROUPS) {
    const cycle = byLabel[group.label];
    if (!cycle) continue;
    for (const level of group.levels) map[level] = cycle;
  }
  return map;
})();

/**
 * Cycle d'un niveau scolaire ("ce2" → "primaire"). Tolère les variantes
 * d'écriture croisées en base ("6ème"/"6eme", majuscules, espaces) : les
 * contenus n'ont pas tous été créés par le même pipeline.
 */
export function getLevelCycle(level: string | null | undefined): SchoolCycle | null {
  if (!level) return null;
  const normalized = level
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return CYCLE_BY_LEVEL[normalized] ?? null;
}

export function getLevelLabel(value: string): string {
  return SCHOOL_LEVELS.find((l) => l.value === value)?.label ?? value;
}

/** Libellé simplifié pour l'espace enfant : pas de détail "spé maths" / "maths expertes" etc. */
export function getSimpleLevelLabel(value: string): string {
  if (!value) return value;
  if (value === "2nde") return "Seconde";
  if (value.startsWith("1ere-generale")) return "Première";
  if (value.startsWith("terminale-generale")) return "Terminale";
  return getLevelLabel(value);
}

/**
 * Détermine le niveau "imposé" par l'espace de publication courant : le niveau
 * du dossier le plus proche (en remontant vers la racine) qui a un niveau
 * spécifique défini (différent de "all"). Retourne null si on est à la racine
 * ou dans un dossier "Tous niveaux".
 */
export function getEffectiveFolderLevel(
  breadcrumbs: { grade_level?: string | null }[]
): string | null {
  for (let i = breadcrumbs.length - 1; i >= 0; i--) {
    const level = breadcrumbs[i]?.grade_level;
    if (level && level !== "all") return level;
  }
  return null;
}
