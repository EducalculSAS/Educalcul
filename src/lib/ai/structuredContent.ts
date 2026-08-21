import katex from "katex";
import { mathRepairSchema, type JsonSchemaContract } from "@/lib/ai/schemas";

/**
 * Format intermédiaire commun aux cours, exercices et quiz.
 *
 * Règle centrale : le modèle ne produit jamais de HTML et ne choisit jamais
 * les délimiteurs $ / $$. Le texte et les mathématiques sont séparés dès la
 * génération. Le serveur valide ensuite chaque champ `latex` avec KaTeX avant
 * de compiler vers les anciens champs HTML/texte utilisés par l'application.
 */

export type StructuredTextPart = {
  type: "text";
  value: string;
};

export type StructuredMathPart = {
  type: "math";
  latex: string;
};

export type StructuredRichTextPart = StructuredTextPart | StructuredMathPart;

export type StructuredRichText = {
  parts: StructuredRichTextPart[];
};

export type StructuredSignValue =
  | "negative"
  | "zero"
  | "positive"
  | "undefined";

export type StructuredVariationDirection = "up" | "down" | "constant";

export type StructuredFigureTone =
  | "navy"
  | "gold"
  | "blue"
  | "green"
  | "red"
  | "gray";

export type StructuredFigurePoint = { x: number; y: number };

export type StructuredFigureElement =
  | {
      type: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      tone: StructuredFigureTone;
      dashed: boolean;
      arrowEnd: boolean;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    }
  | {
      type: "point";
      x: number;
      y: number;
      tone: StructuredFigureTone;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    }
  | {
      type: "circle";
      cx: number;
      cy: number;
      r: number;
      tone: StructuredFigureTone;
      filled: boolean;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    }
  | {
      type: "polygon";
      points: StructuredFigurePoint[];
      tone: StructuredFigureTone;
      filled: boolean;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    }
  | {
      type: "arc";
      cx: number;
      cy: number;
      r: number;
      startAngle: number;
      endAngle: number;
      tone: StructuredFigureTone;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    };

export type StructuredGraphVector = {
  x: number;
  y: number;
  fromX?: number;
  fromY?: number;
  label?: string;
  tone: StructuredFigureTone;
};

// Diagrammes déterministes : contrairement à "figure" (coordonnées brutes
// choisies par le modèle, ce qui provoque chevauchements et débordements dès
// que plusieurs labels mathématiques sont nécessaires — un <text> SVG ne
// peut pas afficher de KaTeX), ces blocs ne demandent au modèle que des
// données sémantiques (angles, valeurs, labels). La disposition géométrique
// est calculée côté serveur dans compiler.ts, et les labels passent par
// foreignObject + $...$ pour un rendu KaTeX correct.

export type StructuredTrigCircleAngle = {
  angleDeg: number;
  label: string;
};

export type StructuredPieSlice = {
  label: string;
  value: number;
  tone: StructuredFigureTone;
};

export type StructuredNumberLinePoint = {
  value: number;
  label: string;
  filled: boolean;
};

export type StructuredNumberLineInterval = {
  from: number;
  to: number;
  fromIncluded: boolean;
  toIncluded: boolean;
  tone: StructuredFigureTone;
};

export type StructuredBar = {
  label: string;
  value: number;
  tone: StructuredFigureTone;
};

export type StructuredProbabilityLeaf = {
  label: string;
  probability: string;
};

export type StructuredProbabilityBranch = StructuredProbabilityLeaf & {
  children: StructuredProbabilityLeaf[];
};

export type StructuredVennSet = {
  label: string;
  tone: StructuredFigureTone;
};

export type StructuredCourseBlock =
  | {
      type: "heading";
      level: 3 | 4;
      content: StructuredRichText;
    }
  | {
      type: "paragraph";
      content: StructuredRichText;
    }
  | {
      type: "display_math";
      latex: string;
      fallbackText?: string;
    }
  | {
      type: "list";
      ordered: boolean;
      items: StructuredRichText[];
    }
  | {
      type: "callout";
      variant: "note" | "warning";
      title?: StructuredRichText;
      paragraphs: StructuredRichText[];
    }
  | {
      type: "table";
      variant: "value";
      headers: StructuredRichText[];
      rows: StructuredRichText[][];
    }
  | {
      type: "column_operation";
      operator: "+" | "-" | "×" | "÷";
      operands: string[];
      result: string;
      carries: string[];
    }
  | {
      type: "sign_table";
      expression: StructuredRichText;
      boundaries: StructuredRichText[];
      intervalSigns: StructuredSignValue[];
      boundarySigns: StructuredSignValue[];
    }
  | {
      type: "variation_table";
      variable: StructuredRichText;
      functionName: StructuredRichText;
      points: StructuredRichText[];
      values: StructuredRichText[];
      directions: StructuredVariationDirection[];
      derivativeSigns: StructuredSignValue[];
    }
  | {
      type: "graph";
      expression: string;
      xmin: number;
      xmax: number;
      caption: string;
      parameter?: {
        name: string;
        min: number;
        max: number;
        default: number;
      };
      vectors: StructuredGraphVector[];
    }
  | {
      type: "figure";
      caption: string;
      elements: StructuredFigureElement[];
    }
  | {
      type: "trig_circle";
      caption: string;
      highlightedAngles: StructuredTrigCircleAngle[];
    }
  | {
      type: "pie_chart";
      caption: string;
      slices: StructuredPieSlice[];
    }
  | {
      type: "number_line";
      caption: string;
      min: number;
      max: number;
      points: StructuredNumberLinePoint[];
      intervals: StructuredNumberLineInterval[];
    }
  | {
      type: "bar_chart";
      caption: string;
      bars: StructuredBar[];
    }
  | {
      type: "probability_tree";
      caption: string;
      branches: StructuredProbabilityBranch[];
    }
  | {
      type: "venn_diagram";
      caption: string;
      sets: StructuredVennSet[];
      regionLabels?: {
        aOnly?: string;
        bOnly?: string;
        both?: string;
        neither?: string;
      };
    }
  | {
      type: "triangle_diagram";
      caption: string;
      vertexLabels: [string, string, string];
      sideLabels?: [string, string, string];
      angleLabels?: [string, string, string];
      rightAngleAt?: 0 | 1 | 2;
    }
  | {
      type: "box_plot";
      caption: string;
      min: number;
      q1: number;
      median: number;
      q3: number;
      max: number;
      axisLabel?: string;
    }
  | {
      type: "exercise";
      exerciseIndex: number;
    }
  | {
      type: "steps";
      steps: Array<{
        title?: StructuredRichText;
        blocks: StructuredCourseBlock[];
      }>;
    }


export type StructuredLearningResource = Extract<
  StructuredCourseBlock,
  { type: "table" | "sign_table" | "variation_table" | "graph" | "figure" }
>;

export type StructuredCourseExercise = {
  question: StructuredRichText;
  answer: StructuredRichText;
  hint: StructuredRichText;
  explanation: StructuredRichText;
};

export type StructuredCourseLesson = {
  title: string;
  duration: number;
  blocks: StructuredCourseBlock[];
  exercises: StructuredCourseExercise[];
};

export type StructuredCourseChapter = {
  title: string;
  lessons: StructuredCourseLesson[];
};

export type StructuredExerciseQuestion = {
  prompt: StructuredRichText;
  content: StructuredRichText;
  answer: StructuredRichText;
  explanation: StructuredRichText;
  points: number;
  options: StructuredRichText[];
  correctOptionIndexes: number[];
  acceptedAnswers: StructuredRichText[][];
  pairs: Array<{ left: StructuredRichText; right: StructuredRichText }>;
  items: StructuredRichText[];
  resources: StructuredLearningResource[];
};

export type StructuredExerciseDraft = {
  title: string;
  description: string;
  introduction: StructuredRichText[];
  questions: StructuredExerciseQuestion[];
};

export type StructuredQuizQuestion = {
  text: StructuredRichText;
  options: StructuredRichText[];
  correctOptionIndex: number;
  explanation: StructuredRichText;
  points: number;
  resources: StructuredLearningResource[];
};

export type StructuredQuizDraft = {
  title: string;
  description: string;
  timeLimit: number;
  maxAttempts: number;
  questions: StructuredQuizQuestion[];
};

export type StructuredGenerator = (
  userPrompt: string,
  systemPrompt: string,
  contract: JsonSchemaContract,
  temperature?: number,
  maxTokens?: number,
  reasoning?: boolean,
) => Promise<unknown>;

export type StructuredMathIssue = {
  id: string;
  path: string;
  latex: string;
  error: string;
};

export type StructuredMathRepairReport = {
  invalidBefore: number;
  repairedByModel: number;
  fallbackCount: number;
  remainingInvalid: StructuredMathIssue[];
};

