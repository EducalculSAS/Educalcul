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

/**
 * Corrige les commandes LaTeX doublement échappées par l'IA.
 *
 * Exemple après lecture du JSON :
 *   \\overrightarrow{AB}
 * devient :
 *   \overrightarrow{AB}
 *
 * On ne touche qu'aux doubles antislashs placés devant une commande LaTeX
 * connue. Les vrais retours à la ligne `\\` utilisés dans aligned, matrix,
 * cases, etc. restent donc intacts.
 */
function normalizeDoubleEscapedLatexCommands(text: string): string {
  const commandNames = [
    CMD_WITH_ARGS,
    CMD_SYMBOLS,
    "left",
    "right",
    "begin",
    "end",
  ].join("|");

  const doubleEscapedCommand = new RegExp(
    `\\\\\\\\(?=(?:${commandNames})\\b)`,
    "g",
  );

  let result = text;

  // Répare aussi les textes qui auraient été échappés plusieurs fois.
  for (let pass = 0; pass < 3; pass++) {
    const repaired = result.replace(doubleEscapedCommand, "\\");
    if (repaired === result) break;
    result = repaired;
  }

  return result;
}

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
    if (m.index > last)
      out.push({ text: text.slice(last, m.index), isMath: false });
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

/** Ajoute les accolades fermantes manquantes d'un contenu LaTeX (l'IA tronque
 * parfois une formule en oubliant de refermer \boxed{...} ou un \vec{...}
 * final). Les accolades échappées (\{ \}) sont des symboles littéraux et ne
 * comptent pas comme groupement. */
function balanceBraces(math: string): string {
  const forCounting = math.replace(/\\[{}]/g, "");
  let depth = 0;
  for (const ch of forCounting) {
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
  }
  return depth > 0 ? math + "}".repeat(depth) : math;
}

/** Répare un segment déjà identifié comme mathématique (délimiteurs $/$$
 * inclus) : retire les $ isolés qui traînent à l'intérieur (l'IA enchaîne
 * parfois plusieurs lignes de calcul dans un même $$...$$ en les séparant
 * par un $ au lieu d'un simple espace — un $ ne peut de toute façon jamais
 * être un délimiteur valide une fois qu'on est déjà à l'intérieur d'une
 * formule), retire un \(/\) redondant imbriqué par erreur dans un $...$ déjà
 * ouvert (\( et \) sont des délimiteurs de CHANGEMENT de mode, invalides une
 * fois déjà en mode math — pas des parenthèses littérales), puis rééquilibre
 * les accolades. */
function repairMathSegment(seg: string): string {
  const isDisplay = seg.startsWith("$$");
  const delim = isDisplay ? "$$" : "$";
  const original = seg.slice(delim.length, seg.length - delim.length);
  let destrayed = original.includes("$")
    ? original.replace(/\$+/g, " \\quad ")
    : original;
  destrayed = destrayed.replace(/\\([()])/g, "");
  // L'IA écrit parfois l'entité HTML &lt;/&gt; au lieu de \lt/\gt à
  // l'intérieur d'une formule déjà bien délimitée (souvent en mélangeant les
  // deux dans le même tableau) — KaTeX ne connaît pas "&lt;" comme symbole.
  destrayed = destrayed.replace(/&lt;/g, " \\lt ").replace(/&gt;/g, " \\gt ");
  const balanced = balanceBraces(destrayed);
  return balanced === original ? seg : `${delim}${balanced}${delim}`;
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
    new RegExp(
      `(?:\\\\(?:${CMD_SYMBOLS})\\b[\\s]*)+[\\s0-9()+\\-*/=.,^_|]*`,
      "g",
    ),
    (m) => {
      const trimmed = m.trimEnd();
      if (!trimmed) return m;
      const trailing = m.slice(trimmed.length);
      return `$${trimmed}$${trailing}`;
    },
  );
  return result;
}

