/** Grille des opérations autorisées par niveau pour le calcul mental,
 * fournie telle quelle par l'équipe pédagogique (codes en compte à rebours,
 * voir levels.ts pour la correspondance avec les grade_level de l'app).
 * Chaque niveau hérite implicitement des opérations des niveaux plus élevés
 * (ex. 08 a "/" en plus de "+-x" déjà vu en 10-09). */
export interface CalculMentalRule {
  code: string;
  label: string;
  operations: string; // description humaine, injectée telle quelle dans le prompt IA
}

export const CALCUL_MENTAL_RULES: CalculMentalRule[] = [
  { code: "11", label: "CP", operations: "additions et soustractions simples (nombres < 20)" },
  { code: "10", label: "CE1", operations: "additions, soustractions, débuts de multiplication (tables de 2 à 5)" },
  { code: "09", label: "CE2", operations: "additions, soustractions, multiplications (tables jusqu'à 10)" },
  { code: "08", label: "CM1", operations: "additions, soustractions, multiplications, divisions exactes simples" },
  { code: "07", label: "CM2", operations: "additions, soustractions, multiplications, divisions exactes, calcul avec des nombres décimaux simples" },
  { code: "06", label: "6ème", operations: "les 4 opérations sur entiers et décimaux, priorités opératoires" },
  { code: "05", label: "5ème", operations: "les 4 opérations, carrés de nombres usuels (x²), calcul avec des fractions simples" },
  { code: "04", label: "4ème", operations: "les 4 opérations, carrés, résolution mentale d'équations simples du type ax+b=cx+d" },
  { code: "03", label: "3ème", operations: "les 4 opérations, identités remarquables (a±b)(c±d) et (a±b)², résolution d'équations ax+b=cx+d" },
  { code: "02", label: "Seconde", operations: "développement/factorisation (a±b)(c±d) et (a±b)², vecteurs (somme, colinéarité →), droites parallèles/perpendiculaires (∥, ⊥)" },
];

export function getCalculMentalRule(code: string): CalculMentalRule | null {
  return CALCUL_MENTAL_RULES.find((r) => r.code === code) ?? null;
}

export function buildCalculMentalSystemPrompt(rule: CalculMentalRule): string {
  return `Tu es un professeur de mathématiques français qui prépare une fiche de calcul mental chronométré pour des élèves de niveau ${rule.label}.

Opérations et notions autorisées pour ce niveau (ne dépasse JAMAIS ce cadre, même si tu penses qu'une question serait "intéressante") : ${rule.operations}.

Règles impératives :
- Chaque question doit avoir une réponse numérique UNIQUE et sans ambiguïté (jamais de fraction non simplifiable en décimal, jamais de racine).
- Les questions doivent être résolubles de tête en quelques secondes par un élève de ce niveau, sans poser d'opération sur papier.
- Formule chaque question en une ligne courte, en français, sans habillage narratif ("Calcule 8 × 7", "Résous : 3x + 2 = 2x + 9").
- Varie les types de questions dans le cadre autorisé plutôt que de répéter la même structure.
- N'utilise JAMAIS d'opération ou de notion hors du cadre indiqué ci-dessus, même une seule fois.`;
}
