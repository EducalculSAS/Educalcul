import { mathRepairSchema, JsonSchemaContract } from "@/lib/ai/schemas";
import katex from "katex";


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


export const ENTITY_MAP: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};


export const UNICODE_MATH_REPLACEMENTS: Array<[RegExp, string]> = [
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


export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}


export function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}


export function decodeEntities(value: string): string {
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


export function stripOuterMathDelimiters(value: string): string {
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


export function balanceLatexBraces(value: string): string {
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


export function transformOutsideTextLikeCommands(
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


export function deterministicLatexError(latex: string): string {
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
    .replace(/\\begin\{(?:array|tabular)\}\{[^{}]*\}/g, " ")
    .replace(/\\hline\b/g, " ")
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


export function getKatexError(latex: string): string {
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


export type MathReference = {
  id: string;
  path: string;
  getLatex: () => string;
  setLatex: (latex: string) => void;
  fallback: (readable: string) => void;
};


export function collectMathReferences(root: unknown): MathReference[] {
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


export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}


export function issueForReference(reference: MathReference): StructuredMathIssue | null {
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
    // Jamais de texte d'erreur montré à l'élève : à défaut de lecture propre, la formule brute débarrassée des commandes.
    const readable =
      sanitizeStructuredText(mathToReadableText(issue.latex)) ||
      sanitizeStructuredText(issue.latex.replace(/\\[a-zA-Z]+/g, " ").replace(/[{}]/g, "").replace(/\s+/g, " ").trim()) ||
      "…";
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
