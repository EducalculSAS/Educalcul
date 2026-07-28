import {
  normalizeStructuredRichText,
  sanitizeStructuredText,
  structuredRichTextToPlainText,
  type StructuredCourseBlock,
  type StructuredCourseChapter,
  type StructuredExerciseDraft,
  type StructuredGenerator,
  type StructuredLearningResource,
  type StructuredQuizDraft,
  type StructuredRichText,
} from "@/lib/ai/structuredContent";
import type { JsonSchemaContract } from "@/lib/ai/schemas";

type RichTextReference = {
  id: string;
  path: string;
  get: () => StructuredRichText;
  set: (value: StructuredRichText) => void;
};

export type StructuredQualityGuardReport = {
  suspiciousMathBefore: number;
  suspiciousMathAfter: number;
  mathTextRepairs: number;
  semanticPatches: number;
  removedCurveFigures: number;
};

const noExtra = { additionalProperties: false } as const;

const richTextSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    parts: {
      type: "array",
      minItems: 1,
      maxItems: 40,
      items: {
        oneOf: [
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["text"] },
              value: { type: "string", minLength: 1 },
            },
            required: ["type", "value"],
            ...noExtra,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["math"] },
              latex: { type: "string", minLength: 1 },
            },
            required: ["type", "latex"],
            ...noExtra,
          },
        ],
      },
    },
  },
  required: ["parts"],
  ...noExtra,
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Détecte les écritures mathématiques qui ont fui dans un part `text`.
 * Le test est volontairement conservateur : il cible surtout les commandes
 * LaTeX sans antislash, les puissances, limites, dérivées et équations.
 */
