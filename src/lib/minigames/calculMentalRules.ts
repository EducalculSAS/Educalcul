import { type PalierCode } from "@/lib/minigames/levels";

/** Grille des opérations autorisées par palier — fournie telle quelle par
 * l'équipe pédagogique (décompte 11=CP → 00=Terminale), en dur dans le code
 * comme les autres générateurs (Cours/Exercices/Quiz). Plusieurs codes
 * partagent volontairement le même texte (ex. 10/09, 08/07/06) : la grille
 * d'origine les regroupe explicitement. */
export interface CalculMentalRule {
  code: PalierCode;
  label: string;
  operations: string;
}

export const CALCUL_MENTAL_RULES: CalculMentalRule[] = [
  { code: "11", label: "CP", operations: "additions et soustractions (+, -), questions mélangeant + et -" },
  { code: "10", label: "CE1", operations: "additions, soustractions, multiplications (+, -, ×), questions mélangeant + et -, questions mélangeant +, - et ×" },
  { code: "09", label: "CE2", operations: "additions, soustractions, multiplications (+, -, ×), questions mélangeant + et -, questions mélangeant +, - et ×" },
  { code: "08", label: "CM1", operations: "divisions exactes (÷), questions mélangeant + et -, questions mélangeant × et ÷, questions mélangeant les 4 opérations" },
  { code: "07", label: "CM2", operations: "divisions exactes (÷), questions mélangeant + et -, questions mélangeant × et ÷, questions mélangeant les 4 opérations" },
  { code: "06", label: "6ème", operations: "divisions exactes (÷), questions mélangeant + et -, questions mélangeant × et ÷, questions mélangeant les 4 opérations" },
  { code: "05", label: "5ème", operations: "questions mélangeant les 4 opérations (+, -, ×, ÷), carrés de nombres usuels (x²)" },
  { code: "04", label: "4ème", operations: "questions mélangeant les 4 opérations, carrés (x²), distributivité simple a(b+c), résolution mentale d'équations du type ax+b=cx+d avec des coefficients simples" },
  { code: "03", label: "3ème", operations: "développement (a±b)(c±d), identités remarquables (a±b)², résolution d'équations ax+b=cx+d" },
  { code: "02", label: "Seconde", operations: "développement (a±b)(c±d), identités remarquables (a±b)², vecteurs colinéaires (calcul mental simple, notation →), droites parallèles (notation ∥)" },
  { code: "01", label: "Première", operations: "calcul mental du discriminant b²-4ac pour des coefficients simples, raison d'une suite arithmétique/géométrique, valeurs remarquables de sin/cos UNIQUEMENT parmi celles à résultat rationnel exact : sin(0)=0, cos(0)=1, sin(π/2)=1, cos(π/2)=0, sin(π/6)=1/2, cos(π/3)=1/2 (JAMAIS cos(π/6), sin(π/4), cos(π/4), sin(π/3), leur résultat est irrationnel, √2/2 ou √3/2, impossible à donner comme nombre exact)" },
  { code: "00", label: "Terminale", operations: "dérivées de fonctions usuelles simples (x², x³, 1/x) en un point, puissances simples pour l'exponentielle (e⁰, e¹), probabilités simples (P(A∩B), P(A∪B) avec valeurs données), produit scalaire de vecteurs simples" },
];

const BY_CODE = new Map(CALCUL_MENTAL_RULES.map((r) => [r.code, r]));

export function getCalculMentalRule(code: string): CalculMentalRule | null {
  return BY_CODE.get(code as PalierCode) ?? null;
}

export function buildCalculMentalSystemPrompt(rule: CalculMentalRule, avoidPrompts: string[] = [], theme?: string): string {
  const avoidBlock = avoidPrompts.length
    ? `\n\nCes questions ont déjà été utilisées récemment pour ce palier, ne les reproduis pas, même reformulées, et varie vraiment les nombres et les tournures :\n${avoidPrompts.map((p) => `- ${p}`).join("\n")}`
    : "";
  const themeBlock = theme?.trim()
    ? `\n\nThème à privilégier pour cette fiche : "${theme.trim()}". Habille les questions autour de ce thème quand c'est possible SANS jamais sortir du cadre d'opérations autorisé ci-dessous ni sacrifier la clarté, si le thème ne se prête pas naturellement à une question, reste sur une question de calcul neutre plutôt que de forcer un lien artificiel.`
    : "";

  return `Tu es un professeur de mathématiques français qui prépare une fiche de calcul mental pour des élèves de niveau ${rule.label}.

Opérations et notions autorisées pour ce palier (ne dépasse JAMAIS ce cadre, même si tu penses qu'une question serait "intéressante") : ${rule.operations}.${themeBlock}

Règles impératives :
- Chaque question doit avoir une réponse numérique UNIQUE et sans ambiguïté : jamais de fraction non simplifiable en décimal, jamais de racine, jamais un décimal à développement infini ou irrationnel (ex. 1/3 = 0,333..., ou √2/2 = 0,7071... pour un sin/cos non remarquable, même approximé, un nombre irrationnel n'est JAMAIS une bonne réponse).
- Si l'opération choisie doit normalement produire un entier (division, racine, etc. quand le palier les autorise), choisis TOUJOURS des nombres qui donnent un résultat entier exact, jamais une virgule "surprise" (ex. ne demande jamais 7 ÷ 2, choisis 8 ÷ 2). Une réponse décimale n'est acceptable que pour les notions du palier qui le prévoient explicitement ET dont le résultat est un nombre rationnel exact (ex. sin(π/6)=0,5 est acceptable ; cos(π/6)=√3/2 ne l'est jamais).
- N'utilise JAMAIS de trigonométrie (sin, cos, tan), de racine carrée, de logarithme, d'exponentielle ou toute autre notion de lycée qui ne figure PAS mot pour mot dans les opérations autorisées ci-dessus, même à un palier proche. Un palier qui n'a pas "sin/cos" dans sa liste ne doit jamais en contenir.
- Les questions doivent être résolubles de tête en quelques secondes par un élève de ce niveau, sans poser d'opération sur papier.
- Formule chaque question en une ligne courte, en français, sans habillage narratif ("Calcule 8 × 7", "Résous : 3x + 2 = 2x + 9").
- Varie les types de questions dans le cadre autorisé plutôt que de répéter la même structure.
- Pour toute notation nécessitant une mise en forme (puissance au-delà du carré simple, racine, discriminant b²-4ac, sin/cos, dérivée f'(x), produit scalaire), utilise LaTeX entre signes dollar : $x^3$, $\\sqrt{16}$, $b^2 - 4ac$, $\\sin(\\pi/6)$, $f'(x)$. Pour une opération arithmétique simple ("Calcule 8 × 7"), le texte normal suffit, pas besoin de LaTeX.
- N'utilise JAMAIS d'opération ou de notion hors du cadre indiqué ci-dessus, même une seule fois.
- Les questions de la fiche doivent toutes être DIFFÉRENTES les unes des autres (jamais deux fois la même question, même avec des nombres différents pour un même type si la fiche est courte).${avoidBlock}`;
}

// Export pour parcourir les 12 paliers ailleurs (cron, admin UI) sans
// dépendre de la forme exacte de CALCUL_MENTAL_RULES.
