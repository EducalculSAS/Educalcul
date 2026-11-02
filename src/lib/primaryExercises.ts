/**
 * Exercices de primaire générés en code : les listes de calculs (« 12 + 8 = »), les doubles, et les nombres
 * à écrire en lettres ou en chiffres. Un modèle de langage s'y trompe (« $7 + {{1}}$ ») ; un programme non.
 */

type Rng = () => number;
const randInt = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/* ------------------------------------------------------------------ */
/*  Nombres en toutes lettres (0 à 999)                                */
/* ------------------------------------------------------------------ */

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

function below100(n: number): string {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? TENS[t] : u === 1 ? `${TENS[t]} et un` : `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) return n === 71 ? "soixante et onze" : `soixante-${below100(n - 60)}`;
  return n === 80 ? "quatre-vingts" : `quatre-vingt-${below100(n - 80)}`;
}

/** « 25 » donne « vingt-cinq », « 71 » donne « soixante et onze », « 300 » donne « trois cents ». */
export function toFrenchWords(n: number): string {
  if (n < 100) return below100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 1) return r === 0 ? "cent" : `cent ${below100(r)}`;
  return r === 0 ? `${UNITS[h]} cents` : `${UNITS[h]} cent ${below100(r)}`;
}

/** Écritures acceptées : traditionnelle (« vingt et un ») et rectifiée (« vingt-et-un »), avec tirets ou espaces. */
export function frenchWordAlternatives(n: number): string[] {
  const base = toFrenchWords(n);
  const set = new Set<string>([
    base,
    base.replace(/ et /g, "-et-"),
    base.replace(/-/g, " "),
    base.replace(/ /g, "-"),
    base.replace(/ /g, "-").replace(/-/g, " "),
  ]);
  return [...set];
}

const normalizeWords = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[▢_.…→]/g, " ").replace(/[-\s]+/g, " ").trim();

let wordsIndex: Map<string, number> | null = null;

/** « quatre-vingt-sept » donne 87 ; renvoie null si ce n'est pas un nombre écrit en lettres (0 à 999). */
export function fromFrenchWords(text: string): number | null {
  if (!wordsIndex) {
    wordsIndex = new Map();
    for (let n = 0; n < 1000; n++) {
      for (const form of frenchWordAlternatives(n)) wordsIndex.set(normalizeWords(form), n);
      // « quatre-vingt » sans « s » final, « cent » pluriel oublié : tolérés à la lecture de la source.
      wordsIndex.set(normalizeWords(toFrenchWords(n)).replace(/s$/, ""), n);
    }
  }
  return wordsIndex.get(normalizeWords(text)) ?? null;
}

/** Nombre à écrire en lettres : « 25 », « 25 → », « 25 = ____ ». */
export function parseDigitsItem(text: string): number | null {
  const m = /^\s*\$?\s*(\d{1,3})\s*\$?\s*(?:→|->|=|:)?\s*[_.…▢\s]*$/.exec(text);
  return m ? Number(m[1]) : null;
}

/* ------------------------------------------------------------------ */
/*  Listes de calculs                                                  */
/* ------------------------------------------------------------------ */

type ArithOp = "+" | "-" | "×" | "÷";
export interface ArithItem {
  a: number;
  op: ArithOp;
  b: number;
}

/** « 12 + 8 », « $24 \times 6$ », « 15 - 7 = » : un calcul simple entre deux entiers de 3 chiffres au plus. */
export function parseArithmeticItem(text: string): ArithItem | null {
  const m = /^\s*\$?\s*(\d{1,3})\s*([+\-−×x*÷:/]|\\times|\\div)\s*(\d{1,3})\s*(?:=\s*[_.…▢\s]*)?\$?\s*$/i.exec(text);
  if (!m) return null;
  const raw = m[2].toLowerCase();
  const op: ArithOp = raw === "+" ? "+" : raw === "-" || raw === "−" ? "-" : raw === "÷" || raw === ":" || raw === "/" || raw === "\\div" ? "÷" : "×";
  return { a: Number(m[1]), op, b: Number(m[3]) };
}

export const arithmeticResult = ({ a, op, b }: ArithItem): number =>
  op === "+" ? a + b : op === "-" ? a - b : op === "×" ? a * b : a / b;

/** Nouveaux calculs de même famille que ceux de la source (mêmes opérations, ordres de grandeur voisins), tous différents. */
export function makeArithmeticVariants(sources: ArithItem[], count: number, rng: Rng = Math.random): ArithItem[] {
  const out: ArithItem[] = [];
  const seen = new Set(sources.map((s) => `${s.a}${s.op}${s.b}`));
  for (let k = 0; k < count; k++) {
    const src = sources[k % sources.length];
    let made: ArithItem | null = null;
    for (let attempt = 0; attempt < 40 && !made; attempt++) {
      let a = src.a;
      let b = src.b;
      if (src.op === "+") {
        if (src.a === src.b) {
          a = randInt(rng, 1, Math.max(10, src.a + 6));
          b = a; // un double
        } else {
          a = randInt(rng, Math.max(1, src.a - 5), src.a + 9);
          b = randInt(rng, Math.max(1, src.b - 5), src.b + 9);
          if (a + b > Math.max(20, (src.a + src.b) * 1.5 + 3)) continue;
        }
      } else if (src.op === "-") {
        a = randInt(rng, Math.max(2, src.a - 6), src.a + 9);
        b = randInt(rng, 1, Math.min(a, src.b + 6));
      } else if (src.op === "×") {
        a = randInt(rng, 2, Math.min(12, Math.max(src.a, src.b) + 2));
        b = randInt(rng, 2, Math.min(12, Math.min(src.a, src.b) + 3));
      } else {
        b = randInt(rng, 2, 9);
        a = b * randInt(rng, 2, 9);
      }
      const key = `${a}${src.op}${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      made = { a, op: src.op, b };
    }
    if (made) out.push(made);
  }
  return out;
}

