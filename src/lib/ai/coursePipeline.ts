import {
  structuredRichTextToPlainText,
  type StructuredCourseBlock,
  type StructuredCourseChapter,
  type StructuredCourseLesson,
} from "@/lib/ai/structuredContent";

export type CourseVisualFocus =
  | "graph"
  | "variation_table"
  | "sign_table"
  | "table"
  | "figure"
  | "none";

export type CourseBlueprintLesson = {
  title: string;
  objective: string;
  scope: string;
  coreConcepts: string[];
  prerequisiteRecall: string[];
  visualFocus: CourseVisualFocus;
  complexity: 1 | 2 | 3;
};

export type CourseBlueprintChapter = {
  title: string;
  scope: string;
  lessons: CourseBlueprintLesson[];
};

export type CourseBlueprint = {
  title: string;
  description: string;
  chapters: CourseBlueprintChapter[];
};

export type LessonBoundaryContext = {
  ownedConcepts: string[];
  allowedRecall: string[];
  forbiddenDevelopments: string[];
};

export type LessonContentBudget = {
  hardMinWords: number;
  targetMinWords: number;
  targetMaxWords: number;
  targetMinChars: number;
  targetMaxChars: number;
  maxOutputTokens: number;
};

export type LessonJob = {
  chapterIndex: number;
  lessonIndex: number;
  chapter: CourseBlueprintChapter;
  lesson: CourseBlueprintLesson;
  boundaries: LessonBoundaryContext;
  budget: LessonContentBudget;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function cleanPlain(value: unknown, fallback = ""): string {
  // Filet de sécurité : title/scope/objective s'affichent tels quels partout
  // dans l'admin (jamais interprétés comme du LaTeX). Le prompt interdit déjà
  // toute formule ici, mais le modèle laisse parfois passer une notation
  // brute (ex: "t↦e^{at}" vu en production, affiché avec des accolades
  // visibles) : on retire ce qui ne peut jamais être de la prose française.
  return typeof value === "string" && value.trim()
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/[{}$]/g, "")
        .replace(/[\^_]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : fallback;
}

function cleanStringArray(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of value) {
    const text = cleanPlain(item);
    const key = canonical(text);
    if (!text || !key || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= maximum) break;
  }
  return output;
}

function visualFocus(value: unknown, fallback: CourseVisualFocus): CourseVisualFocus {
  return value === "graph" ||
    value === "variation_table" ||
    value === "sign_table" ||
    value === "table" ||
    value === "figure" ||
    value === "none"
    ? value
    : fallback;
}

function complexity(value: unknown): 1 | 2 | 3 {
  const parsed = Number(value);
  if (parsed >= 3) return 3;
  if (parsed >= 2) return 2;
  return 1;
}

