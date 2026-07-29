import { getProgrammePromptBlock } from "@/lib/programmes-nationaux";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { auditLog, AuditAction } from "@/lib/auditLog";
import {
  createGenerationTracker,
  createLlmStartGate,
  DEFAULT_LLM_MIN_START_INTERVAL_MS,
  GenerationCancelledError,
} from "@/lib/backgroundGeneration";
import {
  normalizeStructuredCourseChapter,
  repairInvalidStructuredMath,
  type StructuredCourseChapter,
  type StructuredCourseExercise,
  type StructuredCourseLesson,
} from "@/lib/ai/structuredContent";
import {
  courseBlueprintAuditSchema,
  courseBlueprintSchema,
  courseChapterSchema,
} from "@/lib/ai/schemas";
import {
  compileStructuredCourseChapter,
  type CompiledCourseChapter,
  type CompiledCourseLesson,
} from "@/lib/ai/compiler";
import {
  auditStructuredCoursePedagogy,
  formatStructuredQualityIssues,
  normalizeStructuredCoursePedagogy,
  structuredCourseQualityScore,
  topicRequiresFunctionGraph,
} from "@/lib/ai/pedagogy";
import { sanitizeStructuredResources } from "@/lib/ai/qualityGuard";
import {
  CourseGenerationTelemetry,
  auditCourseBlueprint,
  auditCourseCoordination,
  createLessonJobs,
  deduplicateCourseChapters,
  lessonUsefulCharacterCount,
  normalizeCourseBlueprint,
  isBlockingCourseBlueprintIssue,
  type CourseBlueprint,
  type CourseVisualFocus,
  type LessonJob,
} from "@/lib/ai/coursePipeline";
import {
  courseLessonUnstructuredMathFields,
  replaceDuplicateCourseExercises,
  reviewCourseLesson,
  verifyCourseGloballyForPublication,
  verifyCourseLessonForPublication,
} from "@/lib/ai/courseReview";

export type CourseGenerationParams = {
  grade_level: string;
  subject: string;
  additional_info?: string;
  page_count?: string | number;
  chapter_count?: string | number;
  lessons_per_chapter?: string | number;
  lesson_count?: string | number;
  content_style?: "balanced" | "theory_heavy" | "practice_heavy";
  include_exercises?: boolean;
  language_level?: "simple" | "standard" | "academic";
  subject_area?: string;
  duration_per_lesson?: string | number;
  difficulty?: string;
  quality_mode?: "fast" | "balanced" | "strict";
  folder_id?: number | null;
};

export type GenerationProgress = {
  step: "outline" | "chapter" | "final-check";
  current: number;
  total: number;
  message: string;
  chapterTitles?: string[];
  chapters?: Record<number, { title: string; lessons: CompiledCourseLesson[] }>;
};

function clampNumber(
  value: string | number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, Math.trunc(parsed)))
    : fallback;
}

function envNumber(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed)
    ? Math.max(min, Math.min(max, Math.trunc(parsed)))
    : fallback;
}

function envConcurrency(name: string, fallback: number, maximum: number): number {
  return envNumber(name, fallback, 1, maximum);
}

function styleInstruction(
  style: CourseGenerationParams["content_style"],
): string {
  if (style === "theory_heavy") {
    return "Style théorique : définitions rigoureuses, propriétés, démonstrations et profondeur conceptuelle, avec des applications ciblées.";
  }
  if (style === "practice_heavy") {
    return "Style pratique : méthodes, interprétations et applications, avec la théorie nécessaire pour comprendre les procédures.";
  }
  return "Style équilibré : théorie, justification, méthode, application et synthèse.";
}

function languageInstruction(
  level: CourseGenerationParams["language_level"],
): string {
  if (level === "simple") {
    return "Vocabulaire simple : phrases claires et termes techniques expliqués au premier emploi.";
  }
  if (level === "academic") {
    return "Vocabulaire académique : terminologie précise, style formel et démonstrations explicites.";
  }
  return "Vocabulaire scolaire standard : rigoureux, clair et accessible.";
}

function isCompleteCourseExercise(exercise: StructuredCourseExercise): boolean {
  return (
    exercise.question.parts.length > 0 &&
    exercise.answer.parts.length > 0 &&
    exercise.hint.parts.length > 0 &&
    exercise.explanation.parts.length > 0
  );
}

function hasCompleteLesson(
  lesson: StructuredCourseLesson | undefined,
  includeExercises: boolean,
): lesson is StructuredCourseLesson {
  return Boolean(
    lesson &&
      lesson.blocks.length > 0 &&
      (!includeExercises ||
        (lesson.exercises.length >= 3 &&
          lesson.exercises.every(isCompleteCourseExercise))),
  );
}

function exerciseSchema(includeExercises: boolean): string {
  if (!includeExercises) {
    return `Le tableau "exercises" vaut exactement []. Aucun bloc de type "exercise" n'est présent.`;
  }
  return `La leçon contient exactement 3 exercices, ou 4 seulement si la quatrième activité apporte une compétence réellement différente.
Chaque exercice respecte exactement :
{
  "question": "Énoncé Markdown avec formules entre $...$",
  "answer": "Réponse finale Markdown",
  "hint": "Indice court Markdown",
  "explanation": "Correction Markdown"
}
Les exercices n'ont aucun id. Dans les blocs, place {"type":"exercise","exercise_index":1}, puis 2 et 3, juste après les notions correspondantes.
La question ne contient jamais la réponse. answer et la conclusion de explanation donnent exactement le même résultat mathématique. Recalcule chaque activité avant de répondre.`;
}

function visualRequirement(focus: CourseVisualFocus): string {
  if (focus === "none") {
    return "Aucun visuel n'est imposé pour cette leçon. N'en ajoute un que s'il apporte une vraie valeur pédagogique.";
  }
  if (focus === "graph") {
    return 'Ajoute un bloc "graph" utile, avec expression mathGraph exacte et légende mathématiquement correcte.';
  }
  if (focus === "variation_table") {
    return 'Ajoute un bloc "variation_table" cohérent ET un bloc "graph" correspondant, rendu par mathGraph.';
  }
  if (focus === "sign_table") {
    return 'Ajoute un bloc "sign_table" cohérent avec les racines et les intervalles.';
  }
  if (focus === "figure") {
    return 'Ajoute un bloc "figure" réservé à un schéma, diagramme, camembert, aire, fraction, frise ou processus. Jamais une courbe de fonction.';
  }
  return 'Ajoute un bloc "table" utile de valeurs, propriétés ou comparaison.';
}