export function arithmeticStatement({ a, op, b }: ArithItem): string {
  return `$${a} ${op === "×" ? "\\times" : op === "÷" ? "\\div" : op} ${b} =$`;
}

export function arithmeticExplanation(item: ArithItem): string {
  const r = arithmeticResult(item);
  if (item.op === "+" && item.a === item.b) return `Le double de ${item.a} est ${item.a} + ${item.a} = ${r}.`;
  return `On calcule ${item.a} ${item.op} ${item.b} = ${r}.`;
}

/** Nombres à écrire (en lettres ou en chiffres) de même ordre de grandeur que ceux de la source, tous différents. */
export function makeNumbers(sources: number[], count: number, rng: Rng = Math.random): number[] {
  const max = Math.min(999, Math.max(20, Math.max(...sources, 0) + 15));
  const min = Math.max(1, Math.min(10, Math.min(...sources, 10)));
  const seen = new Set(sources);
  const out: number[] = [];
  for (let attempt = 0; out.length < count && attempt < 300; attempt++) {
    const n = randInt(rng, min, max);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** Texte fait UNIQUEMENT de nombres écrits en lettres (« soixante-douze onze quarante et un ») : les renvoie un par un, sinon null. */
export function extractWordNumbers(text: string): string[] | null {
  fromFrenchWords("zéro"); // construit l'index
  const tokens = normalizeWords(text).split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  const found: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = 0;
    for (let len = Math.min(6, tokens.length - i); len >= 1 && !matched; len--) {
      if (wordsIndex!.has(tokens.slice(i, i + len).join(" "))) matched = len;
    }
    if (!matched) return null;
    found.push(tokens.slice(i, i + matched).join(" "));
    i += matched;
  }
  return found;
}

/** « Complète la file numérique » : une suite régulière (pas 1, 2, 5 ou 10) dont certains nombres manquent. */
export function makeNumberSequence(sources: number[], rng: Rng = Math.random): { statement: string; blanks: string[] } {
  const maxSource = Math.max(20, ...sources);
  const steps = [1, 1, 2, 5, 10];
  const step = steps[randInt(rng, 0, steps.length - 1)];
  const length = 9;
  const start = randInt(rng, 1, Math.max(10, Math.min(maxSource, 120) - length * step));
  const numbers = Array.from({ length: length }, (_, i) => start + i * step);
  const blankCount = randInt(rng, 4, 5);
  const blankIdx = new Set<number>();
  while (blankIdx.size < blankCount) blankIdx.add(randInt(rng, 1, length - 1));
  let k = 0;
  const parts = numbers.map((n, i) => (blankIdx.has(i) ? `{{${++k}}}` : String(n)));
  return {
    statement: `Complète la file numérique : ${parts.join(" ; ")}`,
    blanks: numbers.filter((_, i) => blankIdx.has(i)).map(String),
  };
}
