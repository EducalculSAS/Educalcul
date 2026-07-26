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

// Une balise HTML peut contenir un ">" littéral dans une valeur d'attribut
// entre guillemets (ex: data-caption="...$x > 4$...") — un simple [^>]* s'arrête
// sur ce ">" interne et coupe la balise au milieu, ce qui fait passer le reste
// de l'attribut (et la vraie balise fermante) pour un nœud de texte, où le
// réparateur LaTeX convertit alors ce ">" de fermeture en "\gt" littéral. Ce
// motif saute les valeurs entre guillemets sans s'arrêter sur leur contenu.
const HTML_TAG_RE_SOURCE = `<(?:"[^"]*"|'[^']*'|[^>"'])*>`;

const CMD_WITH_ARGS =
  "frac|dfrac|tfrac|sqrt|vec|overrightarrow|overline|underline|bar|hat|dot|ddot|widehat|widetilde|binom|boxed|cancel|text|textbf|textit|mathbb|mathcal|mathbf|mathrm|mathit|mathsf|operatorname";

const CMD_SYMBOLS =
  "quad|qquad|implies|impliedby|iff|to|mapsto|times|div|cdot|cdots|ldots|dots|vdots|ddots|le|leq|ge|geq|neq|ne|pm|mp|infty|approx|equiv|sim|propto|forall|exists|nexists|in|notin|subset|subseteq|supset|supseteq|cup|cap|emptyset|varnothing|perp|parallel|angle|circ|deg|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|Leftrightarrow|langle|rangle|lfloor|rfloor|lceil|rceil|sum|prod|int|lim|log|ln|exp|sin|cos|tan|arcsin|arccos|arctan|sinh|cosh|tanh|min|max|gcd|bmod|pmod|lt|gt|blacksquare";

const ENV_NAMES =
  "cases|array|pmatrix|bmatrix|vmatrix|Vmatrix|Bmatrix|matrix|aligned|align|alignedat|gathered|split";

const ALL_COMMANDS = `${CMD_WITH_ARGS}|${CMD_SYMBOLS}|left|right|begin|end`;
const ANY_LATEX_CMD_RE = new RegExp(`\\\\(?:${ALL_COMMANDS})\\b`);
const LATEX_CMD_GLOBAL_RE = new RegExp(`\\\\(?:${ALL_COMMANDS})\\b`, "g");
const PROSE_WORD_RE = /(?<!\\)\b[A-Za-zÀ-ÿ]{3,}\b/g;

/**
 * Récupère les commandes que JSON.parse a transformées en caractères de
 * contrôle lorsqu'un modèle a oublié d'échapper son antislash dans le JSON
 * brut : "\\text" peut devenir TAB + "ext", "\\frac" FORM-FEED +
 * "rac", etc. Cette passe doit impérativement précéder la suppression des
 * caractères de contrôle.
 */
