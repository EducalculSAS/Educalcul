/**
 * Calcul exact d'expressions de collège (relatifs, décimaux, fractions) pour
 * contrôler les réponses d'exercices générés SANS demander l'avis d'un modèle :
 * « $A = (-4{,}5) - (+2{,}3)$ » vaut forcément -6,8, quoi que le modèle ait écrit.
 * Les nombres sont des fractions exactes (BigInt) : aucun arrondi flottant.
 */

type Frac = { n: bigint; d: bigint };

// Pas de littéraux BigInt (cible TypeScript < ES2020).
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TEN = BigInt(10);
function pow10(exponent: number): bigint {
  let result = ONE;
  for (let i = 0; i < exponent; i++) result *= TEN;
  return result;
}

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < ZERO ? -a : a;
  b = b < ZERO ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || ONE;
};

function frac(n: bigint, d: bigint = ONE): Frac {
  if (d === ZERO) throw new Error("division par zéro");
  if (d < ZERO) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

const add = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
const div = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n);
export const fracEquals = (a: Frac, b: Frac) => a.n === b.n && a.d === b.d;

function decimalToFrac(text: string): Frac {
  const [intPart, decPart = ""] = text.split(".");
  return frac(BigInt(intPart + decPart), pow10(decPart.length));
}

/** Nettoie le LaTeX courant en une chaîne arithmétique simple (ou lève une erreur si autre chose que du calcul). */
function toArithmetic(latex: string): string {
  let s = latex
    .replace(/\\left|\\right/g, "")
    .replace(/\\,|\\;|\\!|\\ /g, "")
    .replace(/−|–/g, "-")
    .replace(/\\times|\\cdot|×|⋅/g, "*")
    .replace(/\\div|÷/g, "/")
    .replace(/\{,\}/g, ".")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\\dfrac|\\tfrac/g, "\\frac");
  // \frac{a}{b} -> ((a)/(b)), de l'intérieur vers l'extérieur
  for (let i = 0; i < 6 && s.includes("\\frac"); i++) {
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))");
  }
  s = s.replace(/\s+/g, "");
  if (/[^0-9.+\-*/()]/.test(s)) throw new Error("expression non arithmétique");
  return s;
}

/** Évalue une expression arithmétique exacte. Lève une erreur si elle n'est pas calculable. */
export function evaluateExpression(latex: string): Frac {
  const src = toArithmetic(latex);
  let pos = 0;
  const peek = () => src[pos];

  const number = (): Frac => {
    const m = /^\d+(\.\d+)?/.exec(src.slice(pos));
    if (!m) throw new Error("nombre attendu");
    pos += m[0].length;
    return decimalToFrac(m[0]);
  };
  const factor = (): Frac => {
    if (peek() === "+") {
      pos++;
      return factor();
    }
    if (peek() === "-") {
      pos++;
      const v = factor();
      return frac(-v.n, v.d);
    }
    if (peek() === "(") {
      pos++;
      const v = expr();
      if (peek() !== ")") throw new Error("parenthèse attendue");
      pos++;
      return v;
    }
    return number();
  };
  const term = (): Frac => {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = src[pos++];
      const w = factor();
      v = op === "*" ? mul(v, w) : div(v, w);
    }
    return v;
  };
  const expr = (): Frac => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = src[pos++];
      const w = term();
      v = op === "+" ? add(v, w) : sub(v, w);
    }
    return v;
  };

  const value = expr();
  if (pos !== src.length) throw new Error("expression incomplète");
  return value;
}

/**
 * Lit une réponse numérique seule : « -6,8 », « +35 », « −11,5 », « A = -9 », « (+3) », « 3/4 ».
 * Renvoie null si la réponse n'est pas UN nombre (liste, phrase...).
 */
export function parseNumericAnswer(answer: string): Frac | null {
  let s = answer
    .replace(/−|–/g, "-")
    .replace(/\s+/g, "")
    .replace(/^[A-Za-z]+=/, "")
    .replace(/^\$|\$$/g, "")
    .replace(/\{,\}/g, ",");
  s = s.replace(/^\((.*)\)$/, "$1");
  const m = /^([+-]?)(\d+(?:[.,]\d+)?)(?:\/(\d+))?$/.exec(s);
  if (!m) return null;
  const sign = m[1] === "-" ? -ONE : ONE;
  const base = decimalToFrac(m[2].replace(",", "."));
  const value = m[3] ? div(base, frac(BigInt(m[3]))) : base;
  return frac(sign * value.n, value.d);
}

/**
 * Pour un énoncé du type « Calculer : $A = (-4{,}5) - (+2{,}3)$ », renvoie la valeur
 * exacte de l'expression, ou null si l'énoncé n'est pas un calcul simple à
 * une seule expression.
 */
export function evaluateStatement(content: string): Frac | null {
  const segments = [...content.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
  const withEquals = segments.filter((s) => s.includes("="));
  const candidates = withEquals.length > 0 ? withEquals : segments;
  if (candidates.length !== 1) return null;
  const raw = candidates[0];
  const right = raw.includes("=") ? raw.slice(raw.indexOf("=") + 1) : raw;
  if (!right.trim()) return null;
  try {
    return evaluateExpression(right);
  } catch {
    return null;
  }
}
