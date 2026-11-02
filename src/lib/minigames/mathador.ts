/** Mathador — jeu procédural, pas d'IA : on tire 5 nombres et une cible, on
 * les combine deux à la mois avec +, -, x, / jusqu'à atteindre la cible.
 *
 * Règles de score (données par l'équipe pédagogique) :
 *   + et x : 1 point · - : 2 points · / : 3 points
 *   Utiliser les 4 opérations dans une même solution ("coup mathador") : 13 points au total
 * Un résultat intermédiaire doit toujours être un entier positif (division
 * exacte uniquement, jamais de soustraction négative) — comme au jeu réel.
 */

type Operation = "+" | "-" | "x" | "/";

export interface MathadorStep {
  a: number;
  b: number;
  op: Operation;
  result: number;
}

interface MathadorSolution {
  steps: MathadorStep[];
  score: number;
  usedAllFourOperations: boolean;
}

const OPS: Operation[] = ["+", "-", "x", "/"];
const OP_POINTS: Record<Operation, number> = { "+": 1, "x": 1, "-": 2, "/": 3 };
const MATHADOR_BONUS = 13;

function applyOp(a: number, b: number, op: Operation): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "-": {
      const diff = a - b;
      return diff > 0 ? diff : null; // jamais 0 ni négatif — pas d'étape "inutile"
    }
    case "x":
      return a * b;
    case "/": {
      if (b === 0 || a % b !== 0) return null; // division exacte uniquement
      const q = a / b;
      return q > 0 ? q : null;
    }
  }
}

function scoreSteps(steps: MathadorStep[]): number {
  const opsUsed = new Set(steps.map((s) => s.op));
  const base = steps.reduce((sum, s) => sum + OP_POINTS[s.op], 0);
  return opsUsed.size === 4 ? MATHADOR_BONUS : base;
}

/** Explore toutes les façons de combiner le multiset `pool` (avec l'historique
 * `steps`) pour atteindre `target`. Garde la meilleure solution (score max)
 * trouvée — pas seulement la première — pour connaître le score maximal
 * atteignable sur ce tirage. `pool` peut descendre à 2 éléments minimum
 * pour arrêter une branche (inutile de forcer l'usage des 5 nombres, comme
 * dans le jeu réel où on peut s'arrêter dès que la cible est atteinte).
 */
function solveMathador(numbers: number[], target: number): MathadorSolution | null {
  let best: MathadorSolution | null = null;

  function consider(steps: MathadorStep[]) {
    if (steps.length === 0) return;
    const score = scoreSteps(steps);
    if (!best || score > best.score) {
      best = { steps: [...steps], score, usedAllFourOperations: new Set(steps.map((s) => s.op)).size === 4 };
    }
  }

  function search(pool: number[], steps: MathadorStep[]) {
    if (pool.includes(target) && steps.length > 0) consider(steps);
    if (pool.length < 2 || steps.length >= 4) return;

    for (let i = 0; i < pool.length; i++) {
      for (let j = 0; j < pool.length; j++) {
        if (i === j) continue;
        const a = pool[i];
        const b = pool[j];
        const rest = pool.filter((_, idx) => idx !== i && idx !== j);
        for (const op of OPS) {
          // a - b et a + b : ordre indifférent pour +, mais on essaie les deux
          // sens pour - et / (7-2 != 2-7) — la double boucle i/j couvre déjà ça.
          const result = applyOp(a, b, op);
          if (result === null) continue;
          const step: MathadorStep = { a, b, op, result };
          search([...rest, result], [...steps, step]);
        }
      }
    }
  }

  search(numbers, []);
  return best;
}

export interface MathadorPuzzle {
  numbers: number[];
  target: number;
  maxScore: number;
}

const SMALL_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Signature stable d'un tirage (ordre des nombres indifférent) — sert à
 * détecter qu'un nouveau tirage reproduit un tirage déjà joué récemment. */
export function mathadorPuzzleSignature(numbers: number[], target: number): string {
  return `${[...numbers].sort((a, b) => a - b).join(",")}|${target}`;
}