export function containsSuspiciousUnstructuredMath(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/\\[A-Za-z]+|\$/.test(text)) return true;
  if (
    /\b(?:mathbb|mathcal|mathbf|mathrm|frac|dfrac|tfrac|sqrt|left|right|cdot|times|div|mapsto|infty)\s*(?:\{|\(|\b)/i.test(
      text,
    )
  ) {
    return true;
  }
  if (/\b(?:lim|sum|prod|int)\s*_?\s*\{/i.test(text)) return true;
  if (/\b(?:exp|ln|sin|cos|tan)\s*\([^)]{1,100}\)/i.test(text)) return true;
  if (/(?:[A-Za-z0-9)]|\})\s*\^\s*(?:\{|\(|[-+A-Za-z0-9])/.test(text)) {
    return true;
  }
  if (/(?:[A-Za-z0-9)]|\})\s*_\s*(?:\{|\(|[-+A-Za-z0-9])/.test(text)) {
    return true;
  }
  if (/\b[A-Za-z]\s*['′]{1,2}\s*\([^)]*\)?\s*=/.test(text)) return true;
  if (
    /(?:\b[A-Za-z]\s*\([^)]{0,80}\)|\be\s*\^|\bexp\b|\bln\b)\s*(?:=|≤|≥|<|>)/i.test(
      text,
    )
  ) {
    return true;
  }
  if (/\b(?:-?infty|\+?infty|xmapsto|o\s*[+-]?infty)\b/i.test(text)) return true;
  return false;
}

function collectRichTextReferences(root: unknown): RichTextReference[] {
  const references: RichTextReference[] = [];
  let counter = 1;

  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    const record = asRecord(value);
    if (!record) return;

    if (Array.isArray(record.parts)) {
      const id = `field-${counter++}`;
      references.push({
        id,
        path,
        get: () => record as unknown as StructuredRichText,
        set: (next) => {
          record.parts = next.parts;
        },
      });
      return;
    }

    for (const [key, child] of Object.entries(record)) {
      visit(child, `${path}.${key}`);
    }
  };

  visit(root, "root");
  return references;
}

function suspiciousReferences(root: unknown): Array<{
  reference: RichTextReference;
  text: string;
}> {
  return collectRichTextReferences(root)
    .map((reference) => ({
      reference,
      text: reference
        .get()
        .parts.filter((part) => part.type === "text")
        .map((part) => part.value)
        .filter(containsSuspiciousUnstructuredMath)
        .join("\n"),
    }))
    .filter((entry) => entry.text.length > 0);
}

function mathTextRepairContract(maxRepairs: number): JsonSchemaContract {
  return {
    name: "educalcul_math_text_repairs",
    description:
      "Découpe du texte en parties textuelles et mathématiques structurées.",
    schema: {
      type: "object",
      properties: {
        repairs: {
          type: "array",
          minItems: 0,
          maxItems: Math.max(1, maxRepairs),
          items: {
            type: "object",
            properties: {
              id: { type: "string", minLength: 1 },
              content: richTextSchema,
            },
            required: ["id", "content"],
            ...noExtra,
          },
        },
      },
      required: ["repairs"],
      ...noExtra,
    },
  };
}

/**
 * Convertit les expressions mathématiques restées dans les parts textuels en
 * parts `math`. Une requête courte et ciblée suffit : aucune leçon complète
 * n'est régénérée.
 */
export async function repairUnstructuredMathText<T>(
  input: T,
  options: {
    generate: StructuredGenerator;
    label: string;
    maxRounds?: number;
  },
): Promise<{
  value: T;
  repaired: number;
  suspiciousBefore: number;
  suspiciousAfter: number;
}> {
  const value = clone(input);
  const suspiciousBefore = suspiciousReferences(value).length;
  let repaired = 0;
  const maxRounds = Math.max(1, Math.min(2, options.maxRounds ?? 2));
  const batchSize = 8;

  const systemPrompt = `Tu répares uniquement la séparation texte/mathématiques d'un contenu Educalcul.
Le contenu est déjà rédigé et son sens doit rester strictement identique.
Pour chaque champ reçu :
• conserve exactement la prose française ;
• place chaque formule, symbole, équation, inéquation, limite, dérivée, ensemble ou puissance dans un part {"type":"math","latex":"..."} ;
• le LaTeX doit être compatible KaTeX, sans $ ni HTML ;
• corrige les commandes dont l'antislash a disparu : mathbb{R}, frac, cdot, left, right, lim, to, infty, etc. ;
• transforme e^(2x-1) en e^{2x-1}, et exp(x) en \exp(x) ;
• ne corrige aucune affirmation mathématique à cette étape ;
• retourne uniquement les champs demandés, avec le même id.`;

  for (let round = 0; round < maxRounds; round += 1) {
    const allSuspicious = suspiciousReferences(value).slice(0, 80);
    if (allSuspicious.length === 0) break;

    for (let offset = 0; offset < allSuspicious.length; offset += batchSize) {
      const suspicious = allSuspicious.slice(offset, offset + batchSize);
      const userPrompt = `Contexte : ${sanitizeStructuredText(options.label)}
Champs à restructurer :
${JSON.stringify({
  fields: suspicious.map(({ reference }) => ({
    id: reference.id,
    path: reference.path,
    content: reference.get(),
  })),
})}`;

      const applyResult = (raw: unknown) => {
        const result = asRecord(raw);
        const repairs = Array.isArray(result?.repairs) ? result.repairs : [];
        const byId = new Map(
          suspicious.map(({ reference }) => [reference.id, reference]),
        );

        for (const rawRepair of repairs) {
          const repair = asRecord(rawRepair);
          if (!repair) continue;
          const reference = byId.get(stringValue(repair.id));
          if (!reference) continue;
          const content = normalizeStructuredRichText(repair.content);
          if (content.parts.length === 0) continue;
          const stillSuspicious = content.parts.some(
            (part) =>
              part.type === "text" &&
              containsSuspiciousUnstructuredMath(part.value),
          );
          if (stillSuspicious) continue;
          reference.set(content);
          repaired += 1;
        }
      };

      try {
        const raw = await options.generate(
          userPrompt,
          systemPrompt,
          mathTextRepairContract(suspicious.length),
          0,
          Math.min(4_500, 800 + suspicious.length * 420),
          false,
        );
        applyResult(raw);
      } catch (batchError) {
        console.warn(
          `[quality-guard] Lot de restructuration LaTeX indisponible pour ${options.label}; reprise champ par champ.`,
          batchError,
        );
        for (const entry of suspicious) {
          try {
            const raw = await options.generate(
              `Contexte : ${sanitizeStructuredText(options.label)}
Champ à restructurer :
${JSON.stringify({
                fields: [
                  {
                    id: entry.reference.id,
                    path: entry.reference.path,
                    content: entry.reference.get(),
                  },
                ],
              })}`,
              systemPrompt,
              mathTextRepairContract(1),
              0,
              2_500,
              false,
            );
            applyResult(raw);
          } catch (fieldError) {
            console.warn(
              `[quality-guard] Champ LaTeX non réparé (${entry.reference.path}).`,
              fieldError,
            );
          }
        }
      }
    }
  }

  return {
    value,
    repaired,
    suspiciousBefore,
    suspiciousAfter: suspiciousReferences(value).length,
  };
}

function semanticPatchContract(maxPatches: number): JsonSchemaContract {
  return {
    name: "educalcul_semantic_quality_patches",
    description:
      "Corrections mathématiques ciblées par champ, sans réécriture globale.",
    schema: {
      type: "object",
      properties: {
        verdict: {
          type: "string",
          enum: ["ok", "patched", "reject"],
        },
        reason: { type: "string" },
        patches: {
          type: "array",
          minItems: 0,
          maxItems: Math.max(1, maxPatches),
          items: {
            type: "object",
            properties: {
              id: { type: "string", minLength: 1 },
              content: richTextSchema,
            },
            required: ["id", "content"],
            ...noExtra,
          },
        },
      },
      required: ["verdict", "reason", "patches"],
      ...noExtra,
    },
  };
}

function qualityFieldPayload(root: unknown): Array<{
  id: string;
  path: string;
  text: string;
}> {
  return collectRichTextReferences(root)
    .map((reference) => ({
      id: reference.id,
      path: reference.path,
      text: structuredRichTextToPlainText(reference.get()),
    }))
    .filter((field) => field.text.length > 0)
    .slice(0, 120);
}

/**
 * Passe de cohérence mathématique ciblée. Le modèle ne renvoie que les champs
 * réellement faux : réponses incompatibles avec les explications, calculs
 * erronés, affirmations trop fortes, raisonnement circulaire ou preuve invalide.
 */
export async function auditAndRepairMathematicalContent<T>(
  input: T,
  options: {
    generate: StructuredGenerator;
    label: string;
    level: string;
    subject: string;
  },
): Promise<{ value: T; patches: number }> {
  const value = clone(input);
  const references = collectRichTextReferences(value);
  const fields = qualityFieldPayload(value);
  if (fields.length === 0) return { value, patches: 0 };

  const systemPrompt = `Tu es le contrôleur mathématique final d'Educalcul pour le niveau ${sanitizeStructuredText(options.level)}.
Sujet : ${sanitizeStructuredText(options.subject)}.
Tu reçois des champs identifiés appartenant au même cours, exercice ou quiz.
Vérifie uniquement les erreurs importantes :
• calcul ou résultat faux ;
• réponse finale incompatible avec l'explication ;
• énoncé faux ou impossible ;
• preuve invalide, circulaire ou utilisant une hypothèse absente ;
• confusion minimum/maximum, implication/équivalence, limite, signe ou intervalle ;
• niveau scolaire manifestement inadapté ;
• notation mathématique ambiguë qui change le sens.
Ne corrige pas le style, ne raccourcis pas un contenu correct et n'invente pas une autre activité.
Pour chaque erreur, remplace le champ complet concerné en conservant son rôle. Toutes les mathématiques de chaque remplacement doivent être dans des parts math LaTeX KaTeX, jamais dans un part text.
Pour un couple answer/explanation, les deux doivent conclure exactement au même résultat.
Retourne verdict=reject seulement si le contenu ne peut pas être réparé par au plus 24 remplacements ciblés.`;

  const raw = await options.generate(
    `Contexte : ${sanitizeStructuredText(options.label)}\nChamps :\n${JSON.stringify({ fields })}`,
    systemPrompt,
    semanticPatchContract(24),
    0,
    Math.min(10_000, 1_500 + fields.length * 180),
    false,
  );
  const result = asRecord(raw);
  const verdict = stringValue(result?.verdict);
  const reason = sanitizeStructuredText(result?.reason);
  const rawPatches = Array.isArray(result?.patches) ? result.patches : [];
  const byId = new Map(references.map((reference) => [reference.id, reference]));
  let patches = 0;

  for (const rawPatch of rawPatches) {
    const patch = asRecord(rawPatch);
    if (!patch) continue;
    const reference = byId.get(stringValue(patch.id));
    if (!reference) continue;
    const content = normalizeStructuredRichText(patch.content);
    if (content.parts.length === 0) continue;
    reference.set(content);
    patches += 1;
  }

  if (verdict === "reject" && patches === 0) {
    throw new Error(
      `Contrôle mathématique bloquant pour ${options.label}${reason ? ` : ${reason}` : ""}`,
    );
  }

  return { value, patches };
}

function isCurveFigure(resource: StructuredLearningResource): boolean {
  if (resource.type !== "figure") return false;
  return /\b(courbe|graphe|graphique de fonction|tangente|asymptote|parabole|sinuso[iï]de|fonction exponentielle|fonction logarithme|convexit[eé].*courbe)\b/i.test(
    resource.caption,
  );
}

function sanitizeResources(
  resources: StructuredLearningResource[],
): { resources: StructuredLearningResource[]; removed: number } {
  let removed = 0;
  const filtered = resources.filter((resource) => {
    if (!isCurveFigure(resource)) return true;
    removed += 1;
    return false;
  });
  return { resources: filtered, removed };
}

function normalizeStepsBlock(
  block: Extract<StructuredCourseBlock, { type: "steps" }>,
): Extract<StructuredCourseBlock, { type: "steps" }> {
  const steps = clone(block.steps);
  const output: typeof steps = [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const next = steps[index + 1];
    const onlyParagraph =
      !step.title &&
      step.blocks.length === 1 &&
      step.blocks[0]?.type === "paragraph"
        ? step.blocks[0]
        : null;
    const shortText = onlyParagraph
      ? structuredRichTextToPlainText(onlyParagraph.content)
      : "";
    if (shortText && shortText.split(/\s+/).length <= 9 && next && !next.title) {
      next.title = normalizeStructuredRichText({
        parts: [{ type: "text", value: shortText }],
      });
      continue;
    }
    output.push(step);
  }
  return { ...block, steps: output };
}

/** Supprime les SVG utilisés comme courbes et répare les steps titre/contenu. */
export function sanitizeStructuredResources<T>(
  input: T,
): { value: T; removedCurveFigures: number } {
  const value = clone(input);
  let removedCurveFigures = 0;

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (let index = node.length - 1; index >= 0; index -= 1) {
        const entry = node[index];
        const record = asRecord(entry);
        if (record?.type === "figure") {
          const resource = record as unknown as StructuredLearningResource;
          if (isCurveFigure(resource)) {
            node.splice(index, 1);
            removedCurveFigures += 1;
            continue;
          }
        }
        if (record?.type === "steps") {
          node[index] = normalizeStepsBlock(
            record as unknown as Extract<StructuredCourseBlock, { type: "steps" }>,
          );
        }
        visit(node[index]);
      }
      return;
    }
    const record = asRecord(node);
    if (!record) return;
    if (Array.isArray(record.resources)) {
      const result = sanitizeResources(
        record.resources as unknown as StructuredLearningResource[],
      );
      record.resources = result.resources;
      removedCurveFigures += result.removed;
    }
    Object.values(record).forEach(visit);
  };

  visit(value);
  return { value, removedCurveFigures };
}

