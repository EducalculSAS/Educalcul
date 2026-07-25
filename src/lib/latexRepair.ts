/**
 * Réparation du LaTeX produit par l'IA dans les contenus de cours.
 *
 * Deux familles de défauts sont corrigées ici, parce qu'elles cassaient le
 * rendu de manière très visible côté élève :
 *
 * 1. Formule laissée SANS délimiteur ($...$ / $$...$$). L'IA écrit parfois
 *    "a(x_0 + ka) + c = 0 \implies ..." ou "\quad (2)" en texte brut : la
 *    commande LaTeX s'affichait telle quelle dans le cours.
 *
 * 2. Délimiteur $$ non refermé dans le même bloc HTML. Le $$ ouvrait dans un
 *    <p> et « cherchait » sa fermeture plusieurs paragraphes plus loin : tout
 *    le HTML intermédiaire était avalé comme si c'était de la formule, ce qui
 *    produisait un mélange illisible (des morceaux rendus en math, d'autres
 *    en texte brut, et un $$ orphelin affiché).
 *
 * Ces fonctions sont volontairement pures et sans dépendance : elles sont
 * utilisées à la génération (pour stocker du contenu propre) ET à l'affichage
 * (pour réparer les cours déjà enregistrés avant ce correctif).
 */

/** Commandes LaTeX prenant un ou deux arguments entre accolades. */
const CMD_WITH_ARGS =
  "frac|dfrac|tfrac|sqrt|vec|overrightarrow|overline|underline|bar|hat|dot|ddot|widehat|widetilde|binom|text|textbf|textit|mathbb|mathcal|mathbf|mathrm|mathit|mathsf|operatorname";

/** Commandes LaTeX « symboles » sans argument. */
const CMD_SYMBOLS =
  "quad|qquad|implies|impliedby|iff|to|mapsto|times|div|cdot|cdots|ldots|dots|vdots|ddots|le|leq|ge|geq|neq|ne|pm|mp|infty|approx|equiv|sim|propto|forall|exists|nexists|in|notin|subset|subseteq|supset|supseteq|cup|cap|emptyset|varnothing|perp|parallel|angle|circ|deg|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|Leftrightarrow|langle|rangle|lfloor|rfloor|lceil|rceil|sum|prod|int|lim|log|ln|exp|sin|cos|tan|arcsin|arccos|arctan|sinh|cosh|tanh|min|max|gcd|bmod|pmod";

const ENV_NAMES =
  "cases|array|pmatrix|bmatrix|vmatrix|Vmatrix|Bmatrix|matrix|aligned|align|gathered|split";

const ANY_LATEX_CMD_RE = new RegExp(
  `\\\\(?:${CMD_WITH_ARGS}|${CMD_SYMBOLS}|left|right|begin|end)\\b`,
);

const ENV_BLOCK_RE = new RegExp(
  `(?:\\\\left\\s*(?:\\\\\\{|[(\\[.|])\\s*)?\\\\begin\\{(${ENV_NAMES})\\}[\\s\\S]*?\\\\end\\{\\1\\}(?:\\s*\\\\right\\s*(?:\\\\\\}|[)\\].|]))?`,
  "g",
);

const CMD_WITH_ARGS_RE = new RegExp(
  `\\\\(?:${CMD_WITH_ARGS})\\s*\\{[^{}]*\\}(?:\\s*\\{[^{}]*\\})?`,
  "g",
);

const CMD_SYMBOL_RE = new RegExp(`\\\\(?:${CMD_SYMBOLS})\\b`, "g");

/** Mots de prose française (≥ 3 lettres, hors commande LaTeX). Sert à
 * distinguer « ce segment est une formule » de « ce segment est une phrase
 * qui contient une formule ». */
const PROSE_WORD_RE = /(?<!\\)\b[A-Za-zÀ-ÿ]{3,}\b/g;

/** Découpe un texte en alternant hors-math / math, en respectant les
 * délimiteurs $$...$$ puis $...$. Renvoie les segments avec un drapeau. */
function splitMathSegments(text: string): { text: string; isMath: boolean }[] {
  const out: { text: string; isMath: boolean }[] = [];
  const re = /\$\$[\s\S]*?\$\$|\$[^$\r\n]*?\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), isMath: false });
    out.push({ text: m[0], isMath: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), isMath: false });
  return out;
}

