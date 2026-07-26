/**
 * Réparation défensive du LaTeX produit par l'IA dans les contenus HTML.
 *
 * Objectifs :
 * - conserver les formules déjà valides ;
 * - corriger les antislashs et dollars sur-échappés ;
 * - empêcher un délimiteur mathématique de traverser une balise HTML ;
 * - remettre en mode math les commandes LaTeX laissées en texte brut ;
 * - rester idempotent : repairLatex(repairLatex(x)) === repairLatex(x).
 *
 * Aucun réparateur heuristique ne peut reconstituer avec certitude une formule
 * dont le modèle a supprimé du contenu. Cette fonction privilégie donc un
 * rendu lisible et sûr, sans avaler le HTML voisin.
 */

const CMD_WITH_ARGS =
  "frac|dfrac|tfrac|sqrt|vec|overrightarrow|overline|underline|bar|hat|dot|ddot|widehat|widetilde|binom|boxed|cancel|text|textbf|textit|mathbb|mathcal|mathbf|mathrm|mathit|mathsf|operatorname";

const CMD_SYMBOLS =
  "quad|qquad|implies|impliedby|iff|to|mapsto|times|div|cdot|cdots|ldots|dots|vdots|ddots|le|leq|ge|geq|neq|ne|pm|mp|infty|approx|equiv|sim|propto|forall|exists|nexists|in|notin|subset|subseteq|supset|supseteq|cup|cap|emptyset|varnothing|perp|parallel|angle|circ|deg|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|Leftrightarrow|langle|rangle|lfloor|rfloor|lceil|rceil|sum|prod|int|lim|log|ln|exp|sin|cos|tan|arcsin|arccos|arctan|sinh|cosh|tanh|min|max|gcd|bmod|pmod";

const ENV_NAMES =
  "cases|array|pmatrix|bmatrix|vmatrix|Vmatrix|Bmatrix|matrix|aligned|align|alignedat|gathered|split";

const ALL_COMMANDS = `${CMD_WITH_ARGS}|${CMD_SYMBOLS}|left|right|begin|end`;
const ANY_LATEX_CMD_RE = new RegExp(`\\\\(?:${ALL_COMMANDS})\\b`);
const LATEX_CMD_GLOBAL_RE = new RegExp(`\\\\(?:${ALL_COMMANDS})\\b`, "g");
const PROSE_WORD_RE = /(?<!\\)\b[A-Za-zÀ-ÿ]{3,}\b/g;

function normalizeControlCharacters(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n");
}

/** Ramène 2 à 8 antislashs à un seul devant une commande connue. */
function normalizeEscapedCommands(text: string): string {
  const re = new RegExp(`\\\\{2,8}(?=(?:${ALL_COMMANDS})\\b)`, "g");
  return text.replace(re, "\\");
}

/** Les modèles écrivent parfois \\$ pour tenter d'échapper le JSON. */
function normalizeEscapedDollars(text: string): string {
  return text
    .replace(/\\+\$\$/g, "$$")
    .replace(/\\+\$/g, "$")
    .replace(/\${3,}/g, "$$");
}

function normalizeCommonCommandMistakes(text: string): string {
  return text
    .replace(/\\text\s*\{\s*[πΠ]\s*\}/g, "\\pi")
    .replace(
      /\\text\s*\{\s*(cos|sin|tan|ln|log|exp)\s*\}/gi,
      (_m, fn: string) => `\\${fn.toLowerCase()}`,
    )
    .replace(
      /\\operatorname\s*\{\s*(cos|sin|tan|ln|log|exp)\s*\}/gi,
      (_m, fn: string) => `\\${fn.toLowerCase()}`,
    )
    .replace(/\\text\s*\{\s*([α-ωΑ-Ω])\s*\}/g, "$1")
    .replace(/\\([()\[\]])/g, "$1");
}

function balanceBraces(math: string): string {
  const src = math.replace(/\\[{}]/g, "");
  let depth = 0;
  for (const ch of src) {
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
  }
  return depth > 0 ? math + "}".repeat(depth) : math;
}

function normalizeMathBody(body: string): string {
  let result = normalizeCommonCommandMistakes(normalizeEscapedCommands(body));
  result = result.replace(/&lt;/g, " \\lt ").replace(/&gt;/g, " \\gt ");
  result = result.replace(/(^|[^\\])<(?![A-Za-z/!])/g, "$1\\lt ");
  result = result.replace(/(^|[^\\])>/g, "$1\\gt ");
  result = result.replace(/\$+/g, " \\quad ");
  result = result.replace(/[ \t]+/g, " ").trim();
  return balanceBraces(result);
}

type MathPart = { text: string; isMath: boolean; display?: boolean };

/** Parse les dollars sans autoriser une formule à dépasser le nœud texte. */
function splitMathSegments(text: string): MathPart[] {
  const out: MathPart[] = [];
  let plain = "";
  let math = "";
  let mode: "plain" | "inline" | "display" = "plain";

  const flushPlain = () => {
    if (plain) out.push({ text: plain, isMath: false });
    plain = "";
  };
  const flushMath = (closed: boolean) => {
    if (!math && !closed) return;
    out.push({ text: math, isMath: true, display: mode === "display" });
    math = "";
  };

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "$") {
      if (mode === "plain") plain += text[i];
      else math += text[i];
      continue;
    }

    const isDouble = text[i + 1] === "$";
    if (mode === "plain") {
      flushPlain();
      mode = isDouble ? "display" : "inline";
      if (isDouble) i++;
      continue;
    }

    if ((mode === "display" && isDouble) || (mode === "inline" && !isDouble)) {
      flushMath(true);
      mode = "plain";
      if (isDouble) i++;
      continue;
    }

    // Dollar d'un autre type à l'intérieur d'une formule : séparateur erroné.
    math += " \\quad ";
    if (isDouble) i++;
  }

  if (mode === "plain") flushPlain();
  else flushMath(false); // on ferme localement un délimiteur orphelin
  return out;
}