export function assertNoUnstructuredMath(input: unknown, label: string): void {
  const suspicious = suspiciousReferences(input);
  if (suspicious.length === 0) return;
  const details = suspicious
    .slice(0, 8)
    .map(({ reference, text }) => `${reference.path}: ${text.slice(0, 140)}`)
    .join(" | ");
  throw new Error(
    `Mathématiques non structurées restantes dans ${label} (${suspicious.length} champ(s)) : ${details}`,
  );
}

export async function runStructuredQualityGuard<T>(
  input: T,
  options: {
    generate: StructuredGenerator;
    label: string;
    level: string;
    subject: string;
    semanticAudit?: boolean;
  },
): Promise<{ value: T; report: StructuredQualityGuardReport }> {
  let value = clone(input);
  const resources = sanitizeStructuredResources(value);
  value = resources.value;

  let semanticPatches = 0;
  if (options.semanticAudit !== false) {
    const semantic = await auditAndRepairMathematicalContent(value, options);
    value = semantic.value;
    semanticPatches = semantic.patches;
  }

  const mathText = await repairUnstructuredMathText(value, {
    generate: options.generate,
    label: options.label,
  });
  value = mathText.value;
  assertNoUnstructuredMath(value, options.label);

  return {
    value,
    report: {
      suspiciousMathBefore: mathText.suspiciousBefore,
      suspiciousMathAfter: mathText.suspiciousAfter,
      mathTextRepairs: mathText.repaired,
      semanticPatches,
      removedCurveFigures: resources.removedCurveFigures,
    },
  };
}

export type QualityGuardSupportedContent =
  | StructuredCourseChapter
  | StructuredExerciseDraft
  | StructuredQuizDraft;
