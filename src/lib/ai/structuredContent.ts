
import { normalizeEduFig } from "@/lib/figures/normalize";
import { stringValue, asRecord } from "./structuredMath";
import { mathToReadableText, sanitizeStructuredText } from "./structuredMath";
import { finiteNumber, clamp } from "./structuredFigures";
import { StructuredCourseBlock, StructuredRichText, normalizeStructuredRichText } from "./structuredFigures";
import { BlockNormalizer, blockLineChart, blockNumberLine, blockPieChart, blockTrigCircle, blockPythagorasVisualizer, blockTriangleDiagram, blockShape, blockFigure, blockGraph, blockVariationTable, blockSignTable, blockBaseTenBlocks, blockImage, blockColumnOperation, blockTable, blockCallout, blockChecklist, blockList, blockDisplayMath, blockParagraph, blockHeading } from "./courseBlocksText";
import { blockNetFolder, blockRatioMixer, blockPlaceValueChart, blockFractionStrips, blockFillGrid, blockBrickPyramid, blockLabeledCircle, blockJsxFigure, blockLabeledPolygon, blockSolid, blockTapeDiagram, blockRulerMeasurer, blockPatternMaker, blockGridPainter, blockBalanceScale, blockCoinPurse, blockDefinition, blockClock, blockBarChart, blockFlowchart, blockScatterPlot } from "./courseBlocksCharts";
import { blockSteps, blockExercise, blockBoxPlot, blockVennDiagram, blockProbabilityTree, blockFraction, blockAlgoSandbox, blockComplexPlanePolar, blockIntegralRiemannSlider, blockSequenceCobweb, blockTangentScrubber, blockIntervalBuilder, blockVectorAdditionPad, blockSlopeTriangle, blockEquationBalancer, blockScientificNotationConverter, blockAreaDecomposer, blockThermometerAxis, blockCompassTool, blockInteractiveProtractor } from "./courseBlocksTools";
export * from "./courseBlocksTools";
export * from "./courseBlocksCharts";
export * from "./courseBlocksText";
export * from "./structuredFigures";
export * from "./structuredMath";


