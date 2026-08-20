import type { PalierCode } from "@/lib/minigames/levels";

/** Suites numériques — contrairement au calcul mental, PAS de primaire : la
 * notion de suite comme objet formel démarre au collège (6ème→Terminale). */
export interface SuiteRule {
  code: PalierCode;
  label: string;
  content: string;
}

export const SUITES_RULES: SuiteRule[] = [
  { code: "06", label: "6ème", content: "suites arithmétiques simples (ajout d'un nombre entier fixe à chaque étape), trouve le terme suivant" },
  { code: "05", label: "5ème", content: "suites arithmétiques (raison positive ou négative, entière ou décimale simple), trouve le terme suivant" },
  { code: "04", label: "4ème", content: "suites arithmétiques et suites géométriques simples (multiplication par un nombre entier fixe), trouve le terme suivant" },
  { code: "03", label: "3ème", content: "suites arithmétiques et géométriques, calcule le terme suivant ou identifie la raison" },
  { code: "02", label: "Seconde", content: "suites définies par une formule explicite un = f(n) simple, ou une relation de récurrence u(n+1)=u(n)+r, calcule un terme donné" },
  { code: "01", label: "Première", content: "suites arithmétiques et géométriques (formule explicite, somme de quelques termes simples), sens de variation" },
  { code: "00", label: "Terminale", content: "suites arithmético-géométriques simples, convergence intuitive évidente (sans démonstration), calcul de termes" },
];

const BY_CODE = new Map(SUITES_RULES.map((r) => [r.code, r]));

export function listSuitesRules(): SuiteRule[] {
  return SUITES_RULES;
}

export function getSuiteRule(code: string): SuiteRule | null {
  return BY_CODE.get(code as PalierCode) ?? null;
}

export function buildSuitesSystemPrompt(rule: SuiteRule, avoidPrompts: string[] = [], theme?: string): string {
  const avoidBlock = avoidPrompts.length
    ? `\n\nCes questions ont déjà été utilisées récemment pour ce palier — ne les reproduis pas, même reformulées :\n${avoidPrompts.map((p) => `- ${p}`).join("\n")}`
    : "";
  const themeBlock = theme?.trim()
    ? `\n\nThème à privilégier pour cette fiche : "${theme.trim()}". SANS sortir du cadre de difficulté ci-dessous.`
    : "";

  return `Tu es un professeur de mathématiques français qui prépare une fiche de 5 questions sur les suites numériques pour des élèves de niveau ${rule.label}.

Type de suites autorisé pour ce palier (ne dépasse JAMAIS ce cadre) : ${rule.content}.${themeBlock}

Règles impératives :
- Chaque question doit avoir une réponse numérique UNIQUE et sans ambiguïté (un entier ou un décimal simple, jamais de fraction non simplifiable, jamais un décimal à développement infini comme 0,333...).
- Donne toujours assez de termes ou d'informations dans l'énoncé pour que la suite soit déterminée sans ambiguïté.
- Formule chaque question en une ou deux lignes courtes, en français ("Soit la suite 2, 5, 8, 11, ... Quel est le terme suivant ?").
- Varie les types de questions (terme suivant, raison, terme de rang n) dans le cadre autorisé.
- Les 5 questions de la fiche doivent toutes être DIFFÉRENTES les unes des autres.
- Pour toute notation nécessitant une mise en forme (indice uₙ, formule de récurrence u(n+1)=u(n)+r, fraction, puissance), utilise LaTeX entre signes dollar : $u_n$, $u_{n+1} = u_n + r$, $\\frac{3}{4}$. Pour une suite de nombres simples ("2, 5, 8, 11, ..."), le texte normal suffit.${avoidBlock}`;
}

export { SUITES_RULES as default };