export const STRUCTURED_MATH_OUTPUT_RULES = `═══ FORMAT STRUCTURÉ TEXTE + MATHÉMATIQUES ═══
• Réponds uniquement avec l'objet JSON demandé. Ne produis jamais de Markdown.
• Ne produis JAMAIS de HTML : aucune balise <p>, <div>, <table>, <br>, <strong>, <svg> ou autre.
• Ne produis JAMAIS les délimiteurs LaTeX $, $$, \\(, \\), \\[ ou \\].
• Toute prose va exclusivement dans un élément {"type":"text","value":"..."}.
• Toute expression mathématique va exclusivement dans un élément {"type":"math","latex":"..."} ou dans le champ "latex" d'un bloc "display_math".
• Un champ "latex" contient uniquement le corps LaTeX, jamais une phrase de prose autour, jamais de HTML, jamais de $.
• Dans le JSON brut, les antislashs suivent l'échappement JSON normal. Exemple JSON EXACT : {"type":"math","latex":"\\\\frac{1}{2}"}. Après lecture du JSON, le serveur obtient \\frac{1}{2}. Ne double jamais davantage les antislashs.
• Utilise uniquement du LaTeX compatible KaTeX : \\frac, \\sqrt, \\vec, \\overrightarrow, \\exp, \\ln, \\sin, \\cos, \\tan, \\lim, \\to, \\infty, \\mathbb, \\begin{aligned}...\\end{aligned}, etc.
• N'utilise jamais les symboles Unicode ², ³, √, ×, ÷, ≤, ≥, ≠, → ou ∞ dans un champ mathématique : utilise ^2, ^3, \\sqrt{}, \\times, \\div, \\leq, \\geq, \\neq, \\to et \\infty.
• Dans un élément texte, n'écris aucune commande commençant par un antislash. Si une formule est nécessaire, crée un élément math séparé.
• Vérifie chaque champ latex avant de répondre : accolades équilibrées, environnements fermés, aucun délimiteur $, aucune balise HTML.
• Les espaces de la phrase restent dans les éléments texte. Exemple : {"parts":[{"type":"text","value":"La fonction "},{"type":"math","latex":"\\\\exp(x)"},{"type":"text","value":" est positive."}]}.
• N'ajoute aucun identifiant technique. Les identifiants sont générés par le serveur.`;

export const RICH_TEXT_SCHEMA_PROMPT = `Un texte enrichi respecte exactement ce format :
{"parts":[
  {"type":"text","value":"Texte en français avec les espaces et la ponctuation nécessaires"},
  {"type":"math","latex":"\\\\frac{1}{2}"},
  {"type":"text","value":" suite de la phrase."}
]}
Une phrase sans mathématiques utilise simplement un seul élément text.`;

export const COURSE_BLOCK_SCHEMA_PROMPT = `Les blocs autorisés dans une leçon sont uniquement :
1. Titre de section :
{"type":"heading","level":3,"content":RICH_TEXT}
2. Paragraphe :
{"type":"paragraph","content":RICH_TEXT}
3. Formule affichée :
{"type":"display_math","latex":"\\begin{aligned}a&=b\\\\c&=d\\end{aligned}"}
4. Liste :
{"type":"list","ordered":false,"items":[RICH_TEXT,RICH_TEXT]}
5. Encadré :
{"type":"callout","variant":"note","title":RICH_TEXT,"paragraphs":[RICH_TEXT]}
variant vaut "note" ou "warning". Réserve les encadrés aux définitions, résultats clés et mises en garde.
6. Tableau de valeurs ou de comparaison — jamais pour un signe ou une variation :
{"type":"table","variant":"value","headers":[RICH_TEXT,RICH_TEXT],"rows":[[RICH_TEXT,RICH_TEXT]]}
Toutes les lignes ont exactement autant de cellules que headers.
7. Tableau de signes structuré :
{"type":"sign_table","expression":RICH_TEXT,"boundaries":[RICH_TEXT],"interval_signs":["negative","positive"],"boundary_signs":["zero"]}
Avec n bornes, interval_signs contient exactement n+1 valeurs et boundary_signs exactement n valeurs. Les valeurs autorisées sont negative, zero, positive et undefined.
8. Tableau de variations structuré :
{"type":"variation_table","variable":RICH_TEXT,"function_name":RICH_TEXT,"points":[RICH_TEXT,RICH_TEXT,RICH_TEXT],"values":[RICH_TEXT,RICH_TEXT,RICH_TEXT],"directions":["down","up"],"derivative_signs":["negative","positive"]}
points et values ont la même longueur ; directions et derivative_signs ont exactement points.length-1 éléments. directions vaut up, down ou constant.
9. Graphique de fonction :
{"type":"graph","expression":"exp(x)","xmin":-5,"xmax":5,"caption":"Description courte sans LaTeX","parameter":null,"vectors":[]}
Pour une famille paramétrée, remplace null par {"name":"a","min":-3,"max":3,"default":1} et utilise a dans expression.
Pour superposer un vecteur sur le repère, ajoute dans vectors : {"x":2,"y":3,"from_x":0,"from_y":0,"label":"u","tone":"red"}. Les labels sont du texte court, sans LaTeX.
10. Figure statique structurée — seulement pour géométrie, fractions, aires, schémas d'énoncé ; jamais pour tracer une courbe de fonction :
{"type":"figure","caption":"Description courte","elements":[
  {"type":"line","x1":25,"y1":125,"x2":170,"y2":125,"tone":"navy","dashed":false,"arrow_end":false,"label":RICH_TEXT,"label_x":95,"label_y":145},
  {"type":"point","x":25,"y":125,"tone":"gold","label":RICH_TEXT,"label_x":15,"label_y":140}
]}
Le repère est toujours 200×160. Les coordonnées restent dans ce cadre. Utilise 3 à 5 éléments étiquetés maximum et les tons navy, gold, blue, green, red ou gray. Les éléments possibles sont line, point, circle, polygon et arc.
11. Emplacement d'exercice :
{"type":"exercise","exercise_index":1}
exercise_index est la position 1, 2, 3... de l'exercice dans le tableau exercises de CETTE leçon.
12. Démonstration en étapes :
{"type":"steps","steps":[{"title":RICH_TEXT,"blocks":[BLOCS]},{"title":RICH_TEXT,"blocks":[BLOCS]},{"title":RICH_TEXT,"blocks":[BLOCS]}]}
Une démonstration de 3 étapes ou plus utilise ce bloc. Le champ title est toujours présent dans chaque étape.
Ne crée aucun autre type de bloc.`;

const ENTITY_MAP: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