function looksLikeWholeFormula(segment: string): boolean {
  if (!ANY_LATEX_CMD_RE.test(segment)) return false;
  const withoutCommands = segment.replace(LATEX_CMD_GLOBAL_RE, " ");
  const words = withoutCommands.match(PROSE_WORD_RE) || [];
  const hasEquationSignal =
    /[=+*/^_]|\\(?:frac|sqrt|vec|overrightarrow|begin|cos|sin|tan)\b/.test(
      segment,
    );
  return hasEquationSignal && words.length <= 2;
}

/**
 * Détecte une suffixe mathématique brut dans un texte, par exemple
 * "En développant : = \\vec{u} \\cdot \\vec{v}".
 */
function wrapRawMathSuffix(segment: string): string {
  if (!ANY_LATEX_CMD_RE.test(segment)) return segment;
  if (looksLikeWholeFormula(segment)) return `$${segment.trim()}$`;

  const commandIndex = segment.search(ANY_LATEX_CMD_RE);
  if (commandIndex < 0) return segment;

  // Cherche le séparateur de prose le plus proche avant la première commande.
  const before = segment.slice(0, commandIndex);
  const candidates = [
    before.lastIndexOf(":"),
    before.lastIndexOf(";"),
    before.lastIndexOf("\n"),
  ];
  const boundary = Math.max(...candidates);
  if (boundary >= 0) {
    const head = segment.slice(0, boundary + 1);
    let tail = segment.slice(boundary + 1).trim();
    if (/^(?:=|[-+()]|[A-Za-z0-9])/.test(tail) && ANY_LATEX_CMD_RE.test(tail)) {
      return `${head} $${normalizeMathBody(tail)}$`;
    }
  }

  // En dernier recours, enveloppe une séquence commande + expression jusqu'à
  // la fin du nœud texte, sans toucher à la prose qui précède.
  const start = Math.max(segment.lastIndexOf(" ", commandIndex - 1) + 1, 0);
  const head = segment.slice(0, start);
  const tail = segment.slice(start).trim();
  return tail ? `${head}$${normalizeMathBody(tail)}$` : segment;
}

/** Regroupe en une formule unique la partie située après un deux-points quand
 * elle est manifestement mathématique. Cela répare les longues identités que
 * le modèle a fragmentées en une succession de `$...$`, `\$` et commandes
 * brutes. */
function coalesceMathAfterColon(text: string): string {
  const colon = text.lastIndexOf(":");
  if (colon < 0) return text;

  const head = text.slice(0, colon + 1);
  const tail = text.slice(colon + 1).trim();
  if (!tail || (tail.startsWith("$") && tail.endsWith("$"))) return text;

  const commandCount = (tail.match(LATEX_CMD_GLOBAL_RE) || []).length;
  const mathSignal =
    /[=+*/^_]|\\(?:frac|sqrt|vec|overrightarrow|cos|sin|tan|left|begin)\b/.test(
      tail,
    );
  if (commandCount === 0 || !mathSignal) return text;

  const body = normalizeMathBody(tail.replace(/\$+/g, " "));
  return body ? `${head} $${body}$` : text;
}

function repairTextNode(raw: string): string {
  if (!raw.trim()) return raw;
  let text = normalizeControlCharacters(raw);
  text = normalizeEscapedDollars(text);
  text = normalizeEscapedCommands(text);
  text = normalizeCommonCommandMistakes(text);
  text = text.replace(/\$\s+\$/g, "$");
  text = coalesceMathAfterColon(text);

  const parts = splitMathSegments(text);
  const rendered = parts.map((part) => {
    if (part.isMath) {
      const body = normalizeMathBody(part.text);
      if (!body) return "";
      const delim = part.display ? "$$" : "$";
      return `${delim}${body}${delim}`;
    }
    return wrapRawMathSuffix(part.text);
  });

  // Deux formules inline consécutives ne doivent jamais fabriquer par
  // concaténation un faux délimiteur display `$$`.
  return rendered.reduce((acc, current) => {
    if (!current) return acc;
    return acc.endsWith("$") && current.startsWith("$")
      ? `${acc} ${current}`
      : acc + current;
  }, "");
}

function escapeStrayAngleBrackets(html: string): string {
  return html.replace(/<(?![a-zA-Z/!])/g, "&lt;");
}

/** Ferme un <p> implicitement lorsqu'un nouveau <p> commence. */
function repairNestedParagraphs(html: string): string {
  let previous = "";
  let result = html;
  for (let i = 0; i < 4 && result !== previous; i++) {
    previous = result;
    result = result.replace(
      /<p([^>]*)>((?:(?!<\/p>)[\s\S])*?)<p([^>]*)>/gi,
      (_m, a: string, body: string, b: string) => `<p${a}>${body}</p><p${b}>`,
    );
  }
  return result;
}

/**
 * Répare le LaTeX sans laisser les délimiteurs traverser les balises HTML.
 */
export function repairLatex(html: string): string {
  if (!html) return html;

  const normalized = repairNestedParagraphs(
    normalizeCommonCommandMistakes(
      normalizeEscapedDollars(
        normalizeEscapedCommands(normalizeControlCharacters(html)),
      ),
    ),
  );

  const repaired = normalized
    .split(/(<[^>]*>)/)
    .map((part) =>
      part.startsWith("<") && part.endsWith(">") ? part : repairTextNode(part),
    )
    .join("");

  return escapeStrayAngleBrackets(repaired);
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
