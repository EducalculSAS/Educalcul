import type { JsonSchemaContract } from "@/lib/ai/exerciseSchemas";

/**
 * Relecture d'un exercice généré, avant enregistrement : un second passage de l'IA refait chaque calcul et rejette
 * les questions dont la réponse est fausse, qui sont incohérentes, ou dont l'énoncé donne déjà le calcul ou la réponse.
 * Des contrôles sans IA complètent (calcul enchaîné « a = b = c » dans l'énoncé, tableau LaTeX cassé).
 */

type Block = Record<string, unknown>;
type Page = { blocks?: Block[] };

const plain = (html: unknown) =>
  typeof html !== "string"
    ? ""
    : html
        .replace(/<figure[\s\S]*?<\/figure>/g, " [figure] ")
        .replace(/<\/(p|li|tr)>/g, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/[ \t]+/g, " ")
        .trim();

/** « a = b = c » dans une formule de l'énoncé : un calcul mené jusqu'au résultat. */
export function hasChainedCalculation(html: unknown): boolean {
  const text = plain(html);
  for (const m of text.matchAll(/\$([^$]+)\$/g)) {
    const formula = m[1].replace(/\\begin\{[^}]*\}[\s\S]*?\\end\{[^}]*\}/g, " ");
    if ((formula.match(/(?<![<>!\\])=/g) ?? []).length >= 2) return true;
  }
  return false;
}

/** Restes d'un tableau LaTeX mal converti (« |c|c| hline ») : illisibles pour l'élève. */
export function hasBrokenTable(html: unknown): boolean {
  const text = plain(html).replace(/\$[^$]*\$/g, " ");
  return /\bhline\b|\|c\|c|\{\|?c\|/.test(text);
}

export interface ReviewQuestion { n: number; type: string; statement: string; options?: string[]; answer: string; explanation: string }

/** Questions numérotées de l'exercice, avec le texte d'introduction de leur page (contexte). */
export function collectQuestions(contentJson: unknown): { questions: ReviewQuestion[]; context: string } {
  const questions: ReviewQuestion[] = [];
  const context: string[] = [];
  let n = 0;
  for (const page of (Array.isArray(contentJson) ? contentJson : []) as Page[]) {
    for (const block of page.blocks ?? []) {
      if (block.type === "text") { const t = plain(block.content); if (t) context.push(t); continue; }
      n += 1;
      const answer = Array.isArray(block.correctAnswer) ? block.correctAnswer.join(" ; ") : String(block.correctAnswer ?? "");
      questions.push({
        n,
        type: String(block.type ?? ""),
        statement: plain(block.content),
        ...(Array.isArray(block.options) ? { options: (block.options as unknown[]).map((o) => plain(typeof o === "string" ? o : (o as { text?: unknown })?.text ?? JSON.stringify(o))) } : {}),
        answer: plain(answer),
        explanation: plain(block.explanation).slice(0, 900),
      });
    }
  }
  return { questions, context: context.join("\n").slice(0, 3_000) };
}

/** Retire les questions rejetées (numéros à partir de 1) ; une page vidée de ses questions disparaît. */
export function removeQuestions(contentJson: unknown, rejected: Set<number>): unknown[] {
  let n = 0;
  const pages = (Array.isArray(contentJson) ? contentJson : []) as Page[];
  return pages
    .map((page) => ({
      ...page,
      blocks: (page.blocks ?? []).filter((block) => {
        if (block.type === "text") return true;
        n += 1;
        return !rejected.has(n);
      }),
    }))
    .filter((page) => page.blocks.some((b) => b.type !== "text"));
}

export const REVIEW_SCHEMA: JsonSchemaContract = {
  name: "exercise_review",
  description: "Verdict de relecture pour chaque question",
  schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer" },
            verdict: { type: "string", enum: ["ok", "reponse_fausse", "fuite", "incoherent", "hors_programme"] },
            raison: { type: "string" },
          },
          required: ["n", "verdict", "raison"],
        },
      },
    },
    required: ["questions"],
  },
};

export const REVIEW_SYSTEM = `Tu es professeur de mathématiques et tu relis un exercice avant qu'il soit donné à des élèves.
Pour CHAQUE question, refais le calcul toi-même, entièrement, puis donne un verdict :
• "reponse_fausse" : la réponse attendue est fausse, incomplète, ou ne correspond pas à ce qui est demandé (QCM : la bonne option n'est pas la réponse attendue, ou plusieurs options sont justes).
• "fuite" : l'énoncé contient déjà le calcul, la démarche ou le résultat attendu (ex. « P(A) = 50/100 = 1/2 » dans l'énoncé alors qu'on demande P(A)), ou donne la réponse d'une question précédente qu'on demande encore.
• "incoherent" : énoncé ambigu, données manquantes ou contradictoires, consigne qui ne correspond pas à la question (ex. « code à trois chiffres » pour une réponse à un chiffre), texte cassé ou illisible.
• "hors_programme" : notion hors du programme du niveau indiqué.
• "ok" : tout est juste et clair.
Sois exigeant mais juste : une écriture équivalente de la bonne réponse (2/4 au lieu de 1/2, 0,5) est "ok".
Réponds uniquement avec le JSON demandé : {"questions":[{"n":1,"verdict":"ok","raison":"…"}]}.`;

export function reviewPrompt(input: { title: string; level: string; context: string; questions: ReviewQuestion[] }): string {
  return `Niveau : ${input.level}
Exercice : ${input.title}
Texte d'introduction :
${input.context || "(aucun)"}

Questions :
${JSON.stringify(input.questions)}`;
}

export type ReviewVerdict = { n: number; verdict: string; raison: string };

export function parseReview(raw: unknown): ReviewVerdict[] {
  const list = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    const r = item as Record<string, unknown>;
    const n = Number(r.n);
    if (!Number.isInteger(n) || n < 1) return [];
    return [{ n, verdict: String(r.verdict ?? "ok"), raison: String(r.raison ?? "").slice(0, 200) }];
  });
}
