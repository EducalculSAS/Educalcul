/**
 * Exercices dont la solution se CALCULE en code (pyramides de briques, carrés
 * magiques) : un modèle de langage s'y trompe ou se contredit, un programme non.
 * Valeurs aléatoires, solution unique garantie, correction écrite par le code.
 */

type Rng = () => number;

const pick = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/** Nombre relatif à la française : (+3), (-4), 0. */
const signed = (v: number) => (v > 0 ? `(+${v})` : v < 0 ? `(${v})` : "0");
const plain = (v: number) => (v > 0 ? `+${v}` : String(v));

/** Réponses acceptées pour une case : « -6 », « (-6) », « −6 » ; « 3 », « +3 », « (+3) », « (3) ». Alternatives séparées par « | ». */
const blankAlternatives = (v: number): string => {
  if (v === 0) return "0";
  const minus = String.fromCharCode(8722);
  return v > 0 ? [`${v}`, `+${v}`, `(+${v})`, `(${v})`].join("|") : [`${v}`, `(${v})`, `${minus}${-v}`, `(${minus}${-v})`].join("|");
};

export interface GeneratedFigureExercise {
  title: string;
  content: string;
  figure: Record<string, unknown>;
  /** Figure à compléter à même ses cases (texte à trous sur une figure). */
  figureSpec: { kind: "brick_pyramid"; levels: string[][] } | { kind: "fill_grid"; cells: string[][] };
  /** Une réponse attendue par case vide, dans l'ordre de lecture. */
  blanks: string[];
  explanation: string;
  correctAnswer: string;
}

/* ------------------------------------------------------------------ */
/*  Pyramide de briques                                                */
/* ------------------------------------------------------------------ */

export type PyramidRule = "difference" | "sum";

/** Brique du dessus d'après les deux briques qui la soutiennent (gauche, droite). */
const parentOf = (rule: PyramidRule, left: number, right: number) => (rule === "sum" ? left + right : left - right);

/**
 * Cellules numérotées du sommet vers la base : level 0 = 1 brique, level k = k+1 briques.
 * Une brique du niveau k (index i) est soutenue par les briques i et i+1 du niveau k+1.
 */
function solvablePyramid(full: number[][], blank: boolean[][]): boolean {
  const n = full.length;
  const known = blank.map((row) => row.map((b) => !b));
  let changed = true;
  while (changed) {
    changed = false;
    for (let k = 0; k < n - 1; k++) {
      for (let i = 0; i <= k; i++) {
        const p = known[k][i];
        const l = known[k + 1][i];
        const r = known[k + 1][i + 1];
        const count = Number(p) + Number(l) + Number(r);
        if (count !== 2) continue;
        if (!p) known[k][i] = true;
        else if (!l) known[k + 1][i] = true;
        else known[k + 1][i + 1] = true;
        changed = true;
      }
    }
  }
  return known.every((row) => row.every(Boolean));
}

