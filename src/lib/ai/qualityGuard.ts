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
  readableMathFallbacks: number;
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

async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));
  const runWorker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await worker(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
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
  // "2pi", "pi/3"... jamais détecté jusqu'ici : ce détecteur listait frac,
  // infty, lambda etc. mais pas pi, alors que c'est la lettre grecque la plus
  // fréquente d'un cours de trigonométrie (vu en prod : "sur [0, 2pi]" jamais
  // converti en "0, 2π" faute d'être repéré comme suspect).
  if (/(?<![a-zA-Z])\d*pi\b/i.test(text)) return true;
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
  const maxRounds = Math.max(1, Math.min(4, options.maxRounds ?? 3));
  const batchSize = 6;

  const systemPrompt = `Tu répares uniquement la séparation texte/mathématiques d'un contenu Educalcul.
Le contenu est déjà rédigé et son sens doit rester strictement identique.
Pour chaque champ reçu :
• conserve exactement la prose française ;
• place CHAQUE formule, symbole, équation, inéquation, limite, dérivée, ensemble, indice ou puissance dans un part {"type":"math","latex":"..."} ;
• le LaTeX doit être compatible KaTeX, sans $ ni HTML ;
• corrige les commandes dont l'antislash a disparu : mathbb{R}, frac, cdot, left, right, lim, to, infty, neq, Delta, alpha, beta, etc. ;
• transforme e^(2x-1) en e^{2x-1}, exp(x) en \\exp(x), x₁ en x_1 et √Delta en \\sqrt{\\Delta} ;
• ne laisse aucune écriture mathématique dans un part text, même si la phrase contient plusieurs formules ;
• ne corrige aucune affirmation mathématique à cette étape ;
• retourne uniquement les champs demandés, avec le même id.`;

  const applyResult = (
    raw: unknown,
    entries: Array<{ reference: RichTextReference; text: string }>,
  ) => {
    const result = asRecord(raw);
    const repairs = Array.isArray(result?.repairs) ? result.repairs : [];
    const byId = new Map(entries.map(({ reference }) => [reference.id, reference]));

    for (const rawRepair of repairs) {
      const repair = asRecord(rawRepair);
      if (!repair) continue;
      const reference = byId.get(stringValue(repair.id));
      if (!reference) continue;
      const content = normalizeStructuredRichText(repair.content);
      if (content.parts.length === 0) continue;
      const before = JSON.stringify(reference.get());
      const after = JSON.stringify(content);
      if (before === after) continue;

      // Une réparation partielle est tout de même conservée. Les tours suivants
      // s'occupent des éventuelles expressions encore présentes dans le texte.
      reference.set(content);
      repaired += 1;
    }
  };

  const repairBatch = async (
    entries: Array<{ reference: RichTextReference; text: string }>,
    strict: boolean,
  ) => {
    if (entries.length === 0) return;
    const payload = {
      fields: entries.map(({ reference, text }) => ({
        id: reference.id,
        path: reference.path,
        suspicious_excerpts: text,
        content: reference.get(),
      })),
    };
    const contentChars = JSON.stringify(payload).length;
    // Plafond relevé (5 500 -> 9 000) : un lot dense de champs suspects
    // tronquait cet appel (vu en prod, maxTokens=3422), ce qui abandonnait le
    // lot silencieusement ("indisponible... reprise champ par champ") au
    // lieu de le réparer. Le plancher précédent (2 000) tronquait encore en
    // prod car il ne dépendait que des caractères du lot, pas du nombre de
    // champs : chaque champ restructuré en parts text/math ajoute un
    // surcoût JSON fixe (accolades, "type", "value"/"latex") même quand son
    // contenu est court. Le budget suit maintenant aussi la taille du lot.
    const maxTokens = Math.min(
      10_000,
      Math.max(3_500, 900 + entries.length * 250 + Math.ceil(contentChars / 2.5)),
    );
    const userPrompt = `${strict ? "CORRECTION STRICTE FINALE. " : ""}Contexte : ${sanitizeStructuredText(options.label)}
Champs à restructurer :
${JSON.stringify(payload)}`;
    const raw = await options.generate(
      userPrompt,
      systemPrompt,
      mathTextRepairContract(entries.length),
      0,
      maxTokens,
      false,
    );
    applyResult(raw, entries);
  };

  for (let round = 0; round < maxRounds; round += 1) {
    const allSuspicious = suspiciousReferences(value);
    if (allSuspicious.length === 0) break;

    for (let offset = 0; offset < allSuspicious.length; offset += batchSize) {
      const batch = allSuspicious.slice(offset, offset + batchSize);
      try {
        await repairBatch(batch, round > 0);
      } catch (batchError) {
        console.warn(
          `[quality-guard] Lot de restructuration LaTeX indisponible pour ${options.label}; reprise champ par champ.`,
          batchError,
        );
      }

      // Le mode JSON de Leanstral peut retourner un lot partiellement réparé.
      // On reprend uniquement les champs du lot qui restent suspects.
      const remainingIds = new Set(
        suspiciousReferences(value).map(({ reference }) => reference.id),
      );
      for (const entry of batch) {
        if (!remainingIds.has(entry.reference.id)) continue;
        try {
          await repairBatch(
            [
              {
                reference: entry.reference,
                text: entry.reference
                  .get()
                  .parts.filter((part) => part.type === "text")
                  .map((part) => part.value)
                  .filter(containsSuspiciousUnstructuredMath)
                  .join("\n"),
              },
            ],
            true,
          );
        } catch (fieldError) {
          console.warn(
            `[quality-guard] Champ LaTeX non réparé (${entry.reference.path}).`,
            fieldError,
          );
        }
      }
    }
  }

  // Filet de sécurité déterministe : après tous les tours, un champ peut
  // rester suspect (lot rejeté, réponse tronquée, ou réparation elle-même
  // mal formée par le modèle). On ne laisse jamais fuir du LaTeX brut à
  // l'affichage — le même repli lisible que celui des légendes de figures
  // (readableMathFallbackText) est appliqué directement au texte, sans
  // appel modèle supplémentaire.
  for (const { reference } of suspiciousReferences(value)) {
    const content = reference.get();
    const nextParts = content.parts.map((part) =>
      part.type === "text" && containsSuspiciousUnstructuredMath(part.value)
        ? { ...part, value: readableMathFallbackText(part.value) }
        : part,
    );
    reference.set({ parts: nextParts });
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
    .slice(0, 240);
}

function qualityFieldGroupKey(path: string): string {
  const grouped = path.match(
    /^(.*?\.(?:exercises|questions|options|steps)\[\d+\])/,
  );
  if (grouped?.[1]) return grouped[1];
  return path.replace(/\.(?:content|question|answer|hint|explanation|title|caption)$/, "");
}

function packQualityFieldBatches(
  fields: Array<{ id: string; path: string; text: string }>,
): Array<Array<{ id: string; path: string; text: string }>> {
  const groups = new Map<
    string,
    Array<{ id: string; path: string; text: string }>
  >();
  for (const field of fields) {
    const key = qualityFieldGroupKey(field.path);
    const current = groups.get(key) ?? [];
    current.push(field);
    groups.set(key, current);
  }

  const batches: Array<Array<{ id: string; path: string; text: string }>> = [];
  let current: Array<{ id: string; path: string; text: string }> = [];
  let currentChars = 0;
  for (const group of groups.values()) {
    const groupChars = group.reduce((sum, field) => sum + field.text.length, 0);
    if (
      current.length > 0 &&
      (current.length + group.length > 14 || currentChars + groupChars > 12_000)
    ) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(...group);
    currentChars += groupChars;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Passe de cohérence mathématique ciblée. Elle est fractionnée en petits lots
 * afin qu'un audit de leçon ne puisse plus atteindre max_tokens. Les champs
 * d'un même exercice restent dans le même lot pour comparer answer/explanation.
 */
export async function auditAndRepairMathematicalContent<T>(
  input: T,
  options: {
    generate: StructuredGenerator;
    label: string;
    level: string;
    subject: string;
    concurrency?: number;
  },
): Promise<{ value: T; patches: number }> {
  const value = clone(input);
  const references = collectRichTextReferences(value);
  const fields = qualityFieldPayload(value);
  if (fields.length === 0) return { value, patches: 0 };

  const systemPrompt = `Tu es un agent relecteur indépendant d'Educalcul. Un autre agent a rédigé le contenu que tu contrôles pour le niveau ${sanitizeStructuredText(options.level)}.
Sujet : ${sanitizeStructuredText(options.subject)}.
Tu reçois un PETIT LOT de champs identifiés appartenant au même cours, exercice ou quiz. Vérifie explicitement les affirmations, calculs et conclusions de l'agent rédacteur.
Vérifie uniquement les erreurs importantes :
• calcul ou résultat faux ;
• réponse finale incompatible avec l'explication ;
• énoncé faux ou impossible ;
• preuve invalide, circulaire ou utilisant une hypothèse absente ;
• confusion minimum/maximum, implication/équivalence, limite, signe ou intervalle ;
• niveau scolaire manifestement inadapté ;
• notation mathématique ambiguë qui change le sens.
Ne corrige pas le style, ne raccourcis pas un contenu correct et n'invente pas une autre activité.
Retourne uniquement les champs réellement faux, jamais tous les champs du lot.
Pour chaque erreur, remplace le champ complet concerné en conservant son rôle. Toutes les mathématiques de chaque remplacement doivent être dans des parts math LaTeX KaTeX, jamais dans un part text.
Pour un couple answer/explanation, les deux doivent conclure exactement au même résultat.
Retourne verdict=reject seulement si ce petit lot ne peut pas être réparé par des remplacements ciblés.`;

  const byId = new Map(references.map((reference) => [reference.id, reference]));
  let patches = 0;

  const applyPatches = (raw: unknown, batchSize: number) => {
    const result = asRecord(raw);
    const verdict = stringValue(result?.verdict);
    const reason = sanitizeStructuredText(result?.reason);
    const rawPatches = Array.isArray(result?.patches) ? result.patches : [];
    let applied = 0;

    for (const rawPatch of rawPatches) {
      const patch = asRecord(rawPatch);
      if (!patch) continue;
      const reference = byId.get(stringValue(patch.id));
      if (!reference) continue;
      const content = normalizeStructuredRichText(patch.content);
      if (content.parts.length === 0) continue;
      reference.set(content);
      applied += 1;
      patches += 1;
    }

    if (verdict === "reject" && applied === 0 && batchSize === 1) {
      console.warn(
        `[quality-guard] Contrôle mathématique non conclusif pour ${options.label}${reason ? ` : ${reason}` : ""}. Le champ est conservé et les validations déterministes restent actives.`,
      );
    }
    return { verdict, applied };
  };

  const processBatch = async (
    batch: Array<{ id: string; path: string; text: string }>,
  ): Promise<void> => {
    if (batch.length === 0) return;
    const payload = JSON.stringify({ fields: batch });
    // Même raisonnement que le rédacteur de cours et repairBatch ci-dessus :
    // le budget doit suivre le nombre de champs du lot, pas seulement leurs
    // caractères (surcoût JSON fixe par champ restructuré).
    const maxTokens = Math.min(
      10_000,
      Math.max(3_500, 1_100 + batch.length * 250 + Math.ceil(payload.length / 2.8)),
    );

    try {
      const raw = await options.generate(
        `Contexte : ${sanitizeStructuredText(options.label)}\nChamps :\n${payload}`,
        systemPrompt,
        semanticPatchContract(Math.min(24, Math.max(1, batch.length * 2))),
        0,
        maxTokens,
        false,
      );
      const result = applyPatches(raw, batch.length);
      if (result.verdict === "reject" && result.applied === 0 && batch.length > 1) {
        const middle = Math.ceil(batch.length / 2);
        await processBatch(batch.slice(0, middle));
        await processBatch(batch.slice(middle));
      }
    } catch (error) {
      if (batch.length > 1) {
        const middle = Math.ceil(batch.length / 2);
        console.warn(
          `[quality-guard] Audit mathématique fractionné pour ${options.label} (${batch.length} champs).`,
          error,
        );
        await processBatch(batch.slice(0, middle));
        await processBatch(batch.slice(middle));
        return;
      }

      // Une indisponibilité ponctuelle du contrôleur ne doit pas détruire une
      // leçon déjà générée. La validation structurelle et LaTeX reste bloquante.
      console.warn(
        `[quality-guard] Audit mathématique indisponible pour ${batch[0]?.path ?? options.label}; champ conservé.`,
        error,
      );
    }
  };

  const batches = packQualityFieldBatches(fields);
  await mapWithConcurrency(
    batches,
    Math.max(1, Math.min(6, options.concurrency ?? 3)),
    async (batch) => processBatch(batch),
  );

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

  // graph.caption / figure.caption sont de simples chaînes (pas de parts
  // text/math) : ni repairUnstructuredMathText ni le pipeline richText ne les
  // visitent, alors qu'elles sont bien rendues avec KaTeX à l'affichage
  // (renderLatexInHTML tourne sur le HTML complet, figcaption compris). Sans
  // ce repli, "infty"/"lambda"/"frac{...}" écrits en toutes lettres restent
  // affichés tels quels au lieu du symbole mathématique attendu.
  const CAPTION_BLOCK_TYPES = new Set([
    "graph",
    "figure",
    "trig_circle",
    "pie_chart",
    "number_line",
    "bar_chart",
    "probability_tree",
    "venn_diagram",
    "triangle_diagram",
    "box_plot",
  ]);
  const repairCaption = (record: Record<string, unknown>) => {
    if (
      typeof record.type === "string" &&
      CAPTION_BLOCK_TYPES.has(record.type) &&
      typeof record.caption === "string" &&
      containsSuspiciousUnstructuredMath(record.caption)
    ) {
      record.caption = readableMathFallbackText(record.caption);
    }
  };

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
        if (record) repairCaption(record);
        visit(node[index]);
      }
      return;
    }
    const record = asRecord(node);
    if (!record) return;
    repairCaption(record);
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


// \w de JS (utilisé par \b) ignore les lettres accentuées : dans "Piège",
// "è" n'est pas un caractère de mot, donc \b voit une frontière entre "i" et
// "è" et \bpi\b matche le "Pi" de "Piège" comme s'il était isolé (vu en
// prod : "πège" partout à la place de "Piège"). Ce lookaround étend la
// définition de "lettre" aux accentuées des deux côtés du mot LaTeX ciblé,
// en plus du \b existant qui gère déjà chiffres/ponctuation/backslash.
const ACCENTED = "A-Za-zÀ-ÖØ-öø-ÿ";
function replaceMathWord(value: string, word: string, symbol: string, flags = ""): string {
  const re = new RegExp(`(?<![${ACCENTED}])\\\\?\\b${word}\\b(?![${ACCENTED}])`, `g${flags}`);
  return value.replace(re, symbol);
}

export function readableMathFallbackText(value: string): string {
  // \b seul en fin de motif ne protège pas le début : sans \b initial,
  // "leq?" matchait "le" à l'intérieur de n'importe quel mot français qui en
  // termine ainsi ("exponentielle" -> "exponentiel≤", "passage" -> "passa≥").
  // Un \b après le "\\?" optionnel encadre le mot des deux côtés, backslash
  // ou non.
  let result = value.replace(/\$/g, "");
  result = replaceMathWord(result, "mathbb\\{R\\}", "ℝ", "i");
  result = replaceMathWord(result, "mathbb\\{N\\}", "ℕ", "i");
  result = replaceMathWord(result, "mathbb\\{Z\\}", "ℤ", "i");
  result = replaceMathWord(result, "mathbb\\{Q\\}", "ℚ", "i");
  result = replaceMathWord(result, "Delta", "Δ");
  result = replaceMathWord(result, "alpha", "α");
  result = replaceMathWord(result, "beta", "β");
  result = replaceMathWord(result, "lambda", "λ");
  result = replaceMathWord(result, "infty", "∞", "i");
  // "2pi" n'a pas de \b entre le chiffre et "pi" (les deux sont des
  // caractères de mot) : motif séparé avant le cas "pi" isolé.
  result = result.replace(/(\d)pi\b(?![A-Za-zÀ-ÖØ-öø-ÿ])/gi, "$1π");
  result = replaceMathWord(result, "pi", "π", "i");
  result = replaceMathWord(result, "neq", "≠");
  result = replaceMathWord(result, "leq", "≤");
  result = replaceMathWord(result, "geq", "≥");
  result = replaceMathWord(result, "cdot", "×");
  result = replaceMathWord(result, "times", "×");
  result = replaceMathWord(result, "to", "→");
  result = replaceMathWord(result, "setminus", "∖");
  result = replaceMathWord(result, "mid", "|");
  result = replaceMathWord(result, "notin", "∉");
  result = replaceMathWord(result, "in", "∈");
  return result
    // \left/\right dimensionnent un délimiteur ({, (, [, |) qui doit rester
    // affiché : sans ces règles, "\left\{...\right\}" perdait le mot mais
    // gardait un antislash orphelin devant l'accolade ("\{"), jamais nettoyé
    // par ailleurs dans ce repli déterministe (vu en prod pour un domaine de
    // définition écrit en ensemble : "\mathbb{R} \setminus \left\{...\right\}").
    .replace(/\\left\s*\\?([{([|])/g, "$1")
    .replace(/\\right\s*\\?([})\]|])/g, "$1")
    .replace(/\\?\bleft\b/g, "")
    .replace(/\\?\bright\b/g, "")
    .replace(/\\?\bfrac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)")
    .replace(/\\?\bsqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Repli de disponibilité : après plusieurs réparations IA, quelques champs
 * peuvent encore contenir une notation imparfaite. On la rend lisible en
 * Unicode au lieu de faire échouer toute la leçon. Les parts math déjà
 * structurés ne sont jamais modifiés.
 */
function applyReadableMathFallback<T>(input: T): {
  value: T;
  fallbacks: number;
} {
  const value = clone(input);
  let fallbacks = 0;
  for (const reference of collectRichTextReferences(value)) {
    const current = reference.get();
    let changed = false;
    const parts = current.parts.map((part) => {
      if (part.type !== "text" || !containsSuspiciousUnstructuredMath(part.value)) {
        return part;
      }
      const normalized = readableMathFallbackText(part.value);
      if (normalized !== part.value) changed = true;
      fallbacks += 1;
      return { type: "text" as const, value: normalized || part.value };
    });
    if (changed) reference.set({ parts });
  }
  return { value, fallbacks };
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
    semanticConcurrency?: number;
    mathTextMode?: "structured" | "markdown";
  },
): Promise<{ value: T; report: StructuredQualityGuardReport }> {
  let value = clone(input);
  const resources = sanitizeStructuredResources(value);
  value = resources.value;

  let semanticPatches = 0;
  if (options.semanticAudit !== false) {
    const semantic = await auditAndRepairMathematicalContent(value, {
      ...options,
      concurrency: options.semanticConcurrency,
    });
    value = semantic.value;
    semanticPatches = semantic.patches;
  }

  // Le mode Markdown est déjà converti de façon déterministe par
  // normalizeStructuredRichText ($...$, $$...$$, \(...\), \[...\]).
  // On évite donc les multiples appels IA de « réparation LaTeX » qui
  // ralentissaient chaque leçon. Le mode structuré historique reste disponible
  // pour les exercices, quiz et contenus anciens.
  const markdownMode = options.mathTextMode === "markdown";
  const suspiciousBefore = suspiciousReferences(value).length;
  let mathTextRepairs = 0;
  let readableMathFallbacks = 0;

  if (!markdownMode) {
    const mathText = await repairUnstructuredMathText(value, {
      generate: options.generate,
      label: options.label,
    });
    value = mathText.value;
    mathTextRepairs = mathText.repaired;

    const readableFallback = applyReadableMathFallback(value);
    value = readableFallback.value;
    readableMathFallbacks = readableFallback.fallbacks;
  }

  const residualSuspicious = suspiciousReferences(value).length;
  if (residualSuspicious > 0) {
    console.warn(
      `[quality-guard] ${options.label}: ${residualSuspicious} champ(s) contiennent une notation mathématique non délimitée. ${markdownMode ? "Le parseur Markdown a déjà traité toutes les expressions délimitées; aucun second agent LaTeX n'est lancé." : "Le contenu est conservé au lieu de faire échouer la génération."}`,
    );
  }

  return {
    value,
    report: {
      suspiciousMathBefore: suspiciousBefore,
      suspiciousMathAfter: residualSuspicious,
      mathTextRepairs,
      readableMathFallbacks,
      semanticPatches,
      removedCurveFigures: resources.removedCurveFigures,
    },
  };
}

export type QualityGuardSupportedContent =
  | StructuredCourseChapter
  | StructuredExerciseDraft
  | StructuredQuizDraft;