const UNICODE_MATH_REPLACEMENTS: Array<[RegExp, string]> = [
  [/≤/g, "\\leq "],
  [/≥/g, "\\geq "],
  [/≠/g, "\\neq "],
  [/≈/g, "\\approx "],
  [/×/g, "\\times "],
  [/÷/g, "\\div "],
  [/±/g, "\\pm "],
  [/→/g, "\\to "],
  [/∞/g, "\\infty "],
  [/π/g, "\\pi "],
  [/θ/g, "\\theta "],
  [/α/g, "\\alpha "],
  [/β/g, "\\beta "],
  [/γ/g, "\\gamma "],
  [/δ/g, "\\delta "],
  [/²/g, "^2"],
  [/³/g, "^3"],
  [/⁴/g, "^4"],
  [/√\s*\(([^()]*)\)/g, "\\sqrt{$1}"],
  [/√\s*([A-Za-z0-9]+)/g, "\\sqrt{$1}"],
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function decodeEntities(value: string): string {
  let result = value;
  for (const [entity, decoded] of Object.entries(ENTITY_MAP)) {
    result = result.split(entity).join(decoded);
  }
  return result;
}

/** Texte strictement textuel : aucun HTML, aucun délimiteur mathématique et
 * aucune commande LaTeX ne peut rester visible à l'élève. */
export function sanitizeStructuredText(
  value: unknown,
  preserveBoundaryWhitespace = false,
): string {
  const original = decodeEntities(stringValue(value));
  const hadLeadingSpace = /^\s/.test(original);
  const hadTrailingSpace = /\s$/.test(original);
  let text = original
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/<\/?[A-Za-z][^>]*>/g, " ")
    // Un tour de réparation LaTeX (repairUnstructuredMathText) a parfois
    // renvoyé un fragment mal sérialisé au lieu du texte attendu, laissant
    // fuiter des guillemets droits littéraux dans le contenu final (ex:
    // `sur $[", "\pi, 2\pi]$` au lieu de `sur $[\pi, 2\pi]$`, vu en prod).
    // Aucun texte ou label de ce pipeline n'a besoin de guillemets droits :
    // on retire d'abord la paire séparée d'une virgule (l'artefact `", "`
    // le plus fréquent), puis tout guillemet isolé restant.
    .replace(/"\s*,\s*"/g, "")
    .replace(/"/g, "")
    .replace(/\$\$?|\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\\([A-Za-z]+)\b/g, "$1")
    .replace(/\\+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  if (preserveBoundaryWhitespace && text) {
    if (hadLeadingSpace) text = ` ${text}`;
    if (hadTrailingSpace) text = `${text} `;
  }
  if (preserveBoundaryWhitespace && !text && (hadLeadingSpace || hadTrailingSpace)) {
    return " ";
  }
  return text;
}

// Conversions appliquées AVANT sanitizeStructuredText pour les labels courts
// des diagrammes déterministes (trig_circle, pie_chart...). sanitizeStructuredText
// seul se contente de retirer l'antislash d'une commande reconnue
// ("\frac" -> "frac"), ce qui est correct pour de la prose (la commande ne
// devrait de toute façon jamais y figurer) mais rend un label illisible : un
// angle "$-\frac{\pi}{3}$" ressortait "-frac{pi}{3}" au lieu de "-π/3" (vu en
// production). Ici on convertit d'abord en notation lisible équivalente à
// celle des captions (readableMathFallbackText dans qualityGuard.ts).
const DIAGRAM_LABEL_CONVERSIONS: Array<[RegExp, string]> = [
  [/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2"],
  [/\\sqrt\{([^{}]*)\}/g, "√$1"],
  [/\\vec\{([^{}]*)\}/g, "$1⃗"],
  [/\\pi\b/g, "π"],
  [/\\theta\b/g, "θ"],
  [/\\infty\b/g, "∞"],
  [/\\lambda\b/g, "λ"],
  [/\\alpha\b/g, "α"],
  [/\\beta\b/g, "β"],
  [/\\times\b/g, "×"],
  [/\\cdot\b/g, "·"],
  [/\\leq\b/g, "≤"],
  [/\\geq\b/g, "≥"],
  [/\\neq\b/g, "≠"],
];

export function sanitizeDiagramLabel(value: unknown): string {
  let text = stringValue(value);
  for (const [pattern, replacement] of DIAGRAM_LABEL_CONVERSIONS) {
    text = text.replace(pattern, replacement);
  }
  return sanitizeStructuredText(text);
}

function stripOuterMathDelimiters(value: string): string {
  let result = value.trim();
  let changed = true;
  while (changed) {
    changed = false;
    if (result.startsWith("$$") && result.endsWith("$$") && result.length > 4) {
      result = result.slice(2, -2).trim();
      changed = true;
    } else if (result.startsWith("$") && result.endsWith("$") && result.length > 2) {
      result = result.slice(1, -1).trim();
      changed = true;
    } else if (result.startsWith("\\(") && result.endsWith("\\)")) {
      result = result.slice(2, -2).trim();
      changed = true;
    } else if (result.startsWith("\\[") && result.endsWith("\\]")) {
      result = result.slice(2, -2).trim();
      changed = true;
    }
  }
  return result;
}

function balanceLatexBraces(value: string): string {
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}" && depth > 0) depth -= 1;
  }
  return depth > 0 ? `${value}${"}".repeat(depth)}` : value;
}

function transformOutsideTextLikeCommands(
  latex: string,
  transform: (value: string) => string,
): string {
  const masked: string[] = [];
  const placeholderPrefix = "ZZSTRUCTUREDMASK";
  const withoutText = latex.replace(
    /\\(?:text|textbf|textit|operatorname|mathrm|mathbf|mathit|mathsf)\s*\{[^{}]*\}/g,
    (match) => {
      const token = `${placeholderPrefix}${masked.length}ZZ`;
      masked.push(match);
      return token;
    },
  );
  let result = transform(withoutText);
  masked.forEach((value, index) => {
    result = result.replace(`${placeholderPrefix}${index}ZZ`, value);
  });
  return result;
}

function deterministicLatexError(latex: string): string {
  if (!latex.trim()) return "Formule vide";
  if (/[<>$]/.test(latex)) return "Délimiteur ou balise interdit dans le corps LaTeX";
  if (/[\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000]/u.test(latex)) {
    return "Caractère d'espacement Unicode invalide";
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(latex)) {
    return "Caractère de contrôle interdit";
  }

  let braceDepth = 0;
  for (let index = 0; index < latex.length; index += 1) {
    const char = latex[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") braceDepth += 1;
    if (char === "}") {
      braceDepth -= 1;
      if (braceDepth < 0) return "Accolade fermante sans ouverture";
    }
  }
  if (braceDepth !== 0) return "Accolades non équilibrées";

  const environmentStack: string[] = [];
  const environmentRe = /\\(begin|end)\{([A-Za-z*]+)\}/g;
  let environmentMatch: RegExpExecArray | null;
  while ((environmentMatch = environmentRe.exec(latex)) !== null) {
    const [, action, name] = environmentMatch;
    if (action === "begin") {
      environmentStack.push(name);
    } else if (environmentStack.pop() !== name) {
      return `Environnement LaTeX mal fermé : ${name}`;
    }
  }
  if (environmentStack.length > 0) {
    return `Environnement LaTeX non fermé : ${environmentStack.at(-1)}`;
  }

  // KaTeX accepte parfois une longue suite de lettres comme un produit de
  // variables. Dans les sorties IA, un mot français minuscule de 4 lettres
  // ou plus hors \text{...} indique presque toujours que prose et formule
  // ont été mélangées. On l'intercepte avant l'affichage.
  const masked = latex
    .replace(
      /\\(?:text|textbf|textit|operatorname|mathrm|mathbf|mathit|mathsf)\s*\{[^{}]*\}/g,
      " ",
    )
    .replace(/\\(?:begin|end)\{[A-Za-z*]+\}/g, " ")
    .replace(/\\[A-Za-z]+/g, " ");
  const suspiciousWord = masked.match(/(?<![A-Za-z])[a-z]{4,}(?![A-Za-z])/);
  if (suspiciousWord) {
    return `Prose suspecte dans le champ LaTeX : ${suspiciousWord[0]}`;
  }

  return "";
}

/** Normalisation volontairement limitée et déterministe. Elle ne tente pas de
 * reconstruire une phrase corrompue : le nouveau format empêche cette phrase
 * de se mélanger aux mathématiques. */
export function normalizeStructuredLatex(value: unknown): string {
  let latex = decodeEntities(stringValue(value));
  latex = stripOuterMathDelimiters(latex)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/<\/?[A-Za-z][^>]*>/g, " ")
    // Voir le même artefact dans sanitizeStructuredText : un tour de
    // réparation a renvoyé `[", "\pi, 2\pi]` au lieu de `[\pi, 2\pi]`
    // (guillemets droits d'une sérialisation ratée qui ont fui dans la
    // formule). Aucune formule KaTeX de ce pipeline n'utilise de guillemet
    // droit.
    .replace(/"\s*,\s*"/g, "")
    .replace(/"/g, "")
    .replace(/\$/g, "")
    .replace(/</g, "\\lt ")
    .replace(/>/g, "\\gt ")
    .trim();

  for (const [pattern, replacement] of UNICODE_MATH_REPLACEMENTS) {
    latex = latex.replace(pattern, replacement);
  }

  // Une commande volontairement sur-échappée après JSON.parse :
  // \\frac -> \frac. On ne réduit que les NOMS DE COMMANDES connus et
  // uniquement lorsque la paire n'est pas précédée d'un autre antislash.
  // Cela préserve les vrais retours de ligne `\\` d'un environnement
  // aligned/cases, y compris lorsqu'une ligne suivante commence par une lettre.
  const overEscapedCommand = /(?<!\\)\\\\(?=(?:frac|dfrac|tfrac|sqrt|vec|overrightarrow|overline|underline|bar|hat|widehat|widetilde|dot|ddot|binom|text|textbf|textit|mathbb|mathcal|mathbf|mathrm|mathit|mathsf|operatorname|left|right|begin|end|quad|qquad|implies|iff|to|mapsto|times|div|cdot|le|leq|ge|geq|neq|ne|pm|mp|infty|approx|equiv|sim|propto|forall|exists|in|notin|subset|subseteq|supset|supseteq|cup|cap|emptyset|varnothing|perp|parallel|angle|circ|alpha|beta|gamma|delta|epsilon|varepsilon|theta|lambda|mu|nu|xi|pi|rho|sigma|tau|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|Leftrightarrow|sum|prod|int|lim|log|ln|exp|sin|cos|tan|arcsin|arccos|arctan|sinh|cosh|tanh|min|max|gcd|bmod|pmod)\b)/g;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = latex.replace(overEscapedCommand, "\\");
    if (next === latex) break;
    latex = next;
  }

  // Le modèle laisse parfois tomber les 1-2 premières lettres d'une commande
  // juste avant une accolade (ex: "e^{- rac{20\ln 2}{8}}" au lieu de
  // "e^{-\frac{20\ln 2}{8}}", vu en production). Non précédé d'une lettre ou
  // d'un antislash, et suivi immédiatement de "{" : signature fiable d'une
  // commande tronquée, jamais d'un mot français légitime.
  latex = latex
    .replace(/(?<![A-Za-z\\])rac\s*\{/g, "\\frac{")
    .replace(/(?<![A-Za-z\\])egin\s*\{/g, "\\begin{")
    .replace(/(?<![A-Za-z\\])ext\s*\{/g, "\\text{")
    .replace(/(?<![A-Za-z\\])vec\s*\{/g, "\\vec{")
    .replace(/(?<![A-Za-z\\])heta\b/g, "\\theta")
    .replace(/(?<![A-Za-z\\])imes\b/g, "\\times")
    .replace(/(?<![A-Za-z\\])ight\s*([{(])/g, "\\right$1");

  latex = latex
    .replace(/\\text\s*\{\s*(?:π|\\pi)\s*\}/g, "\\pi")
    .replace(/\\text\s*\{\s*(exp|ln|sin|cos|tan)\s*\}/g, "\\$1");
  latex = transformOutsideTextLikeCommands(latex, (value) =>
    value.replace(
      /(?<!\\)\b(exp|ln|sin|cos|tan|arcsin|arccos|arctan|sinh|cosh|tanh|lim|log|min|max|gcd)\b/g,
      "\\$1",
    ),
  )
    .replace(/\s+/g, " ")
    .replace(/\\begin\s*\{\s*([A-Za-z]+)\s*\}/g, "\\begin{$1}")
    .replace(/\\end\s*\{\s*([A-Za-z]+)\s*\}/g, "\\end{$1}")
    .trim();

  const leftCount = (latex.match(/\\left\b/g) || []).length;
  const rightCount = (latex.match(/\\right\b/g) || []).length;
  if (leftCount !== rightCount) {
    latex = latex.replace(/\\left\b|\\right\b/g, "");
  }

  return balanceLatexBraces(latex);
}

export function isStructuredLatexValid(latex: string): boolean {
  if (deterministicLatexError(latex)) return false;
  try {
    katex.renderToString(latex, {
      throwOnError: true,
      strict: false,
    });
    return true;
  } catch {
    return false;
  }
}


/**
 * Repli purement textuel pour une formule qui reste invalide après la
 * correction ciblée. Cette fonction ne reconstruit jamais du LaTeX : elle
 * retire les commandes et produit une chaîne lisible, sans antislash, dollar
 * ou HTML. Elle remplace définitivement l'ancien réparateur global.
 */
export function mathToReadableText(value: unknown): string {
  let source = normalizeStructuredLatex(value);
  if (!source) return "";

  const recurse = (input: string): string => {
    let text = input;
    for (let pass = 0; pass < 6; pass += 1) {
      const previous = text;
      text = text
        .replace(/\\(?:d?frac|tfrac)\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a: string, b: string) => `${recurse(a)}/${recurse(b)}`)
        .replace(/\\sqrt\{([^{}]*)\}/g, (_m, a: string) => `racine(${recurse(a)})`)
        .replace(/\\(?:vec|overrightarrow)\{([^{}]*)\}/g, (_m, a: string) => `vecteur ${recurse(a)}`)
        .replace(/\\(?:hat|widehat)\{([^{}]*)\}/g, (_m, a: string) => `angle ${recurse(a)}`)
        .replace(/\\(?:text|textbf|textit|mathrm|mathbf|mathit|mathsf|mathbb|mathcal|operatorname|boxed)\{([^{}]*)\}/g, (_m, a: string) => recurse(a));
      if (text === previous) break;
    }
    return text;
  };

  source = recurse(source)
    .replace(/\\begin\{[^{}]+\}|\\end\{[^{}]+\}/g, " ")
    .replace(/\\\\/g, " ; ")
    .replace(/&/g, " ")
    .replace(/\\leq?\b/g, " <= ")
    .replace(/\\geq?\b/g, " >= ")
    .replace(/\\(?:neq|ne)\b/g, " != ")
    .replace(/\\times\b/g, " x ")
    .replace(/\\cdot\b/g, " . ")
    .replace(/\\div\b/g, " / ")
    .replace(/\\pm\b/g, " +/- ")
    .replace(/\\to\b/g, " -> ")
    .replace(/\\infty\b/g, "infini")
    .replace(/\\pi\b/g, "pi")
    .replace(/\\theta\b/g, "theta")
    .replace(/\\(?:left|right|quad|qquad)\b|\\[,;:!]/g, " ")
    .replace(/\\([A-Za-z]+)\b/g, "$1")
    .replace(/[{}$<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitizeStructuredText(source);
}

function getKatexError(latex: string): string {
  const deterministic = deterministicLatexError(latex);
  if (deterministic) return deterministic;
  try {
    katex.renderToString(latex, {
      throwOnError: true,
      strict: false,
    });
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : "Formule KaTeX invalide";
  }
}

function parseLegacyRichText(value: string): StructuredRichTextPart[] {
  const parts: StructuredRichTextPart[] = [];
  const expression = /\$\$([\s\S]*?)\$\$|\$([^$\r\n]*?)\$|\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(value)) !== null) {
    if (match.index > cursor) {
      const text = sanitizeStructuredText(value.slice(cursor, match.index), true);
      if (text) parts.push({ type: "text", value: text });
    }
    const latex = normalizeStructuredLatex(match[1] ?? match[2] ?? match[3] ?? match[4] ?? "");
    if (latex) parts.push({ type: "math", latex });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) {
    const text = sanitizeStructuredText(value.slice(cursor), true);
    if (text) parts.push({ type: "text", value: text });
  }
  return parts;
}

function needsBoundarySpace(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (/\s$/.test(left) || /^\s/.test(right)) return false;
  if (/[('’\[{\/-]$/.test(left)) return false;
  if (/^[,.;:!?%)\]}]/.test(right)) return false;
  return /[A-Za-zÀ-ÿ0-9)]$/.test(left) && /^[A-Za-zÀ-ÿ0-9(]/.test(right);
}

function normalizePartBoundaries(
  parts: StructuredRichTextPart[],
): StructuredRichTextPart[] {
  const normalized: StructuredRichTextPart[] = [];
  for (const rawPart of parts) {
    if (!rawPart.type) continue;
    const part = rawPart.type === "text"
      ? { ...rawPart, value: rawPart.value.replace(/[ \t]+/g, " ") }
      : rawPart;
    const previous = normalized[normalized.length - 1];

    if (part.type === "text" && previous?.type === "text") {
      const spacer = needsBoundarySpace(previous.value, part.value) ? " " : "";
      previous.value = `${previous.value}${spacer}${part.value}`;
      continue;
    }

    if (previous && part.type === "text" && previous.type === "math") {
      if (part.value && needsBoundarySpace("x", part.value)) {
        part.value = ` ${part.value}`;
      }
    } else if (previous?.type === "text" && part.type === "math") {
      if (previous.value && needsBoundarySpace(previous.value, "x")) {
        previous.value = `${previous.value} `;
      }
    }
    normalized.push(part);
  }
  return normalized.filter(
    (part) => part.type === "math" || part.value.length > 0,
  );
}

function mergeAdjacentText(parts: StructuredRichTextPart[]): StructuredRichTextPart[] {
  return normalizePartBoundaries(parts);
}

export function normalizeStructuredRichText(value: unknown): StructuredRichText {
  if (typeof value === "string") {
    const legacyParts = parseLegacyRichText(value);
    if (legacyParts.length > 0) return { parts: mergeAdjacentText(legacyParts) };
    const text = sanitizeStructuredText(value, true);
    return { parts: text ? [{ type: "text", value: text }] : [] };
  }

  const record = asRecord(value);
  const rawParts = Array.isArray(value)
    ? value
    : Array.isArray(record?.parts)
      ? record.parts
      : [];

  const parts: StructuredRichTextPart[] = [];
  for (const rawPart of rawParts) {
    if (typeof rawPart === "string") {
      parts.push(...parseLegacyRichText(rawPart));
      continue;
    }
    const part = asRecord(rawPart);
    if (!part) continue;
    const type = stringValue(part.type).toLowerCase();
    if (type === "math" || type === "latex" || type === "formula") {
      const latex = normalizeStructuredLatex(part.latex ?? part.value ?? part.text);
      if (latex) parts.push({ type: "math", latex });
      continue;
    }
    const text = sanitizeStructuredText(part.value ?? part.text ?? part.content, true);
    if (text) parts.push({ type: "text", value: text });
  }

  if (parts.length === 0 && record) {
    const fallback = sanitizeStructuredText(record.value ?? record.text ?? record.content, true);
    if (fallback) parts.push({ type: "text", value: fallback });
  }

  return { parts: mergeAdjacentText(parts) };
}

export function structuredRichTextToPlainText(value: StructuredRichText): string {
  return value.parts
    .map((part) =>
      part.type === "text"
        ? part.value
        : mathToReadableText(part.latex) || "formule mathématique",
    )
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}


function normalizeSignValue(value: unknown): StructuredSignValue {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "negative" || normalized === "zero" || normalized === "positive") {
    return normalized;
  }
  return "undefined";
}

function normalizeVariationDirection(
  value: unknown,
): StructuredVariationDirection {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "down" || normalized === "constant") return normalized;
  return "up";
}

function normalizeFigureTone(value: unknown): StructuredFigureTone {
  const tone = stringValue(value).toLowerCase();
  if (
    tone === "gold" ||
    tone === "blue" ||
    tone === "green" ||
    tone === "red" ||
    tone === "gray"
  ) {
    return tone;
  }
  return "navy";
}

function optionalRichText(value: unknown): StructuredRichText | undefined {
  if (value === undefined || value === null) return undefined;
  const rich = normalizeStructuredRichText(value);
  return rich.parts.length > 0 ? rich : undefined;
}

function optionalCoordinate(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return clamp(finiteNumber(value, 0), 0, 200);
}

function normalizeFigurePoint(value: unknown): StructuredFigurePoint | null {
  const raw = asRecord(value);
  if (!raw) return null;
  return {
    x: clamp(finiteNumber(raw.x, 0), 0, 200),
    y: clamp(finiteNumber(raw.y, 0), 0, 160),
  };
}

function normalizeFigureElement(value: unknown): StructuredFigureElement | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const type = stringValue(raw.type).toLowerCase();
  const tone = normalizeFigureTone(raw.tone);
  const label = optionalRichText(raw.label);
  const labelX = optionalCoordinate(raw.label_x ?? raw.labelX);
  const labelYRaw = raw.label_y ?? raw.labelY;
  const labelY =
    labelYRaw === undefined || labelYRaw === null || labelYRaw === ""
      ? undefined
      : clamp(finiteNumber(labelYRaw, 0), 0, 160);
  const shared = { tone, label, labelX, labelY };

  if (type === "line") {
    return {
      type: "line",
      x1: clamp(finiteNumber(raw.x1, 20), 0, 200),
      y1: clamp(finiteNumber(raw.y1, 120), 0, 160),
      x2: clamp(finiteNumber(raw.x2, 180), 0, 200),
      y2: clamp(finiteNumber(raw.y2, 120), 0, 160),
      dashed: raw.dashed === true,
      arrowEnd: raw.arrow_end === true || raw.arrowEnd === true,
      ...shared,
    };
  }
  if (type === "point") {
    return {
      type: "point",
      x: clamp(finiteNumber(raw.x, 100), 0, 200),
      y: clamp(finiteNumber(raw.y, 80), 0, 160),
      ...shared,
    };
  }
  if (type === "circle") {
    return {
      type: "circle",
      cx: clamp(finiteNumber(raw.cx, 100), 0, 200),
      cy: clamp(finiteNumber(raw.cy, 80), 0, 160),
      r: clamp(finiteNumber(raw.r, 35), 2, 80),
      filled: raw.filled === true,
      ...shared,
    };
  }
  if (type === "polygon") {
    const points = Array.isArray(raw.points)
      ? raw.points
          .map(normalizeFigurePoint)
          .filter((point): point is StructuredFigurePoint => point !== null)
          .slice(0, 8)
      : [];
    if (points.length < 3) return null;
    return {
      type: "polygon",
      points,
      filled: raw.filled === true,
      ...shared,
    };
  }
  if (type === "arc") {
    return {
      type: "arc",
      cx: clamp(finiteNumber(raw.cx, 100), 0, 200),
      cy: clamp(finiteNumber(raw.cy, 80), 0, 160),
      r: clamp(finiteNumber(raw.r, 30), 2, 80),
      startAngle: clamp(finiteNumber(raw.start_angle ?? raw.startAngle, 0), -360, 360),
      endAngle: clamp(finiteNumber(raw.end_angle ?? raw.endAngle, 90), -360, 360),
      ...shared,
    };
  }
  return null;
}

function normalizeGraphVector(value: unknown): StructuredGraphVector | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const x = finiteNumber(raw.x, Number.NaN);
  const y = finiteNumber(raw.y, Number.NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const fromXRaw = raw.from_x ?? raw.fromX;
  const fromYRaw = raw.from_y ?? raw.fromY;
  return {
    x: clamp(x, -100, 100),
    y: clamp(y, -100, 100),
    ...(fromXRaw !== undefined ? { fromX: clamp(finiteNumber(fromXRaw, 0), -100, 100) } : {}),
    ...(fromYRaw !== undefined ? { fromY: clamp(finiteNumber(fromYRaw, 0), -100, 100) } : {}),
    ...(sanitizeStructuredText(raw.label) ? { label: sanitizeStructuredText(raw.label).slice(0, 20) } : {}),
    tone: normalizeFigureTone(raw.tone),
  };
}

function normalizeTrigCircleAngle(value: unknown): StructuredTrigCircleAngle | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label ?? raw.angle_deg ?? raw.angleDeg);
  if (!label) return null;
  return {
    angleDeg: finiteNumber(raw.angle_deg ?? raw.angleDeg, 0),
    label: label.slice(0, 24),
  };
}

function normalizePieSlice(value: unknown): StructuredPieSlice | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  const numericValue = finiteNumber(raw.value, Number.NaN);
  if (!label || !Number.isFinite(numericValue) || numericValue < 0) return null;
  return { label: label.slice(0, 60), value: numericValue, tone: normalizeFigureTone(raw.tone) };
}