export function makePyramid(rule: PyramidRule, bottomCount: number, rng: Rng = Math.random): GeneratedFigureExercise {
  const n = Math.max(3, Math.min(6, bottomCount));
  // Base : relatifs jamais nuls, sans deux voisins égaux, d'autant plus petits que la pyramide est haute
  // (les valeurs s'amplifient en montant) ; on retire le tirage si un nombre dépasse 25.
  const range = n <= 3 ? 9 : n === 4 ? 6 : 4;
  let full: number[][] = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    const base: number[] = [];
    while (base.length < n) {
      const v = pick(rng, -range, range);
      if (v !== 0 && v !== base[base.length - 1]) base.push(v);
    }
    // full[k] : niveau k (sommet = 0), calculé de la base vers le sommet.
    full = new Array(n);
    full[n - 1] = base;
    for (let k = n - 2; k >= 0; k--) full[k] = full[k + 1].slice(0, k + 1).map((_, i) => parentOf(rule, full[k + 1][i], full[k + 1][i + 1]));
    if (full.every((row) => row.every((v) => Math.abs(v) <= 25))) break;
  }

  // Cases vides : ensemble tiré au hasard, accepté s'il se résout par déduction (sinon toute la base reste donnée).
  const totalBricks = (n * (n + 1)) / 2;
  let blank: boolean[][] | null = null;
  for (let attempt = 0; attempt < 300 && !blank; attempt++) {
    const wanted = pick(rng, Math.ceil(totalBricks * 0.35), Math.ceil(totalBricks * 0.5));
    const candidate = full.map((row) => row.map(() => false));
    let placed = 0;
    while (placed < wanted) {
      const k = pick(rng, 0, n - 1);
      const i = pick(rng, 0, k);
      if (!candidate[k][i]) {
        candidate[k][i] = true;
        placed++;
      }
    }
    if (solvablePyramid(full, candidate)) blank = candidate;
  }
  if (!blank) blank = full.map((row, k) => row.map(() => k < n - 1));

  const levels = full.map((row, k) => row.map((v, i) => (blank![k][i] ? "" : signed(v))));
  const missing: number[] = [];
  full.forEach((row, k) => row.forEach((v, i) => blank![k][i] && missing.push(v)));

  const ruleText =
    rule === "sum"
      ? "chaque brique est égale à la somme des deux briques qui la soutiennent"
      : "chaque brique est égale à la brique de gauche moins la brique de droite parmi les deux qui la soutiennent";
  const steps: string[] = [];
  for (let k = n - 2; k >= 0; k--) {
    for (let i = 0; i <= k; i++) {
      const l = full[k + 1][i];
      const r = full[k + 1][i + 1];
      steps.push(`${signed(l)} ${rule === "sum" ? "+" : "-"} ${signed(r)} = ${plain(full[k][i])}`);
    }
  }
  return {
    title: "La pyramide",
    content: `Complète la pyramide : ${ruleText}. Écris les nombres qui manquent directement dans les briques vides.`,
    figure: { type: "brick_pyramid", caption: "Pyramide à compléter", levels },
    figureSpec: { kind: "brick_pyramid", levels },
    blanks: missing.map(blankAlternatives),
    explanation: `On utilise la règle dans les deux sens, en partant des briques connues. Toutes les briques de la pyramide, du bas vers le haut : ${steps.join(" ; ")}. Les briques vides, de haut en bas puis de gauche à droite : ${missing.map(plain).join(" ; ")}.`,
    correctAnswer: missing.map(plain).join(" ; "),
  };
}

/* ------------------------------------------------------------------ */
/*  Carré magique 3 × 3                                                */
/* ------------------------------------------------------------------ */

/** Le carré a une solution unique si le système (lignes, colonnes, diagonales de même somme) n'a aucun degré de liberté. */
function uniqueMagic(given: boolean[]): boolean {
  // Inconnues : 9 cases (index 0-8) + somme S (index 9). Équations : chaque ligne/colonne/diagonale - S = 0, et cases données = valeur (ici seule l'indépendance compte).
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  const rows: number[][] = lines.map((line) => {
    const row = new Array(11).fill(0);
    line.forEach((c) => (row[c] = 1));
    row[9] = -1;
    return row;
  });
  given.forEach((isGiven, cell) => {
    if (!isGiven) return;
    const row = new Array(11).fill(0);
    row[cell] = 1;
    rows.push(row);
  });
  // Rang de la partie coefficients (colonnes 0-9) : unique ssi rang = 10.
  const m = rows.map((r) => r.slice(0, 10));
  let rank = 0;
  for (let col = 0; col < 10 && rank < m.length; col++) {
    let piv = -1;
    for (let r = rank; r < m.length; r++) if (Math.abs(m[r][col]) > 1e-9) { piv = r; break; }
    if (piv < 0) continue;
    [m[rank], m[piv]] = [m[piv], m[rank]];
    for (let r = 0; r < m.length; r++) {
      if (r === rank) continue;
      const f = m[r][col] / m[rank][col];
      if (f) for (let c = col; c < 10; c++) m[r][c] -= f * m[rank][c];
    }
    rank++;
  }
  return rank === 10;
}

