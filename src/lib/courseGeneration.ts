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
  type StructuredQualityIssue,
} from "@/lib/ai/pedagogy";
import {
  repairUnstructuredMathText,
  sanitizeStructuredResources,
} from "@/lib/ai/qualityGuard";
import {
  CourseGenerationTelemetry,
  createLessonJobs,
  deduplicateCourseChapters,
  lessonUsefulCharacterCount,
  normalizeCourseBlueprint,
  type CourseBlueprint,
  type CourseVisualFocus,
  type LessonJob,
} from "@/lib/ai/coursePipeline";
import { reviewCourseLesson } from "@/lib/ai/courseReview";

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
La question ne contient jamais la réponse. answer et la conclusion de explanation donnent exactement le même résultat mathématique. Recalcule chaque activité avant de répondre.
Varie la formulation d'un exercice à l'autre (l'élève ne doit jamais voir 3 énoncés qui se ressemblent) : mélange par exemple un calcul direct, un "Vrai ou faux ? Justifier.", un "Identifie l'erreur dans ce raisonnement : [raisonnement fautif court]" ou une comparaison de deux valeurs — toujours répondu en texte libre, jamais de choix à cocher.`;
}

function visualRequirement(focus: CourseVisualFocus): string {
  if (focus === "none") {
    return "Aucun visuel n'est imposé pour cette leçon. N'en ajoute un que s'il apporte une vraie valeur pédagogique.";
  }
  if (focus === "graph") {
    return 'Ajoute un bloc "graph" utile, avec expression mathGraph exacte et légende mathématiquement correcte (caption avec $...$ pour tout symbole, jamais "infty" ou "lambda" en toutes lettres).';
  }
  if (focus === "variation_table") {
    return 'Ajoute un bloc "variation_table" cohérent ET un bloc "graph" correspondant, rendu par mathGraph.';
  }
  if (focus === "sign_table") {
    return 'Ajoute un bloc "sign_table" cohérent avec les racines et les intervalles.';
  }
  if (focus === "figure") {
    return 'Ajoute le bloc dédié le plus adapté : "trig_circle" (cercle trigonométrique), "pie_chart" (camembert), "number_line" (droite graduée, intervalle), "bar_chart" (effectifs), "probability_tree" (arbre pondéré), "venn_diagram" (ensembles/événements) ou "triangle_diagram" (géométrie annotée). N\'utilise "figure" que si aucun ne correspond. Jamais une courbe de fonction.';
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
• N'utilise jamais \\begin{array}, \\begin{matrix} ni aucun environnement LaTeX de mise en page tabulaire (non supporté, rendu cassé à l'affichage) : pour une opération posée en colonnes, utilise exclusivement le bloc "column_operation" (n°21 ci-dessous).
• Les champs "caption" des blocs graph et figure suivent la même règle : tout symbole ou expression (infini, lambda, fraction, comparaison, f(x)=...) est entre $...$. N'écris jamais "infty", "-infty", "lambda" ou une inégalité en toutes lettres dans une caption : ces mots ne sont jamais convertis en symbole à l'affichage.
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
9. {"type":"graph","expression":"exp(x)","xmin":-5,"xmax":5,"caption":"Courbe de $f(x)=e^x$, asymptote horizontale $y=0$ en $-\\\\infty$.","parameter":null,"vectors":[]}
10. {"type":"figure", ...} uniquement pour un schéma géométrique simple non couvert par les blocs 11-17 ci-dessous (jamais une courbe, jamais un cercle trigonométrique).
11. {"type":"trig_circle","caption":"Cercle trigonométrique et angles remarquables.","highlighted_angles":[{"angle_deg":30,"label":"$\\\\frac{\\\\pi}{6}$"},{"angle_deg":90,"label":"$\\\\frac{\\\\pi}{2}$"}]} — le serveur calcule lui-même les coordonnées exactes affichées ; label est juste le nom de l'angle, jamais les coordonnées.
12. {"type":"pie_chart","caption":"Répartition des réponses.","slices":[{"label":"Oui","value":60,"tone":"blue"},{"label":"Non","value":40,"tone":"gold"}]}
13. {"type":"number_line","caption":"Ensemble des solutions.","min":-5,"max":5,"points":[{"value":2,"label":"2","filled":true}],"intervals":[{"from":-2,"to":3,"from_included":false,"to_included":true,"tone":"blue"}]}
14. {"type":"bar_chart","caption":"Effectifs par catégorie.","bars":[{"label":"A","value":12,"tone":"blue"},{"label":"B","value":7,"tone":"gold"}]}
15. {"type":"probability_tree","caption":"Arbre pondéré de l'expérience.","branches":[{"label":"Rouge","probability":"1/3","children":[{"label":"Gagné","probability":"1/2"},{"label":"Perdu","probability":"1/2"}]}]}
16. {"type":"venn_diagram","caption":"Événements A et B.","sets":[{"label":"A","tone":"blue"},{"label":"B","tone":"gold"}],"region_labels":{"a_only":"5","b_only":"3","both":"2","neither":"10"}} (region_labels à null si non pertinent)
17. {"type":"triangle_diagram","caption":"Triangle ABC rectangle en A.","vertex_labels":["A","B","C"],"side_labels":["","5 cm","3 cm"],"angle_labels":["90°","",""],"right_angle_at":0} (side_labels/angle_labels : chaîne vide si non annoté ; right_angle_at à null si aucun angle droit)
18. {"type":"box_plot","caption":"Diagramme en boîte des notes.","min":4,"q1":9,"median":12,"q3":15,"max":19,"axis_label":"Notes sur 20"}
19. {"type":"steps","steps":[{"title":"Étape 1","blocks":[BLOCS]}]}
20. {"type":"exercise","exercise_index":1}
21. {"type":"column_operation","operator":"+","operands":["24","15"],"result":"39","carries":[]} — POUR TOUTE opération posée en colonnes (addition, soustraction, multiplication, division), quel que soit le niveau : jamais de \\begin{array}, jamais de tableau Markdown ni de bloc "table" pour représenter un calcul posé, c'est le seul bloc autorisé pour ça. operands : les nombres du haut vers le bas (2 à 4). result : le résultat final. carries : les retenues au-dessus de chaque colonne si besoin (ex ["1"] pour une addition avec une retenue), tableau vide sinon. Exemple soustraction avec emprunt : {"type":"column_operation","operator":"-","operands":["52","27"],"result":"25","carries":[]}.
Les blocs 11-18 et 21 sont déterministes : ne fournis QUE les données sémantiques demandées (angles, valeurs, labels courts, opérandes), jamais de coordonnées x/y ni de mise en page — le serveur calcule toute la disposition.`;

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
              `  ${chapterIndex + 1}.${lessonIndex + 1} ${lesson.title} — ${lesson.coreConcepts.join(" ; ")}`,
          )
          .join("\n")}`,
    )
    .join("\n");
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
• Chaque paragraphe apporte une information nouvelle. Interdits : répétitions, introductions générales, reformulations de synthèse multiples, historique décoratif et texte ajouté uniquement pour augmenter la longueur.
• Un rappel autorisé reste bref. Une notion interdite n'est ni démontrée, ni étudiée, ni transformée en section. En cas de contradiction, la liste des notions propriétaires prime sur le titre ou le scope.
• Si résoudre une équation ou une inéquation demanderait une notion interdite (typiquement le logarithme), ne l'esquive jamais par une formulation floue du type « si le logarithme était disponible » ou « n'est pas disponible ici, mais... » : soit tu limites l'énoncé à des cas résolubles avec les seuls outils du périmètre (ex: second membre égal à une puissance de $e$ déjà connue), soit tu dis explicitement en une phrase que le cas général sera traité avec l'outil vu au chapitre suivant, sans jamais écrire la formule interdite « à titre indicatif ».
• Progression : mise en contexte utile → construction de la notion → méthode ou justification → applications élève réparties → approfondissement utile → une seule synthèse.
• Le tableau de synthèse et le callout "Point clé" n'ont le droit d'exister que s'ils apportent une information absente du texte qui précède (comparaison de plusieurs cas côte à côte, piège fréquent, lien avec un autre chapitre) : jamais une reformulation de la dernière propriété ou du dernier paragraphe déjà énoncés.
• Aucun titre « exercice résolu », « exercice corrigé » ou « exemple guidé ». Une méthode peut contenir un calcul expliqué sans imiter un exercice corrigé.
• Le premier exercice arrive après au moins trois blocs pédagogiques substantiels. Les exercices sont répartis, jamais tous à la fin.
• Une démonstration de trois étapes ou plus utilise "steps".
• ${visualRequirement(job.lesson.visualFocus)}
• Une courbe de fonction utilise exclusivement "graph". SVG/figure ne trace jamais une courbe, une tangente ou une asymptote.
• Un cercle trigonométrique utilise exclusivement le bloc "trig_circle" (jamais "figure") : le serveur calcule lui-même les coordonnées exactes des angles remarquables, tu ne fournis que l'angle et son nom. Un seul nom court par angle (ex: "$\\frac{\\pi}{6}$"), jamais deux angles co-terminaux dans le même label (pas de "$-\\frac{\\pi}{3}$ ou $\\frac{5\\pi}{3}$") : le serveur affiche déjà la coordonnée exacte à côté, un label trop long déborde du cadre.
• Un camembert utilise "pie_chart", une droite graduée ou un ensemble de solutions "number_line", un diagramme en barres "bar_chart", un arbre pondéré "probability_tree", un diagramme d'ensembles "venn_diagram", un triangle ou schéma géométrique annoté "triangle_diagram", une boîte à moustaches "box_plot". N'utilise "figure" que si aucun de ces blocs dédiés ne correspond.
• Vérifie les légendes : une tangente n'est horizontale que si la dérivée au point vaut zéro.
• Un tableau sur $e^{ax+b}$ ou toute famille paramétrée distingue explicitement les cas nécessaires.
• Recalcule chaque formule, exemple et exercice. Distingue minimum et infimum, implication et équivalence.
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

