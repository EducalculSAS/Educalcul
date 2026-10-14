import type { MathKeyboardKey, MathKeyboardTab } from "@/components/CustomMathKeyboard";

// Dispositions d'origine du clavier mathématique, utilisées par l'admin pour « rétablir » un pavé ou un clavier entier.
// Les chiffres sont des touches LaTeX (« latex » = ce qui s'affiche sur la touche) : insérées à l'endroit du curseur, elles
// se tapent dans une fraction, des parenthèses ou une racine (en « texte », elles s'ajoutaient toujours à la fin du champ).

const digit = (d: string): MathKeyboardKey => ({ label: d, latex: d });
const OPS = {
  div: { label: "÷", latex: "\\div" },
  times: { label: "×", latex: "\\times" },
  minus: { label: "-", latex: "-" },
  plus: { label: "+", latex: "+" },
  equal: { label: "=", latex: "=" },
  comma: { label: ",", latex: "," },
} satisfies Record<string, MathKeyboardKey>;

/** Disposition « calculatrice » (celle d'origine) : 7-8-9 en haut. */
export const NUM_ROWS_CALCULATOR: MathKeyboardKey[][] = [
  [digit("7"), digit("8"), digit("9"), OPS.div],
  [digit("4"), digit("5"), digit("6"), OPS.times],
  [digit("1"), digit("2"), digit("3"), OPS.minus],
  [digit("0"), OPS.comma, OPS.equal, OPS.plus],
];

/** Disposition « téléphone » : 1-2-3 en haut. */
export const NUM_ROWS_PHONE: MathKeyboardKey[][] = [
  [digit("1"), digit("2"), digit("3"), OPS.plus],
  [digit("4"), digit("5"), digit("6"), OPS.minus],
  [digit("7"), digit("8"), digit("9"), OPS.times],
  [OPS.comma, digit("0"), OPS.equal, OPS.div],
];

const ABC_TAB: MathKeyboardTab = { id: "abc", label: "ABC", rows: [], special: "abc" };

const PRIMAIRE_TABS: MathKeyboardTab[] = [
  ABC_TAB,
  { id: "num", label: "123", rows: NUM_ROWS_CALCULATOR },
  {
    id: "unites",
    label: "Unités",
    rows: [
      [{ label: "cm", latex: "\\text{ cm}" }, { label: "m", latex: "\\text{ m}" }, { label: "km", latex: "\\text{ km}" }],
      [{ label: "g", latex: "\\text{ g}" }, { label: "kg", latex: "\\text{ kg}" }, { label: "L", latex: "\\text{ L}" }],
      [{ label: "€", latex: "\\text{ €}" }, { label: "h", latex: "\\text{ h}" }, { label: "min", latex: "\\text{ min}" }],
    ],
  },
];

const COLLEGE_TABS: MathKeyboardTab[] = [
  ABC_TAB,
  { id: "num", label: "123", rows: NUM_ROWS_CALCULATOR },
  {
    id: "alg",
    label: "x",
    rows: [
      [{ label: "x", latex: "x" }, { label: "y", latex: "y" }, { label: "x²", latex: "x^2" }, { label: "√", latex: "\\sqrt{\\placeholder{}}" }],
      [{ label: "( )", latex: "(\\placeholder{})" }, { label: "a/b", latex: "\\frac{\\placeholder{}}{\\placeholder{}}" }, { label: "π", latex: "\\pi" }, { label: "°", latex: "\\degree" }],
      [{ label: "<", latex: "<" }, { label: ">", latex: ">" }, { label: "≤", latex: "\\leq" }, { label: "≥", latex: "\\geq" }],
    ],
  },
  {
    id: "geo",
    label: "Géo",
    rows: [
      [{ label: "△", latex: "\\triangle " }, { label: "∥", latex: "\\parallel " }, { label: "⊥", latex: "\\perp " }],
      [{ label: "∈", latex: "\\in " }, { label: "∉", latex: "\\notin " }, { label: "⊂", latex: "\\subset " }],
    ],
  },
];

const LYCEE_TABS: MathKeyboardTab[] = [
  ABC_TAB,
  { id: "num", label: "123", rows: NUM_ROWS_CALCULATOR },
  {
    id: "alg",
    label: "x",
    rows: [
      [{ label: "x", latex: "x" }, { label: "x²", latex: "x^2" }, { label: "xⁿ", latex: "x^{\\placeholder{}}" }, { label: "√", latex: "\\sqrt{\\placeholder{}}" }],
      [{ label: "a/b", latex: "\\frac{\\placeholder{}}{\\placeholder{}}" }, { label: "( )", latex: "(\\placeholder{})" }, { label: "|x|", latex: "\\left|\\placeholder{}\\right|" }, { label: "Matrice", cmd: "insertMatrix" }],
      [{ label: "≤", latex: "\\leq" }, { label: "≥", latex: "\\geq" }, { label: "≠", latex: "\\neq" }, { label: "≈", latex: "\\approx" }],
    ],
  },
  {
    id: "fct",
    label: "f(x)",
    rows: [
      [{ label: "f(x)", latex: "f(\\placeholder{})" }, { label: "f'(x)", latex: "f'(\\placeholder{})" }, { label: "lim", latex: "\\lim_{\\placeholder{} \\to \\placeholder{}}" }],
      [{ label: "∫", latex: "\\int_{\\placeholder{}}^{\\placeholder{}}" }, { label: "Σ", latex: "\\sum_{\\placeholder{}}^{\\placeholder{}}" }, { label: "e^x", latex: "e^{\\placeholder{}}" }, { label: "ln", latex: "\\ln(\\placeholder{})" }],
      [{ label: "sin", latex: "\\sin(\\placeholder{})" }, { label: "cos", latex: "\\cos(\\placeholder{})" }, { label: "tan", latex: "\\tan(\\placeholder{})" }],
    ],
  },
  {
    id: "ens",
    label: "ℝ ∃",
    rows: [
      [{ label: "ℝ", latex: "\\mathbb{R}" }, { label: "ℕ", latex: "\\mathbb{N}" }, { label: "ℤ", latex: "\\mathbb{Z}" }, { label: "∅", latex: "\\emptyset" }],
      [{ label: "∈", latex: "\\in " }, { label: "∀", latex: "\\forall " }, { label: "∃", latex: "\\exists " }, { label: "⇒", latex: "\\Rightarrow " }],
      [{ label: "α", latex: "\\alpha" }, { label: "β", latex: "\\beta" }, { label: "θ", latex: "\\theta" }, { label: "π", latex: "\\pi" }],
    ],
  },
];

const PRIMAIRE = new Set(["cp", "ce1", "ce2", "cm1", "cm2"]);
const COLLEGE = new Set(["6eme", "5eme", "4eme", "3eme"]);

/** Onglets d'origine d'un niveau (copie profonde : on peut les modifier sans toucher aux modèles). */
export function defaultTabsForLevel(level: string): MathKeyboardTab[] {
  const tabs = PRIMAIRE.has(level) ? PRIMAIRE_TABS : COLLEGE.has(level) ? COLLEGE_TABS : LYCEE_TABS;
  return JSON.parse(JSON.stringify(tabs));
}

/** Clavier numérique complet d'une disposition (copie profonde). */
export function numRows(layout: "calculator" | "phone"): MathKeyboardKey[][] {
  return JSON.parse(JSON.stringify(layout === "phone" ? NUM_ROWS_PHONE : NUM_ROWS_CALCULATOR));
}