/**
 * Normalise les défauts de délimiteurs propres à un segment généré sur
 * plusieurs lignes : un retour à la ligne brut au milieu d'une phrase casse
 * l'appariement $...$ (l'IA l'utilise parfois par erreur, alors que les
 * paragraphes sont déjà séparés par des balises <p>), et un "$$" est parfois
 * écrit là où une seule formule inline ($...$) était visiblement voulue —
 * reconnaissable au fait qu'il ne couvre pas tout le segment (une vraie
 * formule affichée $$...$$ occupe tout le contenu d'un bloc HTML, jamais
 * seulement une portion au milieu d'une phrase).
 */
function normalizeStraySegment(raw: string): string {
  let text = raw.replace(/\s+/g, " ");
  const trimmed = text.trim();
  const isWholeSegmentDisplay =
    trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4;
  if (!isWholeSegmentDisplay) {
    text = text.replace(/\${2,}/g, "$");
  }
  text = text.replace(/\$ \$/g, "$");
  return text;
}

/** Répare un segment de texte brut (déjà isolé de tout balisage HTML). */
function repairTextSegment(raw: string): string {
  if (!raw.trim()) return raw;
  const text = dropUnmatchedDelimiters(
    normalizeStraySegment(raw).replace(/\$\$\$+/g, "$$"),
  );

  return splitMathSegments(text)
    .map(({ text: seg, isMath }) => {
      if (isMath) return repairMathSegment(seg);
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
 * Convertit le < ou > brut resté À L'INTÉRIEUR d'un $...$ déjà bien formé
 * ("$d = ... \\approx 2.683 < 3$") en \\lt/\\gt. Contrairement à
 * mergeStrayComparison (deux $...$ à fusionner), ici il n'y a qu'UNE seule
 * paire $...$ dès le départ : le rendu final exclut < et > du contenu d'une
 * formule (pour qu'un $ ne traverse jamais une balise), donc l'opérateur brut
 * y resterait invisible/non rendu sinon. N'agit que si aucun autre $/<>
 * n'entoure la paire, pour ne jamais risquer d'avaler une vraie balise HTML.
 */
function convertOperatorInsideSinglePair(html: string): string {
  return html.replace(
    /\$([^$<>]*)([<>])([^$<>]*)\$/g,
    (_m, before: string, op: string, after: string) =>
      `$${before}${op === "<" ? "\\lt" : "\\gt"}${after}$`,
  );
}

/**
 * Fusionne "$A$ < B$" ou "$A$ > B$" en "$A \\lt B$" : l'IA referme parfois une
 * formule juste avant un opérateur de comparaison au lieu de l'y inclure
 * ("$\\sqrt{2}$ < 4$" au lieu de "$\\sqrt{2} < 4$"), ce qui laisse un < nu et
 * un $ orphelin. On fusionne en une seule formule ET on convertit l'opérateur
 * en \\lt/\\gt (jamais un < ou > brut) : le rendu final exclut délibérément
 * < et > du contenu d'une formule (pour qu'un $ ne traverse jamais une
 * balise), donc un < littéral y resterait tout aussi invisible/non rendu.
 */
function mergeStrayComparison(html: string): string {
  return html.replace(
    /\$([^$<>]+)\$(\s*)([<>])(\s*)([^$<>]*?)\$/g,
    (_m, a: string, s1: string, op: string, s2: string, b: string) =>
      `$${a}${s1}${op === "<" ? "\\lt" : "\\gt"}${s2}${b}$`,
  );
}

/**
 * Échappe un '<' nu utilisé comme opérateur mathématique en prose ("Si d < r")
 * plutôt que comme début de balise. Un '<' n'ouvre une vraie balise que s'il
 * est suivi d'une lettre, d'un '/' ou d'un '!' (commentaire/doctype) : dans
 * tous les autres cas (espace, chiffre, lettre grecque échappée...) c'est
 * un signe "inférieur à" resté hors LaTeX. Non échappé, il est indiscernable
 * d'un début de balise pour repairLatex et casse tout le découpage HTML qui
 * suit — d'où les blocs de texte brut/écrasés observés en aval.
 */
function escapeStrayAngleBrackets(html: string): string {
  return html.replace(/<(?![a-zA-Z/!])/g, "&lt;");
}

/**
 * Répare le LaTeX d'un contenu HTML de leçon.
 * Le HTML est découpé sur les balises : chaque segment de texte est traité
 * indépendamment, ce qui garantit qu'une formule ne peut jamais « déborder »
 * d'un bloc HTML sur le suivant.
 */
export function repairLatex(html: string): string {
  if (!html) return html;

  const normalized = normalizeDoubleEscapedLatexCommands(html);

  return escapeStrayAngleBrackets(
    mergeStrayComparison(convertOperatorInsideSinglePair(normalized)),
  )
    .split(/(<[^>]*>)/)
    .map((part) =>
      part.startsWith("<") && part.endsWith(">")
        ? part
        : repairTextSegment(part),
    )
    .join("");
}

const GREEK_LOWER: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  vartheta: "ϑ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  varphi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
};
const GREEK_UPPER: Record<string, string> = {
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
};
const SUB_MAP: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
};
const SUP_MAP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
  i: "ⁱ",
};

/** Convertit chaque caractère de `body` via `map` ; renvoie null si un seul
 * caractère n'a pas d'équivalent unicode (mieux vaut garder l'original que
 * de le tronquer). */
function toScript(body: string, map: Record<string, string>): string | null {
  let out = "";
  for (const ch of body) {
    const mapped = map[ch];
    if (!mapped) return null;
    out += mapped;
  }
  return out;
}

/**
 * Convertit une formule LaTeX en texte brut lisible (sans aucun HTML) :
 * utilisé pour les libellés à l'intérieur d'un <text> SVG. Un <text> SVG ne
 * peut afficher que des glyphes de texte brut — jamais les <span> imbriqués
 * que produit KaTeX (mise en page HTML/CSS) — donc y injecter du HTML KaTeX
 * ne fonctionne pas et le libellé disparaît ou s'affiche déformé.
 */
export function mathToPlainText(math: string): string {
  let s = math.trim();
  s = s.replace(/\\(?:left|right)\b\s*/g, "");
  // \vec{X}, \overrightarrow{X}... -> X (la flèche est déjà dessinée dans le schéma)
  s = s.replace(
    /\\(?:vec|overrightarrow|overline|underline|hat|widehat|widetilde|dot|ddot|bar)\{([^{}]*)\}/g,
    "$1",
  );
  // \text{...}, \mathrm{...}, \operatorname{...} -> contenu brut
  s = s.replace(
    /\\(?:text|mathrm|mathbf|mathit|mathsf|mathbb|mathcal|textbf|textit|operatorname)\{([^{}]*)\}/g,
    "$1",
  );
  s = s.replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2");
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, "√($1)");
  s = s.replace(/\\\|/g, "‖");
  // Espacements purement typographiques (\! \, \; \: \<espace>) : aucun
  // contenu textuel, on les retire — sinon ils restent tels quels (aucune
  // des règles suivantes ne reconnaît un backslash suivi d'un symbole non
  // alphabétique) et s'affichent comme du charabia dans le schéma.
  s = s.replace(/\\[!,;: ]/g, "");
  const SYMS: [RegExp, string][] = [
    [/\\cdot\b/g, "·"],
    [/\\times\b/g, "×"],
    [/\\div\b/g, "÷"],
    [/\\pm\b/g, "±"],
    [/\\mp\b/g, "∓"],
    [/\\leq\b|\\le\b/g, "≤"],
    [/\\geq\b|\\ge\b/g, "≥"],
    [/\\neq\b|\\ne\b/g, "≠"],
    [/\\infty\b/g, "∞"],
    [/\\approx\b/g, "≈"],
    [/\\equiv\b/g, "≡"],
    [/\\perp\b/g, "⊥"],
    [/\\parallel\b/g, "∥"],
    [/\\angle\b/g, "∠"],
    [/\\circ\b/g, "°"],
    [/\\rightarrow\b|\\to\b/g, "→"],
    [/\\Rightarrow\b/g, "⇒"],
    [/\\leftrightarrow\b/g, "↔"],
    [/\\in\b/g, "∈"],
    [/\\forall\b/g, "∀"],
    [/\\exists\b/g, "∃"],
    [/\\quad\b|\\qquad\b/g, " "],
  ];
  for (const [re, rep] of SYMS) s = s.replace(re, rep);
  // Commande restante : lettre grecque connue, sinon son nom tel quel
  // (mieux vaut afficher "log" que de faire disparaître le texte).
  s = s.replace(
    /\\([A-Za-z]+)/g,
    (_m, name: string) => GREEK_LOWER[name] ?? GREEK_UPPER[name] ?? name,
  );
  s = s.replace(
    /\^\{([^{}]*)\}|\^([0-9A-Za-z+\-=()])/g,
    (_m, g1: string, g2: string) => {
      const body = g1 ?? g2;
      return toScript(body, SUP_MAP) ?? body;
    },
  );
  s = s.replace(
    /_\{([^{}]*)\}|_([0-9A-Za-z+\-=()])/g,
    (_m, g1: string, g2: string) => {
      const body = g1 ?? g2;
      return toScript(body, SUB_MAP) ?? body;
    },
  );
  s = s.replace(/[{}]/g, "");
  return s.trim();
}

