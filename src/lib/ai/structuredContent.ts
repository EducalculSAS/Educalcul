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

export type StructuredSignValue =
  | "negative"
  | "zero"
  | "positive"
  | "undefined";

export type StructuredVariationDirection = "up" | "down" | "constant";

export type StructuredFigureTone =
  | "navy"
  | "gold"
  | "blue"
  | "green"
  | "red"
  | "gray";

export type StructuredFigurePoint = { x: number; y: number };

/** Brique de base composable du bloc "shape" : une forme simple posée sur le
 * quadrillage, avec ses options (étiquettes de sommets / côtés, marque d'angle
 * droit, cotes). Combiner plusieurs parts remplace les figures spécifiques
 * (triangle annoté, Pythagore, schémas d'énoncé...). */
export type StructuredShapePart = {
  kind:
    | "rectangle"
    | "square"
    | "right_triangle"
    | "triangle"
    | "polygon" // n-gone libre via points
    | "circle"
    | "arc" // portion de cercle (startAngle → endAngle)
    | "angle" // marque d'angle : petit arc entre deux demi-droites issues de (x,y)
    | "segment"
    | "line" // droite infinie passant par (x,y) et points[0] (ou pente via w,h)
    | "point"
    | "text";
  // kind "text" : nombre ou courte étiquette libre posée en (x, y).
  text: string;
  // Coin bas-gauche de la boîte englobante, en carreaux (y vers le haut).
  // Pour circle/arc/angle/point : centre / sommet.
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  // Angles en degrés (convention maths : 0 = est, sens antihoraire).
  // arc : bornes de l'arc. angle : les deux demi-droites de la marque d'angle.
  startAngle: number;
  endAngle: number;
  // polygon / triangle libre / segment / line : sommets explicites.
  points: StructuredFigurePoint[];
  tone: StructuredFigureTone;
  filled: boolean;
  dashed: boolean;
  // "none" | "end" | "both" : pointes de flèche sur segment / line / ray.
  arrow: "none" | "end" | "both";
  // Noms des sommets dans l'ordre (A, B, C…). "" pour ne pas étiqueter.
  vertexLabels: string[];
  // Longueur / nom de chaque côté, même ordre que les sommets.
  sideLabels: string[];
  // Index du sommet portant l'angle droit (marque ⟂), ou null.
  rightAngleAt: number | null;
  showDimensions: boolean;
};

export type StructuredFigureElement =
  | {
      type: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      tone: StructuredFigureTone;
      dashed: boolean;
      arrowEnd: boolean;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    }
  | {
      type: "point";
      x: number;
      y: number;
      tone: StructuredFigureTone;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    }
  | {
      type: "circle";
      cx: number;
      cy: number;
      r: number;
      tone: StructuredFigureTone;
      filled: boolean;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    }
  | {
      type: "polygon";
      points: StructuredFigurePoint[];
      tone: StructuredFigureTone;
      filled: boolean;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    }
  | {
      type: "arc";
      cx: number;
      cy: number;
      r: number;
      startAngle: number;
      endAngle: number;
      tone: StructuredFigureTone;
      label?: StructuredRichText;
      labelX?: number;
      labelY?: number;
    };

export type StructuredGraphVector = {
  x: number;
  y: number;
  fromX?: number;
  fromY?: number;
  label?: string;
  tone: StructuredFigureTone;
};

// Diagrammes déterministes : contrairement à "figure" (coordonnées brutes
// choisies par le modèle, ce qui provoque chevauchements et débordements dès
// que plusieurs labels mathématiques sont nécessaires — un <text> SVG ne
// peut pas afficher de KaTeX), ces blocs ne demandent au modèle que des
// données sémantiques (angles, valeurs, labels). La disposition géométrique
// est calculée côté serveur dans compiler.ts, et les labels passent par
// foreignObject + $...$ pour un rendu KaTeX correct.

export type StructuredTrigCircleAngle = {
  angleDeg: number;
  label: string;
};

export type StructuredPieSlice = {
  label: string;
  value: number;
  tone: StructuredFigureTone;
};

export type StructuredNumberLinePoint = {
  value: number;
  label: string;
  filled: boolean;
};

export type StructuredNumberLineInterval = {
  from: number;
  to: number;
  fromIncluded: boolean;
  toIncluded: boolean;
  tone: StructuredFigureTone;
};

export type StructuredBar = {
  label: string;
  value: number;
  tone: StructuredFigureTone;
};

export type StructuredProbabilityLeaf = {
  label: string;
  probability: string;
};

export type StructuredProbabilityBranch = StructuredProbabilityLeaf & {
  children: StructuredProbabilityLeaf[];
};