// "Rends une leçon complète" ou "corrige ça" ne suffit jamais à faire agir le
// modèle sur un défaut précis (vu deux fois en prod : mots insuffisants puis
// exercices groupés, chacun stable sur 2 tentatives tant qu'aucune directive
// concrète n'était donnée). Chaque nouveau code de blocage structurel DOIT
// venir avec une directive actionnable ici, sinon la correction se contente
// de reformuler sans jamais résoudre le problème réel.
const STRUCTURAL_CORRECTION_DIRECTIVES: Record<string, string> = {
  lesson_too_short:
    "LA LEÇON EST TROP COURTE : ajoute au moins 120 mots de contenu substantiel et nouveau (approfondissement, exemple traité, remarque pédagogique, application) strictement dans le périmètre. Ne te contente pas de reformuler l'existant : le nombre de mots doit augmenter nettement.",
  lesson_too_sparse:
    "LA LEÇON N'A PAS ASSEZ DE BLOCS PÉDAGOGIQUES UTILES : ajoute au moins 2 blocs substantiels supplémentaires (paragraphe, méthode, exemple, tableau) strictement dans le périmètre, pas seulement plus de texte dans les blocs déjà présents.",
  exercises_clustered:
    "AU MOINS DEUX EXERCICES SE SUIVENT SANS RIEN ENTRE EUX : insère un bloc pédagogique substantiel (paragraphe, méthode ou exemple traité) entre CHAQUE paire d'exercices consécutifs, y compris entre les deux derniers exercices en fin de leçon. Aucun exercice ne doit jamais suivre directement un autre exercice.",
  exercise_before_explanation:
    "UN EXERCICE ARRIVE TROP TÔT : déplace le premier exercice après au moins 3 blocs pédagogiques substantiels (définition, propriété, méthode) au lieu de le laisser en début de leçon.",
  missing_planned_graph:
    'LE GRAPHE REQUIS EST ABSENT : ajoute, en plus des blocs existants, un bloc {"type":"graph"} avec une expression mathGraph exacte et une légende mathématiquement correcte.',
  solved_exercise_in_lesson:
    "UN TITRE RESSEMBLE À UN EXERCICE CORRIGÉ : renomme-le en méthode ou explication de calcul, sans jamais le présenter comme un exercice résolu ou un exemple guidé.",
  exercise_count:
    "LE NOMBRE D'EXERCICES EST INCORRECT : produis exactement 3 exercices (4 seulement si la quatrième apporte une compétence réellement différente).",
  exercise_references:
    'LES RÉFÉRENCES D\'EXERCICES SONT INCORRECTES : chaque exercice doit être référencé exactement une fois par un bloc {"type":"exercise","exercise_index":N}, N allant de 1 au nombre total d\'exercices, sans doublon ni index manquant.',
};