function escapeSvgText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Rend en texte brut (jamais en HTML KaTeX) toutes les formules $...$/$$...$$
 * contenues dans un bloc <svg>...</svg>. À appeler avant le rendu KaTeX
 * normal, pour qu'aucune formule à l'intérieur d'un schéma ne reçoive du
 * HTML qu'un <text> SVG ne peut pas afficher.
 */
export function renderMathAsPlainTextInSvg(svgHtml: string): string {
  let result = svgHtml;
  result = result.replace(/\$\$([^<>]*?)\$\$/g, (m, math) =>
    math.trim() ? escapeSvgText(mathToPlainText(math)) : m,
  );
  result = result.replace(/\$([^$<>\r\n]+?)\$/g, (m, math) =>
    math.trim() ? escapeSvgText(mathToPlainText(math)) : m,
  );
  result = result.replace(/\\\(([^<>]+?)\\\)/g, (m, math) =>
    escapeSvgText(mathToPlainText(math)),
  );
  result = result.replace(/\\\[([^<>]+?)\\\]/g, (m, math) =>
    escapeSvgText(mathToPlainText(math)),
  );
  result = result.replace(/\$\$/g, "");
  return result;
}

/**
 * Force une taille de flèche fixe pour les <marker> d'un schéma SVG.
 * Par défaut, markerUnits="strokeWidth" (comportement par défaut du SVG) :
 * la flèche grossit avec le stroke-width de la ligne à laquelle elle est
 * attachée. Un vecteur dessiné avec stroke-width="2" donne donc une flèche
 * DEUX FOIS plus grande que prévu — d'où les triangles énormes observés.
 * userSpaceOnUse fixe la taille de la flèche dans le même repère que le
 * reste du schéma, indépendamment de l'épaisseur du trait.
 */
export function normalizeSvgArrowMarkers(svgHtml: string): string {
  if (!svgHtml.includes("<marker")) return svgHtml;
  return svgHtml.replace(/<marker\b([^>]*)>/g, (match, attrs: string) => {
    if (/\bmarkerUnits\s*=/.test(attrs)) {
      return match.replace(
        /\bmarkerUnits\s*=\s*"[^"]*"/,
        'markerUnits="userSpaceOnUse"',
      );
    }
    return `<marker${attrs} markerUnits="userSpaceOnUse">`;
  });
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