export type StructuredVennSet = {
  label: string;
  tone: StructuredFigureTone;
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
      type: "checklist";
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
      variant: "value";
      headers: StructuredRichText[];
      rows: StructuredRichText[][];
    }
  | {
      type: "column_operation";
      operator: "+" | "-" | "×" | "÷";
      operands: string[];
      result: string;
      carries: string[];
    }
  | {
      type: "image";
      query: string;
      caption: string;
      url?: string;
      attribution?: string;
    }
  | {
      type: "base_ten_blocks";
      hundreds: number;
      tens: number;
      units: number;
      caption: string;
    }
  | {
      type: "sign_table";
      expression: StructuredRichText;
      boundaries: StructuredRichText[];
      intervalSigns: StructuredSignValue[];
      boundarySigns: StructuredSignValue[];
    }
  | {
      type: "variation_table";
      variable: StructuredRichText;
      functionName: StructuredRichText;
      points: StructuredRichText[];
      values: StructuredRichText[];
      directions: StructuredVariationDirection[];
      derivativeSigns: StructuredSignValue[];
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
      vectors: StructuredGraphVector[];
    }
  | {
      type: "figure";
      caption: string;
      elements: StructuredFigureElement[];
    }
  | {
      type: "trig_circle";
      caption: string;
      highlightedAngles: StructuredTrigCircleAngle[];
    }
  | {
      type: "shape";
      caption: string;
      // Canevas en carreaux (origine en bas à gauche, y vers le haut).
      // Auto-agrandi si une part déborde.
      width: number;
      height: number;
      // Preset facultatif assemblé côté serveur à partir de formes simples :
      // "pythagoras" = triangle rectangle + les 3 carrés des côtés (a, b = cathètes).
      preset: "none" | "pythagoras";
      a: number;
      b: number;
      parts: StructuredShapePart[];
    }
  | {
      type: "pie_chart";
      caption: string;
      slices: StructuredPieSlice[];
    }
  | {
      type: "number_line";
      caption: string;
      min: number;
      max: number;
      points: StructuredNumberLinePoint[];
      intervals: StructuredNumberLineInterval[];
    }
  | {
      // Courbe d'évolution : une ou plusieurs séries partageant le même axe
      // des abscisses (températures par mois, suite au fil des rangs…). Le
      // bar_chart ne rendait pas l'idée de continuité, et le graph ne sait
      // tracer qu'une expression, pas des relevés.
      type: "line_chart";
      caption: string;
      xLabel: string;
      yLabel: string;
      xValues: string[];
      series: { name: string; tone: StructuredFigureTone; values: number[] }[];
    }
  | {
      // Nuage de points : le catalogue l'annonçait déjà, mais aucun bloc de
      // cours ne l'implémentait — les 16 figures produites étaient rejetées en
      // silence. Indispensable en statistiques (corrélation, ajustement).
      type: "scatter_plot";
      caption: string;
      xLabel: string;
      yLabel: string;
      points: { x: number; y: number }[];
    }
  | {
      // Schéma d'algorithme : suite d'étapes, avec losanges pour les tests et
      // une flèche de retour possible pour les boucles.
      type: "flowchart";
      caption: string;
      nodes: { label: string; kind: "start" | "end" | "action" | "condition" }[];
      loopFrom: number | null;
      loopTo: number | null;
    }
  | {
      type: "bar_chart";
      caption: string;
      bars: StructuredBar[];
    }
  | {
      type: "clock";
      caption: string;
      hours: number;
      minutes: number;
      interactive: boolean;
    }
  | {
      type: "fraction";
      caption: string;
      numerator: number;
      denominator: number;
      shape: "bar" | "circle";
    }
  | {
      type: "definition";
      term: string;
      definition: StructuredRichText;
      example?: StructuredRichText;
    }
  | {
      type: "coin_purse";
      caption: string;
      coins: number[];
      target: number;
    }
  | {
      type: "balance_scale";
      caption: string;
      left: number[];
      right: number[];
      // Étiquettes libres (prioritaires sur left/right) : "2x + 3", "m", …
      leftLabel: string;
      rightLabel: string;
      // Inclinaison forcée : "level" (équilibre), "left" / "right" (penché de
      // ce côté), ou "auto" (déduit de la somme des masses).
      tilt: "auto" | "level" | "left" | "right";
    }
  | {
      type: "grid_painter";
      caption: string;
      rows: number;
      cols: number;
      highlighted: number;
    }
  | {
      type: "pattern_maker";
      caption: string;
      sequence: string[];
      options: string[];
      answer: string;
    }
  | {
      type: "ruler_measurer";
      caption: string;
      segmentLength: number;
      unit: string;
    }
  | {
      type: "tape_diagram";
      caption: string;
      parts: { label: string; value: number; tone: StructuredFigureTone }[];
    }
  | {
      /** Pyramide de briques : levels du SOMMET vers la base (1, 2, 3... briques), "" = brique vide à compléter. */
      type: "brick_pyramid";
      caption: string;
      levels: string[][];
    }
  | {
      /** Grille à compléter (carré magique, tableau de nombres...) : cells[ligne][colonne], "" = case vide. */
      type: "fill_grid";
      caption: string;
      cells: string[][];
    }
  | {
      type: "fraction_strips";
      caption: string;
      fractions: { numerator: number; denominator: number }[];
    }
  | {
      type: "place_value_chart";
      caption: string;
      number: number;
    }
  | {
      type: "ratio_mixer";
      caption: string;
      ratios: { label: string; value: number; tone: StructuredFigureTone }[];
    }
  | {
      type: "net_folder";
      caption: string;
      solid: "cube" | "pave";
      width: number;
      height: number;
      depth: number;
    }
  | {
      type: "interactive_protractor";
      caption: string;
      angleDeg: number;
    }
  | {
      type: "compass_tool";
      caption: string;
      radius: number;
      centerLabel: string;
    }
  | {
      type: "thermometer_axis";
      caption: string;
      min: number;
      max: number;
      points: { value: number; label: string }[];
    }
  | {
      type: "area_decomposer";
      caption: string;
      shapes: { width: number; height: number; label: string }[];
    }
  | {
      type: "scientific_notation_converter";
      caption: string;
      value: number;
      exponent: number;
    }
  | {
      type: "equation_balancer";
      caption: string;
      leftTerms: string[];
      rightTerms: string[];
    }
  | {
      type: "slope_triangle";
      caption: string;
      a: number;
      b: number;
      xMin: number;
      xMax: number;
    }
  | {
      type: "vector_addition_pad";
      caption: string;
      ux: number;
      uy: number;
      vx: number;
      vy: number;
    }
  | {
      type: "interval_builder";
      caption: string;
      min: number;
      max: number;
      lowerBound: number;
      upperBound: number;
      lowerOpen: boolean;
      upperOpen: boolean;
    }
  | {
      type: "tangent_scrubber";
      caption: string;
      expression: string;
      x0: number;
      xMin: number;
      xMax: number;
    }
  | {
      type: "sequence_cobweb";
      caption: string;
      expression: string;
      u0: number;
      iterations: number;
      xMin: number;
      xMax: number;
    }
  | {
      type: "integral_riemann_slider";
      caption: string;
      expression: string;
      xMin: number;
      xMax: number;
      rectangles: number;
    }
  | {
      type: "complex_plane_polar";
      caption: string;
      re: number;
      im: number;
    }
  | {
      type: "algo_sandbox";
      caption: string;
      code: string;
      language: string;
    }
  | {
      type: "probability_tree";
      caption: string;
      branches: StructuredProbabilityBranch[];
    }
  | {
      type: "venn_diagram";
      caption: string;
      sets: StructuredVennSet[];
      regionLabels?: {
        aOnly?: string;
        bOnly?: string;
        both?: string;
        neither?: string;
      };
    }
  | {
      type: "box_plot";
      caption: string;
      min: number;
      q1: number;
      median: number;
      q3: number;
      max: number;
      axisLabel?: string;
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


export type StructuredLearningResource = Extract<
  StructuredCourseBlock,
  { type: "table" | "sign_table" | "variation_table" | "graph" | "figure" }
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

// Conversions appliquées AVANT sanitizeStructuredText pour les labels courts
// des diagrammes déterministes (trig_circle, pie_chart...). sanitizeStructuredText
// seul se contente de retirer l'antislash d'une commande reconnue
// ("\frac" -> "frac"), ce qui est correct pour de la prose (la commande ne
// devrait de toute façon jamais y figurer) mais rend un label illisible : un
// angle "$-\frac{\pi}{3}$" ressortait "-frac{pi}{3}" au lieu de "-π/3" (vu en
// production). Ici on convertit d'abord en notation lisible équivalente à
// celle des captions (readableMathFallbackText dans qualityGuard.ts).
const DIAGRAM_LABEL_CONVERSIONS: Array<[RegExp, string]> = [
  [/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2"],
  [/\\sqrt\{([^{}]*)\}/g, "√$1"],
  [/\\vec\{([^{}]*)\}/g, "$1⃗"],
  [/\\pi\b/g, "π"],
  [/\\theta\b/g, "θ"],
  [/\\infty\b/g, "∞"],
  [/\\lambda\b/g, "λ"],
  [/\\alpha\b/g, "α"],
  [/\\beta\b/g, "β"],
  [/\\times\b/g, "×"],
  [/\\cdot\b/g, "·"],
  [/\\leq\b/g, "≤"],
  [/\\geq\b/g, "≥"],
  [/\\neq\b/g, "≠"],
];

export function sanitizeDiagramLabel(value: unknown): string {
  let text = stringValue(value);
  for (const [pattern, replacement] of DIAGRAM_LABEL_CONVERSIONS) {
    text = text.replace(pattern, replacement);
  }
  return sanitizeStructuredText(text);
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

/**
 * Ajoute un segment mathématique en sortant les caractères qui relèvent du
 * TEXTE, pas des mathématiques.
 *
 * KaTeX n'a de glyphe ni pour « € » (ni £, ¥…) ni pour les guillemets
 * français : il émet « No character metrics for '€' in style 'Main-Regular' »
 * et les rend avec une largeur approximative, mal espacée. Or une unité
 * monétaire ou un guillemet n'a rien à faire dans une formule — « $5 €$ » se
 * lit « 5 » en mathématiques, suivi de « € » en texte. On découpe donc plutôt
 * que de forcer KaTeX sur un caractère qu'il ne connaît pas.
 */
const TEXT_ONLY_IN_MATH = /([€£¥₽₹«»“”])/;

function pushMathPart(parts: StructuredRichTextPart[], rawLatex: string): void {
  // « $\text{par visite de classe}$ » ou « $\text{48}$ » : du texte (ou un nombre
  // nu) enveloppé dans une formule, que le modèle produit souvent. On le range
  // en texte ordinaire plutôt qu'en mathématiques (police et espacement faux).
  const wrappedText = /^\s*\\text\{([^{}$\\]*)\}\s*$/.exec(rawLatex);
  if (wrappedText) {
    const value = wrappedText[1].trim();
    if (value) parts.push({ type: "text", value });
    return;
  }
  if (!TEXT_ONLY_IN_MATH.test(rawLatex)) {
    const latex = normalizeStructuredLatex(rawLatex);
    if (latex) parts.push({ type: "math", latex });
    return;
  }

  for (const chunk of rawLatex.split(TEXT_ONLY_IN_MATH)) {
    if (!chunk) continue;
    if (TEXT_ONLY_IN_MATH.test(chunk)) {
      // Espace insécable fine avant une unité monétaire, comme le veut
      // l'usage français ; les guillemets se collent à ce qu'ils encadrent.
      const thin = /[€£¥₽₹]/.test(chunk) ? " " : "";
      parts.push({ type: "text", value: `${thin}${chunk}` });
      continue;
    }
    const latex = normalizeStructuredLatex(chunk);
    if (latex) parts.push({ type: "math", latex });
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
    pushMathPart(parts, match[1] ?? match[2] ?? match[3] ?? match[4] ?? "");
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) {
    const text = sanitizeStructuredText(value.slice(cursor), true);
    if (text) parts.push({ type: "text", value: text });
  }
  return parts;
}

function needsBoundarySpace(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (/\s$/.test(left) || /^\s/.test(right)) return false;
  if (/[('’\[{\/-]$/.test(left)) return false;
  if (/^[,.;:!?%)\]}]/.test(right)) return false;
  // Fin de phrase collée à la suivante (« visites.Les tarifs ») ou unité collée au mot suivant.
  if (/[.!?€]$/.test(left) && /^[A-Za-zÀ-ÿ0-9]/.test(right)) return true;
  return /[A-Za-zÀ-ÿ0-9)]$/.test(left) && /^[A-Za-zÀ-ÿ0-9(]/.test(right);
}

function normalizePartBoundaries(
  parts: StructuredRichTextPart[],
): StructuredRichTextPart[] {
  const normalized: StructuredRichTextPart[] = [];
  for (const rawPart of parts) {
    if (!rawPart.type) continue;
    const part = rawPart.type === "text"
      ? { ...rawPart, value: rawPart.value.replace(/[ \t]+/g, " ") }
      : rawPart;
    const previous = normalized[normalized.length - 1];

    if (part.type === "text" && previous?.type === "text") {
      const spacer = needsBoundarySpace(previous.value, part.value) ? " " : "";
      previous.value = `${previous.value}${spacer}${part.value}`;
      continue;
    }

    if (previous && part.type === "text" && previous.type === "math") {
      if (part.value && needsBoundarySpace("x", part.value)) {
        part.value = ` ${part.value}`;
      }
    } else if (previous?.type === "text" && part.type === "math") {
      if (previous.value && needsBoundarySpace(previous.value, "x")) {
        previous.value = `${previous.value} `;
      }
    }
    normalized.push(part);
  }
  return normalized.filter(
    (part) => part.type === "math" || part.value.length > 0,
  );
}

function mergeAdjacentText(parts: StructuredRichTextPart[]): StructuredRichTextPart[] {
  return normalizePartBoundaries(parts);
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
      pushMathPart(parts, stringValue(part.latex ?? part.value ?? part.text));
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


function normalizeSignValue(value: unknown): StructuredSignValue {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "negative" || normalized === "zero" || normalized === "positive") {
    return normalized;
  }
  return "undefined";
}

function normalizeVariationDirection(
  value: unknown,
): StructuredVariationDirection {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "down" || normalized === "constant") return normalized;
  return "up";
}

function normalizeFigureTone(value: unknown): StructuredFigureTone {
  const tone = stringValue(value).toLowerCase();
  if (
    tone === "gold" ||
    tone === "blue" ||
    tone === "green" ||
    tone === "red" ||
    tone === "gray"
  ) {
    return tone;
  }
  return "navy";
}

function optionalRichText(value: unknown): StructuredRichText | undefined {
  if (value === undefined || value === null) return undefined;
  const rich = normalizeStructuredRichText(value);
  return rich.parts.length > 0 ? rich : undefined;
}

function optionalCoordinate(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return clamp(finiteNumber(value, 0), 0, 200);
}

function normalizeFigurePoint(value: unknown): StructuredFigurePoint | null {
  const raw = asRecord(value);
  if (!raw) return null;
  return {
    x: clamp(finiteNumber(raw.x, 0), 0, 200),
    y: clamp(finiteNumber(raw.y, 0), 0, 160),
  };
}

function normalizeFigureElement(value: unknown): StructuredFigureElement | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const type = stringValue(raw.type).toLowerCase();
  const tone = normalizeFigureTone(raw.tone);
  const label = optionalRichText(raw.label);
  const labelX = optionalCoordinate(raw.label_x ?? raw.labelX);
  const labelYRaw = raw.label_y ?? raw.labelY;
  const labelY =
    labelYRaw === undefined || labelYRaw === null || labelYRaw === ""
      ? undefined
      : clamp(finiteNumber(labelYRaw, 0), 0, 160);
  const shared = { tone, label, labelX, labelY };

  if (type === "line") {
    return {
      type: "line",
      x1: clamp(finiteNumber(raw.x1, 20), 0, 200),
      y1: clamp(finiteNumber(raw.y1, 120), 0, 160),
      x2: clamp(finiteNumber(raw.x2, 180), 0, 200),
      y2: clamp(finiteNumber(raw.y2, 120), 0, 160),
      dashed: raw.dashed === true,
      arrowEnd: raw.arrow_end === true || raw.arrowEnd === true,
      ...shared,
    };
  }
  if (type === "point") {
    return {
      type: "point",
      x: clamp(finiteNumber(raw.x, 100), 0, 200),
      y: clamp(finiteNumber(raw.y, 80), 0, 160),
      ...shared,
    };
  }
  if (type === "circle") {
    return {
      type: "circle",
      cx: clamp(finiteNumber(raw.cx, 100), 0, 200),
      cy: clamp(finiteNumber(raw.cy, 80), 0, 160),
      r: clamp(finiteNumber(raw.r, 35), 2, 80),
      filled: raw.filled === true,
      ...shared,
    };
  }
  if (type === "polygon") {
    const points = Array.isArray(raw.points)
      ? raw.points
          .map(normalizeFigurePoint)
          .filter((point): point is StructuredFigurePoint => point !== null)
          .slice(0, 8)
      : [];
    if (points.length < 3) return null;
    return {
      type: "polygon",
      points,
      filled: raw.filled === true,
      ...shared,
    };
  }
  if (type === "arc") {
    return {
      type: "arc",
      cx: clamp(finiteNumber(raw.cx, 100), 0, 200),
      cy: clamp(finiteNumber(raw.cy, 80), 0, 160),
      r: clamp(finiteNumber(raw.r, 30), 2, 80),
      startAngle: clamp(finiteNumber(raw.start_angle ?? raw.startAngle, 0), -360, 360),
      endAngle: clamp(finiteNumber(raw.end_angle ?? raw.endAngle, 90), -360, 360),
      ...shared,
    };
  }
  return null;
}

function normalizeGraphVector(value: unknown): StructuredGraphVector | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const x = finiteNumber(raw.x, Number.NaN);
  const y = finiteNumber(raw.y, Number.NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const fromXRaw = raw.from_x ?? raw.fromX;
  const fromYRaw = raw.from_y ?? raw.fromY;
  return {
    x: clamp(x, -100, 100),
    y: clamp(y, -100, 100),
    ...(fromXRaw !== undefined ? { fromX: clamp(finiteNumber(fromXRaw, 0), -100, 100) } : {}),
    ...(fromYRaw !== undefined ? { fromY: clamp(finiteNumber(fromYRaw, 0), -100, 100) } : {}),
    ...(sanitizeStructuredText(raw.label) ? { label: sanitizeStructuredText(raw.label).slice(0, 20) } : {}),
    tone: normalizeFigureTone(raw.tone),
  };
}

const SHAPE_KINDS = [
  "rectangle",
  "square",
  "right_triangle",
  "triangle",
  "polygon",
  "circle",
  "arc",
  "angle",
  "segment",
  "line",
  "point",
  "text",
] as const;

function normalizeShapePart(value: unknown): StructuredShapePart | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const kindRaw = stringValue(raw.kind).toLowerCase();
  const kind = (SHAPE_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as StructuredShapePart["kind"])
    : "rectangle";
  const x = clamp(finiteNumber(raw.x, 1), -2, 40);
  const y = clamp(finiteNumber(raw.y, 1), -2, 40);
  const w = clamp(finiteNumber(raw.w ?? raw.width, kind === "square" ? 4 : 6), 0.5, 40);
  const h = clamp(
    finiteNumber(raw.h ?? raw.height, kind === "square" ? w : 4),
    0.5,
    40,
  );
  const strList = (input: unknown): string[] =>
    Array.isArray(input)
      ? input.map((s) => sanitizeStructuredText(s).slice(0, 18))
      : [];
  const ptsRaw = Array.isArray(raw.points) ? raw.points : [];
  const points = ptsRaw
    .map((p) => asRecord(p))
    .filter((p): p is Record<string, unknown> => !!p)
    .map((p) => ({
      x: clamp(finiteNumber(p.x, 0), -2, 40),
      y: clamp(finiteNumber(p.y, 0), -2, 40),
    }))
    .slice(0, 12);
  const raRaw = raw.right_angle_at ?? raw.rightAngleAt;
  const rightAngleAt =
    typeof raRaw === "number" && Number.isInteger(raRaw) && raRaw >= 0 && raRaw < 12
      ? raRaw
      : kind === "right_triangle"
        ? 0
        : null;
  const arrowRaw = stringValue(raw.arrow).toLowerCase();
  const arrow = arrowRaw === "end" || arrowRaw === "both" ? arrowRaw : "none";
  return {
    kind,
    text: sanitizeStructuredText(raw.text).slice(0, 24),
    x,
    y,
    w: kind === "square" ? w : w,
    h: kind === "square" ? w : h,
    r: clamp(finiteNumber(raw.r ?? raw.radius, 3), 0.5, 20),
    startAngle: finiteNumber(raw.start_angle ?? raw.startAngle, 0),
    endAngle: finiteNumber(raw.end_angle ?? raw.endAngle, 90),
    // segment/line/polygon/triangle : sommets libres (jusqu'à 12).
    points: points.length >= 2 ? points : [],
    tone: normalizeFigureTone(raw.tone),
    filled: raw.filled ?? raw.fill ?? (kind === "arc" || kind === "angle" || kind === "line" || kind === "segment" ? false : true) ? true : false,
    dashed: raw.dashed ?? raw.dash ?? false ? true : false,
    arrow,
    vertexLabels: strList(raw.vertex_labels ?? raw.vertexLabels).slice(0, 6),
    sideLabels: strList(raw.side_labels ?? raw.sideLabels).slice(0, 6),
    rightAngleAt,
    showDimensions: raw.show_dimensions ?? raw.showDimensions ?? true ? true : false,
  };
}