function recoverCommandsFromJsonControlEscapes(text: string): string {
  return text
    .replace(/\u0008egin(?=\s*\{)/g, "\\begin")
    .replace(/\u0008ar(?=\s*\{)/g, "\\bar")
    .replace(/\u0008eta\b/g, "\\beta")
    .replace(/\u0008inom(?=\s*\{)/g, "\\binom")
    .replace(/\u0008oxed(?=\s*\{)/g, "\\boxed")
    .replace(/\u000Crac(?=\s*\{)/g, "\\frac")
    .replace(/\text(?=\s*\{)/g, "\\text")
    .replace(/\times\b/g, "\\times")
    .replace(/\theta\b/g, "\\theta")
    .replace(/\tfrac(?=\s*\{)/g, "\\tfrac")
    .replace(/\tan\b/g, "\\tan")
    .replace(/\to\b/g, "\\to")
    .replace(/\right(?:arrow)?\b/g, (m) =>
      m.endsWith("arrow") ? "\\rightarrow" : "\\right",
    )
    .replace(/\rho\b/g, "\\rho")
    .replace(/\rangle\b/g, "\\rangle")
    .replace(/\rfloor\b/g, "\\rfloor")
    .replace(/\rceil\b/g, "\\rceil")
    .replace(/\neq\b/g, "\n\\neq")
    .replace(/\nexists\b/g, "\n\\nexists")
    .replace(/\notin\b/g, "\n\\notin");
}

function normalizeControlCharacters(text: string): string {
  return recoverCommandsFromJsonControlEscapes(text)
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
  return (
    text
      // Commandes dont le premier caractère a disparu après une mauvaise
      // séquence d'échappement JSON (ex. TAB + ext{...} devenu ext{...}).
      .replace(/(^|[^A-Za-z\\])ext\s*\{/g, "$1\\text{")
      .replace(/(^|[^A-Za-z\\])rac\s*\{/g, "$1\\frac{")
      .replace(
        new RegExp(`(^|[^A-Za-z\\\\])egin\\s*\\{(${ENV_NAMES})\\}`, "g"),
        "$1\\begin{$2}",
      )
      .replace(/(^|[^A-Za-z\\])ightarrow\b/g, "$1\\rightarrow")
      .replace(/(^|[^A-Za-z\\])ight(?=\s*[)\]}.|])/g, "$1\\right")
      .replace(/(^|[^A-Za-z\\])imes\b/g, "$1\\times")
      .replace(/(^|[^A-Za-z\\])heta\b/g, "$1\\theta")
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
      .replace(/\\([()\[\]])/g, "$1")
  );
}

const PROSE_IN_MATH_IGNORE = new Set([
  "sin",
  "cos",
  "tan",
  "ln",
  "log",
  "exp",
  "lim",
  "min",
  "max",
  "mod",
  "gcd",
  "det",
  "proj",
  "arg",
  "ker",
]);

/** Retire les constructions LaTeX connues avant de chercher de vrais mots de
 * prose dans une formule. Une formule contenant « lorsque », « alors »,
 * « vecteur », etc. ne doit pas être envoyée telle quelle à KaTeX : les
 * espaces disparaissent et toute la phrase devient italique. */
function containsNaturalLanguageInMath(body: string): boolean {
  let probe = normalizeCommonCommandMistakes(body);
  for (let pass = 0; pass < 5; pass++) {
    const previous = probe;
    probe = probe
      .replace(
        /\\(?:text|textbf|textit|mathrm|mathbf|mathit|mathsf|mathbb|mathcal|operatorname)\s*\{[^{}]*\}/g,
        " ",
      )
      .replace(/\\(?:frac|dfrac|tfrac|binom)\s*\{[^{}]*\}\s*\{[^{}]*\}/g, " M ")
      .replace(
        /\\(?:sqrt|vec|overrightarrow|overline|underline|bar|hat|dot|ddot|widehat|widetilde|boxed|cancel)\s*\{[^{}]*\}/g,
        " M ",
      );
    if (probe === previous) break;
  }
  probe = probe
    .replace(/\\(?:begin|end)\s*\{[^{}]*\}/g, " ")
    .replace(/\\[A-Za-z]+/g, " ")
    .replace(/\b[A-Z]{2,}\b/g, " ");

  const words = probe.match(/\b[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\-]{2,}\b/g) || [];
  return words.some((word) => !PROSE_IN_MATH_IGNORE.has(word.toLowerCase()));
}

type BracedValue = { value: string; end: number };

function readBracedValue(source: string, start: number): BracedValue | null {
  if (source[start] !== "{") return null;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "\\") {
      i++;
      continue;
    }
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return { value: source.slice(start + 1, i), end: i + 1 };
    }
  }
  return null;
}

function replaceBracedCommand(
  source: string,
  command: string,
  argCount: number,
  replacer: (args: string[]) => string,
): string {
  const needle = `\\${command}`;
  let result = source;
  let from = 0;
  while (from < result.length) {
    const index = result.indexOf(needle, from);
    if (index < 0) break;
    const before = index > 0 ? result[index - 1] : "";
    const afterName = result[index + needle.length] || "";
    if (before === "\\" || /[A-Za-z]/.test(afterName)) {
      from = index + needle.length;
      continue;
    }
    let cursor = index + needle.length;
    const args: string[] = [];
    let end = cursor;
    let valid = true;
    for (let a = 0; a < argCount; a++) {
      while (/\s/.test(result[cursor] || "")) cursor++;
      const parsed = readBracedValue(result, cursor);
      if (!parsed) {
        valid = false;
        break;
      }
      args.push(parsed.value);
      cursor = parsed.end;
      end = parsed.end;
    }
    if (!valid) {
      from = index + needle.length;
      continue;
    }
    result = result.slice(0, index) + replacer(args) + result.slice(end);
    from = index + 1;
  }
  return result;
}

function needsParentheses(value: string): boolean {
  return /[+\-=<>\s]/.test(value.trim());
}

/** Une commande LaTeX se termine soit devant une autre commande, soit devant
 * un caractère non alphabétique, soit en fin de chaîne. `\\b` ne suffit pas :
 * après avoir converti `\\vec{u}` en texte, `\\cdot\\vec{v}` peut devenir
 * `\\cdot→v`, et certains moteurs concatènent alors accidentellement le nom
 * de la commande avec le symbole suivant. */
const COMMAND_END = String.raw`(?=\\\\|[^A-Za-z]|$)`;

function replaceReadableSymbolCommands(source: string): string {
  const entries: Array<[string, string]> = [
    ["cdot", " · "],
    ["times", " × "],
    ["div", " ÷ "],
    ["pm", " ± "],
    ["mp", " ∓ "],
    ["leq", " ≤ "],
    ["le", " ≤ "],
    ["geq", " ≥ "],
    ["ge", " ≥ "],
    ["neq", " ≠ "],
    ["ne", " ≠ "],
    ["lt", " < "],
    ["gt", " > "],
    ["approx", " ≈ "],
    ["equiv", " ≡ "],
    ["perp", " ⊥ "],
    ["parallel", " ∥ "],
    ["angle", "∠"],
    ["circ", "°"],
    ["deg", "°"],
    ["rightarrow", " → "],
    ["to", " → "],
    ["leftarrow", " ← "],
    ["Rightarrow", " ⇒ "],
    ["Leftarrow", " ⇐ "],
    ["leftrightarrow", " ⇔ "],
    ["Leftrightarrow", " ⇔ "],
    ["iff", " ⇔ "],
    ["implies", " ⇒ "],
    ["impliedby", " ⇐ "],
    ["infty", "∞"],
    ["notin", " ∉ "],
    ["nexists", "∄"],
    ["forall", "∀"],
    ["exists", "∃"],
    ["in", " ∈ "],
    ["blacksquare", "■"],
    ["quad", " "],
    ["qquad", " "],
  ];

  let result = source.replace(/\\\|/g, "‖");
  for (const [command, replacement] of entries) {
    result = result.replace(
      new RegExp(`\\\\${command}${COMMAND_END}`, "g"),
      replacement,
    );
  }
  result = result.replace(/\\[,;:! ]/g, "");
  return result;
}

/**
 * Repli lisible pour une formule mêlée à une phrase. Il garantit qu'aucun
 * antislash LaTeX brut n'arrive à l'écran, même lorsque la source est trop
 * ambiguë pour être reconstruite en plusieurs formules KaTeX fiables.
 *
 * On évite volontairement les accents combinés (`u⃗`, `Â`, etc.) : selon la
 * police du navigateur ils peuvent devenir des carrés noirs. Les notations
 * `→u`, `angle(A)` et `barre(x)` utilisent des glyphes largement supportés.
 */
export function mathToReadableText(math: string): string {
  let s = normalizeCommonCommandMistakes(
    normalizeEscapedCommands(normalizeControlCharacters(math)),
  ).trim();

  // Convertir les symboles AVANT les commandes à arguments évite qu'une
  // séquence comme `\\vec{u}\\cdot\\vec{v}` devienne `→u\\cdot→v` puis soit
  // lue comme une commande inconnue `cdot` collée au texte suivant.
  s = replaceReadableSymbolCommands(s);
  s = s.replace(/\\(?:left|right)(?=\\|[^A-Za-z]|$)\s*/g, "");
  s = s
    .replace(
      /\\(?:begin|end)\s*\{(?:cases|array|pmatrix|bmatrix|vmatrix|Vmatrix|Bmatrix|matrix|aligned|align|alignedat|gathered|split)\}/g,
      " ",
    )
    .replace(/\\\\/g, " ; ")
    .replace(/&/g, "");

  for (let pass = 0; pass < 8; pass++) {
    const previous = s;
    for (const name of ["frac", "dfrac", "tfrac"]) {
      s = replaceBracedCommand(s, name, 2, ([a, b]) => {
        const left = mathToReadableText(a);
        const right = mathToReadableText(b);
        return `${needsParentheses(left) ? `(${left})` : left}/${needsParentheses(right) ? `(${right})` : right}`;
      });
    }
    s = replaceBracedCommand(
      s,
      "binom",
      2,
      ([a, b]) => `C(${mathToReadableText(a)}, ${mathToReadableText(b)})`,
    );
    s = replaceBracedCommand(
      s,
      "sqrt",
      1,
      ([a]) => `√(${mathToReadableText(a)})`,
    );
    for (const name of [
      "text",
      "textbf",
      "textit",
      "mathrm",
      "mathbf",
      "mathit",
      "mathsf",
      "mathbb",
      "mathcal",
      "operatorname",
      "boxed",
      "cancel",
    ]) {
      s = replaceBracedCommand(s, name, 1, ([a]) => mathToReadableText(a));
    }

    // Glyphes robustes : aucune marque combinée susceptible d'afficher □.
    s = replaceBracedCommand(s, "vec", 1, ([a]) => `→${mathToReadableText(a)}`);
    s = replaceBracedCommand(
      s,
      "overrightarrow",
      1,
      ([a]) => `→${mathToReadableText(a)}`,
    );
    s = replaceBracedCommand(
      s,
      "hat",
      1,
      ([a]) => `angle(${mathToReadableText(a)})`,
    );
    s = replaceBracedCommand(
      s,
      "widehat",
      1,
      ([a]) => `angle(${mathToReadableText(a)})`,
    );
    s = replaceBracedCommand(
      s,
      "bar",
      1,
      ([a]) => `barre(${mathToReadableText(a)})`,
    );
    s = replaceBracedCommand(
      s,
      "overline",
      1,
      ([a]) => `barre(${mathToReadableText(a)})`,
    );
    s = replaceBracedCommand(s, "underline", 1, ([a]) => mathToReadableText(a));
    s = replaceBracedCommand(
      s,
      "dot",
      1,
      ([a]) => `point(${mathToReadableText(a)})`,
    );
    s = replaceBracedCommand(
      s,
      "ddot",
      1,
      ([a]) => `deux-points(${mathToReadableText(a)})`,
    );
    if (s === previous) break;
  }

  s = replaceReadableSymbolCommands(s);

  s = s.replace(/\\([A-Za-z]+)/g, (_m, name: string) => {
    const lower: Record<string, string> = {
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
    const upper: Record<string, string> = {
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
    const knownFunction: Record<string, string> = {
      sin: "sin",
      cos: "cos",
      tan: "tan",
      arcsin: "arcsin",
      arccos: "arccos",
      arctan: "arctan",
      sinh: "sinh",
      cosh: "cosh",
      tanh: "tanh",
      ln: "ln",
      log: "log",
      exp: "exp",
      lim: "lim",
      min: "min",
      max: "max",
      gcd: "gcd",
      bmod: "mod",
      pmod: "mod",
      sum: "somme",
      prod: "produit",
      int: "intégrale",
    };
    // Entourer une commande inconnue d'espaces empêche `\\cdot\\vec{v}` de
    // finir sous la forme illisible `cdotvecv` si une commande hors liste
    // traverse malgré tout les passes précédentes.
    return lower[name] ?? upper[name] ?? knownFunction[name] ?? ` ${name} `;
  });

  s = s
    .replace(
      /\^\{([^{}]*)\}|\^([0-9A-Za-z+\-=()])/g,
      (_m, a: string, b: string) => {
        const value = a ?? b;
        return toScript(value, SUP_MAP) ?? `^${value}`;
      },
    )
    .replace(
      /_\{([^{}]*)\}|_([0-9A-Za-z+\-=()])/g,
      (_m, a: string, b: string) => {
        const value = a ?? b;
        return toScript(value, SUB_MAP) ?? `_${value}`;
      },
    )
    .replace(/[{}]/g, "")
    .replace(/\s*([=+×·≤≥≠<>⊥∥])\s*/g, " $1 ")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return s;
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
  if (containsNaturalLanguageInMath(segment))
    return mathToReadableText(segment);
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
      // Une phrase placée par erreur entre dollars ne doit jamais devenir une
      // longue ligne mathématique italique sans espaces. On privilégie un
      // repli Unicode lisible plutôt qu'une reconstruction hasardeuse.
      if (containsNaturalLanguageInMath(body)) return mathToReadableText(body);
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

/** Normalise uniquement la structure des paragraphes. Le navigateur ferait
 * une partie de ce travail implicitement, mais le faire avant la réparation
 * empêche les nœuds texte orphelins et les </p> surnuméraires de perturber le
 * découpage des formules. */
function normalizeParagraphStructure(html: string): string {
  const blockTags = new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "div",
    "dl",
    "fieldset",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hr",
    "main",
    "nav",
    "ol",
    "pre",
    "section",
    "table",
    "ul",
  ]);
  const tokens = html.split(new RegExp(`(<\\/?[A-Za-z](?:"[^"]*"|'[^']*'|[^>"'])*>)`, "g"));
  let paragraphOpen = false;
  let result = "";

  for (const token of tokens) {
    const match = token.match(/^<\s*(\/?)\s*([A-Za-z0-9:-]+)/);
    if (!match) {
      result += token;
      continue;
    }
    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    const selfClosing =
      /\/\s*>$/.test(token) ||
      ["br", "hr", "img", "input", "meta", "link"].includes(name);

    if (name === "p") {
      if (closing) {
        if (paragraphOpen) {
          result += "</p>";
          paragraphOpen = false;
        }
      } else {
        if (paragraphOpen) result += "</p>";
        result += token;
        paragraphOpen = !selfClosing;
      }
      continue;
    }

    if (paragraphOpen && blockTags.has(name)) {
      result += "</p>";
      paragraphOpen = false;
    }
    result += token;
  }

  if (paragraphOpen) result += "</p>";
  return result;
}

/**
 * Répare le LaTeX sans laisser les délimiteurs traverser les balises HTML.
 */
export function repairLatex(html: string): string {
  if (!html) return html;

  const normalized = normalizeParagraphStructure(
    normalizeCommonCommandMistakes(
      normalizeEscapedDollars(
        normalizeEscapedCommands(normalizeControlCharacters(html)),
      ),
    ),
  );

  const repaired = normalized
    .split(new RegExp(`(${HTML_TAG_RE_SOURCE})`))
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
  let s = normalizeCommonCommandMistakes(
    normalizeEscapedCommands(normalizeControlCharacters(math)),
  ).trim();

  // Comme pour mathToReadableText, traiter les opérateurs avant les commandes
  // à arguments empêche la concaténation `\\cdotv` après retrait de \\vec{v}.
  s = replaceReadableSymbolCommands(s);
  s = s.replace(/\\(?:left|right)(?=\\|[^A-Za-z]|$)\s*/g, "");

  // Dans un SVG, la flèche du vecteur est normalement déjà dessinée par le
  // schéma : on garde uniquement le libellé brut, sans HTML KaTeX.
  for (let pass = 0; pass < 6; pass++) {
    const previous = s;
    for (const name of [
      "vec",
      "overrightarrow",
      "overline",
      "underline",
      "hat",
      "widehat",
      "widetilde",
      "dot",
      "ddot",
      "bar",
      "text",
      "mathrm",
      "mathbf",
      "mathit",
      "mathsf",
      "mathbb",
      "mathcal",
      "textbf",
      "textit",
      "operatorname",
    ]) {
      s = replaceBracedCommand(s, name, 1, ([a]) => mathToPlainText(a));
    }
    for (const name of ["frac", "dfrac", "tfrac"]) {
      s = replaceBracedCommand(
        s,
        name,
        2,
        ([a, b]) => `${mathToPlainText(a)}/${mathToPlainText(b)}`,
      );
    }
    s = replaceBracedCommand(s, "sqrt", 1, ([a]) => `√(${mathToPlainText(a)})`);
    if (s === previous) break;
  }

  s = replaceReadableSymbolCommands(s);
  s = s.replace(/\\([A-Za-z]+)/g, (_m, name: string) => {
    const functions: Record<string, string> = {
      sin: "sin",
      cos: "cos",
      tan: "tan",
      arcsin: "arcsin",
      arccos: "arccos",
      arctan: "arctan",
      ln: "ln",
      log: "log",
      exp: "exp",
      lim: "lim",
      min: "min",
      max: "max",
    };
    return (
      GREEK_LOWER[name] ?? GREEK_UPPER[name] ?? functions[name] ?? ` ${name} `
    );
  });
  s = s.replace(
    /\^\{([^{}]*)\}|\^([0-9A-Za-z+\-=()])/g,
    (_m, g1: string, g2: string) => {
      const body = g1 ?? g2;
      return toScript(body, SUP_MAP) ?? `^${body}`;
    },
  );
  s = s.replace(
    /_\{([^{}]*)\}|_([0-9A-Za-z+\-=()])/g,
    (_m, g1: string, g2: string) => {
      const body = g1 ?? g2;
      return toScript(body, SUB_MAP) ?? `_${body}`;
    },
  );
  s = s
    .replace(/[{}]/g, "")
    .replace(/\s*([=+×·≤≥≠<>⊥∥])\s*/g, " $1 ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return s;
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
