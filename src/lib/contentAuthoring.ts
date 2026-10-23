import katex from "katex";
import { evaluateExpression, formatFrac, fracEquals, parseNumericAnswer, type Frac } from "@/lib/exprEval";
import { arithmeticExplanation, arithmeticResult, arithmeticStatement, makeArithmeticVariants, parseArithmeticItem } from "@/lib/primaryExercises";

/**
 * Outils de rédaction à la main pour les exercices : saisie rapide (texte ou tableur → blocs), vérificateur,
 * variantes d'un calcul, duplication. Tout est calculé en code (aucun appel à un modèle) : une réponse est
 * calculée ou vérifiée par un calcul exact, jamais « devinée ».
 *
 * Les blocs produits ont la forme de ceux de l'éditeur d'exercices (ExerciseBuilder) : `content` en HTML avec
 * les formules en `$...$`.
 */

export type AuthoringBlockType = "text_input" | "qcm" | "true_false" | "fill_in_the_blank";

export interface AuthoringBlock {
  id: string;
  type: string;
  title: string;
  content?: string;
  points?: number;
  options?: string[];
  correctAnswer?: string | string[];
  explanation?: string;
  blanks?: string[];
  pairs?: { left: string; right: string }[];
  items?: string[];
  categories?: string[];
  categoryItems?: { text: string; category: string }[];
  figureSpec?: unknown;
  [key: string]: unknown;
}

export interface AuthoringPage {
  id: string;
  title: string;
  blocks: AuthoringBlock[];
  [key: string]: unknown;
}

type Rng = () => number;

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/*  Texte ⇄ HTML                                                       */
/* ------------------------------------------------------------------ */

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Texte brut avec `$...$` → HTML : le texte est échappé, les formules sont conservées telles quelles. */
export function plainToHtml(value: string): string {
  const html = value
    .split(/(\$[^$]*\$)/g)
    .map((part) => (part.startsWith("$") && part.endsWith("$") && part.length >= 2 ? part : escapeHtml(part)))
    .join("")
    .replace(/\n+/g, "<br>");
  return `<p>${html}</p>`;
}