export function normalizeShapeBlock(
  raw: Record<string, unknown>,
): Extract<StructuredCourseBlock, { type: "shape" }> | null {
  const preset = raw.preset === "pythagoras" ? "pythagoras" : "none";
  let parts = Array.isArray(raw.parts)
    ? raw.parts
        .map(normalizeShapePart)
        .filter((p): p is StructuredShapePart => p !== null)
        .slice(0, 8)
    : [];
  // Rétro-compat : un "shape" à l'ancienne (kind/width/height au niveau bloc)
  // devient une part unique.
  if (parts.length === 0 && preset === "none" && typeof raw.kind === "string") {
    const single = normalizeShapePart({
      kind: raw.kind,
      x: 1,
      y: 1,
      w: raw.width,
      h: raw.height,
      r: raw.radius,
      tone: raw.tone,
      side_labels: Array.isArray(raw.side_labels) ? raw.side_labels : undefined,
      show_dimensions: raw.show_dimensions ?? raw.showDimensions,
    });
    if (single) parts = [single];
  }
  if (preset === "none" && parts.length === 0) {
    parts = [normalizeShapePart({ kind: "rectangle" }) as StructuredShapePart];
  }
  const spanX = Math.max(
    6,
    ...parts.map((p) =>
      p.points.length
        ? Math.max(...p.points.map((pt) => pt.x))
        : p.kind === "circle" || p.kind === "point"
          ? p.x + p.r
          : p.x + p.w,
    ),
  );
  const spanY = Math.max(
    5,
    ...parts.map((p) =>
      p.points.length
        ? Math.max(...p.points.map((pt) => pt.y))
        : p.kind === "circle" || p.kind === "point"
          ? p.y + p.r
          : p.y + p.h,
    ),
  );
  return {
    type: "shape",
    caption: sanitizeStructuredText(raw.caption),
    width: clamp(Math.ceil(finiteNumber(raw.width, spanX) + 1), 4, 44),
    height: clamp(Math.ceil(finiteNumber(raw.height, spanY) + 1), 4, 36),
    preset,
    a: clamp(finiteNumber(raw.a, 3), 1, 12),
    b: clamp(finiteNumber(raw.b, 4), 1, 12),
    parts,
  };
}