export type StructuredLearningResource = Extract<
  StructuredCourseBlock,
  { type: "table" | "sign_table" | "variation_table" | "graph" | "figure" | "edufig" }
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
6. Tableau de valeurs ou de comparaison, jamais pour un signe ou une variation :
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
10. Figure statique structurée, seulement pour géométrie, fractions, aires, schémas d'énoncé ; jamais pour tracer une courbe de fonction :
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
13. Opération posée en colonnes (addition, soustraction, multiplication, division) :
{"type":"column_operation","operator":"+","operands":["24","15"],"result":"39","carries":[]}
Seul bloc autorisé pour un calcul posé en colonnes : jamais de \\begin{array}, jamais de tableau pour ça. operands va du haut vers le bas (2 à 4 nombres), carries contient les retenues au-dessus de chaque colonne si besoin, tableau vide sinon.
14. Photo réelle :
{"type":"image","query":"des billes de couleur sur une table, photo réaliste","caption":"Légende courte sans LaTeX"}
Le serveur cherche et insère une vraie photo libre de droits correspondant à "query" (en français ou anglais, décris précisément ce qu'il faut voir) : jamais d'URL, jamais de balise img, jamais de description d'image qui n'est pas accompagnée de ce bloc. N'écris JAMAIS une phrase du type "regarde cette image" ou "observe ce dessin" sans placer ce bloc juste à côté : si tu mentionnes un visuel, il doit exister sous forme de bloc (image, figure, table...). Si aucune bonne photo n'est probable pour ce concept (notion abstraite, calcul...), décris en mots au lieu de demander une image.
15. Dizaines/centaines/unités (numération, valeur positionnelle) :
{"type":"base_ten_blocks","hundreds":0,"tens":5,"units":3,"caption":"53 : 5 dizaines et 3 unités"}
Bloc OBLIGATOIRE dès que tu représentes visuellement un nombre en dizaines/unités (ou centaines), n'essaie JAMAIS de dessiner ça toi-même avec le bloc "figure" (lignes/points/polygones à la main) : c'est illisible et peu soigné. hundreds/tens/units sont les chiffres de 0 à 9 de chaque rang.
16. Formes géométriques sur feuille quadrillée (bloc composable) :
{"type":"shape","caption":"Triangle ABC rectangle en A","width":9,"height":7,"preset":"none","a":3,"b":4,"parts":[{"kind":"right_triangle","x":1,"y":1,"w":7,"h":5,"r":3,"points":[],"tone":"navy","filled":true,"dashed":false,"vertex_labels":["A","B","C"],"side_labels":["","5 cm","3 cm"],"right_angle_at":0,"show_dimensions":false}]}
Chaque part est une forme simple posée sur le quadrillage (origine en bas à gauche ; x, y, w, h, r en carreaux). kind ∈ rectangle, square, right_triangle, triangle, circle, segment, point, text. La part "text" pose un nombre / une courte étiquette libre en (x, y), pour les effectifs d'un Venn, une aire, une valeur. On ajoute des OPTIONS plutôt qu'une figure spéciale : vertex_labels (noms des sommets A, B, C…), side_labels (longueurs des côtés), right_angle_at (index du sommet à angle droit, ou null), show_dimensions (cotes auto). Triangle quelconque : "points" = 3 sommets. Combine plusieurs parts sur le même canevas : un diagramme de Venn = 2-3 cercles qui se chevauchent + des parts text ; une décomposition d'aire = plusieurs rectangles. preset:"pythagoras" (avec a, b) assemble un triangle rectangle et les 3 carrés de ses côtés. PRIVILÉGIE "shape" pour TOUTE figure géométrique ; "figure" ne sert que si aucun assemblage de parts ne convient.
Ne crée aucun autre type de bloc.`;

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

/**
 * Synonymes de types de figures.
 *
 * Le modèle nomme volontiers un bloc par son idée plutôt que par son nom de
 * catalogue : « code_block » pour un encart de code, « tree » pour un arbre
 * pondéré, « matrix » pour un tableau, « rectangle » ou « segment » pour un
 * tracé. Ces figures étaient rejetées en silence alors que leur CONTENU était
 * exploitable — 108 figures perdues sur un corpus de 4 492. On accepte donc le
 * synonyme et on redirige vers le bloc réel.
 */
const FIGURE_TYPE_ALIASES: Record<string, string> = {
  code_block: "algo_sandbox",
  code: "algo_sandbox",
  python: "algo_sandbox",
  tree: "probability_tree",
  matrix: "table",
  truth_table: "table",
  line_graph: "line_chart",
  flow_diagram: "flowchart",
  histogram: "bar_chart",
  // Tracés libres : tous rendus par « shape », qui porte déjà des « parts ».
  rectangle: "shape",
  segment: "shape",
  line: "shape",
  point: "shape",
  angle: "shape",
  cube: "shape",
  box: "shape",
  die: "shape",
  shape_pythagoras: "shape",
  function_diagram: "shape",
  function_definition: "shape",
  function_machine: "shape",
  list_representation: "shape",
  timeline: "shape",
};

export const COURSE_BLOCK_NORMALIZERS: Record<string, BlockNormalizer> = {
  "heading": blockHeading,
  "title": blockHeading,
  "paragraph": blockParagraph,
  "text": blockParagraph,
  "display_math": blockDisplayMath,
  "formula": blockDisplayMath,
  "math_block": blockDisplayMath,
  "list": blockList,
  "checklist": blockChecklist,
  "callout": blockCallout,
  "table": blockTable,
  "column_operation": blockColumnOperation,
  "image": blockImage,
  "base_ten_blocks": blockBaseTenBlocks,
  "sign_table": blockSignTable,
  "variation_table": blockVariationTable,
  "graph": blockGraph,
  "figure": blockFigure,
  "shape": blockShape,
  "triangle_diagram": blockTriangleDiagram,
  "pythagoras_visualizer": blockPythagorasVisualizer,
  "trig_circle": blockTrigCircle,
  "pie_chart": blockPieChart,
  "number_line": blockNumberLine,
  "line_chart": blockLineChart,
  "line_graph": blockLineChart,
  "scatter_plot": blockScatterPlot,
  "flowchart": blockFlowchart,
  "flow_diagram": blockFlowchart,
  "bar_chart": blockBarChart,
  "clock": blockClock,
  "definition": blockDefinition,
  "coin_purse": blockCoinPurse,
  "balance_scale": blockBalanceScale,
  "grid_painter": blockGridPainter,
  "pattern_maker": blockPatternMaker,
  "ruler_measurer": blockRulerMeasurer,
  "tape_diagram": blockTapeDiagram,
  "solid": blockSolid,
  "labeled_polygon": blockLabeledPolygon,
  "jsx_figure": blockJsxFigure,
  "labeled_circle": blockLabeledCircle,
  "brick_pyramid": blockBrickPyramid,
  "fill_grid": blockFillGrid,
  "fraction_strips": blockFractionStrips,
  "place_value_chart": blockPlaceValueChart,
  "ratio_mixer": blockRatioMixer,
  "net_folder": blockNetFolder,
  "interactive_protractor": blockInteractiveProtractor,
  "compass_tool": blockCompassTool,
  "thermometer_axis": blockThermometerAxis,
  "area_decomposer": blockAreaDecomposer,
  "scientific_notation_converter": blockScientificNotationConverter,
  "equation_balancer": blockEquationBalancer,
  "slope_triangle": blockSlopeTriangle,
  "vector_addition_pad": blockVectorAdditionPad,
  "interval_builder": blockIntervalBuilder,
  "tangent_scrubber": blockTangentScrubber,
  "sequence_cobweb": blockSequenceCobweb,
  "integral_riemann_slider": blockIntegralRiemannSlider,
  "complex_plane_polar": blockComplexPlanePolar,
  "algo_sandbox": blockAlgoSandbox,
  "fraction": blockFraction,
  "probability_tree": blockProbabilityTree,
  "venn_diagram": blockVennDiagram,
  "box_plot": blockBoxPlot,
  "exercise": blockExercise,
  "exercise_placeholder": blockExercise,
  "steps": blockSteps,
};

export function normalizeCourseBlock(value: unknown, depth = 0): StructuredCourseBlock | null {
  if (depth > 4) return null;
  const raw = asRecord(value);
  if (!raw) {
    const content = normalizeStructuredRichText(value);
    return content.parts.length ? { type: "paragraph", content } : null;
  }

  const type = FIGURE_TYPE_ALIASES[stringValue(raw.type, "paragraph").toLowerCase()]
    ?? stringValue(raw.type, "paragraph").toLowerCase();

  // « figure » servant d'enveloppe : {"type":"figure","graph":{...}}. Le bloc
  // interne n'a pas toujours son propre "type" — on le déduit de la clé.
  if (type === "figure" && !Array.isArray(raw.elements)) {
    for (const [key, inner] of Object.entries(raw)) {
      if (key === "type" || key === "caption") continue;
      const nested = asRecord(inner);
      if (!nested) continue;
      return normalizeCourseBlock(
        { type: nested.type ?? key, caption: raw.caption, ...nested },
        depth + 1,
      );
    }
  }
  void type;
  // Figure au format EduFig : {"type":"edufig","fig":{…}} ou la description à plat {"type":"edufig","kind":"geometry",…}.
  if (type === "edufig") {
    const { fig } = normalizeEduFig(raw.fig_json ?? raw.fig ?? { ...raw, type: undefined });
    return fig ? { type: "edufig", fig } : null;
  }
  const normalizer = COURSE_BLOCK_NORMALIZERS[type];
  if (normalizer) return normalizer(raw, { type, depth, normalize: normalizeCourseBlock });
  
  const content = normalizeStructuredRichText(raw.content ?? raw.text ?? raw.value);
  return content.parts.length ? { type: "paragraph", content } : null;
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
      entry !== null && ["table", "sign_table", "variation_table", "graph", "figure", "edufig"].includes(entry.type),
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