const COURSE_MARKDOWN_JSON_PROMPT = `═══ FORMAT JSON + MARKDOWN MATHÉMATIQUE ═══
• Réponds uniquement avec l'objet JSON demandé.
• Aucun HTML.
• Les champs de contenu sont des chaînes Markdown simples.
• Toute expression mathématique en ligne est entre $...$.
• Une formule importante utilise display_math avec le corps LaTeX sans $ ni $$.
• Dans le JSON, les antislashs sont échappés normalement : "\\\\frac{1}{2}".
• Utilise du LaTeX KaTeX valide : \\frac, \\sqrt, \\Delta, \\mathbb, \\lim, \\to, \\infty, \\exp, \\ln.
• Ne laisse jamais mathbb{R}, frac{...}, x^2, e^(x), -+∞ ou une équation hors de $...$.
• N'utilise pas de titres Markdown, de listes Markdown ni de tableaux Markdown : ils ont des blocs JSON.
• Aucun identifiant technique : le serveur les génère.

Blocs autorisés :
1. {"type":"heading","level":3,"content":"Titre"}
2. {"type":"paragraph","content":"Texte avec $f(x)=x^2$."}
3. {"type":"display_math","latex":"\\\\begin{aligned}a&=b\\\\\\\\c&=d\\\\end{aligned}"}
4. {"type":"list","ordered":false,"items":["Texte","Texte avec $x\\\\in\\\\mathbb{R}$"]}
5. {"type":"callout","variant":"note","title":"Titre","paragraphs":["Contenu"]}
6. {"type":"table","variant":"value","headers":["Colonne 1","Colonne 2"],"rows":[["$x$","$f(x)$"]]}
7. {"type":"sign_table","expression":"$P(x)$","boundaries":["$x_1$","$x_2$"],"interval_signs":["positive","negative","positive"],"boundary_signs":["zero","zero"]}
8. {"type":"variation_table","variable":"$x$","function_name":"$f$","points":["$-\\\\infty$","$0$","$+\\\\infty$"],"values":["$0$","$1$","$+\\\\infty$"],"directions":["up","up"],"derivative_signs":["positive","positive"]}
9. {"type":"graph","expression":"exp(x)","xmin":-5,"xmax":5,"caption":"Description exacte","parameter":null,"vectors":[]}
10. {"type":"figure", ...} uniquement pour un schéma ou diagramme, jamais une courbe.
11. {"type":"steps","steps":[{"title":"Étape 1","blocks":[BLOCS]}]}
12. {"type":"exercise","exercise_index":1}`;

function formatList(values: string[], fallback: string): string {
  return values.length > 0 ? values.map((value) => `• ${value}`).join("\n") : fallback;
}

function coursePlanSummary(blueprint: CourseBlueprint): string {
  return blueprint.chapters
    .map(
      (chapter, chapterIndex) =>
        `Chapitre ${chapterIndex + 1}. ${chapter.title}\n${chapter.lessons
          .map(
            (lesson, lessonIndex) =>
              `  ${chapterIndex + 1}.${lessonIndex + 1} ${lesson.title}
` +
              `    Objectif : ${lesson.objective}
` +
              `    Propriétaire de : ${lesson.coreConcepts.join(" ; ")}
` +
              `    Sections réservées : ${lesson.requiredSections.join(" ; ")}
` +
              `    Exercices réservés : ${lesson.exerciseSkills.join(" ; ")}`,
          )
          .join("\n")}`,
    )
    .join("\n");
}

function lessonPositionContext(blueprint: CourseBlueprint, job: LessonJob): string {
  const ordered = blueprint.chapters.flatMap((chapter, chapterIndex) =>
    chapter.lessons.map((lesson, lessonIndex) => ({
      chapterIndex,
      lessonIndex,
      lesson,
    })),
  );
  const current = ordered.findIndex(
    (entry) =>
      entry.chapterIndex === job.chapterIndex && entry.lessonIndex === job.lessonIndex,
  );
  const previous = ordered
    .slice(0, Math.max(0, current))
    .map((entry) => `${entry.lesson.title} : ${entry.lesson.coreConcepts.join(" ; ")}`);
  const next = ordered
    .slice(current + 1)
    .map((entry) => `${entry.lesson.title} : ${entry.lesson.coreConcepts.join(" ; ")}`);
  return `CONTEXTE DE PROGRESSION :
` +
    `Déjà traité avant cette leçon :
${formatList(previous, "• Rien : première leçon du cours.")}

` +
    `Réservé aux leçons suivantes :
${formatList(next, "• Rien : dernière leçon du cours.")}`;
}

function buildLessonSystemPrompt(options: {
  blueprint: CourseBlueprint;
  job: LessonJob;
  gradeLevel: string;
  subject: string;
  subjectArea: string;
  difficulty: string;
  durationPerLesson: number;
  includeExercises: boolean;
  style: CourseGenerationParams["content_style"];
  language: CourseGenerationParams["language_level"];
  programmeBlock: string;
  teacherDirective: string;
}): string {
  const { blueprint, job } = options;
  return `Tu es l'agent rédacteur d'une architecture multi-agent Educalcul.
Tu rédiges UNE SEULE leçon. Un agent indépendant la relira ensuite et ne pourra appliquer que des patches locaux : rends donc la première version exacte et complète.

Cours : ${blueprint.title}.
Niveau : ${options.gradeLevel}.
Matière : ${options.subjectArea || options.subject}.
Difficulté : ${options.difficulty}.
Chapitre ${job.chapterIndex + 1}/${blueprint.chapters.length} : ${job.chapter.title}.
Périmètre du chapitre : ${job.chapter.scope}.
Leçon ${job.lessonIndex + 1}/${job.chapter.lessons.length} : ${job.lesson.title}.
Objectif : ${job.lesson.objective}.
Périmètre strict : ${job.lesson.scope}.

CARTE GLOBALE — chaque notion principale appartient à un seul agent :
${coursePlanSummary(blueprint)}

NOTIONS DONT CETTE LEÇON EST PROPRIÉTAIRE :
${formatList(job.boundaries.ownedConcepts, "• Les notions indiquées dans le périmètre.")}

RAPPELS AUTORISÉS, EN UNE PHRASE MAXIMUM CHACUN :
${formatList(job.boundaries.allowedRecall, "• Aucun rappel développé.")}

NOTIONS ATTRIBUÉES AUX AUTRES AGENTS — NE PAS LES DÉVELOPPER :
${formatList(job.boundaries.forbiddenDevelopments, "• Aucune.")}

SECTIONS QUE LE PLAN T'ATTRIBUE — elles structurent la leçon :
${formatList(job.lesson.requiredSections, "• Construire les sections à partir des notions propriétaires.")}

COMPÉTENCES RÉSERVÉES AUX EXERCICES DE CETTE LEÇON :
${formatList(job.lesson.exerciseSkills, "• Trois applications distinctes des notions propriétaires.")}

${lessonPositionContext(blueprint, job)}

${options.programmeBlock}
${styleInstruction(options.style)}
${languageInstruction(options.language)}
${options.teacherDirective}

${COURSE_MARKDOWN_JSON_PROMPT}

═══ CONTRAT DE CONTENU UTILE ═══
• Retourne exactement un chapitre contenant exactement une leçon.
• Le titre du chapitre est « ${job.chapter.title} » et celui de la leçon « ${job.lesson.title} ».
• duration vaut exactement ${options.durationPerLesson}.
• Budget visé pour la leçon : ${job.budget.targetMinWords} à ${job.budget.targetMaxWords} mots utiles, environ ${job.budget.targetMinChars} à ${job.budget.targetMaxChars} caractères pédagogiques. Ce budget est un plafond de densité, pas une invitation au remplissage.
• Développe toutes les notions propriétaires avec définition, justification, méthode ou interprétation, puis arrête-toi lorsque l'objectif est couvert.
• Les titres de sections suivent required_sections. Une section supplémentaire n'est permise que pour une unique synthèse finale.
• Chaque exercice évalue une compétence différente de exercise_skills. Ne recycle jamais l'énoncé, les nombres ou la méthode d'un exercice visible dans la carte globale.
• Chaque paragraphe apporte une information nouvelle. Interdits : répétitions, introductions générales, reformulations de synthèse multiples, historique décoratif et texte ajouté uniquement pour augmenter la longueur.
• Un rappel autorisé reste bref. Une notion interdite n'est ni démontrée, ni étudiée, ni transformée en section. En cas de contradiction, la liste des notions propriétaires prime sur le titre ou le scope.
• Progression : mise en contexte utile → construction de la notion → méthode ou justification → applications élève réparties → approfondissement utile → une seule synthèse.
• Aucun titre « exercice résolu », « exercice corrigé » ou « exemple guidé ». Une méthode peut contenir un calcul expliqué sans imiter un exercice corrigé.
• Le premier exercice arrive après au moins trois blocs pédagogiques substantiels. Les exercices sont répartis, jamais tous à la fin.
• Une démonstration de trois étapes ou plus utilise "steps".
• ${visualRequirement(job.lesson.visualFocus)}
• Une courbe de fonction utilise exclusivement "graph". SVG/figure ne trace jamais une courbe, une tangente ou une asymptote.
• Vérifie les légendes : une tangente n'est horizontale que si la dérivée au point vaut zéro.
• Un tableau sur $e^{ax+b}$ ou toute famille paramétrée distingue explicitement les cas nécessaires.
• Recalcule chaque formule, exemple et exercice. Distingue minimum et infimum, implication et équivalence.
• Ne confonds jamais fonction croissante, vitesse de croissance constante et convexité : si $f''>0$, la pente augmente.
• Pour une application numérique, conserve la formule exacte, les unités et la même valeur arrondie dans answer et explanation.
• Avant toute comparaison de constantes ou de bases, vérifie numériquement le rapport utilisé.
• Pas de leçon supplémentaire, pas de préface hors JSON.

${exerciseSchema(options.includeExercises)}

Structure exacte :
{
  "title": "${job.chapter.title}",
  "lessons": [
    {
      "title": "${job.lesson.title}",
      "duration": ${options.durationPerLesson},
      "blocks": [BLOCS_STRUCTURÉS],
      "exercises": [EXERCICES_STRUCTURÉS]
    }
  ]
}

Réponds uniquement avec ce JSON.`;
}