function normalizeTrigCircleAngle(value: unknown): StructuredTrigCircleAngle | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label ?? raw.angle_deg ?? raw.angleDeg);
  if (!label) return null;
  return {
    angleDeg: finiteNumber(raw.angle_deg ?? raw.angleDeg, 0),
    label: label.slice(0, 24),
  };
}

function normalizePieSlice(value: unknown): StructuredPieSlice | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  const numericValue = finiteNumber(raw.value, Number.NaN);
  if (!label || !Number.isFinite(numericValue) || numericValue < 0) return null;
  return { label: label.slice(0, 60), value: numericValue, tone: normalizeFigureTone(raw.tone) };
}

function normalizeNumberLinePoint(value: unknown): StructuredNumberLinePoint | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  const numericValue = finiteNumber(raw.value, Number.NaN);
  if (!label || !Number.isFinite(numericValue)) return null;
  return { value: numericValue, label: label.slice(0, 40), filled: raw.filled !== false };
}

function normalizeNumberLineInterval(
  value: unknown,
): StructuredNumberLineInterval | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const from = finiteNumber(raw.from, Number.NaN);
  const to = finiteNumber(raw.to, Number.NaN);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return {
    from: Math.min(from, to),
    to: Math.max(from, to),
    fromIncluded: (raw.from_included ?? raw.fromIncluded) === true,
    toIncluded: (raw.to_included ?? raw.toIncluded) === true,
    tone: normalizeFigureTone(raw.tone),
  };
}

function normalizeBar(value: unknown): StructuredBar | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  const numericValue = finiteNumber(raw.value, Number.NaN);
  if (!label || !Number.isFinite(numericValue) || numericValue < 0) return null;
  return { label: label.slice(0, 30), value: numericValue, tone: normalizeFigureTone(raw.tone) };
}

function normalizeProbabilityLeaf(value: unknown): StructuredProbabilityLeaf | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  const probability = sanitizeDiagramLabel(raw.probability);
  if (!label || !probability) return null;
  return { label: label.slice(0, 40), probability: probability.slice(0, 20) };
}

function normalizeProbabilityBranch(
  value: unknown,
): StructuredProbabilityBranch | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const leaf = normalizeProbabilityLeaf(raw);
  if (!leaf) return null;
  const children = Array.isArray(raw.children)
    ? raw.children
        .map(normalizeProbabilityLeaf)
        .filter((entry): entry is StructuredProbabilityLeaf => entry !== null)
        .slice(0, 4)
    : [];
  return { ...leaf, children };
}

function normalizeVennSet(value: unknown): StructuredVennSet | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const label = sanitizeDiagramLabel(raw.label);
  if (!label) return null;
  return { label: label.slice(0, 30), tone: normalizeFigureTone(raw.tone) };
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