/** Tire 5 nombres + une cible et vérifie par le solveur exhaustif qu'au
 * moins une solution existe avant de renvoyer le tirage — jamais de partie
 * injouable. Retire jusqu'à `maxAttempts` fois si besoin. Biaise vers un
 * tirage permettant un "coup mathador" (les 4 opérations) quand possible,
 * pour se rapprocher des tirages donnés en exemple, sans le garantir à
 * chaque fois (sinon trop peu de tirages possibles).
 *
 * `avoidSignatures` (tirages joués récemment par le même enfant, voir
 * mathadorPuzzleSignature) est évité tant qu'une alternative solvable existe
 * — jamais au prix de renvoyer un tirage injouable ou d'épuiser tous les
 * essais sans résultat.
 */
export function generateMathadorPuzzle(maxAttempts = 200, avoidSignatures: Set<string> = new Set()): MathadorPuzzle {
  let fallback: MathadorPuzzle | null = null;
  let repeatFallback: MathadorPuzzle | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const numbers = Array.from({ length: 5 }, () => randomFrom(SMALL_NUMBERS));
    const target = 15 + Math.floor(Math.random() * 85); // 15..99, comme les tirages fournis

    const solution = solveMathador(numbers, target);
    if (!solution) continue;

    const puzzle: MathadorPuzzle = { numbers, target, maxScore: solution.score };
    const isRepeat = avoidSignatures.has(mathadorPuzzleSignature(numbers, target));

    if (isRepeat) {
      if (!repeatFallback) repeatFallback = puzzle; // filet si on ne trouve QUE des répétitions
      continue;
    }

    if (solution.usedAllFourOperations) return puzzle; // le meilleur cas, on s'arrête là
    if (!fallback) fallback = puzzle;
  }

  if (fallback) return fallback;
  if (repeatFallback) return repeatFallback;

  // Filet de sécurité théorique (ne devrait jamais arriver avec 200 essais) :
  // un tirage trivialement solvable par simple addition.
  const numbers = [1, 2, 3, 4, 5];
  const target = numbers.reduce((a, b) => a + b, 0);
  return { numbers, target, maxScore: solveMathador(numbers, target)!.score };
}

/** Rejoue et valide une séquence d'étapes proposée par le joueur contre le
 * tirage réel — ne fait JAMAIS confiance à un score envoyé par le client.
 * Renvoie le score réel (0 si la séquence est invalide ou n'atteint pas la
 * cible) et le détail pour affichage. */
export function verifyMathadorSolution(
  numbers: number[],
  target: number,
  steps: MathadorStep[],
): { valid: boolean; score: number; reason?: string } {
  if (!Array.isArray(steps) || steps.length === 0 || steps.length > 4) {
    return { valid: false, score: 0, reason: "Séquence vide ou trop longue." };
  }

  let pool = [...numbers];
  for (const step of steps) {
    if (!OPS.includes(step.op)) return { valid: false, score: 0, reason: "Opération inconnue." };
    const aIdx = pool.indexOf(step.a);
    if (aIdx === -1) return { valid: false, score: 0, reason: "Nombre non disponible dans le tirage." };
    const poolAfterA = [...pool.slice(0, aIdx), ...pool.slice(aIdx + 1)];
    const bIdx = poolAfterA.indexOf(step.b);
    if (bIdx === -1) return { valid: false, score: 0, reason: "Nombre non disponible dans le tirage." };
    const rest = [...poolAfterA.slice(0, bIdx), ...poolAfterA.slice(bIdx + 1)];

    const expected = applyOp(step.a, step.b, step.op);
    if (expected === null || expected !== step.result) {
      return { valid: false, score: 0, reason: "Calcul incorrect." };
    }
    pool = [...rest, step.result];
  }

  if (!pool.includes(target)) {
    return { valid: false, score: 0, reason: "La cible n'est pas atteinte." };
  }

  return { valid: true, score: scoreSteps(steps) };
}
