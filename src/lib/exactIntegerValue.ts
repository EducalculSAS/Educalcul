/**
 * Valeur ENTIÈRE exacte d'une expression numérique écrite en LaTeX ou au clavier (produits, puissances, fractions,
 * parenthèses) : `2^2 \times 5^5` vaut 12500, `4 \times 5^{5}` aussi.
 *
 * Sert à une seule chose : reconnaître sans l'ombre d'un doute une réponse FAUSSE (« 2^3 × 5^5 » vaut 40000, pas
 * 12500), là où un petit modèle de langage se trompait en comparant des écritures proches. On ne s'en sert jamais pour
 * accepter : deux écritures de même valeur peuvent ne pas être équivalentes pour la consigne (« donne le résultat sous
 * la forme 2^a × 5^b »), c'est l'IA qui lit l'énoncé qui tranche.
 *
 * Tout ce qui n'est pas un calcul sur des nombres (lettres, unités, égalités, ensembles…) ou qui ne donne pas un entier
 * renvoie `null` : on ne tranche pas.
 */

type Rat = { n: bigint; d: bigint };

// Pas de littéraux bigint (la cible TypeScript du projet est antérieure à ES2020).
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TEN = BigInt(10);

function bpow(base: bigint, exp: bigint): bigint {
  let result = ONE;
  for (let i = ZERO; i < exp; i = i + ONE) result = result * base;
  return result;
}

const MAX_EXPONENT = 400;
const MAX_BITS = 20_000;

function gcd(a: bigint, b: bigint): bigint {
  a = a < ZERO ? -a : a;
  b = b < ZERO ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}
function rat(n: bigint, d: bigint): Rat {
  if (d === ZERO) throw new Error("division par zéro");
  if (d < ZERO) { n = -n; d = -d; }
  const g = gcd(n, d) || ONE;
  return { n: n / g, d: d / g };
}
const bits = (x: bigint) => (x < ZERO ? -x : x).toString(2).length;

function normalize(raw: string): string {
  return raw
    .replace(/\$/g, "")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\(left|right)/g, "")
    .replace(/\\[,;:! ]|~/g, "")
    .replace(/\\[dt]frac/g, "\\frac")
    .replace(/\\(times|cdot)|[×·*]/g, "*")
    .replace(/\\div|÷/g, "/")
    .replace(/\{,\}/g, ",")
    .replace(/[−–—‐‑‒⁻﹣－]/g, "-")
    .replace(/\s+/g, "");
}

class Parser {
  private i = 0;
  constructor(private readonly s: string) {}

  parseAll(): Rat {
    const v = this.expr();
    if (this.i !== this.s.length) throw new Error("reste");
    return v;
  }

  private peek() { return this.s[this.i]; }

  private expr(): Rat {
    let v = this.term();
    while (this.peek() === "+" || this.peek() === "-") {
      const op = this.s[this.i++];
      const r = this.term();
      v = op === "+" ? rat(v.n * r.d + r.n * v.d, v.d * r.d) : rat(v.n * r.d - r.n * v.d, v.d * r.d);
    }
    return v;
  }

  private term(): Rat {
    let v = this.unary();
    while (this.peek() === "*" || this.peek() === "/") {
      const op = this.s[this.i++];
      const r = this.unary();
      v = op === "*" ? rat(v.n * r.n, v.d * r.d) : rat(v.n * r.d, v.d * r.n);
      if (bits(v.n) > MAX_BITS || bits(v.d) > MAX_BITS) throw new Error("trop grand");
    }
    return v;
  }

  private unary(): Rat {
    if (this.peek() === "-") { this.i++; const v = this.unary(); return rat(-v.n, v.d); }
    if (this.peek() === "+") { this.i++; return this.unary(); }
    return this.power();
  }

  private power(): Rat {
    const base = this.atom();
    if (this.peek() !== "^") return base;
    this.i++;
    let exp: Rat;
    if (this.peek() === "{") { this.i++; exp = this.expr(); this.expect("}"); }
    else if (/[0-9]/.test(this.peek() ?? "")) { exp = rat(BigInt(this.s[this.i++]), ONE); }
    else throw new Error("exposant");
    if (exp.d !== ONE) throw new Error("exposant non entier");
    const e = Number(exp.n);
    if (!Number.isInteger(e) || Math.abs(e) > MAX_EXPONENT) throw new Error("exposant trop grand");
    const k = BigInt(Math.abs(e));
    if (bits(base.n) * Math.abs(e) > MAX_BITS || bits(base.d) * Math.abs(e) > MAX_BITS) throw new Error("trop grand");
    const n = bpow(base.n, k), d = bpow(base.d, k);
    return e >= 0 ? rat(n, d) : rat(d, n);
  }

  private atom(): Rat {
    const c = this.peek();
    if (c === "(") { this.i++; const v = this.expr(); this.expect(")"); return v; }
    if (c === "{") { this.i++; const v = this.expr(); this.expect("}"); return v; }
    if (this.s.startsWith("\\frac", this.i)) {
      this.i += 5;
      this.expect("{"); const a = this.expr(); this.expect("}");
      this.expect("{"); const b = this.expr(); this.expect("}");
      return rat(a.n * b.d, a.d * b.n);
    }
    const m = /^(\d+)(?:[.,](\d+))?/.exec(this.s.slice(this.i));
    if (!m) throw new Error("atome");
    this.i += m[0].length;
    const frac = m[2] ?? "";
    return rat(BigInt(m[1] + frac), bpow(TEN, BigInt(frac.length)));
  }

  private expect(ch: string) {
    if (this.s[this.i] !== ch) throw new Error(`attendu ${ch}`);
    this.i++;
  }
}

/** Valeur entière exacte de l'expression, ou null (pas un calcul, pas un entier, trop grand…). */
export function exactIntegerValue(raw: string): bigint | null {
  try {
    const s = normalize(String(raw ?? ""));
    if (!s) return null;
    const v = new Parser(s).parseAll();
    return v.d === ONE ? v.n : null;
  } catch {
    return null;
  }
}

/** true seulement si les DEUX écritures sont des calculs d'entiers de valeurs différentes : réponse sûrement fausse. */
export function integerValuesDiffer(expected: string, student: string): boolean {
  const a = exactIntegerValue(expected);
  if (a === null) return false;
  const b = exactIntegerValue(student);
  return b !== null && a !== b;
}