export function normalizeCourseBlock(value: unknown, depth = 0): StructuredCourseBlock | null {
  if (depth > 4) return null;
  const raw = asRecord(value);
  if (!raw) {
    const content = normalizeStructuredRichText(value);
    return content.parts.length ? { type: "paragraph", content } : null;
  }

  let type = FIGURE_TYPE_ALIASES[stringValue(raw.type, "paragraph").toLowerCase()]
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
    case "checklist": {
      const items = Array.isArray(raw.items)
        ? raw.items.map(normalizeStructuredRichText).filter((item) => item.parts.length > 0)
        : [];
      return { type: "checklist", items };
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
      const headers = Array.isArray(raw.headers)
        ? raw.headers
            .map(normalizeStructuredRichText)
            .filter((entry) => entry.parts.length > 0)
            .slice(0, 8)
        : [];
      if (headers.length === 0) return null;
      const rows = Array.isArray(raw.rows)
        ? raw.rows
            .filter(Array.isArray)
            .map((row) =>
              (row as unknown[])
                .slice(0, headers.length)
                .map(normalizeStructuredRichText),
            )
            .filter((row) => row.length === headers.length)
            .slice(0, 20)
        : [];
      if (rows.length === 0) return null;
      return { type: "table", variant: "value", headers, rows };
    }
    case "column_operation": {
      const rawOperator = stringValue(raw.operator);
      const operator = (["+", "-", "×", "÷", "x", "*", "/"].includes(rawOperator)
        ? rawOperator === "x" || rawOperator === "*"
          ? "×"
          : rawOperator === "/"
            ? "÷"
            : rawOperator
        : "+") as "+" | "-" | "×" | "÷";
      const operands = Array.isArray(raw.operands)
        ? raw.operands.map((entry) => stringValue(entry)).filter(Boolean).slice(0, 4)
        : [];
      const result = stringValue(raw.result);
      if (operands.length < 2 || !result) return null;
      const carries = Array.isArray(raw.carries)
        ? raw.carries.map((entry) => stringValue(entry))
        : [];
      return { type: "column_operation", operator, operands, result, carries };
    }
    case "image": {
      const query = stringValue(raw.query).slice(0, 200);
      const caption = stringValue(raw.caption).slice(0, 200);
      // Un admin peut fournir directement une URL (lien colle ou upload) —
      // dans ce cas le bloc s'affiche immediatement, sans passer par la
      // resolution differee (catalogue-advance/route.ts) reservee aux
      // requetes de recherche generees par l'IA sans URL connue.
      const url = stringValue(raw.url).slice(0, 500);
      const attribution = stringValue(raw.attribution).slice(0, 200);
      if (!query && !url) return null;
      return {
        type: "image",
        query,
        caption,
        url: url || undefined,
        attribution: attribution || undefined,
      };
    }
    case "base_ten_blocks": {
      const clamp = (value: unknown) => Math.min(9, Math.max(0, Math.trunc(finiteNumber(value, 0))));
      const hundreds = clamp(raw.hundreds);
      const tens = clamp(raw.tens);
      const units = clamp(raw.units);
      const caption = stringValue(raw.caption).slice(0, 200);
      if (hundreds === 0 && tens === 0 && units === 0) return null;
      return { type: "base_ten_blocks", hundreds, tens, units, caption };
    }
    case "sign_table": {
      const boundaries = Array.isArray(raw.boundaries)
        ? raw.boundaries
            .map(normalizeStructuredRichText)
            .filter((entry) => entry.parts.length > 0)
            .slice(0, 6)
        : [];
      const rawIntervalSigns = raw.interval_signs ?? raw.intervalSigns;
      const intervalSigns = Array.isArray(rawIntervalSigns)
        ? rawIntervalSigns
            .map(normalizeSignValue)
            .slice(0, boundaries.length + 1)
        : [];
      const rawBoundarySigns = raw.boundary_signs ?? raw.boundarySigns;
      const boundarySigns = Array.isArray(rawBoundarySigns)
        ? rawBoundarySigns
            .map(normalizeSignValue)
            .slice(0, boundaries.length)
        : [];
      if (
        boundaries.length === 0 ||
        intervalSigns.length !== boundaries.length + 1 ||
        boundarySigns.length !== boundaries.length
      ) {
        return null;
      }
      return {
        type: "sign_table",
        expression: normalizeStructuredRichText(raw.expression),
        boundaries,
        intervalSigns,
        boundarySigns,
      };
    }
    case "variation_table": {
      const points = Array.isArray(raw.points)
        ? raw.points
            .map(normalizeStructuredRichText)
            .filter((entry) => entry.parts.length > 0)
            .slice(0, 7)
        : [];
      const values = Array.isArray(raw.values)
        ? raw.values.map(normalizeStructuredRichText).slice(0, points.length)
        : [];
      const directions = Array.isArray(raw.directions)
        ? raw.directions
            .map(normalizeVariationDirection)
            .slice(0, Math.max(0, points.length - 1))
        : [];
      const rawDerivativeSigns =
        raw.derivative_signs ?? raw.derivativeSigns;
      const derivativeSigns = Array.isArray(rawDerivativeSigns)
        ? rawDerivativeSigns
            .map(normalizeSignValue)
            .slice(0, Math.max(0, points.length - 1))
        : [];
      if (
        points.length < 2 ||
        values.length !== points.length ||
        directions.length !== points.length - 1 ||
        derivativeSigns.length !== points.length - 1
      ) {
        return null;
      }
      return {
        type: "variation_table",
        variable: normalizeStructuredRichText(raw.variable ?? "x"),
        functionName: normalizeStructuredRichText(
          raw.function_name ?? raw.functionName ?? "f",
        ),
        points,
        values,
        directions,
        derivativeSigns,
      };
    }
    case "graph": {
      const parameterRaw = asRecord(raw.parameter);
      const name = sanitizeStructuredText(parameterRaw?.name)
        .replace(/[^A-Za-z]/g, "")
        .slice(0, 2);
      const parameter = parameterRaw && name
        ? {
            name,
            min: finiteNumber(parameterRaw.min, -3),
            max: finiteNumber(parameterRaw.max, 3),
            default: finiteNumber(parameterRaw.default, 1),
          }
        : undefined;
      const vectors = Array.isArray(raw.vectors)
        ? raw.vectors
            .map(normalizeGraphVector)
            .filter((entry): entry is StructuredGraphVector => entry !== null)
            .slice(0, 5)
        : [];
      return {
        type: "graph",
        expression: sanitizeGraphExpression(
          raw.expression ?? raw.function ?? raw.data_function,
        ),
        xmin: finiteNumber(raw.xmin, -5),
        xmax: finiteNumber(raw.xmax, 5),
        caption: sanitizeStructuredText(raw.caption),
        parameter,
        vectors,
      };
    }
    case "figure": {
      const elements = Array.isArray(raw.elements)
        ? raw.elements
            .map(normalizeFigureElement)
            .filter((entry): entry is StructuredFigureElement => entry !== null)
            .slice(0, 12)
        : [];
      if (elements.length === 0) return null;
      return {
        type: "figure",
        caption: sanitizeStructuredText(raw.caption),
        elements,
      };
    }
    case "shape":
      return normalizeShapeBlock(raw);
    case "triangle_diagram": {
      // Ancien bloc dédié → devient un "shape" composable (1 triangle annoté).
      const vl = Array.isArray(raw.vertex_labels ?? raw.vertexLabels)
        ? (raw.vertex_labels ?? raw.vertexLabels)
        : ["A", "B", "C"];
      const slRaw = Array.isArray(raw.side_labels ?? raw.sideLabels)
        ? (raw.side_labels ?? raw.sideLabels)
        : [];
      const rightAt = raw.right_angle_at ?? raw.rightAngleAt;
      return normalizeShapeBlock({
        caption: raw.caption,
        width: 10,
        height: 8,
        parts: [
          {
            kind: rightAt === 0 || rightAt === 1 || rightAt === 2 ? "right_triangle" : "triangle",
            x: 1,
            y: 1,
            w: 8,
            h: 6,
            vertex_labels: vl,
            side_labels: slRaw,
            right_angle_at: rightAt,
            show_dimensions: false,
            tone: "navy",
          },
        ],
      });
    }
    case "pythagoras_visualizer":
      return normalizeShapeBlock({
        caption: raw.caption,
        preset: "pythagoras",
        a: finiteNumber(raw.a, 3),
        b: finiteNumber(raw.b, 4),
      });
    case "trig_circle": {
      const rawAngles = raw.highlighted_angles ?? raw.highlightedAngles;
      const highlightedAngles = Array.isArray(rawAngles)
        ? rawAngles
            .map(normalizeTrigCircleAngle)
            .filter((entry): entry is StructuredTrigCircleAngle => entry !== null)
            .slice(0, 16)
        : [];
      return {
        type: "trig_circle",
        caption: sanitizeStructuredText(raw.caption),
        highlightedAngles,
      };
    }
    case "pie_chart": {
      const slices = Array.isArray(raw.slices)
        ? raw.slices
            .map(normalizePieSlice)
            .filter((entry): entry is StructuredPieSlice => entry !== null)
            .slice(0, 8)
        : [];
      if (slices.length < 2) return null;
      return {
        type: "pie_chart",
        caption: sanitizeStructuredText(raw.caption),
        slices,
      };
    }
    case "number_line": {
      const points = Array.isArray(raw.points)
        ? raw.points
            .map(normalizeNumberLinePoint)
            .filter((entry): entry is StructuredNumberLinePoint => entry !== null)
            .slice(0, 8)
        : [];
      const intervals = Array.isArray(raw.intervals)
        ? raw.intervals
            .map(normalizeNumberLineInterval)
            .filter((entry): entry is StructuredNumberLineInterval => entry !== null)
            .slice(0, 4)
        : [];
      if (points.length === 0 && intervals.length === 0) return null;
      return {
        type: "number_line",
        caption: sanitizeStructuredText(raw.caption),
        min: finiteNumber(raw.min, -5),
        max: finiteNumber(raw.max, 5),
        points,
        intervals,
      };
    }
    // « line_chart » / « line_graph » : le modèle écrit soit des séries
    // (lines[{name, values[]}]), soit une suite de points ({x, y}). On accepte
    // les deux plutôt que de perdre la figure sur une question de forme.
    case "line_chart":
    case "line_graph": {
      const rawSeries = Array.isArray(raw.series) ? raw.series : Array.isArray(raw.lines) ? raw.lines : [];
      let xValues = Array.isArray(raw.x_values)
        ? raw.x_values.map((v) => sanitizeDiagramLabel(v) ?? "")
        : [];

      const series = rawSeries
        .map((entry) => {
          const row = asRecord(entry);
          if (!row) return null;
          const values = (Array.isArray(row.values) ? row.values : [])
            .map((v) => finiteNumber(v, Number.NaN))
            .filter((v): v is number => Number.isFinite(v));
          if (values.length < 2) return null;
          return {
            name: sanitizeDiagramLabel(row.name ?? row.label) ?? "",
            tone: normalizeFigureTone(row.tone),
            values: values.slice(0, 24),
          };
        })
        .filter((s): s is { name: string; tone: StructuredFigureTone; values: number[] } => s !== null)
        .slice(0, 4);

      if (series.length === 0 && Array.isArray(raw.points)) {
        const points = raw.points.map(asRecord).filter((p): p is Record<string, unknown> => p !== null);
        const values = points.map((p) => finiteNumber(p.y, Number.NaN)).filter((v) => Number.isFinite(v));
        if (values.length >= 2) {
          series.push({ name: "", tone: normalizeFigureTone(raw.tone), values: values.slice(0, 24) });
          if (xValues.length === 0) {
            xValues = points.map((p) => sanitizeDiagramLabel(p.x) ?? "").slice(0, 24);
          }
        }
      }
      if (series.length === 0) return null;

      const longest = Math.max(...series.map((s) => s.values.length));
      return {
        type: "line_chart",
        caption: sanitizeStructuredText(raw.caption),
        xLabel: sanitizeDiagramLabel(raw.x_label) ?? "",
        yLabel: sanitizeDiagramLabel(raw.y_label) ?? "",
        xValues: xValues.length === longest ? xValues : [],
        series,
      };
    }
    case "scatter_plot": {
      const points = (Array.isArray(raw.points) ? raw.points : [])
        .map(asRecord)
        .filter((p): p is Record<string, unknown> => p !== null)
        .map((p) => ({ x: finiteNumber(p.x, Number.NaN), y: finiteNumber(p.y, Number.NaN) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
        .slice(0, 40);
      if (points.length < 2) return null;
      return {
        type: "scatter_plot",
        caption: sanitizeStructuredText(raw.caption),
        xLabel: sanitizeDiagramLabel(raw.x_label) ?? "",
        yLabel: sanitizeDiagramLabel(raw.y_label) ?? "",
        points,
      };
    }
    case "flowchart":
    case "flow_diagram": {
      // Deux écritures observées : nodes[{label, type}] et steps[""].
      const rawNodes = Array.isArray(raw.nodes)
        ? raw.nodes
        : Array.isArray(raw.steps)
          ? raw.steps.map((label) => ({ label }))
          : [];

      const nodes = rawNodes
        .map((entry, index, all) => {
          const row: Record<string, unknown> = asRecord(entry) ?? { label: entry };
          const label = sanitizeDiagramLabel(row.label ?? row.text);
          if (!label) return null;
          const declared = String(row.kind ?? row.type ?? "").toLowerCase();
          // Une flèche n'est pas une étape : le modèle en glisse parfois entre
          // deux boîtes, ce qui ferait un rectangle « Oui » dans le schéma.
          if (declared === "arrow" || declared === "edge") return null;
          const kind: "start" | "end" | "action" | "condition" =
            declared === "condition" || declared === "decision" || /\?\s*$/.test(label)
              ? "condition"
              : declared === "start" || (index === 0 && /début|debut|start/i.test(label))
                ? "start"
                : declared === "end" || declared === "stop" || index === all.length - 1
                  ? "end"
                  : "action";
          return { label: label.slice(0, 48), kind };
        })
        .filter((n): n is { label: string; kind: "start" | "end" | "action" | "condition" } => n !== null)
        .slice(0, 8);

      if (nodes.length < 2) return null;

      const loopFrom = Number.isInteger(raw.loop_from) ? (raw.loop_from as number) : null;
      const loopTo = Number.isInteger(raw.loop_to) ? (raw.loop_to as number) : null;
      const valid = (n: number | null) => (n !== null && n >= 0 && n < nodes.length ? n : null);
      return {
        type: "flowchart",
        caption: sanitizeStructuredText(raw.caption),
        nodes,
        loopFrom: valid(loopFrom),
        loopTo: valid(loopTo),
      };
    }
    case "bar_chart": {
      const bars = Array.isArray(raw.bars)
        ? raw.bars
            .map(normalizeBar)
            .filter((entry): entry is StructuredBar => entry !== null)
            .slice(0, 10)
        : [];
      if (bars.length < 2) return null;
      return {
        type: "bar_chart",
        caption: sanitizeStructuredText(raw.caption),
        bars,
      };
    }
    case "clock": {
      const hours = Math.max(0, Math.min(23, Math.round(finiteNumber(raw.hours, 3))));
      const minutes = Math.max(0, Math.min(59, Math.round(finiteNumber(raw.minutes, 0))));
      return {
        type: "clock",
        caption: sanitizeStructuredText(raw.caption),
        hours,
        minutes,
        interactive: raw.interactive !== false,
      };
    }
    case "definition": {
      const term = sanitizeStructuredText(raw.term);
      const definition = normalizeStructuredRichText(raw.definition);
      if (!term || definition.parts.length === 0) return null;
      const example = raw.example !== undefined ? normalizeStructuredRichText(raw.example) : undefined;
      return {
        type: "definition",
        term,
        definition,
        example: example && example.parts.length > 0 ? example : undefined,
      };
    }
    case "coin_purse": {
      const coins = Array.isArray(raw.coins)
        ? raw.coins.map((c: unknown) => Math.round(finiteNumber(c, 0))).filter((c: number) => c > 0).slice(0, 12)
        : [];
      if (coins.length < 2) return null;
      return {
        type: "coin_purse",
        caption: sanitizeStructuredText(raw.caption),
        coins,
        target: Math.max(1, Math.round(finiteNumber(raw.target, coins[0] ?? 100))),
      };
    }
    case "balance_scale": {
      const toNumArray = (v: unknown): number[] =>
        Array.isArray(v)
          ? v.map((n: unknown) => Math.round(finiteNumber(n, 0))).slice(0, 8)
          : [];
      const left = toNumArray(raw.left);
      const right = toNumArray(raw.right);
      const leftLabel = sanitizeStructuredText(raw.left_label ?? raw.leftLabel).slice(0, 40);
      const rightLabel = sanitizeStructuredText(raw.right_label ?? raw.rightLabel).slice(0, 40);
      if (left.length === 0 && right.length === 0 && !leftLabel && !rightLabel) return null;
      const tRaw = stringValue(raw.tilt).toLowerCase();
      const tilt =
        tRaw === "level" || tRaw === "left" || tRaw === "right" ? tRaw : "auto";
      return {
        type: "balance_scale",
        caption: sanitizeStructuredText(raw.caption),
        left,
        right,
        leftLabel,
        rightLabel,
        tilt,
      };
    }
    case "grid_painter": {
      const rows = Math.max(1, Math.min(12, Math.round(finiteNumber(raw.rows, 3))));
      const cols = Math.max(1, Math.min(12, Math.round(finiteNumber(raw.cols, 4))));
      const highlighted = Math.max(0, Math.min(rows * cols, Math.round(finiteNumber(raw.highlighted, 0))));
      return { type: "grid_painter", caption: sanitizeStructuredText(raw.caption), rows, cols, highlighted };
    }
    case "pattern_maker": {
      const sequence = Array.isArray(raw.sequence)
        ? raw.sequence.map((s: unknown) => sanitizeDiagramLabel(s)).filter(Boolean).slice(0, 8)
        : [];
      const options = Array.isArray(raw.options)
        ? raw.options.map((s: unknown) => sanitizeDiagramLabel(s)).filter(Boolean).slice(0, 6)
        : [];
      const answer = sanitizeDiagramLabel(raw.answer);
      if (sequence.length < 2 || options.length < 2 || !answer) return null;
      return { type: "pattern_maker", caption: sanitizeStructuredText(raw.caption), sequence, options, answer };
    }
    case "ruler_measurer": {
      const segmentLength = Math.max(1, finiteNumber(raw.segmentLength, 10));
      return {
        type: "ruler_measurer",
        caption: sanitizeStructuredText(raw.caption),
        segmentLength,
        unit: sanitizeDiagramLabel(raw.unit) || "cm",
      };
    }
    case "tape_diagram": {
      const parts = Array.isArray(raw.parts)
        ? raw.parts
            .map((p: unknown) => {
              const rec = asRecord(p);
              if (!rec) return null;
              const label = sanitizeDiagramLabel(rec.label);
              const value = finiteNumber(rec.value, Number.NaN);
              if (!label || !Number.isFinite(value) || value < 0) return null;
              return { label: label.slice(0, 24), value, tone: normalizeFigureTone(rec.tone) };
            })
            .filter((p): p is { label: string; value: number; tone: StructuredFigureTone } => p !== null)
            .slice(0, 6)
        : [];
      if (parts.length < 2) return null;
      return { type: "tape_diagram", caption: sanitizeStructuredText(raw.caption), parts };
    }
    case "brick_pyramid": {
      const cell = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 9);
      let levels = Array.isArray(raw.levels)
        ? raw.levels
            .map((row: unknown) => (Array.isArray(row) ? row.map(cell) : null))
            .filter((row: string[] | null): row is string[] => row !== null)
            .slice(0, 7)
        : [];
      // Fournie de la base vers le sommet : on remet le sommet en premier.
      if (levels.length >= 2 && levels[0].length > levels[levels.length - 1].length) levels = levels.slice().reverse();
      if (levels.length < 2 || levels.some((row: string[], i: number) => row.length !== i + 1)) return null;
      return { type: "brick_pyramid", caption: sanitizeStructuredText(raw.caption), levels };
    }
    case "fill_grid": {
      const cell = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 12);
      const cells = Array.isArray(raw.cells)
        ? raw.cells
            .map((row: unknown) => (Array.isArray(row) ? row.map(cell) : null))
            .filter((row: string[] | null): row is string[] => row !== null)
            .slice(0, 8)
        : [];
      const width = cells[0]?.length ?? 0;
      if (cells.length < 1 || width < 1 || width > 8 || cells.some((row: string[]) => row.length !== width)) return null;
      return { type: "fill_grid", caption: sanitizeStructuredText(raw.caption), cells };
    }
    case "fraction_strips": {
      const fractions = Array.isArray(raw.fractions)
        ? raw.fractions
            .map((f: unknown) => {
              const rec = asRecord(f);
              if (!rec) return null;
              const denominator = Math.max(2, Math.min(12, Math.round(finiteNumber(rec.denominator, 4))));
              const numerator = Math.max(0, Math.min(denominator, Math.round(finiteNumber(rec.numerator, 1))));
              return { numerator, denominator };
            })
            .filter((f): f is { numerator: number; denominator: number } => f !== null)
            .slice(0, 5)
        : [];
      if (fractions.length < 2) return null;
      return { type: "fraction_strips", caption: sanitizeStructuredText(raw.caption), fractions };
    }
    case "place_value_chart": {
      return {
        type: "place_value_chart",
        caption: sanitizeStructuredText(raw.caption),
        number: finiteNumber(raw.number, 0),
      };
    }
    case "ratio_mixer": {
      const ratios = Array.isArray(raw.ratios)
        ? raw.ratios
            .map((r: unknown) => {
              const rec = asRecord(r);
              if (!rec) return null;
              const label = sanitizeDiagramLabel(rec.label);
              const value = finiteNumber(rec.value, Number.NaN);
              if (!label || !Number.isFinite(value) || value < 0) return null;
              return { label: label.slice(0, 24), value, tone: normalizeFigureTone(rec.tone) };
            })
            .filter((r): r is { label: string; value: number; tone: StructuredFigureTone } => r !== null)
            .slice(0, 5)
        : [];
      if (ratios.length < 2) return null;
      return { type: "ratio_mixer", caption: sanitizeStructuredText(raw.caption), ratios };
    }
    case "net_folder": {
      return {
        type: "net_folder",
        caption: sanitizeStructuredText(raw.caption),
        solid: raw.solid === "pave" ? "pave" : "cube",
        width: Math.max(1, finiteNumber(raw.width, 4)),
        height: Math.max(1, finiteNumber(raw.height, 4)),
        depth: Math.max(1, finiteNumber(raw.depth, 4)),
      };
    }
    case "interactive_protractor": {
      return {
        type: "interactive_protractor",
        caption: sanitizeStructuredText(raw.caption),
        angleDeg: Math.max(0, Math.min(180, finiteNumber(raw.angleDeg, 45))),
      };
    }
    case "compass_tool": {
      return {
        type: "compass_tool",
        caption: sanitizeStructuredText(raw.caption),
        radius: Math.max(1, finiteNumber(raw.radius, 5)),
        centerLabel: sanitizeDiagramLabel(raw.centerLabel) || "O",
      };
    }
    case "thermometer_axis": {
      const points = Array.isArray(raw.points)
        ? raw.points
            .map((p: unknown) => {
              const rec = asRecord(p);
              if (!rec) return null;
              const label = sanitizeDiagramLabel(rec.label);
              const value = finiteNumber(rec.value, Number.NaN);
              if (!label || !Number.isFinite(value)) return null;
              return { value, label: label.slice(0, 20) };
            })
            .filter((p): p is { value: number; label: string } => p !== null)
            .slice(0, 6)
        : [];
      return {
        type: "thermometer_axis",
        caption: sanitizeStructuredText(raw.caption),
        min: finiteNumber(raw.min, -10),
        max: finiteNumber(raw.max, 10),
        points,
      };
    }
    case "area_decomposer": {
      const shapes = Array.isArray(raw.shapes)
        ? raw.shapes
            .map((s: unknown) => {
              const rec = asRecord(s);
              if (!rec) return null;
              const width = finiteNumber(rec.width, Number.NaN);
              const height = finiteNumber(rec.height, Number.NaN);
              if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
              return { width, height, label: sanitizeDiagramLabel(rec.label).slice(0, 20) };
            })
            .filter((s): s is { width: number; height: number; label: string } => s !== null)
            .slice(0, 5)
        : [];
      if (shapes.length === 0) return null;
      // Décomposition d'aire = plusieurs rectangles → bloc "shape" composable.
      let ax = 1;
      return normalizeShapeBlock({
        caption: raw.caption,
        parts: shapes.flatMap((s) => {
          const p = {
            kind: "rectangle",
            x: ax,
            y: 1,
            w: s.width,
            h: s.height,
            tone: "blue",
            side_labels: [],
            vertex_labels: [],
            show_dimensions: true,
          };
          const label = s.label
            ? [{ kind: "text", x: ax + s.width / 2, y: 1 + s.height / 2, text: s.label, tone: "navy" }]
            : [];
          ax += s.width + 1;
          return [p, ...label];
        }),
      });
    }
    case "scientific_notation_converter": {
      return {
        type: "scientific_notation_converter",
        caption: sanitizeStructuredText(raw.caption),
        value: finiteNumber(raw.value, 1),
        exponent: Math.round(finiteNumber(raw.exponent, 0)),
      };
    }
    case "equation_balancer": {
      const leftTerms = Array.isArray(raw.leftTerms)
        ? raw.leftTerms.map((t: unknown) => sanitizeDiagramLabel(t)).filter(Boolean).slice(0, 5)
        : [];
      const rightTerms = Array.isArray(raw.rightTerms)
        ? raw.rightTerms.map((t: unknown) => sanitizeDiagramLabel(t)).filter(Boolean).slice(0, 5)
        : [];
      if (leftTerms.length === 0 || rightTerms.length === 0) return null;
      return { type: "equation_balancer", caption: sanitizeStructuredText(raw.caption), leftTerms, rightTerms };
    }
    case "slope_triangle": {
      return {
        type: "slope_triangle",
        caption: sanitizeStructuredText(raw.caption),
        a: finiteNumber(raw.a, 1),
        b: finiteNumber(raw.b, 0),
        xMin: finiteNumber(raw.xMin, -5),
        xMax: finiteNumber(raw.xMax, 5),
      };
    }
    case "vector_addition_pad": {
      return {
        type: "vector_addition_pad",
        caption: sanitizeStructuredText(raw.caption),
        ux: finiteNumber(raw.ux, 2),
        uy: finiteNumber(raw.uy, 1),
        vx: finiteNumber(raw.vx, 1),
        vy: finiteNumber(raw.vy, 2),
      };
    }
    case "interval_builder": {
      return {
        type: "interval_builder",
        caption: sanitizeStructuredText(raw.caption),
        min: finiteNumber(raw.min, -5),
        max: finiteNumber(raw.max, 5),
        lowerBound: finiteNumber(raw.lowerBound, -2),
        upperBound: finiteNumber(raw.upperBound, 2),
        lowerOpen: raw.lowerOpen === true,
        upperOpen: raw.upperOpen === true,
      };
    }
    case "tangent_scrubber": {
      const expression = sanitizeDiagramLabel(raw.expression);
      if (!expression) return null;
      return {
        type: "tangent_scrubber",
        caption: sanitizeStructuredText(raw.caption),
        expression,
        x0: finiteNumber(raw.x0, 0),
        xMin: finiteNumber(raw.xMin, -5),
        xMax: finiteNumber(raw.xMax, 5),
      };
    }
    case "sequence_cobweb": {
      const expression = sanitizeDiagramLabel(raw.expression);
      if (!expression) return null;
      return {
        type: "sequence_cobweb",
        caption: sanitizeStructuredText(raw.caption),
        expression,
        u0: finiteNumber(raw.u0, 1),
        iterations: Math.max(1, Math.min(10, Math.round(finiteNumber(raw.iterations, 5)))),
        xMin: finiteNumber(raw.xMin, 0),
        xMax: finiteNumber(raw.xMax, 5),
      };
    }
    case "integral_riemann_slider": {
      const expression = sanitizeDiagramLabel(raw.expression);
      if (!expression) return null;
      return {
        type: "integral_riemann_slider",
        caption: sanitizeStructuredText(raw.caption),
        expression,
        xMin: finiteNumber(raw.xMin, 0),
        xMax: finiteNumber(raw.xMax, 5),
        rectangles: Math.max(2, Math.min(30, Math.round(finiteNumber(raw.rectangles, 8)))),
      };
    }
    case "complex_plane_polar": {
      return {
        type: "complex_plane_polar",
        caption: sanitizeStructuredText(raw.caption),
        re: finiteNumber(raw.re, 1),
        im: finiteNumber(raw.im, 1),
      };
    }
    case "algo_sandbox": {
      // Le modèle nomme ce champ « content » ou « source » aussi souvent que « code ».
      const rawCode = raw.code ?? raw.content ?? raw.source;
      const code = typeof rawCode === "string" ? rawCode.slice(0, 2000) : "";
      if (!code.trim()) return null;
      return {
        type: "algo_sandbox",
        caption: sanitizeStructuredText(raw.caption),
        code,
        language: sanitizeDiagramLabel(raw.language) || "python",
      };
    }
    case "fraction": {
      const denominator = Math.max(2, Math.min(12, Math.round(finiteNumber(raw.denominator, 4))));
      const numerator = Math.max(0, Math.min(denominator, Math.round(finiteNumber(raw.numerator, 1))));
      const shape = raw.shape === "circle" ? "circle" : "bar";
      return {
        type: "fraction",
        caption: sanitizeStructuredText(raw.caption),
        numerator,
        denominator,
        shape,
      };
    }
    case "probability_tree": {
      const branches = Array.isArray(raw.branches)
        ? raw.branches
            .map(normalizeProbabilityBranch)
            .filter((entry): entry is StructuredProbabilityBranch => entry !== null)
            .slice(0, 4)
        : [];
      if (branches.length < 2) return null;
      return {
        type: "probability_tree",
        caption: sanitizeStructuredText(raw.caption),
        branches,
      };
    }
    case "venn_diagram": {
      const sets = Array.isArray(raw.sets)
        ? raw.sets
            .map(normalizeVennSet)
            .filter((entry): entry is StructuredVennSet => entry !== null)
            .slice(0, 3)
        : [];
      if (sets.length < 2) return null;
      const rl = asRecord(raw.region_labels ?? raw.regionLabels) ?? {};
      const g = (k: string) => sanitizeDiagramLabel(rl[k]);
      // Venn = 2 (ou 3) cercles qui se chevauchent + des nombres → "shape".
      const three = sets.length >= 3;
      const parts: Record<string, unknown>[] = three
        ? [
            { kind: "circle", x: 5, y: 7, r: 4, tone: sets[0].tone, filled: true, vertex_labels: [sets[0].label] },
            { kind: "circle", x: 9, y: 7, r: 4, tone: sets[1].tone, filled: true, vertex_labels: [sets[1].label] },
            { kind: "circle", x: 7, y: 4, r: 4, tone: sets[2].tone, filled: true, vertex_labels: [sets[2].label] },
          ]
        : [
            { kind: "circle", x: 6, y: 5.5, r: 3.8, tone: sets[0].tone, filled: true, vertex_labels: [sets[0].label] },
            { kind: "circle", x: 10, y: 5.5, r: 3.8, tone: sets[1].tone, filled: true, vertex_labels: [sets[1].label] },
          ];
      if (!three) {
        if (g("a_only")) parts.push({ kind: "text", x: 3.8, y: 5.5, text: g("a_only"), tone: "navy" });
        if (g("both")) parts.push({ kind: "text", x: 8, y: 5.5, text: g("both"), tone: "navy" });
        if (g("b_only")) parts.push({ kind: "text", x: 12.2, y: 5.5, text: g("b_only"), tone: "navy" });
        if (g("neither")) parts.push({ kind: "text", x: 14.5, y: 1.5, text: g("neither"), tone: "gray" });
      }
      return normalizeShapeBlock({
        caption: raw.caption,
        width: 16,
        height: three ? 13 : 11,
        parts,
      });
    }
    case "box_plot": {
      const min = finiteNumber(raw.min, 0);
      const q1 = finiteNumber(raw.q1, min);
      const median = finiteNumber(raw.median, q1);
      const q3 = finiteNumber(raw.q3, median);
      const max = finiteNumber(raw.max, q3);
      return {
        type: "box_plot",
        caption: sanitizeStructuredText(raw.caption),
        min,
        q1,
        median,
        q3,
        max,
        axisLabel: sanitizeDiagramLabel(raw.axis_label ?? raw.axisLabel) || undefined,
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

function normalizeLearningResources(value: unknown): StructuredLearningResource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeCourseBlock(entry, 0))
    .filter((entry): entry is StructuredLearningResource =>
      entry !== null && ["table", "sign_table", "variation_table", "graph", "figure"].includes(entry.type),
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
        case "sign_table":
          visitRich(block.expression);
          block.boundaries.forEach(visitRich);
          break;
        case "variation_table":
          visitRich(block.variable);
          visitRich(block.functionName);
          block.points.forEach(visitRich);
          block.values.forEach(visitRich);
          break;
        case "figure":
          block.elements.forEach((element) => visitRich(element.label));
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