function normalizeNumberLinePoint(value: unknown): StructuredNumberLinePoint | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  const numericValue = finiteNumber(raw.value, Number.NaN);
  if (!label || !Number.isFinite(numericValue)) return null;
  return { value: numericValue, label: label.slice(0, 40), filled: raw.filled !== false };
}

function normalizeNumberLineInterval(
  value: unknown,
): StructuredNumberLineInterval | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const from = finiteNumber(raw.from, Number.NaN);
  const to = finiteNumber(raw.to, Number.NaN);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return {
    from: Math.min(from, to),
    to: Math.max(from, to),
    fromIncluded: (raw.from_included ?? raw.fromIncluded) === true,
    toIncluded: (raw.to_included ?? raw.toIncluded) === true,
    tone: normalizeFigureTone(raw.tone),
  };
}

function normalizeBar(value: unknown): StructuredBar | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  const numericValue = finiteNumber(raw.value, Number.NaN);
  if (!label || !Number.isFinite(numericValue) || numericValue < 0) return null;
  return { label: label.slice(0, 30), value: numericValue, tone: normalizeFigureTone(raw.tone) };
}

function normalizeProbabilityLeaf(value: unknown): StructuredProbabilityLeaf | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  const probability = sanitizeDiagramLabel(raw.probability);
  if (!label || !probability) return null;
  return { label: label.slice(0, 40), probability: probability.slice(0, 20) };
}

