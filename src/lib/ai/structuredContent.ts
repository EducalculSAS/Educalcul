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
      variant: "value" | "sign" | "variation";
      headers: StructuredRichText[];
      rows: StructuredRichText[][];
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
  | {
      type: "interactive_vectors";
      uLabel: string;
      vLabel: string;
      showProjection: boolean;
      caption: string;
      ox: number;
      oy: number;
      ux: number;
      uy: number;
      vx: number;
      vy: number;
    };

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
{"type":"display_math","latex":"\\\\begin{aligned}a&=b\\\\\\\\c&=d\\\\end{aligned}"}
4. Liste :
{"type":"list","ordered":false,"items":[RICH_TEXT,RICH_TEXT]}
5. Encadré :
{"type":"callout","variant":"note","title":RICH_TEXT,"paragraphs":[RICH_TEXT]}
variant vaut "note" ou "warning". Le champ title est toujours présent.
6. Tableau :
{"type":"table","variant":"value","headers":[RICH_TEXT,RICH_TEXT],"rows":[[RICH_TEXT,RICH_TEXT]]}
variant vaut "value", "sign" ou "variation".
7. Graphique de fonction :
{"type":"graph","expression":"exp(x)","xmin":-5,"xmax":5,"caption":"Description courte sans LaTeX","parameter":null}
Pour une famille paramétrée, remplace null par {"name":"a","min":-3,"max":3,"default":1} et utilise a dans expression.
8. Emplacement d'exercice :
{"type":"exercise","exercise_index":1}
exercise_index est la position 1, 2, 3... de l'exercice dans le tableau exercises de CETTE leçon.
9. Démonstration en étapes :
{"type":"steps","steps":[{"title":RICH_TEXT,"blocks":[BLOCS]},{"title":RICH_TEXT,"blocks":[BLOCS]}]}
Le champ title est toujours présent dans chaque étape.
10. Vecteurs interactifs :
{"type":"interactive_vectors","u_label":"u","v_label":"v","show_projection":true,"caption":"Description courte","ox":150,"oy":100,"ux":220,"uy":55,"vx":255,"vy":115}
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

function mergeAdjacentText(parts: StructuredRichTextPart[]): StructuredRichTextPart[] {
  const merged: StructuredRichTextPart[] = [];
  for (const part of parts) {
    if (!part.type) continue;
    const previous = merged[merged.length - 1];
    if (part.type === "text" && previous?.type === "text") {
      previous.value = `${previous.value}${part.value}`;
    } else {
      merged.push(part);
    }
  }
  return merged;
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
      const variantRaw = stringValue(raw.variant).toLowerCase();
      const variant =
        variantRaw === "sign" || variantRaw === "variation" ? variantRaw : "value";
      const headers = Array.isArray(raw.headers)
        ? raw.headers.map(normalizeStructuredRichText)
        : [];
      const rows = Array.isArray(raw.rows)
        ? raw.rows
            .filter(Array.isArray)
            .map((row) => (row as unknown[]).map(normalizeStructuredRichText))
        : [];
      return { type: "table", variant, headers, rows };
    }
    case "graph": {
      const parameterRaw = asRecord(raw.parameter);
      const name = sanitizeStructuredText(parameterRaw?.name).replace(/[^A-Za-z]/g, "").slice(0, 2);
      const parameter = parameterRaw && name
        ? {
            name,
            min: finiteNumber(parameterRaw.min, -3),
            max: finiteNumber(parameterRaw.max, 3),
            default: finiteNumber(parameterRaw.default, 1),
          }
        : undefined;
      return {
        type: "graph",
        expression: sanitizeGraphExpression(raw.expression ?? raw.function ?? raw.data_function),
        xmin: finiteNumber(raw.xmin, -5),
        xmax: finiteNumber(raw.xmax, 5),
        caption: sanitizeStructuredText(raw.caption),
        parameter,
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
    case "interactive_vectors":
      return {
        type: "interactive_vectors",
        uLabel: sanitizeStructuredText(raw.u_label ?? raw.uLabel ?? "u") || "u",
        vLabel: sanitizeStructuredText(raw.v_label ?? raw.vLabel ?? "v") || "v",
        showProjection: raw.show_projection !== false && raw.showProjection !== false,
        caption: sanitizeStructuredText(raw.caption),
        ox: clamp(finiteNumber(raw.ox, 150), 0, 300),
        oy: clamp(finiteNumber(raw.oy, 100), 0, 200),
        ux: clamp(finiteNumber(raw.ux, 220), 0, 300),
        uy: clamp(finiteNumber(raw.uy, 55), 0, 200),
        vx: clamp(finiteNumber(raw.vx, 255), 0, 300),
        vy: clamp(finiteNumber(raw.vy, 115), 0, 200),
      };
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
