import type { PalierCode } from "@/lib/minigames/levels";

/** Énigmes de logique — une énigme se calibre naturellement à tout âge (contrairement
 * à Suites/Langues), donc les 12 paliers sont couverts comme le calcul mental. */
export interface EnigmeRule {
  code: PalierCode;
  label: string;
  content: string;
}

export const ENIGMES_RULES: EnigmeRule[] = [
  { code: "11", label: "CP", content: "énigmes très simples de reconnaissance (formes, couleurs, comptage jusqu'à 20), réponse un mot ou un petit nombre" },
  { code: "10", label: "CE1", content: "énigmes simples de logique (suites d'objets, comparaisons de quantités), réponse un mot ou un nombre" },
  { code: "09", label: "CE2", content: "énigmes de logique avec un indice à exploiter (ordre, position), réponse un mot ou un nombre" },
  { code: "08", label: "CM1", content: "énigmes de déduction simple (qui est qui, ordre d'objets à partir de 2-3 indices), réponse un mot ou un nombre" },
  { code: "07", label: "CM2", content: "énigmes de déduction avec plusieurs indices à croiser, petits problèmes numériques déguisés" },
  { code: "06", label: "6ème", content: "énigmes mathématiques simples (parité, multiples, petits problèmes de logique), réponse un mot ou un nombre" },
  { code: "05", label: "5ème", content: "énigmes de logique avec plusieurs indices à croiser, petits problèmes arithmétiques déguisés en histoire" },
  { code: "04", label: "4ème", content: "énigmes mêlant logique et calcul (âges, partages, proportions simples)" },
  { code: "03", label: "3ème", content: "énigmes de déduction multi-étapes, petits problèmes algébriques déguisés en histoire" },
  { code: "02", label: "Seconde", content: "énigmes mêlant logique et notions de seconde (ensembles simples, fonctions, probabilités élémentaires)" },
  { code: "01", label: "Première", content: "énigmes de logique avancées mêlant probabilités, suites ou algèbre de niveau première" },
  { code: "00", label: "Terminale", content: "énigmes de logique avancées mêlant probabilités, exponentielle ou algèbre de niveau terminale" },
];

const BY_CODE = new Map(ENIGMES_RULES.map((r) => [r.code, r]));

export function listEnigmesRules(): EnigmeRule[] {
  return ENIGMES_RULES;
}

export function getEnigmeRule(code: string): EnigmeRule | null {
  return BY_CODE.get(code as PalierCode) ?? null;
}

export function buildEnigmesSystemPrompt(rule: EnigmeRule, avoidPrompts: string[] = [], theme?: string): string {
  const avoidBlock = avoidPrompts.length
    ? `\n\nCes énigmes ont déjà été utilisées récemment pour ce palier, ne les reproduis pas, même reformulées :\n${avoidPrompts.map((p) => `- ${p}`).join("\n")}`
    : "";
  const themeBlock = theme?.trim()
    ? `\n\nThème à privilégier pour cette fiche : "${theme.trim()}". Habille les énigmes autour de ce thème SANS sacrifier la clarté de l'indice.`
    : "";

  return `Tu es un professeur qui prépare une fiche de 5 énigmes de logique pour des élèves de niveau ${rule.label}.

Type d'énigmes attendu pour ce palier (ne dépasse jamais ce cadre de difficulté) : ${rule.content}.${themeBlock}

Règles impératives :
- Chaque énigme doit avoir une réponse UNIQUE et sans ambiguïté : un seul mot (en minuscules, sans accent si possible) ou un nombre écrit en chiffres.
- L'énoncé doit contenir tous les indices nécessaires pour trouver la réponse sans information manquante.
- Formule chaque énigme en 1 à 3 phrases courtes, en français.
- Varie les types d'énigmes (déduction, logique, calcul déguisé) plutôt que de répéter la même structure.
- Les 5 énigmes de la fiche doivent toutes être DIFFÉRENTES les unes des autres.${avoidBlock}`;
}

export { ENIGMES_RULES as default };
