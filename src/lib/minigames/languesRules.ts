import type { PalierCode } from "@/lib/minigames/levels";

export type MathLanguage = "en" | "de" | "es";

const LANGUAGE_NAMES: Record<MathLanguage, string> = { en: "anglais", de: "allemand", es: "espagnol" };

/** Maths en langues — seul le lycée est couvert : c'est la seule tranche pour
 * laquelle du contenu a été fourni (thèmes de Première : équations du second
 * degré, suites, trigonométrie). L'énoncé est en langue étrangère, la
 * réponse reste toujours un nombre. */
export interface LangueRule {
  code: PalierCode;
  label: string;
  content: string;
}

export const LANGUES_RULES: LangueRule[] = [
  { code: "01", label: "Première", content: "équations du second degré simples, suites arithmétiques/géométriques, trigonométrie de base (valeurs remarquables), vocabulaire mathématique en langue étrangère" },
  { code: "00", label: "Terminale", content: "dérivées simples, exponentielle, probabilités simples, produit scalaire, vocabulaire mathématique en langue étrangère" },
];

const BY_CODE = new Map(LANGUES_RULES.map((r) => [r.code, r]));

export function listLanguesRules(): LangueRule[] {
  return LANGUES_RULES;
}

export function getLangueRule(code: string): LangueRule | null {
  return BY_CODE.get(code as PalierCode) ?? null;
}

/** Une seule langue par jour, tournante (déterministe à partir de la date
 * YYYY-MM-DD) — évite de tripler la génération quotidienne pour 3 langues en
 * parallèle. Basé sur le jour de l'année, stable indépendamment du moment où
 * la génération tourne réellement (fiabilise l'idempotence du cron). */
export function getRotatingLanguage(forDate: string): MathLanguage {
  const [y, m, d] = forDate.split("-").map(Number);
  const dayOfYear = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
  const languages: MathLanguage[] = ["en", "de", "es"];
  return languages[dayOfYear % 3];
}

export function buildLanguesSystemPrompt(
  rule: LangueRule,
  avoidPrompts: string[] = [],
  theme?: string,
  language: MathLanguage = "en",
): string {
  const languageName = LANGUAGE_NAMES[language];
  const avoidBlock = avoidPrompts.length
    ? `\n\nCes questions ont déjà été utilisées récemment pour ce palier, ne les reproduis pas, même reformulées :\n${avoidPrompts.map((p) => `- ${p}`).join("\n")}`
    : "";
  const themeBlock = theme?.trim()
    ? `\n\nThème à privilégier pour cette fiche : "${theme.trim()}". SANS sortir du cadre de notions ci-dessous.`
    : "";

  return `Tu es un professeur de mathématiques qui prépare une fiche de 5 questions de mathématiques ENTIÈREMENT RÉDIGÉES EN ${languageName.toUpperCase()} pour des élèves français de niveau ${rule.label} (cours de maths en langue étrangère).

Notions autorisées pour ce palier (ne dépasse JAMAIS ce cadre) : ${rule.content}.${themeBlock}

Règles impératives :
- L'énoncé de chaque question ("prompt") doit être ENTIÈREMENT en ${languageName}, vocabulaire mathématique correct dans cette langue.
- Chaque question doit avoir une réponse NUMÉRIQUE unique et sans ambiguïté : jamais de fraction non simplifiable, jamais de racine, et jamais un décimal à développement infini (ex. 1/3 = 0,333... est interdit, choisis des valeurs qui donnent un résultat exact ou un décimal qui s'arrête en 1-2 chiffres). La réponse elle-même reste un nombre, même si l'énoncé est en langue étrangère.
- Les questions doivent être résolubles en quelques dizaines de secondes par un élève de ce niveau qui maîtrise ces notions en français.
- Varie les types de questions dans le cadre autorisé plutôt que de répéter la même structure.
- Les 5 questions de la fiche doivent toutes être DIFFÉRENTES les unes des autres.
- Pour toute notation mathématique nécessitant une mise en forme (équation, puissance, dérivée, trigonométrie), utilise LaTeX entre signes dollar (ex. $x^2 + 3x - 4 = 0$, $f'(x)$, $\\sin(\\theta)$) même si le texte autour est en langue étrangère, seul l'habillage textuel change de langue, la notation mathématique reste universelle.${avoidBlock}`;
}

export { LANGUES_RULES as default };