function normalizeProbabilityBranch(
  value: unknown,
): StructuredProbabilityBranch | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const leaf = normalizeProbabilityLeaf(raw);
  if (!leaf) return null;
  const children = Array.isArray(raw.children)
    ? raw.children
        .map(normalizeProbabilityLeaf)
        .filter((entry): entry is StructuredProbabilityLeaf => entry !== null)
        .slice(0, 4)
    : [];
  return { ...leaf, children };
}

function normalizeVennSet(value: unknown): StructuredVennSet | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  if (!label) return null;
  return { label: label.slice(0, 30), tone: normalizeFigureTone(raw.tone) };
}

function normalizeCourseBlock(value: unknown, depth = 0): StructuredCourseBlock | null {
  if (depth > 4) return null;
  const raw = asRecord(value);
  if (!raw) {
    const content = normalizeStructuredRichText(value);
    return content.parts.length ? { type: "paragraph", content } : null;
  }

  const type = stringValue(raw.type, "paragraph").toLowerCase();
  switch (type) {
    case "heading":
    case "title":
      return {
        type: "heading",
        level: finiteNumber(raw.level, 3) >= 4 ? 4 : 3,
        content: normalizeStructuredRichText(raw.content ?? raw.text ?? raw.title),
      };
    case "paragraph":
    case "text":
      return {
        type: "paragraph",
        content: normalizeStructuredRichText(raw.content ?? raw.text ?? raw.value),
      };
    case "display_math":
    case "formula":
    case "math_block":
      return {
        type: "display_math",
        latex: normalizeStructuredLatex(raw.latex ?? raw.value ?? raw.content),
      };
    case "list": {
      const items = Array.isArray(raw.items)
        ? raw.items.map(normalizeStructuredRichText).filter((item) => item.parts.length > 0)
        : [];
      return {
        type: "list",
        ordered: raw.ordered === true || stringValue(raw.style).toLowerCase() === "ordered",
        items,
      };
    }
    case "callout": {
      const paragraphsRaw = Array.isArray(raw.paragraphs)
        ? raw.paragraphs
        : raw.content !== undefined
          ? [raw.content]
          : [];
      return {
        type: "callout",
        variant: stringValue(raw.variant).toLowerCase() === "warning" ? "warning" : "note",
        title: raw.title !== undefined ? normalizeStructuredRichText(raw.title) : undefined,
        paragraphs: paragraphsRaw
          .map(normalizeStructuredRichText)
          .filter((paragraph) => paragraph.parts.length > 0),
      };
    }
    case "table": {
      const headers = Array.isArray(raw.headers)
        ? raw.headers
            .map(normalizeStructuredRichText)
            .filter((entry) => entry.parts.length > 0)
            .slice(0, 8)
        : [];
      if (headers.length === 0) return null;
      const rows = Array.isArray(raw.rows)
        ? raw.rows
            .filter(Array.isArray)
            .map((row) =>
              (row as unknown[])
                .slice(0, headers.length)
                .map(normalizeStructuredRichText),
            )
            .filter((row) => row.length === headers.length)
            .slice(0, 20)
        : [];
      if (rows.length === 0) return null;
      return { type: "table", variant: "value", headers, rows };
    }
    case "column_operation": {
      const rawOperator = stringValue(raw.operator);
      const operator = (["+", "-", "×", "÷", "x", "*", "/"].includes(rawOperator)
        ? rawOperator === "x" || rawOperator === "*"
          ? "×"
          : rawOperator === "/"
            ? "÷"
            : rawOperator
        : "+") as "+" | "-" | "×" | "÷";
      const operands = Array.isArray(raw.operands)
        ? raw.operands.map((entry) => stringValue(entry)).filter(Boolean).slice(0, 4)
        : [];
      const result = stringValue(raw.result);
      if (operands.length < 2 || !result) return null;
      const carries = Array.isArray(raw.carries)
        ? raw.carries.map((entry) => stringValue(entry))
        : [];
      return { type: "column_operation", operator, operands, result, carries };
    }
    case "sign_table": {
      const boundaries = Array.isArray(raw.boundaries)
        ? raw.boundaries
            .map(normalizeStructuredRichText)
            .filter((entry) => entry.parts.length > 0)
            .slice(0, 6)
        : [];
      const rawIntervalSigns = raw.interval_signs ?? raw.intervalSigns;
      const intervalSigns = Array.isArray(rawIntervalSigns)
        ? rawIntervalSigns
            .map(normalizeSignValue)
            .slice(0, boundaries.length + 1)
        : [];
      const rawBoundarySigns = raw.boundary_signs ?? raw.boundarySigns;
      const boundarySigns = Array.isArray(rawBoundarySigns)
        ? rawBoundarySigns
            .map(normalizeSignValue)
            .slice(0, boundaries.length)
        : [];
      if (
        boundaries.length === 0 ||
        intervalSigns.length !== boundaries.length + 1 ||
        boundarySigns.length !== boundaries.length
      ) {
        return null;
      }
      return {
        type: "sign_table",
        expression: normalizeStructuredRichText(raw.expression),
        boundaries,
        intervalSigns,
        boundarySigns,
      };
    }
    case "variation_table": {
      const points = Array.isArray(raw.points)
        ? raw.points
            .map(normalizeStructuredRichText)
            .filter((entry) => entry.parts.length > 0)
            .slice(0, 7)
        : [];
      const values = Array.isArray(raw.values)
        ? raw.values.map(normalizeStructuredRichText).slice(0, points.length)
        : [];
      const directions = Array.isArray(raw.directions)
        ? raw.directions
            .map(normalizeVariationDirection)
            .slice(0, Math.max(0, points.length - 1))
        : [];
      const rawDerivativeSigns =
        raw.derivative_signs ?? raw.derivativeSigns;
      const derivativeSigns = Array.isArray(rawDerivativeSigns)
        ? rawDerivativeSigns
            .map(normalizeSignValue)
            .slice(0, Math.max(0, points.length - 1))
        : [];
      if (
        points.length < 2 ||
        values.length !== points.length ||
        directions.length !== points.length - 1 ||
        derivativeSigns.length !== points.length - 1
      ) {
        return null;
      }
      return {
        type: "variation_table",
        variable: normalizeStructuredRichText(raw.variable ?? "x"),
        functionName: normalizeStructuredRichText(
          raw.function_name ?? raw.functionName ?? "f",
        ),
        points,
        values,
        directions,
        derivativeSigns,
      };
    }
    case "graph": {
      const parameterRaw = asRecord(raw.parameter);
      const name = sanitizeStructuredText(parameterRaw?.name)
        .replace(/[^A-Za-z]/g, "")
        .slice(0, 2);
      const parameter = parameterRaw && name
        ? {
            name,
            min: finiteNumber(parameterRaw.min, -3),
            max: finiteNumber(parameterRaw.max, 3),
            default: finiteNumber(parameterRaw.default, 1),
          }
        : undefined;
      const vectors = Array.isArray(raw.vectors)
        ? raw.vectors
            .map(normalizeGraphVector)
            .filter((entry): entry is StructuredGraphVector => entry !== null)
            .slice(0, 5)
        : [];
      return {
        type: "graph",
        expression: sanitizeGraphExpression(
          raw.expression ?? raw.function ?? raw.data_function,
        ),
        xmin: finiteNumber(raw.xmin, -5),
        xmax: finiteNumber(raw.xmax, 5),
        caption: sanitizeStructuredText(raw.caption),
        parameter,
        vectors,
      };
    }
    case "figure": {
      const elements = Array.isArray(raw.elements)
        ? raw.elements
            .map(normalizeFigureElement)
            .filter((entry): entry is StructuredFigureElement => entry !== null)
            .slice(0, 12)
        : [];
      if (elements.length === 0) return null;
      return {
        type: "figure",
        caption: sanitizeStructuredText(raw.caption),
        elements,
      };
    }
    case "trig_circle": {
      const rawAngles = raw.highlighted_angles ?? raw.highlightedAngles;
      const highlightedAngles = Array.isArray(rawAngles)
        ? rawAngles
            .map(normalizeTrigCircleAngle)
            .filter((entry): entry is StructuredTrigCircleAngle => entry !== null)
            .slice(0, 12)
        : [];
      if (highlightedAngles.length === 0) return null;
      return {
        type: "trig_circle",
        caption: sanitizeStructuredText(raw.caption),
        highlightedAngles,
      };
    }
    case "pie_chart": {
      const slices = Array.isArray(raw.slices)
        ? raw.slices
            .map(normalizePieSlice)
            .filter((entry): entry is StructuredPieSlice => entry !== null)
            .slice(0, 8)
        : [];
      if (slices.length < 2) return null;
      return {
        type: "pie_chart",
        caption: sanitizeStructuredText(raw.caption),
        slices,
      };
    }
    case "number_line": {
      const points = Array.isArray(raw.points)
        ? raw.points
            .map(normalizeNumberLinePoint)
            .filter((entry): entry is StructuredNumberLinePoint => entry !== null)
            .slice(0, 8)
        : [];
      const intervals = Array.isArray(raw.intervals)
        ? raw.intervals
            .map(normalizeNumberLineInterval)
            .filter((entry): entry is StructuredNumberLineInterval => entry !== null)
            .slice(0, 4)
        : [];
      if (points.length === 0 && intervals.length === 0) return null;
      return {
        type: "number_line",
        caption: sanitizeStructuredText(raw.caption),
        min: finiteNumber(raw.min, -5),
        max: finiteNumber(raw.max, 5),
        points,
        intervals,
      };
    }
    case "bar_chart": {
      const bars = Array.isArray(raw.bars)
        ? raw.bars
            .map(normalizeBar)
            .filter((entry): entry is StructuredBar => entry !== null)
            .slice(0, 10)
        : [];
      if (bars.length < 2) return null;
      return {
        type: "bar_chart",
        caption: sanitizeStructuredText(raw.caption),
        bars,
      };
    }
    case "probability_tree": {
      const branches = Array.isArray(raw.branches)
        ? raw.branches
            .map(normalizeProbabilityBranch)
            .filter((entry): entry is StructuredProbabilityBranch => entry !== null)
            .slice(0, 4)
        : [];
      if (branches.length < 2) return null;
      return {
        type: "probability_tree",
        caption: sanitizeStructuredText(raw.caption),
        branches,
      };
    }
    case "venn_diagram": {
      const sets = Array.isArray(raw.sets)
        ? raw.sets
            .map(normalizeVennSet)
            .filter((entry): entry is StructuredVennSet => entry !== null)
            .slice(0, 3)
        : [];
      if (sets.length < 2) return null;
      const regionLabelsRaw = asRecord(raw.region_labels ?? raw.regionLabels);
      const regionLabels = regionLabelsRaw
        ? {
            aOnly: sanitizeDiagramLabel(regionLabelsRaw.a_only) || undefined,
            bOnly: sanitizeDiagramLabel(regionLabelsRaw.b_only) || undefined,
            both: sanitizeDiagramLabel(regionLabelsRaw.both) || undefined,
            neither: sanitizeDiagramLabel(regionLabelsRaw.neither) || undefined,
          }
        : undefined;
      return {
        type: "venn_diagram",
        caption: sanitizeStructuredText(raw.caption),
        sets,
        regionLabels,
      };
    }
    case "triangle_diagram": {
      const asUnknownArray = (input: unknown): unknown[] =>
        Array.isArray(input) ? input : [];
      const vertexLabelsRaw = asUnknownArray(raw.vertex_labels ?? raw.vertexLabels);
      const vertexLabels = [0, 1, 2].map((index) =>
        sanitizeDiagramLabel(vertexLabelsRaw[index]) || ["A", "B", "C"][index],
      ) as [string, string, string];
      const sideLabelsRaw = asUnknownArray(raw.side_labels ?? raw.sideLabels);
      const sideLabels = [0, 1, 2].map((index) =>
        sanitizeDiagramLabel(sideLabelsRaw[index]),
      ) as [string, string, string];
      const angleLabelsRaw = asUnknownArray(raw.angle_labels ?? raw.angleLabels);
      const angleLabels = [0, 1, 2].map((index) =>
        sanitizeDiagramLabel(angleLabelsRaw[index]),
      ) as [string, string, string];
      const rightAngleRaw = raw.right_angle_at ?? raw.rightAngleAt;
      const rightAngleAt =
        rightAngleRaw === 0 || rightAngleRaw === 1 || rightAngleRaw === 2
          ? rightAngleRaw
          : undefined;
      return {
        type: "triangle_diagram",
        caption: sanitizeStructuredText(raw.caption),
        vertexLabels,
        sideLabels,
        angleLabels,
        rightAngleAt,
      };
    }
    case "box_plot": {
      const min = finiteNumber(raw.min, 0);
      const q1 = finiteNumber(raw.q1, min);
      const median = finiteNumber(raw.median, q1);
      const q3 = finiteNumber(raw.q3, median);
      const max = finiteNumber(raw.max, q3);
      return {
        type: "box_plot",
        caption: sanitizeStructuredText(raw.caption),
        min,
        q1,
        median,
        q3,
        max,
        axisLabel: sanitizeDiagramLabel(raw.axis_label ?? raw.axisLabel) || undefined,
      };
    }
    case "exercise":
    case "exercise_placeholder":
      return {
        type: "exercise",
        exerciseIndex: Math.max(
          1,
          Math.trunc(finiteNumber(raw.exercise_index ?? raw.exerciseIndex ?? raw.index, 1)),
        ),
      };
    case "steps": {
      const steps: Array<{
        title?: StructuredRichText;
        blocks: StructuredCourseBlock[];
      }> = [];
      if (Array.isArray(raw.steps)) {
        for (const step of raw.steps) {
          const stepRecord = asRecord(step);
          if (!stepRecord) continue;
          const blocks = Array.isArray(stepRecord.blocks)
            ? stepRecord.blocks
                .map((block) => normalizeCourseBlock(block, depth + 1))
                .filter((block): block is StructuredCourseBlock => block !== null)
            : [];
          if (blocks.length === 0 && stepRecord.content !== undefined) {
            blocks.push({
              type: "paragraph",
              content: normalizeStructuredRichText(stepRecord.content),
            });
          }
          if (blocks.length === 0) continue;
          const normalizedStep: {
            title?: StructuredRichText;
            blocks: StructuredCourseBlock[];
          } = { blocks };
          if (stepRecord.title !== undefined) {
            normalizedStep.title = normalizeStructuredRichText(stepRecord.title);
          }
          steps.push(normalizedStep);
        }
      }
      return { type: "steps", steps };
    }
    default: {
      const content = normalizeStructuredRichText(raw.content ?? raw.text ?? raw.value);
      return content.parts.length ? { type: "paragraph", content } : null;
    }
  }
}