function structuralCorrectionDirectives(
  issues: StructuredQualityIssue[],
): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const issue of issues) {
    const directive = STRUCTURAL_CORRECTION_DIRECTIVES[issue.code];
    if (directive && !seen.has(issue.code)) {
      seen.add(issue.code);
      lines.push(directive);
    }
  }
  return lines.length > 0 ? `\n${lines.join("\n")}` : "";
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

export async function runCourseGeneration(
  generationId: string,
  params: CourseGenerationParams,
  adminId: number,
): Promise<void> {
  const tracker = createGenerationTracker("content_generations", generationId);
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
  const reviewLimit = createTaskLimiter(reviewerConcurrency);
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
Chaque leçon contient : title, objective, scope, core_concepts, prerequisite_recall, visual_focus et complexity.

Règles impératives :
• répartis les notions avant toute rédaction ;
• une notion principale apparaît dans core_concepts d'UNE SEULE leçon ;
• prerequisite_recall contient uniquement des notions déjà traitées avant cette leçon et qui pourront être rappelées en une phrase ;
• deux leçons ne doivent pas avoir le même objectif sous des formulations différentes ;
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
• complexity vaut 1, 2 ou 3 selon la densité réelle ;
• aucune formule, aucun HTML et aucun Markdown dans ce plan : title et scope sont des phrases en français uniquement, sans aucun des caractères $ ^ _ { } et sans notation type "t↦e^{at}" ou "f'(x)". Écris le concept en toutes lettres ("Dérivée de la fonction exponentielle affine") : ces titres s'affichent tels quels partout dans l'admin, y compris là où les formules ne sont jamais interprétées.

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
    const blueprintMaxTokens = Math.min(
      12_000,
      Math.max(4_500, 2_200 + totalLessonCount * 360),
    );

    let rawBlueprint: unknown;
    try {
      rawBlueprint = await generate(
        blueprintUser,
        blueprintSystem,
        blueprintContract,
        0.18,
        blueprintMaxTokens,
        false,
      );
    } catch (error) {
      if (!isTruncationError(error)) throw error;
      rawBlueprint = await generate(
        `${blueprintUser}\nLe plan précédent était trop long. Garde exactement les quantités demandées et rends chaque scope et objective très concis.`,
        blueprintSystem,
        blueprintContract,
        0.05,
        Math.min(14_000, blueprintMaxTokens + 2_000),
        false,
      );
    }

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

    telemetry.start("blueprint-review");
    try {
      const reviewedBlueprintRaw = await generate(
        `Plan à contrôler et corriger sans changer les quantités :\n${JSON.stringify(blueprint)}`,
        `Tu es l'agent relecteur du plan global Educalcul.
Niveau : ${grade_level}. Sujet : ${subject}. Domaine : ${subject_area || "Mathématiques"}.
${programmeBlock}
${teacherDirective}

Retourne le plan complet corrigé avec exactement ${chapterCount} chapitres et exactement ${lessonsPerChapter} leçons par chapitre.
Vérifie : conformité stricte au programme, progression logique, absence de doublons entre objectifs, absence de notion universitaire ou hors niveau, attribution d'une notion principale à une seule leçon, et pertinence sémantique de visual_focus.
Un sign_table n'est permis que pour une vraie étude de signe; jamais pour limites, croissance comparée, lien avec le logarithme, définition ou convexité. Utilise graph pour courbes/limites/asymptotes/convexité, variation_table pour variations/extrema, table pour propriétés/comparaisons, figure pour schémas non fonctionnels, et none si aucun visuel n'est utile.
Supprime ou remplace toute extension hors programme, notamment exponentielle complexe, formule d'Euler, analyse complexe ou série de Fourier, sauf demande explicite et niveau compatible.
Si un title ou un scope contient une formule ou une notation mathématique brute ($ ^ _ { } ou un style "t↦e^{at}"), réécris-le en toutes lettres : ces titres s'affichent tels quels partout dans l'admin, jamais interprétés comme du LaTeX.
Ne rédige aucun contenu de cours, aucune formule, aucun Markdown et aucun HTML.`,
        blueprintContract,
        0,
        Math.min(6_000, blueprintMaxTokens),
        false,
      );
      blueprint = normalizeCourseBlueprint(reviewedBlueprintRaw, {
        subject,
        chapterCount,
        lessonsPerChapter,
        chapterRequiresGraph: (title, scope) =>
          topicRequiresFunctionGraph(subject, subject_area || "", title, scope),
      });
      telemetry.end("blueprint-review", "plan validé par un second agent");
    } catch (error) {
      telemetry.end("blueprint-review", "relecteur indisponible, plan initial conservé");
      console.warn("[course-ai] Relecture du plan indisponible; plan initial conservé.", error);
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
        const contract = courseChapterSchema({
          lessonCount: 1,
          includeExercises: shouldIncludeExercises,
          minExercises: 3,
          maxExercises: 4,
        });
        const qualityOptions = {
          expectedLessonCount: 1,
          includeExercises: shouldIncludeExercises,
          minWordsPerLesson: job.budget.hardMinWords,
          requireGraph: job.lesson.visualFocus === "graph",
          validationScope: "lesson" as const,
          visualFocus: job.lesson.visualFocus,
        };

        const requestDraft = async (
          prompt: string,
          temperature: number,
          maxTokens: number,
        ) => {
          const raw = await generate(
            prompt,
            systemPrompt,
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

        // Une nouvelle tentative après troncature doit disposer de PLUS de
        // marge que la précédente, jamais d'un plafond identique ou inférieur
        // : sinon le modèle tronque exactement la même sortie une seconde
        // fois. Le budget de base va jusqu'à 10 500 ; on autorise jusqu'à
        // 14 000 pour les tentatives de rattrapage, comme pour le blueprint.
        const boostedMaxTokens = (base: number) => Math.min(14_000, base + 3_000);

        let structured: StructuredCourseChapter;
        try {
          structured = await requestDraft(
            userPrompt,
            0.16,
            job.budget.maxOutputTokens,
          );
        } catch (error) {
          if (!isTruncationError(error)) throw error;
          structured = await requestDraft(
            `${userPrompt}\nLa sortie précédente était tronquée. Produis une version complète et plus dense : 7 à 12 blocs, exactement 3 exercices courts, un seul visuel principal, aucune répétition et pas de développement hors périmètre.`,
            0.03,
            boostedMaxTokens(job.budget.maxOutputTokens),
          );
        }

        let issues = blockingIssues(structured, qualityOptions);
        let bestScore = structuredCourseQualityScore(structured, qualityOptions);
        // Jusqu'à 3 corrections structurelles (ex: bloc graph manquant, 0
        // exercice) avant d'abandonner la leçon — une seule tentative faisait
        // échouer tout le cours dès qu'un agent ratait sa correction une
        // fois ; vu en prod un échec qui persiste sur 2 tentatives (0
        // exercice ET graph manquant simultanément).
        const MAX_STRUCTURAL_RETRIES = 3;
        for (
          let attempt = 0;
          attempt < MAX_STRUCTURAL_RETRIES &&
          (!hasCompleteLesson(structured.lessons[0], shouldIncludeExercises) ||
            issues.length > 0);
          attempt += 1
        ) {
          const issueSummary = formatStructuredQualityIssues(issues);
          const directives = structuralCorrectionDirectives(issues);
          const correctionPrompt = `${userPrompt}\nCORRECTION STRUCTURELLE. La leçon précédente ne respectait pas le contrat :\n${issueSummary || "structure ou exercices incomplets"}${directives}\nRends une leçon complète sans changer le périmètre, sans répétition et sans ajouter de notion attribuée aux autres agents.`;
          let retry: StructuredCourseChapter;
          try {
            retry = await requestDraft(
              correctionPrompt,
              0.02,
              job.budget.maxOutputTokens,
            );
          } catch (error) {
            if (!isTruncationError(error)) throw error;
            retry = await requestDraft(
              `${correctionPrompt}\nLa tentative précédente était aussi tronquée : reste complet mais plus concis.`,
              0.02,
              boostedMaxTokens(job.budget.maxOutputTokens),
            );
          }
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

          let reviewedChapter = normalizeStructuredCoursePedagogy({
            title: job.chapter.title,
            lessons: [reviewed],
          });
          const sanitized = sanitizeStructuredResources(reviewedChapter);
          reviewedChapter = normalizeStructuredCoursePedagogy(sanitized.value);
          // Répare les formules qui ont fui en texte brut (ex: "f'=f",
          // "f(0)=1" écrits tels quels au lieu d'un part math) : coûte 0
          // appel si aucun champ n'est suspect, le scan est synchrone et ne
          // bloque rien. 2 tours au lieu d'1 : un échec ponctuel du modèle de
          // réparation sur un lot ne doit pas laisser passer un champ
          // détecté comme suspect sans seconde chance.
          const unstructuredMathRepair = await repairUnstructuredMathText(
            reviewedChapter,
            {
              generate,
              label: `cours ${blueprint.title}, chapitre ${job.chapter.title}, leçon ${job.lesson.title}`,
              maxRounds: 2,
            },
          );
          reviewedChapter = normalizeStructuredCoursePedagogy(unstructuredMathRepair.value);
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
            `${patchCount} patch(es), ${repaired.report.fallbackCount} repli(s) KaTeX`,
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
    const structuredChapters: StructuredCourseChapter[] = blueprint.chapters.map(
      (chapter, chapterIndex) => ({
        title: chapter.title,
        lessons: jobs
          .map((job, index) => ({ job, lesson: reviewedLessons[index] }))
          .filter(({ job }) => job.chapterIndex === chapterIndex)
          .sort((left, right) => left.job.lessonIndex - right.job.lessonIndex)
          .map(({ lesson }) => lesson as StructuredCourseLesson),
      }),
    );

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
        // Colonne integer en base : chapterCount * lessonsPerChapter * durée
        // n'est pas toujours un multiple de 60 (vu en prod : 3*3*30/60 = 4.5,
        // rejeté par Postgres avec "invalid input syntax for type integer").
        estimated_time: Math.max(
          1,
          Math.round(chapterCount * lessonsPerChapter * (durationPerLesson / 60)),
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
        source: "ai_multi_agent_markdown_v2_6",
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
    await tracker.setStatus("done", { target_id: courseRow.id });
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