function canonical(value: string): string {
  return value
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackFocus(_index: number, requireGraph: boolean): CourseVisualFocus {
  if (requireGraph && _index === 0) return "graph";
  return "none";
}

function containsAny(text: string, fragments: string[]): boolean {
  return fragments.some((fragment) => text.includes(fragment));
}

/**
 * Le planificateur reste libre de proposer un visuel, mais le serveur refuse
 * les associations absurdes (par exemple un tableau de signes pour une leçon
 * sur les limites). Cette passe est locale, instantanée et déterministe.
 */
export function resolveSemanticVisualFocus(
  requested: CourseVisualFocus,
  lesson: Pick<
    CourseBlueprintLesson,
    "title" | "objective" | "scope" | "coreConcepts"
  >,
  options: { requireGraph: boolean; lessonIndex: number },
): CourseVisualFocus {
  const text = canonical(
    [lesson.title, lesson.objective, lesson.scope, ...lesson.coreConcepts].join(" "),
  );

  const signCompatible = containsAny(text, [
    "signe",
    "tableau de signes",
    "racine",
    "factorisation",
    "inequation",
    "produit",
    "quotient",
    "trinome",
    "polynome",
    "zero d une expression",
  ]);
  const variationCompatible = containsAny(text, [
    "variation",
    "monoton",
    "croissant",
    "decroissant",
    "derivee",
    "extremum",
    "minimum",
    "maximum",
  ]);
  const graphCompatible = containsAny(text, [
    "courbe",
    "graph",
    "fonction",
    "limite",
    "asymptote",
    "convex",
    "croissance comparee",
    "logarithme",
    "exponentielle",
    "fonction reciproque",
    "image",
  ]);
  const tableCompatible = containsAny(text, [
    "propriete",
    "formule",
    "valeur",
    "comparaison",
    "recapitulatif",
    "identite",
    "methode",
    "lien avec",
  ]);
  const figureCompatible = containsAny(text, [
    "schema",
    "diagramme",
    "camembert",
    "geometr",
    "construction",
    "processus",
    "frise",
    "probabilite",
    "statistique",
  ]);

  if (requested === "sign_table" && signCompatible) return requested;
  if (requested === "variation_table" && variationCompatible) return requested;
  if (requested === "graph" && graphCompatible) return requested;
  if (requested === "table" && tableCompatible) return requested;
  if (requested === "figure" && figureCompatible) return requested;
  if (requested === "none") {
    if (options.requireGraph && options.lessonIndex === 0) return "graph";
    return "none";
  }

  // Remplacement sémantique d'un choix inadapté. Les limites, la convexité et
  // le lien exp/ln gagnent davantage à être visualisés par une courbe; les
  // propriétés algébriques et comparaisons utilisent plutôt un tableau.
  if (graphCompatible) return "graph";
  if (variationCompatible) return "variation_table";
  if (signCompatible) return "sign_table";
  if (tableCompatible) return "table";
  if (figureCompatible) return "figure";
  if (options.requireGraph && options.lessonIndex === 0) return "graph";
  return "none";
}

export function normalizeCourseBlueprint(
  raw: unknown,
  options: {
    subject: string;
    chapterCount: number;
    lessonsPerChapter: number;
    chapterRequiresGraph: (chapterTitle: string, chapterScope: string) => boolean;
  },
): CourseBlueprint {
  const root = asRecord(raw);
  const rawChapters = Array.isArray(root?.chapters) ? root.chapters : [];
  const chapters: CourseBlueprintChapter[] = [];

  for (let chapterIndex = 0; chapterIndex < options.chapterCount; chapterIndex += 1) {
    const rawChapter = asRecord(rawChapters[chapterIndex]);
    const title = cleanPlain(
      rawChapter?.title,
      `${options.subject} — partie ${chapterIndex + 1}`,
    );
    const scope = cleanPlain(rawChapter?.scope, title);
    const requireGraph = options.chapterRequiresGraph(title, scope);
    const rawLessons = Array.isArray(rawChapter?.lessons) ? rawChapter.lessons : [];
    const lessons: CourseBlueprintLesson[] = [];

    for (let lessonIndex = 0; lessonIndex < options.lessonsPerChapter; lessonIndex += 1) {
      const rawLesson = asRecord(rawLessons[lessonIndex]);
      const lessonTitle = cleanPlain(
        rawLesson?.title,
        `${title} — leçon ${lessonIndex + 1}`,
      );
      const lessonScope = cleanPlain(
        rawLesson?.scope,
        `${scope}. Partie ${lessonIndex + 1}/${options.lessonsPerChapter}.`,
      );
      const concepts = cleanStringArray(rawLesson?.core_concepts, 7);
      const draftLesson: CourseBlueprintLesson = {
        title: lessonTitle,
        objective: cleanPlain(
          rawLesson?.objective,
          `Comprendre et utiliser les notions essentielles de « ${lessonTitle} ».`,
        ),
        scope: lessonScope,
        coreConcepts:
          concepts.length > 0
            ? concepts
            : [lessonTitle, lessonScope].filter(Boolean).slice(0, 2),
        prerequisiteRecall: cleanStringArray(rawLesson?.prerequisite_recall, 4),
        visualFocus: visualFocus(
          rawLesson?.visual_focus,
          fallbackFocus(lessonIndex, requireGraph),
        ),
        complexity: complexity(rawLesson?.complexity),
      };
      draftLesson.visualFocus = resolveSemanticVisualFocus(
        draftLesson.visualFocus,
        draftLesson,
        { requireGraph, lessonIndex },
      );
      lessons.push(draftLesson);
    }

    if (requireGraph && !lessons.some((lesson) => lesson.visualFocus === "graph")) {
      const first = lessons[0];
      if (first) first.visualFocus = "graph";
    }

    // Diversité visuelle : un sujet de fonction (exp, ln...) rend presque
    // toutes les leçons "graphCompatible" au sens sémantique, donc un
    // chapitre entier retombe facilement sur 3 leçons qui tracent la même
    // courbe avec une légende à peine différente. Une leçon de modélisation
    // ou d'application concrète gagne davantage à un schéma (frise,
    // diagramme, camembert) qu'à une énième courbe : on la diversifie tant
    // qu'il reste au moins une autre leçon avec un graph dans le chapitre.
    const graphLessons = lessons.filter((lesson) => lesson.visualFocus === "graph");
    if (graphLessons.length > 1) {
      const modelingCandidate = lessons.find(
        (lesson, index) =>
          index > 0 &&
          lesson.visualFocus === "graph" &&
          /\b(modelis|application|probleme concret|cas concret)\b/.test(
            canonical([lesson.title, lesson.objective, lesson.scope].join(" ")),
          ),
      );
      if (modelingCandidate) modelingCandidate.visualFocus = "figure";
    }

    chapters.push({ title, scope, lessons });
  }

  // Le modèle propose la répartition, puis le serveur impose une propriété
  // exclusive : une notion principale ne peut appartenir qu'à une leçon.
  // Une répétition tardive devient au mieux un rappel de prérequis.
  const conceptOwners = new Set<string>();
  for (const chapter of chapters) {
    for (const lesson of chapter.lessons) {
      const owned: string[] = [];
      const repeated: string[] = [];
      for (const concept of lesson.coreConcepts) {
        const key = canonical(concept);
        if (!key) continue;
        if (conceptOwners.has(key)) repeated.push(concept);
        else {
          conceptOwners.add(key);
          owned.push(concept);
        }
      }
      if (owned.length === 0) {
        const fallback = lesson.title || lesson.scope;
        let candidate = fallback;
        let suffix = 2;
        while (conceptOwners.has(canonical(candidate))) {
          candidate = `${fallback} — approfondissement ${suffix}`;
          suffix += 1;
        }
        conceptOwners.add(canonical(candidate));
        owned.push(candidate);
      }
      lesson.coreConcepts = owned.slice(0, 7);
      lesson.prerequisiteRecall = uniqueConcepts([
        ...lesson.prerequisiteRecall,
        ...repeated,
      ]).slice(0, 4);
    }
  }

  return {
    title: cleanPlain(root?.title, `Cours : ${options.subject}`),
    description: cleanPlain(
      root?.description,
      `Cours complet sur ${options.subject}.`,
    ),
    chapters,
  };
}

function uniqueConcepts(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const key = canonical(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

export function buildLessonBoundaries(
  blueprint: CourseBlueprint,
  chapterIndex: number,
  lessonIndex: number,
): LessonBoundaryContext {
  const lesson = blueprint.chapters[chapterIndex]?.lessons[lessonIndex];
  if (!lesson) {
    return { ownedConcepts: [], allowedRecall: [], forbiddenDevelopments: [] };
  }

  const ownKeys = new Set(
    [...lesson.coreConcepts, ...lesson.prerequisiteRecall].map(canonical),
  );
  const sameChapter = blueprint.chapters[chapterIndex]?.lessons ?? [];
  const nearbyConcepts = sameChapter.flatMap((candidate, index) =>
    index === lessonIndex ? [] : candidate.coreConcepts,
  );
  const otherChapterConcepts = blueprint.chapters.flatMap((chapter, index) =>
    index === chapterIndex
      ? []
      : chapter.lessons.flatMap((candidate) => candidate.coreConcepts),
  );
  const forbidden = uniqueConcepts([...nearbyConcepts, ...otherChapterConcepts])
    .filter((concept) => !ownKeys.has(canonical(concept)))
    .slice(0, 14);

  return {
    ownedConcepts: uniqueConcepts(lesson.coreConcepts).slice(0, 7),
    allowedRecall: uniqueConcepts(lesson.prerequisiteRecall).slice(0, 4),
    forbiddenDevelopments: forbidden,
  };
}

function durationBase(duration: number): Omit<LessonContentBudget, "maxOutputTokens"> {
  if (duration <= 20) {
    return {
      hardMinWords: 280,
      targetMinWords: 470,
      targetMaxWords: 680,
      targetMinChars: 3_400,
      targetMaxChars: 5_100,
    };
  }
  if (duration <= 30) {
    return {
      hardMinWords: 360,
      targetMinWords: 650,
      targetMaxWords: 920,
      targetMinChars: 5_000,
      targetMaxChars: 7_400,
    };
  }
  if (duration <= 45) {
    return {
      hardMinWords: 480,
      targetMinWords: 900,
      targetMaxWords: 1_260,
      targetMinChars: 7_000,
      targetMaxChars: 10_200,
    };
  }
  return {
    hardMinWords: 620,
    targetMinWords: 1_150,
    targetMaxWords: 1_600,
    targetMinChars: 9_000,
    targetMaxChars: 13_000,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createLessonJobs(
  blueprint: CourseBlueprint,
  options: {
    durationPerLesson: number;
    includeExercises: boolean;
    maxCourseCharacters: number;
  },
): LessonJob[] {
  const lessons = blueprint.chapters.flatMap((chapter, chapterIndex) =>
    chapter.lessons.map((lesson, lessonIndex) => ({
      chapterIndex,
      lessonIndex,
      chapter,
      lesson,
    })),
  );
  const base = durationBase(options.durationPerLesson);
  const weights = lessons.map(({ lesson }) => 1 + (lesson.complexity - 1) * 0.22);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const naturalTotal = lessons.length * base.targetMaxChars;
  const effectiveTotal = Math.min(options.maxCourseCharacters, naturalTotal);

  return lessons.map((entry, index) => {
    const weightedMax = Math.floor((effectiveTotal * (weights[index] ?? 1)) / totalWeight);
    const averageBudget = Math.floor(effectiveTotal / Math.max(1, lessons.length));
    const dynamicFloor = Math.min(
      base.targetMinChars,
      Math.max(2_200, Math.floor(averageBudget * 0.8)),
    );
    const targetMaxChars = clamp(
      weightedMax,
      dynamicFloor,
      Math.ceil(base.targetMaxChars * 1.12),
    );
    const targetMinChars = Math.min(
      targetMaxChars - 300,
      Math.max(2_400, Math.floor(targetMaxChars * 0.72)),
    );
    const charRatio = targetMaxChars / base.targetMaxChars;
    const targetMinWords = Math.max(
      base.hardMinWords,
      Math.floor(base.targetMinWords * Math.min(1.08, charRatio)),
    );
    const targetMaxWords = Math.max(
      targetMinWords + 80,
      Math.floor(base.targetMaxWords * Math.min(1.08, charRatio)),
    );
    // Le plancher précédent (5 500) est atteint par la quasi-totalité des
    // leçons de durée standard (≤ 30 min, la valeur par défaut) : la
    // conversion caractères→tokens ne couvre alors que le texte utile, pas la
    // structure JSON (accolades, guillemets, LaTeX échappé en \\\\) qui
    // gonfle nettement la sortie réelle du modèle. Un plancher trop bas
    // provoque une troncature systématique dès la première tentative.
    const maxOutputTokens = clamp(
      Math.ceil(targetMaxChars / 2.45) + (options.includeExercises ? 2_800 : 1_300),
      7_500,
      12_000,
    );

    return {
      ...entry,
      boundaries: buildLessonBoundaries(
        blueprint,
        entry.chapterIndex,
        entry.lessonIndex,
      ),
      budget: {
        hardMinWords: base.hardMinWords,
        targetMinWords,
        targetMaxWords,
        targetMinChars,
        targetMaxChars,
        maxOutputTokens,
      },
    };
  });
}

function blockPlainText(block: StructuredCourseBlock): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return structuredRichTextToPlainText(block.content);
    case "display_math":
      return block.latex;
    case "list":
    case "checklist":
      return block.items.map(structuredRichTextToPlainText).join(" ");
    case "callout":
      return [
        block.title ? structuredRichTextToPlainText(block.title) : "",
        ...block.paragraphs.map(structuredRichTextToPlainText),
      ].join(" ");
    case "table":
      return [
        ...block.headers.map(structuredRichTextToPlainText),
        ...block.rows.flat().map(structuredRichTextToPlainText),
      ].join(" ");
    case "column_operation":
      return [...block.operands, block.operator, block.result].join(" ");
    case "image":
      return block.caption;
    case "base_ten_blocks":
      return block.caption;
    case "sign_table":
      return [
        structuredRichTextToPlainText(block.expression),
        ...block.boundaries.map(structuredRichTextToPlainText),
      ].join(" ");
    case "variation_table":
      return [
        structuredRichTextToPlainText(block.variable),
        structuredRichTextToPlainText(block.functionName),
        ...block.points.map(structuredRichTextToPlainText),
        ...block.values.map(structuredRichTextToPlainText),
      ].join(" ");
    case "graph":
    case "figure":
    case "shape":
    case "trig_circle":
    case "pie_chart":
    case "number_line":
    case "bar_chart":
    case "probability_tree":
    case "venn_diagram":
    case "box_plot":
    case "clock":
    case "fraction":
    case "coin_purse":
    case "balance_scale":
    case "grid_painter":
    case "pattern_maker":
    case "ruler_measurer":
    case "tape_diagram":
    case "fraction_strips":
    case "place_value_chart":
    case "ratio_mixer":
    case "net_folder":
    case "interactive_protractor":
    case "compass_tool":
    case "thermometer_axis":
    case "area_decomposer":
    case "scientific_notation_converter":
    case "equation_balancer":
    case "slope_triangle":
    case "vector_addition_pad":
    case "interval_builder":
    case "tangent_scrubber":
    case "sequence_cobweb":
    case "integral_riemann_slider":
    case "complex_plane_polar":
    case "algo_sandbox":
      return block.caption;
    case "definition":
      return [
        block.term,
        structuredRichTextToPlainText(block.definition),
        block.example ? structuredRichTextToPlainText(block.example) : "",
      ].join(" ");
    case "steps":
      return block.steps
        .flatMap((step) => [
          step.title ? structuredRichTextToPlainText(step.title) : "",
          ...step.blocks.map(blockPlainText),
        ])
        .join(" ");
    case "exercise":
      return "";
  }
}

function tokens(value: string): Set<string> {
  return new Set(canonical(value).split(" ").filter((token) => token.length > 2));
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function canDeduplicate(block: StructuredCourseBlock): boolean {
  return block.type === "paragraph" || block.type === "callout" || block.type === "list";
}

/**
 * Supprime uniquement les blocs quasiment identiques entre leçons. Le seuil est
 * volontairement élevé : ce garde évite le copier-coller, pas les rappels utiles.
 */
export function deduplicateCourseChapters(
  chapters: StructuredCourseChapter[],
): { chapters: StructuredCourseChapter[]; removedBlocks: number } {
  const seen: Array<{ text: string; tokens: Set<string> }> = [];
  let removedBlocks = 0;
  const output = chapters.map((chapter) => ({
    ...chapter,
    lessons: chapter.lessons.map((lesson) => {
      const blocks = lesson.blocks.filter((block) => {
        if (!canDeduplicate(block)) return true;
        const text = blockPlainText(block).replace(/\s+/g, " ").trim();
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        if (wordCount < 18) return true;
        const currentTokens = tokens(text);
        // Seuil abaissé (0.91 -> 0.78, plancher 20 -> 14 mots partagés) : le
        // seuil précédent n'attrapait que le copier-coller quasi-littéral,
        // pas une même notion réexpliquée avec d'autres mots d'une leçon à
        // l'autre (ex: "lien avec les suites géométriques" développé deux
        // fois dans le même chapitre). Le garde-fou dedupeCreatedIssue côté
        // courseGeneration.ts annule déjà toute suppression qui casserait un
        // seuil de mots ou un visuel requis, donc un seuil plus permissif ici
        // reste sans risque.
        const duplicate = seen.some(
          (entry) =>
            (canonical(entry.text) === canonical(text) && text.length > 120) ||
            (Math.min(entry.tokens.size, currentTokens.size) >= 14 &&
              jaccard(entry.tokens, currentTokens) >= 0.78),
        );
        if (duplicate) {
          removedBlocks += 1;
          return false;
        }
        seen.push({ text, tokens: currentTokens });
        return true;
      });
      return { ...lesson, blocks };
    }),
  }));
  return { chapters: output, removedBlocks };
}

export function lessonUsefulCharacterCount(lesson: StructuredCourseLesson): number {
  const blockChars = lesson.blocks.reduce(
    (sum, block) => sum + blockPlainText(block).length,
    0,
  );
  const exerciseChars = lesson.exercises.reduce(
    (sum, exercise) =>
      sum +
      structuredRichTextToPlainText(exercise.question).length +
      structuredRichTextToPlainText(exercise.answer).length +
      structuredRichTextToPlainText(exercise.hint).length +
      structuredRichTextToPlainText(exercise.explanation).length,
    0,
  );
  return blockChars + exerciseChars;
}

export class CourseGenerationTelemetry {
  private readonly startedAt = Date.now();
  private readonly active = new Map<string, number>();
  private readonly durations = new Map<string, number>();

  start(label: string): void {
    this.active.set(label, Date.now());
  }

  end(label: string, details = ""): number {
    const start = this.active.get(label) ?? Date.now();
    const duration = Date.now() - start;
    this.active.delete(label);
    this.durations.set(label, duration);
    console.info(
      `[course-ai][timing] ${label}: ${(duration / 1_000).toFixed(1)} s${details ? ` — ${details}` : ""}`,
    );
    return duration;
  }

  total(details = ""): number {
    const duration = Date.now() - this.startedAt;
    console.info(
      `[course-ai][timing] total: ${(duration / 1_000).toFixed(1)} s${details ? ` — ${details}` : ""}`,
    );
    return duration;
  }

  summary(): Record<string, number> {
    return Object.fromEntries(this.durations.entries());
  }
}