function sanitizeGraphExpression(value: unknown): string {
  return stringValue(value, "x")
    .replace(/[<>"'`;$]/g, "")
    .replace(/[^0-9A-Za-z_+\-*/^()., ]/g, "")
    .trim()
    .slice(0, 180) || "x";
}

function normalizeCourseExercise(value: unknown): StructuredCourseExercise {
  const raw = asRecord(value) ?? {};
  return {
    question: normalizeStructuredRichText(raw.question ?? raw.prompt),
    answer: normalizeStructuredRichText(raw.answer ?? raw.correct_answer ?? raw.correctAnswer),
    hint: normalizeStructuredRichText(raw.hint),
    explanation: normalizeStructuredRichText(raw.explanation ?? raw.solution),
  };
}

export function normalizeStructuredCourseChapter(
  value: unknown,
  options: {
    expectedLessonCount: number;
    durationPerLesson: number;
    includeExercises: boolean;
    maxExercisesPerLesson?: number;
  },
): StructuredCourseChapter {
  const raw = asRecord(value) ?? {};
  const lessonsRaw = Array.isArray(raw.lessons) ? raw.lessons : [];
  const maxExercises = options.maxExercisesPerLesson ?? 4;
  const lessons = lessonsRaw
    .map((lessonValue) => {
      const lesson = asRecord(lessonValue);
      if (!lesson) return null;
      const blocksRaw = Array.isArray(lesson.blocks)
        ? lesson.blocks
        : lesson.content !== undefined
          ? [{ type: "paragraph", content: lesson.content }]
          : [];
      const blocks = blocksRaw
        .map((block) => normalizeCourseBlock(block))
        .filter((block): block is StructuredCourseBlock => block !== null);
      const exercises = options.includeExercises && Array.isArray(lesson.exercises)
        ? lesson.exercises
            .map(normalizeCourseExercise)
            .filter((exercise) => exercise.question.parts.length > 0)
            .slice(0, maxExercises)
        : [];
      return {
        title: sanitizeStructuredText(lesson.title) || "Leçon",
        duration: options.durationPerLesson,
        blocks,
        exercises,
      } satisfies StructuredCourseLesson;
    })
    .filter((lesson): lesson is StructuredCourseLesson => lesson !== null)
    .slice(0, options.expectedLessonCount);

  return {
    title: sanitizeStructuredText(raw.title) || "Chapitre",
    lessons,
  };
}

function normalizeAcceptedAnswers(value: unknown): StructuredRichText[][] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (Array.isArray(entry)) {
        return entry.map(normalizeStructuredRichText).filter((answer) => answer.parts.length > 0);
      }
      const record = asRecord(entry);
      if (record && Array.isArray(record.accepted)) {
        return record.accepted
          .map(normalizeStructuredRichText)
          .filter((answer) => answer.parts.length > 0);
      }
      const answer = normalizeStructuredRichText(entry);
      return answer.parts.length > 0 ? [answer] : [];
    })
    .filter((answers) => answers.length > 0);
}