function isTruncationError(error: unknown): boolean {
  return error instanceof Error && /tronqu|token|length|max_tokens/i.test(error.message);
}

function isInvalidStructuredJsonError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /JSON invalide|JSON incomplet|aucun contenu JSON|objet JSON|contenu JSON/i.test(
      error.message,
    )
  );
}

function isRecoverableWriterOutputError(error: unknown): boolean {
  return isTruncationError(error) || isInvalidStructuredJsonError(error);
}

async function mapSettledWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));

  const runWorker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      try {
        results[index] = {
          status: "fulfilled",
          value: await worker(items[index] as T, index),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

function createTaskLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const release = () => {
    active -= 1;
    const next = queue.shift();
    if (next) next();
  };

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active += 1;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

function lessonHasVisualFocus(
  lesson: StructuredCourseLesson | undefined,
  focus: CourseVisualFocus,
): boolean {
  if (focus === "none") return true;
  if (!lesson) return false;
  if (focus === "graph") return lesson.blocks.some((block) => block.type === "graph");
  if (focus === "variation_table") {
    return lesson.blocks.some((block) => block.type === "variation_table");
  }
  if (focus === "sign_table") {
    return lesson.blocks.some((block) => block.type === "sign_table");
  }
  if (focus === "figure") return lesson.blocks.some((block) => block.type === "figure");
  return lesson.blocks.some((block) => block.type === "table");
}

function blockingIssues(
  chapter: StructuredCourseChapter,
  options: {
    expectedLessonCount: number;
    includeExercises: boolean;
    minWordsPerLesson: number;
    requireGraph: boolean;
    validationScope?: "lesson" | "chapter";
    visualFocus?: CourseVisualFocus;
  },
) {
  const audited = auditStructuredCoursePedagogy(chapter, options).filter(
    (issue) => issue.severity === "error",
  );

  if (options.validationScope !== "lesson") return audited;

  // L'audit pédagogique historique raisonne au niveau d'un chapitre complet.
  // Pendant la rédaction multi-agent, chaque réponse ne contient qu'une seule
  // leçon : les règles « un visuel par chapitre » et « un graph quelque part
  // dans le chapitre » doivent donc être différées jusqu'à l'assemblage final.
  const lessonIssues = audited.filter(
    (issue) => issue.code !== "missing_visual" && issue.code !== "missing_graph",
  );

  // Seul un graph explicitement planifié reste bloquant au niveau de la leçon,
  // car il répond à une exigence de visualisation d'une étude de fonction. Les
  // autres visual_focus sont des orientations pédagogiques : leur absence ne
  // doit jamais détruire une leçon complète. Le chapitre assemblé garde ses
  // contrôles stricts sur la présence globale de visuels et de graphes.
  if (
    options.visualFocus === "graph" &&
    !lessonHasVisualFocus(chapter.lessons[0], "graph")
  ) {
    lessonIssues.push({
      severity: "error",
      code: "missing_planned_graph",
      path: "lessons[0].blocks",
      message: "La leçon chargée de la visualisation doit contenir un bloc graph rendu par mathGraph.",
    });
  }

  return lessonIssues;
}

function asUnknownRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function blueprintAuditMessages(raw: unknown): string[] {
  const record = asUnknownRecord(raw);
  const issues = Array.isArray(record?.issues) ? record.issues : [];
  return issues.flatMap((item) => {
    const issue = asUnknownRecord(item);
    if (!issue) return [];
    const location = typeof issue.location === "string" ? issue.location : "plan";
    const message = typeof issue.message === "string" ? issue.message : "";
    const suggestion = typeof issue.suggestion === "string" ? issue.suggestion : "";
    if (!message) return [];
    return [`${location} — ${message}${suggestion ? ` Correction attendue : ${suggestion}` : ""}`];
  }).slice(0, 20);
}

function isBlockingIndependentBlueprintMessage(message: string): boolean {
  const normalized = message
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const concernsExerciseSkills = normalized.includes("exercise_skills");
  const lexicalOverlap = /(proche|similaire|chevauch|doublon|duplicate|overlap)/.test(normalized);

  // Le modèle relecteur peut considérer deux compétences comme identiques
  // uniquement parce qu'elles emploient le même verbe. Le normaliseur les
  // contextualise déjà, et les vrais doublons d'exercices sont vérifiés sur
  // le contenu final. Une collision exacte reste détectée par l'audit local.
  return !(concernsExerciseSkills && lexicalOverlap);
}

function localBlueprintAuditMessages(
  blueprint: CourseBlueprint,
  subject: string,
  includeExercises: boolean,
  options: { blockingOnly?: boolean } = {},
): string[] {
  return auditCourseBlueprint(blueprint, { subject, includeExercises })
    .filter((issue) => !options.blockingOnly || isBlockingCourseBlueprintIssue(issue))
    .map((issue) => `${issue.location} — ${issue.message}`)
    .slice(0, 30);
}

export async function runCourseGeneration(
  generationId: string,
  params: CourseGenerationParams,
  adminId: number,
): Promise<void> {
  const tracker = createGenerationTracker("course_generations", generationId);
  const telemetry = new CourseGenerationTelemetry();
  const {
    grade_level,
    subject,
    additional_info,
    page_count,
    chapter_count,
    lessons_per_chapter,
    lesson_count,
    content_style = "balanced",
    include_exercises,
    language_level = "standard",
    subject_area,
    duration_per_lesson,
    difficulty = "medium",
    quality_mode = "balanced",
    folder_id,
  } = params;

  const chapterCount = clampNumber(page_count ?? chapter_count, 4, 1, 8);
  const lessonsPerChapter = clampNumber(
    lessons_per_chapter ?? lesson_count,
    3,
    1,
    6,
  );
  const durationPerLesson = clampNumber(duration_per_lesson, 30, 5, 90);
  const totalLessonCount = chapterCount * lessonsPerChapter;
  const shouldIncludeExercises = include_exercises !== false;
  const maxCourseCharacters = envNumber(
    "AI_COURSE_MAX_USEFUL_CHARS",
    140_000,
    20_000,
    220_000,
  );
  const configuredInterval = Number(process.env.MISTRAL_MIN_REQUEST_INTERVAL_MS);
  const minInterval =
    Number.isFinite(configuredInterval) && configuredInterval >= 0
      ? configuredInterval
      : DEFAULT_LLM_MIN_START_INTERVAL_MS;
  const generate = createLlmStartGate(
    minInterval,
    () => tracker.isCancelRequested(),
  );
  const legacyLessonConcurrency = envConcurrency(
    "AI_COURSE_LESSON_CONCURRENCY",
    quality_mode === "strict" ? 5 : 6,
    10,
  );
  const writerConcurrency = envConcurrency(
    "AI_COURSE_WRITER_CONCURRENCY",
    legacyLessonConcurrency,
    10,
  );
  const reviewerConcurrency = envConcurrency(
    "AI_COURSE_REVIEW_CONCURRENCY",
    quality_mode === "strict" ? 5 : 6,
    10,
  );
  const writerJsonRetryCount = envNumber(
    "AI_COURSE_WRITER_JSON_RETRIES",
    2,
    1,
    4,
  );
  const reviewLimit = createTaskLimiter(reviewerConcurrency);
  const publicationGateEnabled = process.env.AI_COURSE_PUBLICATION_GATE !== "0";
  const publicationReviewMaxTokens = envNumber(
    "AI_COURSE_PUBLICATION_REVIEW_MAX_TOKENS",
    128_000,
    8_000,
    128_000,
  );
  const publicationRepairMaxTokens = envNumber(
    "AI_COURSE_PUBLICATION_REPAIR_MAX_TOKENS",
    128_000,
    8_000,
    128_000,
  );
  const globalPublicationReviewMaxTokens = envNumber(
    "AI_COURSE_GLOBAL_REVIEW_MAX_TOKENS",
    128_000,
    12_000,
    128_000,
  );
  const globalPublicationRepairMaxTokens = envNumber(
    "AI_COURSE_GLOBAL_REPAIR_MAX_TOKENS",
    128_000,
    12_000,
    128_000,
  );
  const programmeBlock = getProgrammePromptBlock(String(grade_level));
  const teacherDirective = additional_info?.trim()
    ? `Instructions prioritaires de l'enseignant :\n${additional_info.trim()}`
    : "";

  try {
    await tracker.setStatus("running");
    await tracker.updateProgress({
      step: "outline",
      current: 0,
      total: totalLessonCount,
      message: "Planification globale des notions et des agents...",
    });

    telemetry.start("blueprint");
    const blueprintSystem = `Tu es l'agent planificateur principal d'Educalcul.
Tu conçois EN UNE FOIS la carte complète d'un cours de mathématiques français pour ${grade_level}.
${programmeBlock}

Retourne exactement ${chapterCount} chapitres et exactement ${lessonsPerChapter} leçons par chapitre.
Chaque leçon contient : title, objective, scope, core_concepts, prerequisite_recall, required_sections, exercise_skills, forbidden_concepts, visual_focus et complexity.

Règles impératives :
• répartis les notions avant toute rédaction ;
• core_concepts contient 2 à 4 notions ou compétences courtes et réellement propres à la leçon ;
• une notion principale apparaît dans core_concepts d'UNE SEULE leçon ;
• prerequisite_recall contient uniquement des notions déjà traitées avant cette leçon et qui pourront être rappelées en une phrase ;
• les titres de chapitres et de leçons sont pédagogiques et spécifiques : interdiction de « partie 1 », « leçon 2 », « introduction » ou du sujet recopié comme titre ;
• deux leçons ne doivent pas avoir le même objectif sous des formulations différentes ;
• required_sections contient 3 à 6 sections précises, toutes différentes de celles des autres leçons ;
• exercise_skills contient exactement 3 compétences d'exercices réellement différentes, réservées à cette leçon ;
• forbidden_concepts énumère les notions proches qu'un rédacteur pourrait être tenté de développer mais qui appartiennent à d'autres leçons ou sont hors niveau ;
• scope dit explicitement ce que la leçon couvre ET ce qu'elle ne couvre pas ;
• reste concis : titre 4 à 10 mots, objectif 15 à 28 mots, scope de leçon 25 à 50 mots, scope de chapitre 30 à 65 mots ;
• chaque entrée de core_concepts, required_sections, exercise_skills et forbidden_concepts tient sur une courte proposition, sans explication longue ;
• progression conforme au programme et au niveau ;
• aucune extension universitaire ou hors programme : pas d'exponentielle complexe, de formule d'Euler, d'analyse complexe, de série de Fourier ou de notion supérieure sauf demande explicite de l'enseignant et niveau compatible ;
• n'ajoute pas de chapitre artificiel pour augmenter la longueur ;
• visual_focus est un choix sémantique, jamais une rotation artificielle entre outils ;
• visual_focus="sign_table" uniquement pour étudier le signe d'une expression, des racines, facteurs ou intervalles ; jamais pour des limites, un lien exp/ln, une définition ou de la convexité seule ;
• visual_focus="variation_table" uniquement pour monotonie, dérivée, extrema ou variations ;
• visual_focus="graph" pour une vraie courbe, des limites, asymptotes, comparaisons de croissance, convexité ou lien entre fonctions réciproques ;
• visual_focus="table" pour propriétés, valeurs, méthodes ou comparaisons ;
• visual_focus="figure" uniquement pour schémas, camemberts, diagrammes, géométrie ou processus ; jamais une courbe de fonction ;
• visual_focus="none" lorsqu'aucun visuel n'apporte une vraie valeur ; toutes les leçons n'ont pas besoin d'un visuel ;
• pour une étude de fonction, répartis définition/propriétés, variations, limites, convexité et applications entre les leçons au lieu de tout répéter partout ;
• une notion propriétaire, une section imposée et une compétence d'exercice ne peuvent être attribuées qu'à une seule leçon ;
• complexity vaut 1, 2 ou 3 selon la densité réelle ;
• aucune formule, aucun HTML et aucun Markdown dans ce plan.

Le cours final peut utiliser jusqu'à ${maxCourseCharacters} caractères utiles, mais aucun agent ne devra écrire pour remplir.`;
    const blueprintUser = `Sujet : ${subject}
Domaine : ${subject_area || "Mathématiques"}
Difficulté : ${difficulty}
Style : ${content_style}
${teacherDirective}`;
    const blueprintContract = courseBlueprintSchema({
      chapterCount,
      lessonsPerChapter,
    });
    // Le blueprint est une structure JSON relativement petite.
    // Un plafond trop élevé peut prolonger inutilement le raisonnement du modèle.
    // 24k laisse une marge confortable pour le raisonnement et la sortie structurée.
    const blueprintMaxTokens = envNumber(
      "AI_COURSE_BLUEPRINT_MAX_TOKENS",
      24_000,
      8_000,
      32_000,
    );

    const rawBlueprint = await generate(
      blueprintUser,
      blueprintSystem,
      blueprintContract,
      0.12,
      blueprintMaxTokens,
      true,
    );

    let blueprint = normalizeCourseBlueprint(rawBlueprint, {
      subject,
      chapterCount,
      lessonsPerChapter,
      chapterRequiresGraph: (title, scope) =>
        topicRequiresFunctionGraph(subject, subject_area || "", title, scope),
    });
    telemetry.end(
      "blueprint",
      `${chapterCount} chapitre(s), ${totalLessonCount} leçon(s)`,
    );

    const deterministicPlanIssues = localBlueprintAuditMessages(
      blueprint,
      subject,
      shouldIncludeExercises,
      { blockingOnly: true },
    );
    let independentPlanIssues: string[] = [];
    telemetry.start("blueprint-review");
    try {
      const auditRaw = await generate(
        `Plan à auditer sans le réécrire :\n${JSON.stringify(blueprint)}`,
        `Tu es l'agent vérificateur indépendant du plan global Educalcul.
Niveau : ${grade_level}. Sujet : ${subject}. Domaine : ${subject_area || "Mathématiques"}.
${programmeBlock}
${teacherDirective}

Tu ne rédiges pas le cours et tu ne réécris pas le plan. Tu signales uniquement les défauts précis.
Vérifie obligatoirement :
• titres pédagogiques spécifiques, jamais « partie 1 » ou « leçon 2 » ;
• une progression logique où chaque notion principale a un seul propriétaire ;
• objectifs et required_sections distincts entre toutes les leçons ;
• pour exercise_skills, ne signale un doublon que si la compétence vise le même objet mathématique ET la même méthode ; un verbe commun comme « résoudre », « calculer » ou « modéliser » ne suffit pas ;
• scope assez précis pour dire ce qui est couvert et exclu ;
• prerequisite_recall uniquement vers des notions déjà traitées ;
• forbidden_concepts pertinent et sans contradiction avec core_concepts ;
• conformité stricte au programme et absence de notion hors niveau ;
• visuel sémantiquement utile ;
• aucun plan où une première leçon traite déjà tout le sujet.

verdict="ok" seulement si les rédacteurs peuvent travailler en parallèle sans se répéter.`,
        courseBlueprintAuditSchema(),
        0.05,
        envNumber("AI_COURSE_BLUEPRINT_REVIEW_MAX_TOKENS", 8_000, 2_000, 16_000),
        false,
      );
      independentPlanIssues = blueprintAuditMessages(auditRaw)
        .filter(isBlockingIndependentBlueprintMessage);
      telemetry.end(
        "blueprint-review",
        independentPlanIssues.length > 0
          ? `${independentPlanIssues.length} correction(s) demandée(s)`
          : "plan validé par un agent indépendant",
      );
    } catch (error) {
      telemetry.end("blueprint-review", "vérificateur indisponible, audit local conservé");
      console.warn("[course-ai] Vérification indépendante du plan indisponible.", error);
    }

    const planFeedback = [...deterministicPlanIssues, ...independentPlanIssues]
      .filter((message, index, all) => all.indexOf(message) === index)
      .slice(0, 30);
    if (planFeedback.length > 0) {
      telemetry.start("blueprint-repair");
      const repairedRaw = await generate(
        `${blueprintUser}

Le premier plan doit être entièrement repensé par le planificateur. Voici les défauts détectés :
${planFeedback.map((message, index) => `${index + 1}. ${message}`).join("\n")}

Retourne un nouveau plan complet, précis et non générique. Ne te contente pas de reformuler les mêmes leçons.`,
        blueprintSystem,
        blueprintContract,
        0.08,
        blueprintMaxTokens,
        true,
      );
      blueprint = normalizeCourseBlueprint(repairedRaw, {
        subject,
        chapterCount,
        lessonsPerChapter,
        chapterRequiresGraph: (title, scope) =>
          topicRequiresFunctionGraph(subject, subject_area || "", title, scope),
      });
      const remainingPlanIssues = localBlueprintAuditMessages(
        blueprint,
        subject,
        shouldIncludeExercises,
      );
      const blockingPlanIssues = localBlueprintAuditMessages(
        blueprint,
        subject,
        shouldIncludeExercises,
        { blockingOnly: true },
      ).filter(
        (message) => !message.includes(".scope — Le périmètre du chapitre est trop vague"),
      );
      telemetry.end(
        "blueprint-repair",
        blockingPlanIssues.length > 0
          ? `${blockingPlanIssues.length} défaut(s) bloquant(s) restant(s)`
          : remainingPlanIssues.length > 0
            ? "métadonnées de chapitre stabilisées localement"
            : "plan corrigé par le planificateur",
      );
      if (blockingPlanIssues.length > 0) {
        throw new Error(
          `Le plan global reste insuffisamment précis après une correction :\n${blockingPlanIssues
            .slice(0, 12)
            .map((message, index) => `${index + 1}. ${message}`)
            .join("\n")}`,
        );
      }
    }

    const jobs = createLessonJobs(blueprint, {
      durationPerLesson,
      includeExercises: shouldIncludeExercises,
      maxCourseCharacters,
    });
    const chapterTitles = blueprint.chapters.map((chapter) => chapter.title);

    await tracker.updateProgress({
      step: "chapter",
      current: 0,
      total: totalLessonCount,
      message: `${totalLessonCount} agents rédacteurs et relecteurs sont lancés en pipeline parallèle...`,
      chapterTitles,
    });

    const reviewedLessonPromises = new Array<Promise<StructuredCourseLesson>>(
      jobs.length,
    );
    let completedLessons = 0;
    let progressChain = Promise.resolve();
    const queueProgress = (message: string) => {
      completedLessons += 1;
      const current = completedLessons;
      progressChain = progressChain
        .then(() =>
          tracker.updateProgress({
            step: "chapter",
            current,
            total: totalLessonCount,
            message,
            chapterTitles,
          }),
        )
        .catch((error) => {
          console.warn("[course-ai] Mise à jour de progression indisponible.", error);
        });
      return progressChain;
    };

    const writerResults = await mapSettledWithConcurrency(
      jobs,
      writerConcurrency,
      async (job, jobIndex) => {
        if (await tracker.isCancelRequested()) {
          throw new GenerationCancelledError();
        }

        const writerLabel = `writer c${job.chapterIndex + 1}-l${job.lessonIndex + 1}`;
        telemetry.start(writerLabel);
        const systemPrompt = buildLessonSystemPrompt({
          blueprint,
          job,
          gradeLevel: String(grade_level),
          subject,
          subjectArea: subject_area || "Mathématiques",
          difficulty,
          durationPerLesson,
          includeExercises: shouldIncludeExercises,
          style: content_style,
          language: language_level,
          programmeBlock,
          teacherDirective,
        });
        const userPrompt = `Rédige la leçon « ${job.lesson.title} ». Couvre uniquement ses notions propriétaires et respecte son budget utile.`;
        const compactRecoverySystemPrompt = `Tu es le rédacteur de secours JSON d'Educalcul.
Tu dois générer UNE SEULE leçon complète et exploitable, sans reprendre ni commenter une sortie précédente.

Cours : ${blueprint.title}
Niveau : ${String(grade_level)}
Chapitre : ${job.chapter.title}
Leçon : ${job.lesson.title}
Objectif : ${job.lesson.objective}
Périmètre : ${job.lesson.scope}
Notions propriétaires : ${job.boundaries.ownedConcepts.join(" ; ")}
Sections obligatoires : ${job.lesson.requiredSections.join(" ; ")}
Compétences des exercices : ${job.lesson.exerciseSkills.join(" ; ")}
Notions interdites : ${job.boundaries.forbiddenDevelopments.join(" ; ") || "aucune"}
Visuel : ${job.lesson.visualFocus}

${COURSE_MARKDOWN_JSON_PROMPT}

CONTRAT DE SECOURS :
• Retourne uniquement un objet JSON complet et fermé.
• Un chapitre, une leçon, duration=${durationPerLesson}.
• Entre 7 et 12 blocs substantiels, sans remplissage ni répétition.
• ${visualRequirement(job.lesson.visualFocus)}
• ${shouldIncludeExercises ? "Exactement 3 exercices complets et différents, avec question, answer, hint et explanation cohérents." : "Aucun exercice."}
• Toute formule est entre $...$ ou dans display_math.
• Ne développe aucune notion interdite.
• Vérifie chaque calcul avant de fermer le JSON.

Structure racine exacte :
{"title":"${job.chapter.title}","lessons":[{"title":"${job.lesson.title}","duration":${durationPerLesson},"blocks":[],"exercises":[]}]}`;
        const contract = courseChapterSchema({
          lessonCount: 1,
          includeExercises: shouldIncludeExercises,
          minExercises: 3,
          maxExercises: 4,
        });
        // Une différence marginale de quelques mots ne doit jamais annuler un
        // cours complet. Le prompt continue de viser le budget pédagogique,
        // tandis que la validation structurelle accepte une marge de 10 %.
        const structuralMinWords = Math.max(
          240,
          Math.floor(job.budget.hardMinWords * 0.9),
        );
        const qualityOptions = {
          expectedLessonCount: 1,
          includeExercises: shouldIncludeExercises,
          minWordsPerLesson: structuralMinWords,
          requireGraph: job.lesson.visualFocus === "graph",
          validationScope: "lesson" as const,
          visualFocus: job.lesson.visualFocus,
        };

        const requestDraft = async (
          prompt: string,
          temperature: number,
          maxTokens: number,
          activeSystemPrompt = systemPrompt,
        ) => {
          const raw = await generate(
            prompt,
            activeSystemPrompt,
            contract,
            temperature,
            maxTokens,
            false,
          );
          let chapter = normalizeStructuredCoursePedagogy(
            normalizeStructuredCourseChapter(raw, {
              expectedLessonCount: 1,
              durationPerLesson,
              includeExercises: shouldIncludeExercises,
              maxExercisesPerLesson: 4,
            }),
          );
          if (chapter.lessons[0]) {
            chapter.title = job.chapter.title;
            chapter.lessons[0].title = job.lesson.title;
            chapter.lessons[0].duration = durationPerLesson;
          }
          const sanitized = sanitizeStructuredResources(chapter);
          chapter = normalizeStructuredCoursePedagogy(sanitized.value);
          return chapter;
        };

        const requestDraftWithFreshJsonRecovery = async (
          prompt: string,
          temperature: number,
          purpose: "draft" | "structural-correction",
        ): Promise<StructuredCourseChapter> => {
          let lastError: unknown;
          for (let attempt = 0; attempt <= writerJsonRetryCount; attempt += 1) {
            const freshRetry = attempt > 0;
            const activeSystemPrompt = freshRetry
              ? compactRecoverySystemPrompt
              : systemPrompt;
            const activePrompt = freshRetry
              ? `${prompt}\n\nGÉNÉRATION FRAÎCHE ${attempt}/${writerJsonRetryCount}. Ignore toute sortie précédente. Produis maintenant l'objet JSON complet depuis zéro. Ferme tous les tableaux, objets et chaînes. ${attempt === writerJsonRetryCount ? "Privilégie une structure compacte : 7 à 9 blocs et exactement 3 exercices courts." : "Aucun texte avant ou après le JSON."}`
              : prompt;
            const activeTemperature = freshRetry
              ? attempt === writerJsonRetryCount
                ? 0
                : 0.02
              : temperature;
            try {
              return await requestDraft(
                activePrompt,
                activeTemperature,
                job.budget.maxOutputTokens,
                activeSystemPrompt,
              );
            } catch (error) {
              lastError = error;
              if (!isRecoverableWriterOutputError(error)) throw error;
              if (attempt >= writerJsonRetryCount) break;
              console.warn(
                `[course-ai] Sortie JSON inutilisable pour « ${job.lesson.title} » (${purpose}, tentative ${attempt + 1}/${writerJsonRetryCount + 1}); nouvelle génération fraîche et compacte.`,
              );
            }
          }
          throw lastError instanceof Error
            ? lastError
            : new Error(
                `La leçon « ${job.lesson.title} » n'a pas pu produire un JSON complet.`,
              );
        };

        let structured = await requestDraftWithFreshJsonRecovery(
          userPrompt,
          0.16,
          "draft",
        );

        let issues = blockingIssues(structured, qualityOptions);
        let bestScore = structuredCourseQualityScore(structured, qualityOptions);
        if (!hasCompleteLesson(structured.lessons[0], shouldIncludeExercises) || issues.length > 0) {
          const issueSummary = formatStructuredQualityIssues(issues);
          const retry = await requestDraftWithFreshJsonRecovery(
            `${userPrompt}\nCORRECTION STRUCTURELLE UNIQUE. La leçon précédente ne respectait pas le contrat :\n${issueSummary || "structure ou exercices incomplets"}\nRends une leçon complète sans changer le périmètre, sans répétition et sans ajouter de notion attribuée aux autres agents.`,
            0.02,
            "structural-correction",
          );
          const retryScore = structuredCourseQualityScore(retry, qualityOptions);
          const retryIssues = blockingIssues(retry, qualityOptions);
          if (
            retryIssues.length < issues.length ||
            (retryIssues.length === issues.length && retryScore >= bestScore)
          ) {
            structured = retry;
            issues = retryIssues;
            bestScore = retryScore;
          }
        }

        const lesson = structured.lessons[0];
        if (!hasCompleteLesson(lesson, shouldIncludeExercises) || issues.length > 0) {
          throw new Error(
            `La leçon « ${job.lesson.title} » reste structurellement non conforme :\n${formatStructuredQualityIssues(issues) || "contenu incomplet"}`,
          );
        }

        telemetry.end(
          writerLabel,
          `${lessonUsefulCharacterCount(lesson)} caractères utiles`,
        );

        // Le rédacteur libère immédiatement son slot. La relecture part dans
        // une file séparée et commence dès qu'un relecteur est disponible.
        reviewedLessonPromises[jobIndex] = reviewLimit(async () => {
          const reviewLabel = `review c${job.chapterIndex + 1}-l${job.lessonIndex + 1}`;
          telemetry.start(reviewLabel);
          let reviewed = lesson;
          let patchCount = 0;
          let deletedExerciseCount = 0;
          let unstructuredMathFields = courseLessonUnstructuredMathFields(lesson);
          try {
            const result = await reviewCourseLesson(lesson, {
              generate,
              courseTitle: blueprint.title,
              chapterTitle: job.chapter.title,
              lessonPlan: job.lesson,
              boundaries: job.boundaries,
              level: String(grade_level),
              subject,
            });
            reviewed = result.value;
            patchCount = result.report.patches;
            deletedExerciseCount = result.report.deletedExercises;
            unstructuredMathFields = result.report.unstructuredMathFields;
            if (result.report.warnings.length > 0) {
              console.warn(
                `[course-ai] Relecteur ${job.lesson.title}: ${result.report.warnings.join(" | ")}`,
              );
            }
          } catch (error) {
            console.warn(
              `[course-ai] Relecteur indisponible pour « ${job.lesson.title} »; validations locales conservées.`,
              error,
            );
          }

          if (unstructuredMathFields.length > 0) {
            throw new Error(
              `La leçon « ${job.lesson.title} » contient encore des mathématiques non délimitées dans : ${unstructuredMathFields.join(", ")}.`,
            );
          }

          let reviewedChapter = normalizeStructuredCoursePedagogy({
            title: job.chapter.title,
            lessons: [reviewed],
          });
          const sanitized = sanitizeStructuredResources(reviewedChapter);
          reviewedChapter = normalizeStructuredCoursePedagogy(sanitized.value);
          const repaired = await repairInvalidStructuredMath(reviewedChapter, {
            generate,
            label: `cours ${blueprint.title}, chapitre ${job.chapter.title}, leçon ${job.lesson.title}`,
            enableModelRepair: false,
          });
          reviewedChapter = normalizeStructuredCoursePedagogy(repaired.value);
          const finalIssues = blockingIssues(reviewedChapter, qualityOptions);
          if (finalIssues.length > 0 || !reviewedChapter.lessons[0]) {
            throw new Error(
              `La leçon « ${job.lesson.title} » reste non conforme après relecture :\n${formatStructuredQualityIssues(finalIssues)}`,
            );
          }

          const finalLesson = reviewedChapter.lessons[0];
          telemetry.end(
            reviewLabel,
            `${patchCount} patch(es), ${deletedExerciseCount} exercice(s) supprimé(s), ${repaired.report.fallbackCount} repli(s) KaTeX`,
          );
          await queueProgress(
            `Leçon ${completedLessons + 1}/${totalLessonCount} vérifiée : ${job.lesson.title}`,
          );
          return finalLesson;
        });
      },
    );

    if (await tracker.isCancelRequested()) {
      await Promise.allSettled(
        reviewedLessonPromises.filter(
          (promise): promise is Promise<StructuredCourseLesson> => Boolean(promise),
        ),
      );
      await tracker.setStatus("cancelled");
      return;
    }

    const failedWriters = writerResults
      .map((result, index) => (result.status === "rejected" ? jobs[index] : null))
      .filter((job): job is LessonJob => Boolean(job));
    writerResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `[course-ai] Échec de l'agent rédacteur « ${jobs[index]?.lesson.title} » :`,
          result.reason,
        );
      }
    });
    if (failedWriters.length > 0) {
      await Promise.allSettled(
        reviewedLessonPromises.filter(
          (promise): promise is Promise<StructuredCourseLesson> => Boolean(promise),
        ),
      );
      throw new Error(
        `Le cours n'a pas été enregistré car ${failedWriters.length} leçon(s) n'ont pas pu être rédigées : ${failedWriters.map((job) => job.lesson.title).join(", ")}.`,
      );
    }

    const reviewResults = await Promise.allSettled(reviewedLessonPromises);
    await progressChain;
    const failedReviews = reviewResults
      .map((result, index) => (result.status === "rejected" ? jobs[index] : null))
      .filter((job): job is LessonJob => Boolean(job));
    reviewResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `[course-ai] Échec de la leçon vérifiée « ${jobs[index]?.lesson.title} » :`,
          result.reason,
        );
      }
    });
    if (failedReviews.length > 0) {
      throw new Error(
        `Le cours n'a pas été enregistré car ${failedReviews.length} leçon(s) restent non conformes après vérification : ${failedReviews.map((job) => job.lesson.title).join(", ")}.`,
      );
    }

    const reviewedLessons = reviewResults.map(
      (result) => (result as PromiseFulfilledResult<StructuredCourseLesson>).value,
    );
    let structuredChapters: StructuredCourseChapter[] = blueprint.chapters.map(
      (chapter, chapterIndex) => ({
        title: chapter.title,
        lessons: jobs
          .map((job, index) => ({ job, lesson: reviewedLessons[index] }))
          .filter(({ job }) => job.chapterIndex === chapterIndex)
          .sort((left, right) => left.job.lessonIndex - right.job.lessonIndex)
          .map(({ lesson }) => lesson as StructuredCourseLesson),
      }),
    );

    const initialCoordinationIssues = auditCourseCoordination(
      structuredChapters,
      blueprint,
    );
    const duplicateExerciseIssues = initialCoordinationIssues.filter(
      (issue) => issue.code === "duplicate_exercise",
    );
    if (duplicateExerciseIssues.length > 0) {
      telemetry.start("coordination-review");
      try {
        const coordinated = await replaceDuplicateCourseExercises(
          structuredChapters,
          {
            generate,
            blueprint,
            level: String(grade_level),
            subject,
            issues: duplicateExerciseIssues,
          },
        );
        structuredChapters = coordinated.value;
        telemetry.end(
          "coordination-review",
          `${coordinated.replacements} exercice(s) inter-leçons remplacé(s)`,
        );
      } catch (error) {
        telemetry.end("coordination-review", "coordinateur indisponible");
        console.warn(
          "[course-ai] Le coordinateur final des exercices est indisponible.",
          error,
        );
      }
    }

    const deduplicated = deduplicateCourseChapters(structuredChapters);
    let finalStructuredChapters = deduplicated.chapters.map(
      normalizeStructuredCoursePedagogy,
    );
    const dedupeCreatedIssue = finalStructuredChapters.some((chapter, index) => {
      const requireGraph = topicRequiresFunctionGraph(
        subject,
        subject_area || "",
        blueprint.chapters[index]?.title || "",
        blueprint.chapters[index]?.scope || "",
      );
      return blockingIssues(chapter, {
        expectedLessonCount: lessonsPerChapter,
        includeExercises: shouldIncludeExercises,
        minWordsPerLesson: Math.min(...jobs
          .filter((job) => job.chapterIndex === index)
          .map((job) => job.budget.hardMinWords)),
        requireGraph,
      }).length > 0;
    });
    if (dedupeCreatedIssue) {
      finalStructuredChapters = structuredChapters.map(
        normalizeStructuredCoursePedagogy,
      );
      console.info(
        "[course-ai] Déduplication annulée car elle retirait un bloc nécessaire.",
      );
    } else if (deduplicated.removedBlocks > 0) {
      console.info(
        `[course-ai] ${deduplicated.removedBlocks} bloc(s) quasi identique(s) supprimé(s) entre les leçons.`,
      );
    }

    if (publicationGateEnabled) {
      telemetry.start("publication-gate");
      const publicationEntries = jobs.map((job) => ({
        job,
        lesson: finalStructuredChapters[job.chapterIndex]?.lessons[job.lessonIndex],
      }));
      const publicationResults = await mapSettledWithConcurrency(
        publicationEntries,
        reviewerConcurrency,
        async ({ job, lesson }) => {
          if (!lesson) {
            throw new Error(`Leçon finale introuvable : ${job.lesson.title}.`);
          }
          if (await tracker.isCancelRequested()) {
            throw new GenerationCancelledError();
          }
          const label = `publication-check c${job.chapterIndex + 1}-l${job.lessonIndex + 1}`;
          telemetry.start(label);
          const checked = await verifyCourseLessonForPublication(lesson, {
            generate,
            courseTitle: blueprint.title,
            chapterTitle: job.chapter.title,
            lessonPlan: job.lesson,
            boundaries: job.boundaries,
            level: String(grade_level),
            subject,
            reviewMaxTokens: publicationReviewMaxTokens,
            repairMaxTokens: publicationRepairMaxTokens,
          });
          if (checked.report.unresolved.length > 0) {
            throw new Error(
              `La leçon « ${job.lesson.title} » ne franchit pas la barrière de publication :\n${checked.report.unresolved
                .slice(0, 12)
                .map(
                  (issue, index) =>
                    `${index + 1}. [${issue.category}] ${issue.id} — ${issue.message}`,
                )
                .join("\n")}`,
            );
          }
          telemetry.end(
            label,
            `${checked.report.patches} patch(es), ${checked.report.repairRounds} cycle(s), ${checked.report.fallbackExerciseRewrites} exercice(s) reconstruit(s), 0 erreur bloquante restante`,
          );
          return checked.value;
        },
      );

      const publicationFailures = publicationResults
        .map((result, index) =>
          result.status === "rejected"
            ? { job: publicationEntries[index]?.job, reason: result.reason }
            : null,
        )
        .filter(
          (entry): entry is { job: LessonJob; reason: unknown } => Boolean(entry?.job),
        );
      publicationFailures.forEach(({ job, reason }) => {
        console.error(
          `[course-ai] Barrière de publication refusée pour « ${job.lesson.title} » :`,
          reason,
        );
      });
      if (publicationFailures.length > 0) {
        throw new Error(
          `Le cours n'a pas été enregistré car ${publicationFailures.length} leçon(s) contiennent encore une erreur mathématique ou pédagogique bloquante : ${publicationFailures
            .map(({ job }) => job.lesson.title)
            .join(", ")}.`,
        );
      }

      const checkedLessons = publicationResults.map(
        (result) =>
          (result as PromiseFulfilledResult<StructuredCourseLesson>).value,
      );
      finalStructuredChapters = blueprint.chapters.map((chapter, chapterIndex) => ({
        title: chapter.title,
        lessons: jobs
          .map((job, index) => ({ job, lesson: checkedLessons[index] }))
          .filter(({ job }) => job.chapterIndex === chapterIndex)
          .sort((left, right) => left.job.lessonIndex - right.job.lessonIndex)
          .map(({ lesson }) => normalizeStructuredCoursePedagogy({
            title: chapter.title,
            lessons: [lesson],
          }).lessons[0] as StructuredCourseLesson),
      }));
      telemetry.end(
        "publication-gate",
        `${totalLessonCount} leçon(s) validée(s), mode fail-closed`,
      );

      telemetry.start("publication-global");
      const globalCheck = await verifyCourseGloballyForPublication(
        finalStructuredChapters,
        {
          generate,
          blueprint,
          level: String(grade_level),
          subject,
          reviewMaxTokens: globalPublicationReviewMaxTokens,
          repairMaxTokens: globalPublicationRepairMaxTokens,
        },
      );
      if (globalCheck.report.unresolved.length > 0) {
        throw new Error(
          `Le cours ne franchit pas le contrôle global de publication :\n${globalCheck.report.unresolved
            .slice(0, 15)
            .map(
              (issue, index) =>
                `${index + 1}. [${issue.category}] ${issue.id} — ${issue.message}`,
            )
            .join("\n")}`,
        );
      }
      finalStructuredChapters = globalCheck.value.map(
        normalizeStructuredCoursePedagogy,
      );
      telemetry.end(
        "publication-global",
        `${globalCheck.report.patches} patch(es), ${globalCheck.report.repairRounds} cycle(s), cohérence inter-leçons validée`,
      );
    }

    const finalCoordinationIssues = auditCourseCoordination(
      finalStructuredChapters,
      blueprint,
    );
    const blockingCoordinationIssues = finalCoordinationIssues.filter(
      (issue) =>
        issue.code === "duplicate_exercise" || issue.code === "duplicate_content",
    );
    const coverageWarnings = finalCoordinationIssues.filter(
      (issue) => issue.code === "missing_owned_concept",
    );
    if (coverageWarnings.length > 0) {
      console.warn(
        `[course-ai] Audit de couverture : ${coverageWarnings
          .map((issue) => `${issue.first}: ${issue.message}`)
          .join(" | ")}`,
      );
    }
    if (blockingCoordinationIssues.length > 0) {
      throw new Error(
        `Le cours contient encore des répétitions inter-leçons avant enregistrement :\n${blockingCoordinationIssues
          .slice(0, 10)
          .map(
            (issue, index) =>
              `${index + 1}. ${issue.first} / ${issue.second} — ${issue.message}`,
          )
          .join("\n")}`,
      );
    }

    if (await tracker.isCancelRequested()) {
      await tracker.setStatus("cancelled");
      return;
    }

    telemetry.start("compile");
    const contentJson: CompiledCourseChapter[] = [];
    for (let chapterIndex = 0; chapterIndex < finalStructuredChapters.length; chapterIndex += 1) {
      const chapter = finalStructuredChapters[chapterIndex] as StructuredCourseChapter;
      const requireGraph = topicRequiresFunctionGraph(
        subject,
        subject_area || "",
        blueprint.chapters[chapterIndex]?.title || "",
        blueprint.chapters[chapterIndex]?.scope || "",
      );
      const chapterJobs = jobs.filter((job) => job.chapterIndex === chapterIndex);
      const chapterIssues = blockingIssues(chapter, {
        expectedLessonCount: lessonsPerChapter,
        includeExercises: shouldIncludeExercises,
        minWordsPerLesson: Math.min(
          ...chapterJobs.map((job) => job.budget.hardMinWords),
        ),
        requireGraph,
      });
      if (chapterIssues.length > 0) {
        throw new Error(
          `Le chapitre « ${chapter.title} » reste non conforme :\n${formatStructuredQualityIssues(chapterIssues)}`,
        );
      }
      const compiled = compileStructuredCourseChapter(chapter, {
        chapterIndex,
        durationPerLesson,
      });
      contentJson.push(compiled);
      await tracker.updateProgress({
        step: "chapter",
        current: totalLessonCount,
        total: totalLessonCount,
        message: `Chapitre ${chapterIndex + 1}/${chapterCount} assemblé : ${chapter.title}`,
        chapterTitles,
        chapters: { [chapterIndex]: compiled },
      });
    }
    telemetry.end("compile", `${contentJson.length} chapitre(s)`);

    if (contentJson.length !== chapterCount) {
      throw new Error("Le nombre final de chapitres ne correspond pas à la demande.");
    }

    const actualUsefulCharacters = finalStructuredChapters.reduce(
      (courseSum, chapter) =>
        courseSum +
        chapter.lessons.reduce(
          (chapterSum, lesson) =>
            chapterSum + lessonUsefulCharacterCount(lesson),
          0,
        ),
      0,
    );
    if (actualUsefulCharacters > maxCourseCharacters * 1.15) {
      console.warn(
        `[course-ai] Le cours contient ${actualUsefulCharacters} caractères utiles, au-dessus du budget indicatif ${maxCourseCharacters}. Aucun contenu n'a été tronqué automatiquement.`,
      );
    }

    await tracker.updateProgress({
      step: "final-check",
      current: totalLessonCount,
      total: totalLessonCount + 1,
      message: "Enregistrement du cours...",
    });

    telemetry.start("save");
    const { data: courseRow, error: insertError } = await supabaseAdmin
      .from("courses")
      .insert({
        title: blueprint.title,
        description: blueprint.description,
        subject,
        level: String(grade_level) || "6eme",
        status: "draft",
        thumbnail_url: "",
        folder_id: folder_id || null,
        content_json: contentJson,
        estimated_time: finalStructuredChapters.reduce(
          (total, chapter) =>
            total + chapter.lessons.reduce((sum, lesson) => sum + lesson.duration, 0),
          0,
        ),
        is_published: false,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await auditLog({
      action: AuditAction.CONTENT_CREATED,
      adminId,
      targetType: "course",
      targetId: String(courseRow.id),
      details: {
        title: courseRow.title,
        status: courseRow.status,
        source: publicationGateEnabled
          ? "ai_publication_gate_v2_8"
          : "ai_coordinated_planning_v2_7",
        useful_characters: actualUsefulCharacters,
        timings_ms: telemetry.summary(),
      },
    });

    telemetry.end("save");
    telemetry.total(
      `${actualUsefulCharacters} caractères utiles, ${totalLessonCount} leçon(s)`,
    );
    await tracker.updateProgress({
      step: "final-check",
      current: totalLessonCount + 1,
      total: totalLessonCount + 1,
      message: "Cours enregistré.",
    });
    await tracker.setStatus("done", { course_id: courseRow.id });
  } catch (error: unknown) {
    telemetry.total("échec");
    if (error instanceof GenerationCancelledError) {
      await tracker.setStatus("cancelled");
      return;
    }
    console.error("❌ Erreur génération cours IA structurée:", error);
    await tracker.setStatus("error", {
      error: error instanceof Error ? error.message : "Erreur de génération",
    });
  }
}