let uniqueSetsCache: boolean[][] | null = null;
function uniqueGivenSets(): boolean[][] {
  if (uniqueSetsCache) return uniqueSetsCache;
  const sets: boolean[][] = [];
  for (let mask = 0; mask < 512; mask++) {
    const bits = mask.toString(2).replace(/0/g, "").length;
    if (bits < 3 || bits > 4) continue;
    const given = Array.from({ length: 9 }, (_, i) => Boolean(mask & (1 << i)));
    if (uniqueMagic(given)) sets.push(given);
  }
  uniqueSetsCache = sets;
  return sets;
}

export function makeMagicSquare(rng: Rng = Math.random): GeneratedFigureExercise {
  let c = 0;
  let cells: number[] = [];
  // Neuf nombres tous différents (plus lisible) : on retire le tirage sinon.
  for (let attempt = 0; attempt < 200; attempt++) {
    c = pick(rng, -3, 4);
    let a = pick(rng, 1, 4);
    let b = pick(rng, 1, 4);
    if (rng() < 0.5) a = -a;
    if (rng() < 0.5) b = -b;
    cells = [
      c + a, c - a - b, c + b,
      c - a + b, c, c + a - b,
      c - b, c + a + b, c - a,
    ];
    if (new Set(cells).size === 9) break;
  }
  // Cases données : un ensemble de 3 ou 4 cases (parmi tous ceux qui déterminent le carré), tiré au hasard.
  const all = uniqueGivenSets();
  // Quatre cases données si possible (un carré à trois cases est nettement plus dur).
  const four = all.filter((set) => set.filter(Boolean).length === 4);
  const options = four.length > 0 ? four : all;
  const given = options[Math.floor(rng() * options.length)];
  const grid = [0, 1, 2].map((r) => [0, 1, 2].map((col) => (given![r * 3 + col] ? String(cells[r * 3 + col]) : "")));
  const missing = cells.filter((_, i) => !given![i]);
  const sum = 3 * c;
  return {
    title: "Le carré magique",
    content: "Complète ce carré magique : la somme des nombres de chaque ligne, de chaque colonne et de chaque diagonale est la même. Écris les nombres qui manquent directement dans les cases vides.",
    figure: { type: "fill_grid", caption: "Carré magique à compléter", cells: grid },
    figureSpec: { kind: "fill_grid", cells: grid },
    blanks: missing.map(blankAlternatives),
    explanation: `La somme magique vaut ${sum} : c'est trois fois le nombre du centre (${c}). On complète chaque ligne, colonne ou diagonale pour que la somme fasse ${sum}. Le carré complet est : ${[0, 1, 2].map((r) => cells.slice(r * 3, r * 3 + 3).join(" ")).join(" / ")}. Les cases vides, ligne par ligne : ${missing.join(" ; ")}.`,
    correctAnswer: missing.join(" ; "),
  };
}

/* ------------------------------------------------------------------ */
/*  Résolution des figures LUES sur une photo (copie fidèle)           */
/* ------------------------------------------------------------------ */

/** « (+2) », « (-4) », « -3 », « 5 » donnent 2, -4, -3, 5 ; « » ou illisible donne null. */
export function parseCellNumber(text: string): number | null {
  const s = text.replace(/\s+/g, "").replace(/[−–]/g, "-").replace(/^\((.*)\)$/, "$1").replace(",", ".");
  return /^[+-]?\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
}

/**
 * Pyramide lue sur l'image (sommet en premier, "" = brique vide) : renvoie les valeurs des briques vides, dans l'ordre de
 * lecture, ou null si la pyramide ne se résout pas (nombres mal lus, règle introuvable). La règle (somme ou différence
 * « gauche moins droite ») est celle de la consigne ; à défaut, celle qui colle aux briques connues.
 */