function normalizeLearningResources(value: unknown): StructuredLearningResource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeCourseBlock(entry, 0))
    .filter((entry): entry is StructuredLearningResource =>
      entry !== null && ["table", "sign_table", "variation_table", "graph", "figure"].includes(entry.type),
    )
    .slice(0, 2);
}

function normalizeExerciseQuestion(value: unknown): StructuredExerciseQuestion | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const options = Array.isArray(raw.options)
    ? raw.options.map(normalizeStructuredRichText).filter((option) => option.parts.length > 0)
    : [];
  const indexesRaw = Array.isArray(raw.correct_option_indexes)
    ? raw.correct_option_indexes
    : Array.isArray(raw.correctOptionIndexes)
      ? raw.correctOptionIndexes
      : raw.correct_option_index !== undefined
        ? [raw.correct_option_index]
        : [];
  const correctOptionIndexes = indexesRaw
    .map((index) => Math.trunc(finiteNumber(index, -1)))
    .filter((index, position, array) => index >= 0 && index < options.length && array.indexOf(index) === position);
  const pairs = Array.isArray(raw.pairs)
    ? raw.pairs
        .map((pair) => {
          const record = asRecord(pair);
          if (!record) return null;
          const left = normalizeStructuredRichText(record.left);
          const right = normalizeStructuredRichText(record.right);
          return left.parts.length > 0 && right.parts.length > 0 ? { left, right } : null;
        })
        .filter(
          (pair): pair is { left: StructuredRichText; right: StructuredRichText } =>
            pair !== null,
        )
    : [];
  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizeStructuredRichText).filter((item) => item.parts.length > 0)
    : [];

  const prompt = normalizeStructuredRichText(raw.prompt ?? raw.question ?? raw.title);
  if (prompt.parts.length === 0) return null;

  return {
    prompt,
    content: normalizeStructuredRichText(raw.content ?? raw.support ?? raw.statement),
    answer: normalizeStructuredRichText(raw.answer ?? raw.correct_answer ?? raw.correctAnswer),
    explanation: normalizeStructuredRichText(raw.explanation ?? raw.solution),
    points: clamp(Math.trunc(finiteNumber(raw.points, 2)), 1, 20),
    options,
    correctOptionIndexes,
    acceptedAnswers: normalizeAcceptedAnswers(
      raw.accepted_answers ?? raw.acceptedAnswers ?? raw.blanks,
    ),
    pairs,
    items,
    resources: normalizeLearningResources(raw.resources ?? raw.resource),
  };
}

export function normalizeStructuredExerciseDraft(
  value: unknown,
  expectedQuestionCount: number,
): StructuredExerciseDraft {
  const raw = asRecord(value) ?? {};
  const introductionRaw = Array.isArray(raw.introduction)
    ? raw.introduction
    : raw.introduction !== undefined
      ? [raw.introduction]
      : [];
  const questionsRaw = Array.isArray(raw.questions)
    ? raw.questions
    : Array.isArray(raw.blocks)
      ? raw.blocks
      : [];
  return {
    title: sanitizeStructuredText(raw.title) || "Exercice",
    description: sanitizeStructuredText(raw.description),
    introduction: introductionRaw
      .map(normalizeStructuredRichText)
      .filter((paragraph) => paragraph.parts.length > 0),
    questions: questionsRaw
      .map(normalizeExerciseQuestion)
      .filter((question): question is StructuredExerciseQuestion => question !== null)
      .slice(0, expectedQuestionCount),
  };
}