/** HTML d'un énoncé → texte brut (formules `$...$` conservées). */
export function htmlToPlain(html: string | undefined): string {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/* ------------------------------------------------------------------ */
/*  Saisie rapide                                                      */
/* ------------------------------------------------------------------ */

const CALC_OPERATOR = /[+\-*/()]|\\times|\\div|\\frac|\\cdot/;

/**
 * Valeur exacte du calcul d'un énoncé : « $A = 3 + 4$ » (expression à droite du =) comme « $12 + 8 =$ »
 * (expression à gauche d'un = final). null si l'énoncé n'est pas UN calcul.
 */
function evaluateCalculation(text: string): Frac | null {
  const segments = [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
  if (segments.length !== 1) return null;
  const raw = segments[0];
  const hasOperator = (expr: string) => CALC_OPERATOR.test(expr.replace(/^\s*[+-]/, ""));
  const eq = raw.indexOf("=");
  let expr: string;
  if (eq < 0) expr = raw;
  else if (!raw.slice(eq + 1).trim()) expr = raw.slice(0, eq);
  // « A = expression » : seule une étiquette (une lettre) peut précéder le = ; « x^2 = 9 » est une équation, pas un calcul.
  else if (/^\s*[A-Za-z](?:_\{?\w+\}?)?\s*$/.test(raw.slice(0, eq))) expr = raw.slice(eq + 1);
  else return null;
  if (!hasOperator(expr)) return null;
  try {
    return evaluateExpression(expr);
  } catch {
    return null;
  }
}

/** Un calcul écrit « à la main » (« 12 + 8 = », « (-5,5) - (+3) ») devient du LaTeX : $12 + 8 =$. */
function normalizeStatement(raw: string): string {
  const s = raw.trim();
  if (!s || s.includes("$")) return s;
  const looksLikeCalc = /^[\d\s+\-−–×x*÷:/().,=▢_…]+$/i.test(s) && /\d/.test(s) && /[+\-−–×x*÷:/]/.test(s.replace(/^\s*[-−–+]/, ""));
  if (!looksLikeCalc) return s;
  const latex = s
    .replace(/[=\s▢_…]+$/g, "")
    .replace(/−|–/g, "-")
    .replace(/(\d)\s*[x*]\s*(?=[\d(])/gi, "$1 \\times ")
    .replace(/×/g, "\\times ")
    .replace(/÷|(\d)\s*[:/]\s*(?=[\d(])/g, (m, d) => `${d ?? ""} \\div `)
    .replace(/(\d),(\d)/g, "$1{,}$2")
    .replace(/\s+/g, " ")
    .trim();
  return `$${latex} =$`;
}

export interface BlockFields {
  statement: string;
  answer?: string;
  explanation?: string;
  /** Force le type : "qcm" | "vf" | "trous" | "libre" (sinon deviné). */
  type?: string;
  index?: number;
}

export interface BuiltBlock {
  block: AuthoringBlock;
  /** Remarques sur la ligne : réponse calculée, réponse qui ne correspond pas au calcul, QCM sans bonne réponse... */
  notes: string[];
}

const TRUE_WORDS = /^(vrai|true|v|oui)$/i;
const FALSE_WORDS = /^(faux|false|f|non)$/i;

function latexNumber(text: string): string {
  return text.replace(/(\d),(\d)/g, "$1{,}$2");
}

/** Construit UN bloc d'exercice depuis une ligne (énoncé, réponse, explication). */
export function blockFromFields(fields: BlockFields): BuiltBlock {
  const notes: string[] = [];
  const title = `Question ${fields.index ?? 1}`;
  const answerRaw = (fields.answer ?? "").trim();
  const explanationRaw = (fields.explanation ?? "").trim();
  const forced = (fields.type ?? "").trim().toLowerCase();
  const base = { id: newId(), title, points: 1 };

  // Texte à trous : « 3 + ▢ = 8 » ou « 3 + ___ = 8 », réponses séparées par « ; ».
  const holePattern = /▢|_{3,}|…{2,}|\.{4,}/g;
  const holeCount = (fields.statement.match(holePattern) ?? []).length;
  if (forced === "trous" || (!forced && holeCount > 0 && answerRaw)) {
    let n = 0;
    const text = fields.statement.replace(holePattern, () => `{{${++n}}}`);
    const blanks = answerRaw.split(";").map((b) => b.trim());
    if (n === 0) notes.push("aucun trou (▢ ou ___) dans l'énoncé");
    else if (blanks.length !== n || blanks.some((b) => !b)) notes.push(`${n} trou(s) mais ${blanks.filter(Boolean).length} réponse(s) (sépare-les par « ; »)`);
    return { block: { ...base, type: "fill_in_the_blank", content: plainToHtml(normalizeStatement(text)), blanks, explanation: explanationRaw ? plainToHtml(explanationRaw) : "" }, notes };
  }

  // QCM : « Paris* ; Lyon ; Nice » — les bonnes réponses portent une étoile.
  const optionParts = answerRaw.split(";").map((o) => o.trim()).filter(Boolean);
  if (forced === "qcm" || (!forced && optionParts.length >= 2 && optionParts.some((o) => o.endsWith("*")))) {
    const options = optionParts.map((o) => o.replace(/\*+$/, "").trim());
    const correct = optionParts.filter((o) => o.endsWith("*")).map((o) => o.replace(/\*+$/, "").trim());
    if (options.length < 2) notes.push("un QCM demande au moins 2 options, séparées par « ; »");
    if (correct.length === 0) notes.push("aucune bonne réponse : ajoute une * après la bonne option");
    return { block: { ...base, type: "qcm", content: plainToHtml(normalizeStatement(fields.statement)), options, correctAnswer: correct, explanation: explanationRaw ? plainToHtml(explanationRaw) : "" }, notes };
  }

  // Vrai / faux
  if (forced === "vf" || (!forced && (TRUE_WORDS.test(answerRaw) || FALSE_WORDS.test(answerRaw)) && !evaluateCalculation(normalizeStatement(fields.statement)))) {
    const isTrue = TRUE_WORDS.test(answerRaw);
    if (!isTrue && !FALSE_WORDS.test(answerRaw)) notes.push("réponse « vrai » ou « faux » attendue");
    return { block: { ...base, type: "true_false", content: plainToHtml(normalizeStatement(fields.statement)), correctAnswer: isTrue ? "true" : "false", explanation: explanationRaw ? plainToHtml(explanationRaw) : "" }, notes };
  }

  // Réponse libre (calcul ou réponse courte) : la réponse manquante d'un calcul est calculée.
  const statement = normalizeStatement(fields.statement);
  const computed = evaluateCalculation(statement);
  let answer = answerRaw;
  let explanation = explanationRaw;
  if (computed) {
    const exact = formatFrac(computed);
    if (!answerRaw) {
      answer = exact;
      notes.push(`réponse calculée : ${exact}`);
      if (!explanationRaw) {
        const expr = (htmlToPlain(statement).match(/\$([^$]+)\$/)?.[1] ?? "").replace(/=\s*$/, "").replace(/^.*?=/, "").trim();
        explanation = expr ? `On calcule : $${expr} = ${latexNumber(exact)}$.` : "";
      }
    } else {
      const given = parseNumericAnswer(answerRaw);
      if (given && !fracEquals(given, computed)) notes.push(`⚠ ta réponse (${answerRaw}) ne correspond pas au calcul, qui donne ${exact}`);
    }
  } else if (!answerRaw) {
    notes.push("réponse manquante");
  }
  return { block: { ...base, type: "text_input", content: plainToHtml(statement), correctAnswer: answer, explanation: explanation ? plainToHtml(explanation) : "" }, notes };
}

export interface QuickEntryGroup {
  /** Titre de page donné par une ligne « # Titre » ou une colonne « page » ; null = blocs sans page nommée. */
  title: string | null;
  blocks: AuthoringBlock[];
}

export interface QuickEntryResult {
  groups: QuickEntryGroup[];
  /** Remarques par ligne : [numéro de ligne, texte]. */
  notes: [number, string][];
  total: number;
}

/** Découpe un texte CSV / tableur (guillemets, séparateur « ; », « , » ou tabulation détecté sur la 1re ligne). */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delimiter = count("\t") > 0 ? "\t" : count(";") >= count(",") && count(";") > 0 ? ";" : count(",") > 0 ? "," : ";";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const COLUMN_NAMES: Record<string, string> = {
  énoncé: "statement", enonce: "statement", énonce: "statement", question: "statement", calcul: "statement",
  réponse: "answer", reponse: "answer", réponses: "answer", reponses: "answer", answer: "answer", solution: "answer",
  explication: "explanation", explanation: "explanation", correction: "explanation",
  type: "type",
  page: "page", partie: "page", titre: "page", exercice: "page",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Lignes de saisie rapide ou tableau → blocs.
 * - Texte : une question par ligne, « énoncé | réponse | explication » (ou colonnes collées depuis Excel, séparées par une tabulation).
 *   Une ligne « # Titre » commence une nouvelle page.
 * - Tableau (CSV) : première ligne = en-têtes (énoncé, réponse, explication, type, page) ; sans en-têtes, dans cet ordre.
 */
export function parseQuickEntry(text: string, options: { startIndex?: number; table?: boolean } = {}): QuickEntryResult {
  const groups: QuickEntryGroup[] = [];
  const notes: [number, string][] = [];
  let current: QuickEntryGroup | null = null;
  let counter = 0;
  const start = options.startIndex ?? 0;

  const group = (title: string | null) => {
    if (!current || current.title !== title) {
      current = groups.find((g) => g.title === title) ?? null;
      if (!current) {
        current = { title, blocks: [] };
        groups.push(current);
      }
    }
    return current;
  };
  const add = (fields: BlockFields, pageTitle: string | null, lineNumber: number) => {
    if (!fields.statement.trim()) return;
    counter += 1;
    const target = group(pageTitle ?? current?.title ?? null);
    const built = blockFromFields({ ...fields, index: start + target.blocks.length + 1 });
    target.blocks.push(built.block);
    for (const note of built.notes) notes.push([lineNumber, note]);
  };

  if (options.table) {
    const rows = parseDelimited(text);
    if (rows.length === 0) return { groups, notes, total: 0 };
    const header = rows[0].map((h) => COLUMN_NAMES[stripAccents(h.trim().toLowerCase())] ?? COLUMN_NAMES[h.trim().toLowerCase()]);
    const hasHeader = header.includes("statement");
    const columns = hasHeader ? header : ["statement", "answer", "explanation", "type", "page"];
    (hasHeader ? rows.slice(1) : rows).forEach((cells, i) => {
      const pick = (name: string) => {
        const at = columns.indexOf(name);
        return at >= 0 ? (cells[at] ?? "").trim() : "";
      };
      add({ statement: pick("statement"), answer: pick("answer"), explanation: pick("explanation"), type: pick("type") }, pick("page") || null, i + (hasHeader ? 2 : 1));
    });
    return { groups, notes, total: counter };
  }

  text.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const heading = /^#{1,3}\s*(.+)$/.exec(trimmed);
    if (heading) {
      group(heading[1].trim());
      return;
    }
    const cells = (trimmed.includes("\t") ? trimmed.split("\t") : trimmed.split(/(?<!\\)\|/)).map((c) => c.replace(/\\\|/g, "|").trim());
    add({ statement: cells[0] ?? "", answer: cells[1], explanation: cells[2], type: cells[3] }, null, i + 1);
  });
  return { groups, notes, total: counter };
}

/* ------------------------------------------------------------------ */
/*  Variantes d'un calcul                                              */
/* ------------------------------------------------------------------ */

const randInt = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

function cloneBlock(block: AuthoringBlock): AuthoringBlock {
  return { ...JSON.parse(JSON.stringify(block)), id: newId() };
}

/** Duplique un bloc (nouvel identifiant). */
export function duplicateBlock(block: AuthoringBlock): AuthoringBlock {
  return cloneBlock(block);
}

/** Duplique une page et tous ses blocs (nouveaux identifiants). */
export function duplicatePage<P extends AuthoringPage>(page: P): P {
  return { ...JSON.parse(JSON.stringify(page)), id: newId(), title: `${page.title} (copie)`, blocks: page.blocks.map(cloneBlock) };
}

export interface VariantResult {
  blocks: AuthoringBlock[];
  reason?: string;
}

const NUMBER_TOKEN = /\d+(?:\{,\}\d+|\.\d+)?/g;

/**
 * Nouveaux calculs de même forme, avec d'autres nombres, réponse recalculée exactement. Uniquement pour une
 * réponse libre dont l'énoncé est UN calcul (entiers, décimaux, relatifs, fractions, parenthèses, + − × ÷).
 */
export function makeVariants(block: AuthoringBlock, count: number, rng: Rng = Math.random): VariantResult {
  const none = (reason: string): VariantResult => ({ blocks: [], reason });
  if (block.type !== "text_input") return none("Les variantes automatiques existent pour les calculs en « Réponse libre ».");
  const plain = htmlToPlain(block.content);

  // 1. Calcul simple entre deux entiers (« 12 + 8 », « 24 × 6 ») : mêmes opérations, ordres de grandeur voisins.
  const simple = parseArithmeticItem(plain.replace(/\\times/g, "×").replace(/\\div/g, "÷"));
  // Un résultat négatif (15 − 20) est un calcul sur les relatifs : les variantes « simples » ne le garderaient pas.
  if (simple && arithmeticResult(simple) >= 0) {
    return {
      blocks: makeArithmeticVariants([simple], count, rng).map((item) => ({
        ...cloneBlock(block),
        content: plainToHtml(arithmeticStatement(item)),
        correctAnswer: String(arithmeticResult(item)),
        explanation: plainToHtml(arithmeticExplanation(item)),
      })),
    };
  }

  // 2. Expression plus riche : les nombres sont changés, le résultat est recalculé et doit rester « propre ».
  const segments = [...plain.matchAll(/\$([^$]+)\$/g)];
  if (segments.length !== 1 || !evaluateCalculation(plain)) return none("Cet énoncé n'est pas un calcul simple à une seule expression : crée la variante à la main (Dupliquer).");
  const segment = segments[0];
  const raw = segment[1];
  const eq = raw.indexOf("=");
  // « A = expression » : on change l'expression à droite ; « expression = » : celle de gauche.
  const rightBlank = eq >= 0 && !raw.slice(eq + 1).trim();
  const left = eq >= 0 && !rightBlank ? raw.slice(0, eq + 1) : "";
  const right = eq < 0 ? raw : rightBlank ? raw.slice(0, eq) : raw.slice(eq + 1);
  const suffix = rightBlank ? raw.slice(eq) : "";
  const originalExact = formatFrac(evaluateExpression(right));
  const wantFraction = originalExact.includes("/");
  const seen = new Set([right.replace(/\s+/g, "")]);
  const blocks: AuthoringBlock[] = [];

  for (let k = 0; k < count; k++) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const mutated = right.replace(NUMBER_TOKEN, (token) => {
        const decimals = /\{,\}(\d+)$|\.(\d+)$/.exec(token);
        const places = decimals ? (decimals[1] ?? decimals[2]).length : 0;
        const value = Number(token.replace("{,}", "."));
        if (value === 0) return token;
        const next = Math.max(places ? Math.pow(10, -places) : 1, value + randInt(rng, -3, 6) * (places ? Math.pow(10, -places) * 10 : 1));
        return next.toFixed(places).replace(".", "{,}");
      });
      const key = mutated.replace(/\s+/g, "");
      if (seen.has(key)) continue;
      let exact: string;
      try {
        exact = formatFrac(evaluateExpression(mutated));
      } catch {
        continue;
      }
      if (!wantFraction && exact.includes("/")) continue;
      seen.add(key);
      const newPlain = plain.replace(segment[0], `$${left}${mutated}${suffix}$`);
      blocks.push({
        ...cloneBlock(block),
        content: plainToHtml(newPlain),
        correctAnswer: exact,
        explanation: plainToHtml(`On calcule : $${mutated.trim()} = ${latexNumber(exact)}$.`),
      });
      break;
    }
  }
  return blocks.length > 0 ? { blocks } : none("Aucune variante propre trouvée pour ce calcul.");
}

/* ------------------------------------------------------------------ */
/*  Vérificateur                                                       */
/* ------------------------------------------------------------------ */

export interface AuthoringIssue {
  pageIndex: number;
  blockIndex: number;
  pageTitle: string;
  blockTitle: string;
  severity: "error" | "warn";
  message: string;
}

const NON_QUESTION = new Set(["text", "image"]);

function formulaProblem(html: string | undefined): string | null {
  const plain = htmlToPlain(html);
  if (!plain.includes("$")) return null;
  const dollars = (plain.replace(/\\\$/g, "").match(/\$/g) ?? []).length;
  if (dollars % 2 === 1) return "un « $ » n'est pas refermé (formule coupée)";
  for (const [, tex] of plain.matchAll(/\$([^$]+)\$/g)) {
    try {
      katex.renderToString(tex, { throwOnError: true, strict: "ignore" });
    } catch (error) {
      return `formule illisible « ${tex.slice(0, 40)} » : ${error instanceof Error ? error.message.replace(/^KaTeX parse error:\s*/, "").slice(0, 80) : "erreur"}`;
    }
  }
  return null;
}

function normalizedKey(html: string | undefined): string {
  return htmlToPlain(html).toLowerCase().replace(/[\s$\\{}]/g, "");
}

/** Contrôle d'un exercice avant enregistrement : réponses fausses, champs vides, formules illisibles, doublons. */
export function checkExercise(pages: AuthoringPage[]): AuthoringIssue[] {
  const issues: AuthoringIssue[] = [];
  const seen = new Map<string, string>();
  pages.forEach((page, pageIndex) => {
    page.blocks.forEach((block, blockIndex) => {
      const add = (severity: "error" | "warn", message: string) =>
        issues.push({ pageIndex, blockIndex, pageTitle: page.title, blockTitle: block.title || `Bloc ${blockIndex + 1}`, severity, message });
      const plain = htmlToPlain(block.content);
      if (block.type === "image") {
        if (!String(block.content ?? "").trim()) add("error", "aucun fichier téléversé");
        return;
      }
      if (!plain) {
        add("error", block.type === "text" ? "bloc de texte vide" : "énoncé vide");
        if (NON_QUESTION.has(block.type)) return;
      }
      for (const field of [block.content, block.explanation, ...(block.options ?? [])]) {
        const problem = formulaProblem(field);
        if (problem) {
          add("error", problem);
          break;
        }
      }
      if (NON_QUESTION.has(block.type)) return;

      const key = normalizedKey(block.content);
      if (key) {
        const previous = seen.get(key);
        if (previous) add("warn", `même énoncé que « ${previous} »`);
        else seen.set(key, block.title || `Bloc ${blockIndex + 1}`);
      }
      if (!htmlToPlain(block.explanation)) add("warn", "pas d'explication (l'élève ne verra pas la correction détaillée)");
      if (!block.points) add("warn", "aucun point attribué");

      const answer = Array.isArray(block.correctAnswer) ? block.correctAnswer.join(" ; ") : String(block.correctAnswer ?? "").trim();
      switch (block.type) {
        case "text_input": {
          if (!answer) {
            add("error", "réponse attendue vide");
            break;
          }
          const exact = evaluateCalculation(plain);
          if (exact) {
            const given = parseNumericAnswer(answer);
            if (!given) add("warn", `le calcul donne ${formatFrac(exact)} mais la réponse (« ${answer} ») n'est pas un nombre seul`);
            else if (!fracEquals(given, exact)) add("error", `réponse fausse : « ${answer} », mais le calcul donne ${formatFrac(exact)}`);
          }
          break;
        }
        case "qcm":
        case "single_choice":
        case "multiple_choice": {
          const options = (block.options ?? []).map((o) => o.trim());
          const correct = Array.isArray(block.correctAnswer) ? block.correctAnswer : block.correctAnswer ? [block.correctAnswer] : [];
          if (options.length < 2) add("error", "moins de 2 options");
          if (options.some((o) => !o)) add("error", "une option est vide");
          if (new Set(options.map((o) => o.toLowerCase())).size < options.length) add("warn", "deux options identiques");
          if (correct.length === 0) add("error", "aucune bonne réponse cochée");
          else if (correct.some((c) => !options.includes(c))) add("error", "une bonne réponse n'est plus dans les options (option renommée ?)");
          break;
        }
        case "true_false":
          if (answer !== "true" && answer !== "false") add("error", "ni vrai ni faux choisi");
          break;
        case "fill_in_the_blank": {
          const blanks = block.blanks ?? [];
          if (!block.figureSpec) {
            const tokens = (block.content ?? "").match(/\{\{\d+\}\}/g) ?? [];
            if (tokens.length === 0) add("error", "aucun trou {{1}} dans le texte");
            else if (tokens.length !== blanks.length) add("error", `${tokens.length} trou(s) dans le texte mais ${blanks.length} réponse(s)`);
          }
          if (blanks.some((b) => !b.trim())) add("error", "une réponse de trou est vide");
          break;
        }
        case "matching": {
          const pairs = block.pairs ?? [];
          if (pairs.length < 2) add("error", "moins de 2 paires");
          if (pairs.some((p) => !p.left.trim() || !p.right.trim())) add("error", "une paire a une case vide");
          break;
        }
        case "ordering": {
          const items = block.items ?? [];
          if (items.length < 2) add("error", "moins de 2 éléments à ordonner");
          if (items.some((i) => !i.trim())) add("error", "un élément est vide");
          break;
        }
        case "categorize": {
          const categories = block.categories ?? [];
          const items = block.categoryItems ?? [];
          if (categories.length < 2) add("error", "moins de 2 catégories");
          if (items.some((i) => !categories.includes(i.category))) add("error", "un élément est rangé dans une catégorie qui n'existe plus");
          break;
        }
        case "number_line_point":
        case "click_error":
          if (!answer) add("error", "réponse attendue vide");
          break;
        default:
          break;
      }
    });
  });
  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
}

/* ------------------------------------------------------------------ */
/*  Quiz : questions plates                                            */
/* ------------------------------------------------------------------ */

export interface AuthoringQuestion {
  id: string;
  text: string;
  type: "single_choice" | "multiple_choice" | "true_false" | "text_input" | "impossible_search";
  points: number;
  options?: string[];
  correctAnswer?: string | string[];
  explanation?: string;
  [key: string]: unknown;
}

/** Bloc de saisie rapide → question de quiz (un trou de texte à trous devient « … » et la réponse la liste des trous). */
export function blockToQuestion(block: AuthoringBlock): AuthoringQuestion {
  const base = { id: block.id, points: block.points ?? 1, explanation: block.explanation ?? "" };
  if (block.type === "qcm") {
    const correct = Array.isArray(block.correctAnswer) ? block.correctAnswer : block.correctAnswer ? [block.correctAnswer] : [];
    return correct.length > 1
      ? { ...base, text: block.content ?? "", type: "multiple_choice", options: block.options ?? [], correctAnswer: correct }
      : { ...base, text: block.content ?? "", type: "single_choice", options: block.options ?? [], correctAnswer: correct[0] ?? "" };
  }
  if (block.type === "true_false") return { ...base, text: block.content ?? "", type: "true_false", correctAnswer: String(block.correctAnswer ?? "") };
  if (block.type === "fill_in_the_blank") {
    return { ...base, text: (block.content ?? "").replace(/\{\{\d+\}\}/g, "…"), type: "text_input", correctAnswer: (block.blanks ?? []).join(" ; ") };
  }
  return { ...base, text: block.content ?? "", type: "text_input", correctAnswer: String(block.correctAnswer ?? "") };
}

/** Question de quiz → bloc, pour réutiliser le vérificateur d'exercices. */
export function questionToBlock(question: AuthoringQuestion, index: number): AuthoringBlock {
  const choice = question.type === "single_choice" || question.type === "multiple_choice";
  return {
    id: question.id,
    type: choice ? "qcm" : question.type === "true_false" ? "true_false" : question.type === "text_input" ? "text_input" : "coding",
    title: `Question ${index + 1}`,
    content: question.text,
    points: question.points,
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
  };
}

/** Duplique une question de quiz (nouvel identifiant). */
export function duplicateQuestion<Q extends AuthoringQuestion>(question: Q): Q {
  return { ...JSON.parse(JSON.stringify(question)), id: newId() };
}