export function solvePyramid(levels: string[][], hint: string): { rule: PyramidRule; missing: number[] } | null {
  const n = levels.length;
  const known: (number | null)[][] = levels.map((row) => row.map(parseCellNumber));
  const rules: PyramidRule[] = /diff[eé]rence/i.test(hint) ? ["difference", "sum"] : /somme/i.test(hint) ? ["sum", "difference"] : ["sum", "difference"];
  for (const rule of rules) {
    const values = known.map((row) => row.slice());
    let changed = true;
    let consistent = true;
    while (changed && consistent) {
      changed = false;
      for (let k = 0; k < n - 1 && consistent; k++) {
        for (let i = 0; i <= k; i++) {
          const p = values[k][i];
          const l = values[k + 1][i];
          const r = values[k + 1][i + 1];
          const count = [p, l, r].filter((v) => v !== null).length;
          if (count === 3) {
            if (parentOf(rule, l as number, r as number) !== p) consistent = false;
          } else if (count === 2) {
            if (p === null) values[k][i] = parentOf(rule, l as number, r as number);
            else if (l === null) values[k + 1][i] = rule === "sum" ? (p as number) - (r as number) : (p as number) + (r as number);
            else values[k + 1][i + 1] = rule === "sum" ? (p as number) - (l as number) : (l as number) - (p as number);
            changed = true;
          }
        }
      }
    }
    if (!consistent || values.some((row) => row.some((v) => v === null))) continue;
    const missing: number[] = [];
    known.forEach((row, k) => row.forEach((v, i) => v === null && missing.push(values[k][i] as number)));
    return { rule, missing };
  }
  return null;
}

/**
 * Carré magique lu sur l'image ("" = case vide) : toutes les lignes, colonnes et diagonales ont la même somme. Renvoie
 * les valeurs des cases vides, ligne par ligne, ou null si la solution n'est pas unique ou ne colle pas aux cases lues.
 */
export function solveMagic(cells: string[][]): number[] | null {
  if (cells.length !== 3 || cells.some((r) => r.length !== 3)) return null;
  const given = cells.flat().map(parseCellNumber);
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  // Inconnues : 9 cases + S ; équations : somme de chaque ligne - S = 0, et chaque case lue = sa valeur.
  const rows: number[][] = lines.map((line) => {
    const row = new Array(11).fill(0);
    line.forEach((c) => (row[c] = 1));
    row[9] = -1;
    return row;
  });
  given.forEach((v, cell) => {
    if (v === null) return;
    const row = new Array(11).fill(0);
    row[cell] = 1;
    row[10] = v;
    rows.push(row);
  });
  const m = rows.map((r) => r.slice());
  const pivotCols: number[] = [];
  let rank = 0;
  for (let col = 0; col < 10 && rank < m.length; col++) {
    let piv = -1;
    for (let r = rank; r < m.length; r++) if (Math.abs(m[r][col]) > 1e-9) { piv = r; break; }
    if (piv < 0) continue;
    [m[rank], m[piv]] = [m[piv], m[rank]];
    const lead = m[rank][col];
    for (let c = col; c < 11; c++) m[rank][c] /= lead;
    for (let r = 0; r < m.length; r++) {
      if (r === rank) continue;
      const f = m[r][col];
      if (Math.abs(f) > 1e-12) for (let c = col; c < 11; c++) m[r][c] -= f * m[rank][c];
    }
    pivotCols.push(col);
    rank++;
  }
  // Incohérent (une ligne 0 = non nul) ou non unique (moins de 10 pivots) : on ne devine pas.
  for (let r = rank; r < m.length; r++) if (Math.abs(m[r][10]) > 1e-6) return null;
  if (rank < 10) return null;
  const solution = new Array(10).fill(0);
  pivotCols.forEach((col, r) => (solution[col] = m[r][10]));
  const out: number[] = [];
  for (let cell = 0; cell < 9; cell++) {
    if (given[cell] !== null) continue;
    const v = Math.round(solution[cell] * 1000) / 1000;
    out.push(v);
  }
  return out;
}

export { blankAlternatives };
