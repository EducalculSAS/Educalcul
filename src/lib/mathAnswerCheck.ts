/**
 * Vérification déterministe des réponses numériques avant de solliciter le
 * LLM (`gradeAnswer` dans `src/lib/llm.ts`). Cible spécifiquement le bug
 * observé : une réponse numérique correcte, mais abîmée par des artefacts de
 * saisie (virgule décimale française, `\text{...}` de MathLive autour d'un
 * chiffre, espaces, zéro final...), rejetée par erreur de lecture/calcul du
 * modèle.
 *
 * Important : on ne tranche QUE quand les deux réponses sont écrites dans la
 * MÊME famille de notation (nombre vs nombre, fraction vs fraction,
 * pourcentage vs pourcentage) — jamais entre familles différentes (ex:
 * 50% vs 0.5). Une question peut explicitement exiger une forme précise
 * ("donne le résultat en décimal") ; seule l'IA lit l'énoncé et sait si la
 * conversion entre notations est acceptée ici. Les expressions algébriques,
 * le texte libre et les réponses ensemblistes/intervalles ne sont pas
 * couverts (`decided: false`) : ils restent tranchés par l'IA.
 */

const NUMERIC_TOLERANCE = 1e-9;

export interface DeterministicCheckResult {
  decided: boolean;
  isCorrect?: boolean;
  reason?: "incomplete";
}

type NotationCategory = "plain" | "fraction" | "percent";

interface ParsedNumber {
  value: number;
  category: NotationCategory;
}

/** Un `\placeholder{}` résiduel signale une structure MathLive pas remplie
 * (ex: une fraction dont seul le numérateur a été saisi) — inutile
 * d'appeler l'IA, la réponse est incomplète par construction. */
function hasResidualPlaceholder(input: string): boolean {
  return /\\placeholder(\{[^{}]*\})?/.test(input);
}

/** Déballe tout `\text{...}` : ce sont des caractères tapés tels quels au
 * clavier physique (voir MathInput.tsx), pas de la notation mathématique —
 * il faut lire leur contenu brut, pas les traiter comme un bloc opaque. */
function unwrapText(input: string): string {
  return input.replace(/\\text\{([^{}]*)\}/g, "$1");
}

/** Nettoie les artefacts cosmétiques LaTeX qui n'affectent pas la valeur :
 * `\left`/`\right`, espacements fins, `$`, notation MathLive `{,}` pour la
 * virgule décimale, puis tous les espaces. */
function cleanLatex(raw: string): string {
  let s = raw;
  s = s.replace(/\{,\}/g, ","); // virgule décimale MathLive native (ex: "3{,}14")
  // Tirets typographiques (moins « − », demi-cadratin « – », cadratin « — », traits d'union insécables) : tous valent « - ».
  // Un « − » collé ou tapé depuis un autre clavier faisait lire « −3 » comme du texte, donc une réponse juste refusée.
  s = s.replace(/[\u2212\u2013\u2014\u2010\u2011\u2012\u207B\uFE63\uFF0D]/g, "-");
  s = unwrapText(s);
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\[,;!]/g, "");
  s = s.replace(/~/g, "");
  s = s.replace(/\$/g, "");
  s = s.replace(/\s+/g, "");
  // Une seule paire d'accolades qui enveloppe toute la chaîne restante
  // (résidu possible après le déballage de \text{...}).
  const wrapped = s.match(/^\{([^{}]*)\}$/);
  if (wrapped) s = wrapped[1];
  // Parenthèses qui enveloppent TOUTE la réponse : « (-3) » vaut « -3 », « (3) » vaut « 3 » (un nombre négatif se met
  // souvent entre parenthèses) ; un « + » de tête ne change rien non plus.
  for (let i = 0; i < 2; i++) {
    const paren = s.match(/^\(([^()]*)\)$/);
    if (paren) s = paren[1];
  }
  if (/^\+\d/.test(s)) s = s.slice(1);
  return s;
}

/** Convertit la virgule décimale française en point, uniquement quand elle
 * relie deux groupes de chiffres (ex: "3,14" → "3.14") — jamais une virgule
 * qui séparerait deux valeurs distinctes. */
function frenchCommaToPoint(s: string): string {
  return s.replace(/(\d),(\d)/g, "$1.$2");
}

/** Essaie de réduire une expression nettoyée à un nombre catégorisé par
 * notation : entier/décimal ("plain"), pourcentage, ou fraction
 * (`\frac`/`\dfrac`/`\tfrac{a}{b}` ou texte `a/b`). Retourne `null` si
 * l'expression n'est pas purement numérique (algèbre, texte, etc.). */
function parseNumericToken(cleaned: string): ParsedNumber | null {
  const s = frenchCommaToPoint(cleaned);

  if (/^-?\d+(\.\d+)?$/.test(s)) {
    return { value: parseFloat(s), category: "plain" };
  }

  const percent = s.match(/^(-?\d+(?:\.\d+)?)\\?%$/);
  if (percent) {
    return { value: parseFloat(percent[1]) / 100, category: "percent" };
  }

  const latexFraction = s.match(/^(-)?\\(?:d|t)?frac\{(-?\d+(?:\.\d+)?)\}\{(-?\d+(?:\.\d+)?)\}$/);
  if (latexFraction) {
    const sign = latexFraction[1] ? -1 : 1;
    const numerator = parseFloat(latexFraction[2]);
    const denominator = parseFloat(latexFraction[3]);
    if (denominator === 0) return null;
    return { value: (sign * numerator) / denominator, category: "fraction" };
  }

  const plainFraction = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (plainFraction) {
    const numerator = parseFloat(plainFraction[1]);
    const denominator = parseFloat(plainFraction[2]);
    if (denominator === 0) return null;
    return { value: numerator / denominator, category: "fraction" };
  }

  return null;
}

/**
 * Tente de trancher déterministiquement une réponse élève par rapport à la
 * réponse attendue. `decided:false` signifie "pas de verdict fiable ici,
 * laisse l'IA juger" (expression algébrique, texte, ensemble, changement de
 * notation entre fraction/décimal/pourcentage, etc.) — jamais un signal
 * d'erreur.
 */
export function tryDeterministicMathCheck(
  expected: string,
  studentAnswer: string,
): DeterministicCheckResult {
  if (typeof studentAnswer !== "string" || typeof expected !== "string") {
    return { decided: false };
  }

  if (hasResidualPlaceholder(studentAnswer)) {
    return { decided: true, isCorrect: false, reason: "incomplete" };
  }

  const expectedParsed = parseNumericToken(cleanLatex(expected));
  const studentParsed = parseNumericToken(cleanLatex(studentAnswer));

  if (!expectedParsed || !studentParsed) {
    return { decided: false };
  }

  // Notations différentes (ex: 50% vs 0.5) : la question peut exiger une
  // forme précise, seule l'IA lit l'énoncé pour trancher — on ne devine pas.
  if (expectedParsed.category !== studentParsed.category) {
    return { decided: false };
  }

  return {
    decided: true,
    isCorrect: Math.abs(expectedParsed.value - studentParsed.value) < NUMERIC_TOLERANCE,
  };
}