/** Retire les délimiteurs $$ ou $ restés orphelins (non refermés) dans un
 * segment de texte, pour qu'ils ne s'affichent jamais tels quels. */
function dropUnmatchedDelimiters(text: string): string {
  let result = text;
  // $$ orphelin : nombre impair d'occurrences → on retire la dernière.
  const dd = result.match(/\$\$/g);
  if (dd && dd.length % 2 === 1) {
    const idx = result.lastIndexOf("$$");
    result = result.slice(0, idx) + result.slice(idx + 2);
  }
  // $ simple orphelin (après retrait des $$ appariés).
  const withoutPairs = result.replace(/\$\$[\s\S]*?\$\$/g, "");
  const singles = withoutPairs.match(/\$/g);
  if (singles && singles.length % 2 === 1) {
    const idx = result.lastIndexOf("$");
    result = result.slice(0, idx) + result.slice(idx + 1);
  }
  return result;
}

/** Vrai si le segment (hors math) ressemble à une formule entière plutôt
 * qu'à une phrase : il contient au moins une commande LaTeX et très peu de
 * mots de prose. */
function looksLikeWholeFormula(segment: string): boolean {
  if (!ANY_LATEX_CMD_RE.test(segment)) return false;
  const withoutCommands = segment.replace(/\\[A-Za-z]+/g, " ");
  const proseWords = withoutCommands.match(PROSE_WORD_RE) || [];
  return proseWords.length <= 1;
}

/** Enveloppe dans $...$ les commandes LaTeX isolées d'un segment de prose. */
function wrapInlineCommands(segment: string): string {
  let result = segment.replace(ENV_BLOCK_RE, (m) => `$$${m}$$`);
  result = result.replace(CMD_WITH_ARGS_RE, (m) => `$${m}$`);
  // Commandes-symboles : on les regroupe avec les caractères mathématiques
  // adjacents (chiffres, opérateurs, parenthèses) pour éviter "$\quad$ (2)".
  result = result.replace(
    new RegExp(`(?:\\\\(?:${CMD_SYMBOLS})\\b[\\s]*)+[\\s0-9()+\\-*/=.,^_|]*`, "g"),
    (m) => {
      const trimmed = m.trimEnd();
      if (!trimmed) return m;
      const trailing = m.slice(trimmed.length);
      return `$${trimmed}$${trailing}`;
    },
  );
  return result;
}

/** Répare un segment de texte brut (déjà isolé de tout balisage HTML). */
function repairTextSegment(raw: string): string {
  if (!raw.trim()) return raw;
  const text = dropUnmatchedDelimiters(raw.replace(/\$\$\$+/g, "$$"));

  return splitMathSegments(text)
    .map(({ text: seg, isMath }) => {
      if (isMath) return seg;
      if (!ANY_LATEX_CMD_RE.test(seg)) return seg;
      if (looksLikeWholeFormula(seg)) {
        const lead = seg.match(/^\s*/)?.[0] ?? "";
        const tail = seg.match(/\s*$/)?.[0] ?? "";
        const core = seg.trim();
        return core ? `${lead}$${core}$${tail}` : seg;
      }
      return wrapInlineCommands(seg);
    })
    .join("");
}

/**
 * Répare le LaTeX d'un contenu HTML de leçon.
 * Le HTML est découpé sur les balises : chaque segment de texte est traité
 * indépendamment, ce qui garantit qu'une formule ne peut jamais « déborder »
 * d'un bloc HTML sur le suivant.
 */
export function repairLatex(html: string): string {
  if (!html) return html;
  return html
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith("<") && part.endsWith(">") ? part : repairTextSegment(part)))
    .join("");
}

/** Retire un préfixe « Figure 3 — » / « Fig. 2 : » d'une légende : la
 * numérotation est ajoutée automatiquement par le CSS, sans quoi elle
 * apparaîtrait en double et serait fausse dès qu'une figure est ajoutée
 * ou supprimée en cours d'édition. */
export function stripFigureNumberPrefix(html: string): string {
  if (!html) return html;
  return html.replace(
    /(<figcaption[^>]*>)\s*(?:Figure|Fig\.?|Schéma)\s*\d+\s*(?:[—:.\-–])?\s*/gi,
    "$1",
  );
}
