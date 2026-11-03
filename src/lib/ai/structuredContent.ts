import { normalizeJsxSpec } from "@/lib/jsxFigure";

import { stringValue, asRecord } from "./structuredMath";
import { normalizeStructuredLatex, mathToReadableText, sanitizeStructuredText } from "./structuredMath";
import { StructuredSignValue, StructuredVariationDirection, StructuredGraphVector, finiteNumber, clamp, normalizeFigureTone, StructuredTrigCircleAngle, StructuredPieSlice, StructuredNumberLinePoint, StructuredNumberLineInterval, StructuredBar, StructuredProbabilityLeaf, StructuredProbabilityBranch, StructuredVennSet, normalizeFigureElement, StructuredFigureElement, normalizeShapeBlock, StructuredFigureTone } from "./structuredFigures";
import { StructuredCourseBlock, StructuredRichText, normalizeStructuredRichText } from "./structuredFigures";
export * from "./structuredFigures";
export * from "./structuredMath";


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

function sanitizeDiagramLabel(value: unknown): string {
  let text = stringValue(value);
  for (const [pattern, replacement] of DIAGRAM_LABEL_CONVERSIONS) {
    text = text.replace(pattern, replacement);
  }
  return sanitizeStructuredText(text);
}

/** Étiquettes de cotes d'une figure de géométrie : clés connues seulement, valeurs courtes. */
function geometryLabels(value: unknown): Record<string, string> {
  const allowed = ["height", "radius", "diameter", "base", "length", "width", "depth", "side", "a", "b", "c", "hypotenuse", "big_base", "small_base"];
  const rec = asRecord(value);
  const out: Record<string, string> = {};
  if (!rec) return out;
  for (const key of allowed) {
    const v = rec[key];
    if (typeof v === "string" || typeof v === "number") {
      const text = String(v).replace(/\s+/g, " ").trim().slice(0, 16);
      if (text) out[key] = text;
    }
  }
  return out;
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
    case "solid": {
      const solids = ["cube", "box", "cylinder", "cone", "pyramid", "triangular_prism", "sphere"] as const;
      const solid = solids.find((s) => s === String(raw.solid ?? raw.kind ?? "").trim());
      if (!solid) return null;
      return { type: "solid", solid, caption: sanitizeStructuredText(raw.caption), labels: geometryLabels(raw.labels) };
    }
    case "labeled_polygon": {
      const shapes = ["rectangle", "square", "right_triangle", "triangle", "parallelogram", "trapezoid"] as const;
      const shape = shapes.find((s) => s === String(raw.shape ?? raw.kind ?? "").trim());
      if (!shape) return null;
      const vertices = Array.isArray(raw.vertices) ? raw.vertices.map((v: unknown) => String(v ?? "").trim().slice(0, 3)).slice(0, 6) : [];
      return { type: "labeled_polygon", shape, caption: sanitizeStructuredText(raw.caption), labels: geometryLabels(raw.labels), vertices };
    }
    case "jsx_figure": {
      const spec = normalizeJsxSpec(raw.spec ?? raw);
      return spec ? { type: "jsx_figure", caption: spec.caption, spec } : null;
    }
    case "labeled_circle": {
      return { type: "labeled_circle", caption: sanitizeStructuredText(raw.caption), labels: geometryLabels(raw.labels) };
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
