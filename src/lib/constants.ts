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
  { value: "1ere-sti2d", label: "Première STI2D" },
  { value: "1ere-stmg", label: "Première STMG" },
  { value: "1ere-st2s", label: "Première ST2S" },
  { value: "1ere-stl", label: "Première STL" },
  { value: "1ere-std2a", label: "Première STD2A" },
  { value: "1ere-sthr", label: "Première STHR" },
  { value: "terminale-generale", label: "Terminale Générale (sans maths)" },
  { value: "terminale-generale-maths", label: "Terminale Générale (spé maths)" },
  { value: "terminale-generale-expertes", label: "Terminale Générale (maths expertes)" },
  { value: "terminale-generale-complementaires", label: "Terminale Générale (maths complémentaires)" },
  { value: "terminale-sti2d", label: "Terminale STI2D" },
  { value: "terminale-stmg", label: "Terminale STMG" },
  { value: "terminale-st2s", label: "Terminale ST2S" },
  { value: "terminale-stl", label: "Terminale STL" },
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
      "1ere-sti2d", "1ere-stmg", "1ere-st2s", "1ere-stl", "1ere-std2a", "1ere-sthr",
      "terminale-generale", "terminale-generale-maths", "terminale-generale-expertes", "terminale-generale-complementaires",
      "terminale-sti2d", "terminale-stmg", "terminale-st2s", "terminale-stl",
    ],
  },
];

export function getLevelLabel(value: string): string {
  return SCHOOL_LEVELS.find((l) => l.value === value)?.label ?? value;
}