function normalizeQuizQuestion(value: unknown): StructuredQuizQuestion | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const text = normalizeStructuredRichText(raw.text ?? raw.question ?? raw.prompt);
  const options = Array.isArray(raw.options)
    ? raw.options.map(normalizeStructuredRichText).filter((option) => option.parts.length > 0)
    : [];
  if (text.parts.length === 0 || options.length < 2) return null;
  return {
    text,
    options: options.slice(0, 6),
    correctOptionIndex: clamp(
      Math.trunc(finiteNumber(raw.correct_option_index ?? raw.correctOptionIndex, 0)),
      0,
      options.length - 1,
    ),
    explanation: normalizeStructuredRichText(raw.explanation ?? raw.solution),
    points: clamp(Math.trunc(finiteNumber(raw.points, 1)), 1, 20),
    resources: normalizeLearningResources(raw.resources ?? raw.resource).slice(0, 1),
  };
}

export function normalizeStructuredQuizDraft(
  value: unknown,
  expectedQuestionCount: number,
): StructuredQuizDraft {
  const raw = asRecord(value) ?? {};
  const questionsRaw = Array.isArray(raw.questions) ? raw.questions : [];
  return {
    title: sanitizeStructuredText(raw.title) || "Quiz",
    description: sanitizeStructuredText(raw.description),
    timeLimit: clamp(Math.trunc(finiteNumber(raw.time_limit ?? raw.timeLimit, 10)), 1, 180),
    maxAttempts: clamp(Math.trunc(finiteNumber(raw.max_attempts ?? raw.maxAttempts, 3)), 1, 20),
    questions: questionsRaw
      .map(normalizeQuizQuestion)
      .filter((question): question is StructuredQuizQuestion => question !== null)
      .slice(0, expectedQuestionCount),
  };
}

type MathReference = {
  id: string;
  path: string;
  getLatex: () => string;
  setLatex: (latex: string) => void;
  fallback: (readable: string) => void;
};

function collectMathReferences(root: unknown): MathReference[] {
  const references: MathReference[] = [];
  let counter = 1;

  const visit = (
    value: unknown,
    path: string,
    parent?: Record<string, unknown> | unknown[],
    key?: string | number,
  ) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`, value, index));
      return;
    }
    const record = asRecord(value);
    if (!record) return;

    if (record.type === "math" && typeof record.latex === "string") {
      const id = `formula-${counter++}`;
      references.push({
        id,
        path,
        getLatex: () => stringValue(record.latex),
        setLatex: (latex) => {
          record.latex = latex;
        },
        fallback: (readable) => {
          if (Array.isArray(parent) && typeof key === "number") {
            parent[key] = { type: "text", value: readable };
          } else {
            record.type = "text";
            delete record.latex;
            record.value = readable;
          }
        },
      });
      return;
    }

    if (record.type === "display_math" && typeof record.latex === "string") {
      const id = `formula-${counter++}`;
      references.push({
        id,
        path,
        getLatex: () => stringValue(record.latex),
        setLatex: (latex) => {
          record.latex = latex;
          delete record.fallbackText;
        },
        fallback: (readable) => {
          record.type = "paragraph";
          delete record.latex;
          delete record.fallbackText;
          record.content = {
            parts: [{ type: "text", value: readable }],
          };
        },
      });
    }

    for (const [childKey, childValue] of Object.entries(record)) {
      if (childKey === "latex") continue;
      visit(childValue, `${path}.${childKey}`, record, childKey);
    }
  };

  visit(root, "root");
  return references;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function issueForReference(reference: MathReference): StructuredMathIssue | null {
  const latex = normalizeStructuredLatex(reference.getLatex());
  reference.setLatex(latex);
  if (isStructuredLatexValid(latex)) return null;
  return {
    id: reference.id,
    path: reference.path,
    latex,
    error: getKatexError(latex),
  };
}

/**
 * Valide toutes les formules du JSON structuré. Une seule petite requête de
 * correction est faite pour les formules invalides, jamais pour le chapitre
 * entier. Une formule encore invalide est transformée en texte lisible : elle
 * ne peut donc jamais atteindre le rendu entourée de délimiteurs mathématiques.
 */
export async function repairInvalidStructuredMath<T>(
  input: T,
  options: {
    generate?: StructuredGenerator;
    label: string;
    enableModelRepair?: boolean;
  },
): Promise<{ value: T; report: StructuredMathRepairReport }> {
  const value = cloneJson(input);
  const references = collectMathReferences(value);
  let issues = references
    .map(issueForReference)
    .filter((issue): issue is StructuredMathIssue => issue !== null);
  const invalidBefore = issues.length;
  let repairedByModel = 0;

  if (
    issues.length > 0 &&
    options.generate &&
    options.enableModelRepair !== false
  ) {
    const systemPrompt = `Tu es un correcteur de syntaxe LaTeX compatible KaTeX.
Tu reçois une liste de formules isolées. Corrige uniquement leur syntaxe sans changer leur sens mathématique.
RÈGLES :
• Retourne uniquement {"repairs":[{"id":"formula-1","latex":"..."}]}.
• Le champ latex ne contient aucun $, aucun HTML, aucune phrase autour.
• Utilise l'échappement JSON normal pour les antislashs.
• Ne supprime aucune formule et ne change aucun identifiant.
• Si une formule contient de la prose nécessaire, place cette prose dans \\text{...}.
• Chaque formule doit compiler avec KaTeX.`;
    const userPrompt = `Contexte : ${sanitizeStructuredText(options.label)}

FORMULES À CORRIGER :
${JSON.stringify({ formulas: issues.map(({ id, latex, error }) => ({ id, latex, error })) })}`;

    try {
      const raw = await options.generate(
        userPrompt,
        systemPrompt,
        mathRepairSchema(issues.length),
        0,
        Math.min(5_000, 700 + issues.length * 350),
        false,
      );
      const result = asRecord(raw);
      const repairs = Array.isArray(result?.repairs) ? result.repairs : [];
      const byId = new Map(references.map((reference) => [reference.id, reference]));
      for (const repair of repairs) {
        const repairRecord = asRecord(repair);
        if (!repairRecord) continue;
        const id = stringValue(repairRecord.id);
        const reference = byId.get(id);
        if (!reference) continue;
        const latex = normalizeStructuredLatex(repairRecord.latex);
        if (!isStructuredLatexValid(latex)) continue;
        reference.setLatex(latex);
        repairedByModel += 1;
      }
    } catch (error) {
      console.warn(
        `[structured-math] Correction ciblée indisponible pour ${options.label}. Repli déterministe utilisé.`,
        error,
      );
    }
  }

  issues = references
    .map(issueForReference)
    .filter((issue): issue is StructuredMathIssue => issue !== null);

  const remainingById = new Map(issues.map((issue) => [issue.id, issue]));
  let fallbackCount = 0;
  for (const reference of references) {
    const issue = remainingById.get(reference.id);
    if (!issue) continue;
    const readable =
      sanitizeStructuredText(mathToReadableText(issue.latex)) ||
      "Formule mathématique non disponible";
    reference.fallback(readable);
    fallbackCount += 1;
  }

  const remainingInvalid = collectMathReferences(value)
    .map(issueForReference)
    .filter((issue): issue is StructuredMathIssue => issue !== null);

  return {
    value,
    report: {
      invalidBefore,
      repairedByModel,
      fallbackCount,
      remainingInvalid,
    },
  };
}

export function structuredCourseWordCount(chapter: StructuredCourseChapter): number {
  const words: string[] = [];
  const visitRich = (rich: StructuredRichText | undefined) => {
    if (!rich) return;
    words.push(structuredRichTextToPlainText(rich));
  };
  const visitBlocks = (blocks: StructuredCourseBlock[]) => {
    for (const block of blocks) {
      switch (block.type) {
        case "heading":
        case "paragraph":
          visitRich(block.content);
          break;
        case "list":
          block.items.forEach(visitRich);
          break;
        case "callout":
          visitRich(block.title);
          block.paragraphs.forEach(visitRich);
          break;
        case "table":
          block.headers.forEach(visitRich);
          block.rows.flat().forEach(visitRich);
          break;
        case "sign_table":
          visitRich(block.expression);
          block.boundaries.forEach(visitRich);
          break;
        case "variation_table":
          visitRich(block.variable);
          visitRich(block.functionName);
          block.points.forEach(visitRich);
          block.values.forEach(visitRich);
          break;
        case "figure":
          block.elements.forEach((element) => visitRich(element.label));
          break;
        case "steps":
          block.steps.forEach((step) => {
            visitRich(step.title);
            visitBlocks(step.blocks);
          });
          break;
        default:
          break;
      }
    }
  };
  chapter.lessons.forEach((lesson) => visitBlocks(lesson.blocks));
  return words
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}
