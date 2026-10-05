/**
 * Catalogue de RÉFÉRENCE — un exemple minimal et correct pour CHAQUE bloc de
 * contenu / figure que le site sait afficher (`compileCourseBlock`,
 * `src/lib/ai/compiler.ts`). Sert à documenter le modèle JSON téléchargeable
 * (voir `jsonTemplates.ts`) : on copie-colle l'entrée qu'il faut dans
 * `blocks`, on ajuste les valeurs. Ignoré à l'import (seul `content_json`
 * compte) — garde-le dans le fichier ou supprime-le, ça ne change rien.
 *
 * Champs en snake_case (ex: `vertex_labels`, `start_angle`) : les deux
 * écritures sont acceptées, la snake_case est la plus lisible à la main.
 * Tons disponibles partout où "tone" apparaît : navy, gold, blue, green, red, gray.
 */

export const FIGURE_CATALOG_COMMENT =
  "Catalogue de TOUS les blocs disponibles, copie l'entrée qu'il te faut dans \"blocks\" " +
  "(ou pour un quiz/exercice, dans le champ \"figure\" d'une question). Ignoré à l'import.";

export const FIGURE_CATALOG: Record<string, unknown> = {
  // ---- texte & structure -------------------------------------------------
  heading: { type: "heading", level: 3, content: "Titre de section" },
  paragraph: { type: "paragraph", content: "Texte du cours, avec des maths inline si besoin : $x^2 + 1$." },
  display_math: { type: "display_math", latex: "x^2 + y^2 = z^2" },
  list: { type: "list", ordered: false, items: ["Premier point", "Second point"] },
  checklist: { type: "checklist", items: ["Je sais expliquer cette notion avec mes mots.", "Je sais l'appliquer dans un exercice."] },
  callout: { type: "callout", variant: "note", title: "Définition", paragraphs: ["Un nombre premier n'a que deux diviseurs : 1 et lui-même."] },
  steps: {
    type: "steps",
    steps: [
      { title: "Étape 1, isoler le terme", blocks: [{ type: "paragraph", content: "On soustrait $5$ des deux côtés." }] },
      { title: "Étape 2, diviser", blocks: [{ type: "paragraph", content: "On divise par $2$." }] },
    ],
  },
  table: { type: "table", headers: ["x", "f(x)"], rows: [["0", "1"], ["1", "2"], ["2", "5"]] },
  sign_table: {
    type: "sign_table",
    expression: "2x - 4",
    boundaries: ["2"],
    interval_signs: ["negative", "positive"],
    boundary_signs: ["zero"],
    _note: "n bornes → n+1 interval_signs et n boundary_signs. Valeurs : negative | zero | positive | undefined.",
  },
  variation_table: {
    type: "variation_table",
    variable: "x",
    function_name: "f",
    points: ["-\\infty", "0", "+\\infty"],
    values: ["+\\infty", "-1", "+\\infty"],
    directions: ["down", "up"],
    derivative_signs: ["negative", "positive"],
    _note: "points/values même longueur n ; directions et derivative_signs ont n-1 éléments. directions : down | up | constant.",
  },

  // ---- courbes / repère ---------------------------------------------------
  graph: {
    type: "graph",
    expression: "x^2 - 2",
    xmin: -5,
    xmax: 5,
    caption: "Parabole d'équation f(x) = x² - 2",
    parameter: null,
    vectors: [],
    _note: "Pour une famille paramétrée : parameter:{\"name\":\"a\",\"min\":-3,\"max\":3,\"default\":1} et utiliser a dans expression. vectors: [{\"x\":2,\"y\":3,\"from_x\":0,\"from_y\":0,\"label\":\"u\",\"tone\":\"red\"}].",
  },
  slope_triangle: { type: "slope_triangle", caption: "Pente d'une droite", a: 2, b: -1, xMin: -5, xMax: 5 },
  tangent_scrubber: { type: "tangent_scrubber", caption: "Tangente en un point", expression: "x^2", x0: 1, xMin: -5, xMax: 5 },
  sequence_cobweb: { type: "sequence_cobweb", caption: "Suite récurrente $u_{n+1}=0.5u_n+1$", expression: "0.5*x+1", u0: 1, iterations: 5, xMin: 0, xMax: 5 },
  integral_riemann_slider: { type: "integral_riemann_slider", caption: "Aire sous la courbe", expression: "x^2", xMin: 0, xMax: 5, rectangles: 8 },
  vector_addition_pad: { type: "vector_addition_pad", caption: "Somme de deux vecteurs", ux: 2, uy: 1, vx: 1, vy: 2 },
  complex_plane_polar: { type: "complex_plane_polar", caption: "Forme polaire d'un nombre complexe", re: 1, im: 1 },

  // ---- géométrie : la toile libre -----------------------------------------
  shape: {
    type: "shape",
    caption: "Triangle ABC rectangle en A",
    width: 9,
    height: 7,
    preset: "none",
    parts: [
      {
        kind: "right_triangle",
        x: 1, y: 1, w: 7, h: 5,
        tone: "navy", filled: true, dashed: false,
        vertex_labels: ["A", "B", "C"],
        side_labels: ["", "5 cm", "3 cm"],
        right_angle_at: 0,
        show_dimensions: false,
      },
    ],
    _note:
      "Toile composable : additionne des \"parts\" sur le même quadrillage (origine bas-gauche, unités = carreaux). " +
      "kind : rectangle | square | right_triangle | triangle | polygon (points[]) | circle (x,y,r) | arc (x,y,r,start_angle,end_angle) | " +
      "angle (marque d'angle : x,y,r,start_angle,end_angle,text=mesure) | segment (points:[{x,y},{x,y}]) | line (droite infinie, mêmes points) | " +
      "point (x,y) | text (x,y,text=étiquette libre). Options communes : tone, filled, dashed, arrow: none|end|both, " +
      "vertex_labels, side_labels, right_angle_at (index du sommet), show_dimensions. " +
      "Combine plusieurs parts pour composer : Venn = 2-3 circle + text ; aire décomposée = plusieurs rectangle + text.",
  },
  shape_pythagoras: {
    type: "shape",
    caption: "a² + b² = c²",
    preset: "pythagoras",
    a: 3,
    b: 4,
    parts: [],
    _note: "preset:\"pythagoras\" assemble seul le triangle rectangle + les 3 carrés à partir de a et b.",
  },
  trig_circle: {
    type: "trig_circle",
    caption: "Cercle trigonométrique",
    highlighted_angles: [{ angle_deg: 30, label: "\\pi/6" }, { angle_deg: 90, label: "\\pi/2" }],
    _note: "Les 16 angles remarquables sont toujours affichés ; highlighted_angles les met en évidence (gros point + étiquette).",
  },
  area_decomposer: {
    type: "area_decomposer",
    caption: "Aire décomposée en deux rectangles",
    shapes: [{ width: 4, height: 3, label: "A" }, { width: 2, height: 3, label: "B" }],
  },
  venn_diagram: {
    type: "venn_diagram",
    caption: "Multiples de 2 et de 3 entre 1 et 20",
    sets: [{ label: "Multiples de 2", tone: "blue" }, { label: "Multiples de 3", tone: "green" }],
    region_labels: { a_only: "2,4,8,10,14,16,20", both: "6,12,18", b_only: "3,9,15", neither: "1,5,7,11,13,17,19" },
    _note: "2 ou 3 sets. region_labels optionnel, seulement utilisé pour 2 sets (a_only/both/b_only/neither).",
  },
  figure: {
    type: "figure",
    caption: "Schéma libre (dernier recours si \"shape\" ne convient pas)",
    elements: [
      { type: "line", x1: 20, y1: 120, x2: 180, y2: 120, tone: "navy", label: "Segment" },
      { type: "point", x: 100, y: 80, tone: "gold", label: "A" },
    ],
    _note: "Repère fixe 200×160. elements : line | point | circle (cx,cy,r,filled) | polygon (points[], filled) | arc (cx,cy,r,start_angle,end_angle).",
  },

  // ---- nombres, mesures, numération ---------------------------------------
  number_line: {
    type: "number_line",
    caption: "Droite graduée",
    min: -5, max: 5,
    points: [{ value: -2, label: "A" }, { value: 3, label: "B" }],
    intervals: [{ from: -1, to: 2, from_included: true, to_included: false, tone: "blue" }],
  },
  interval_builder: { type: "interval_builder", caption: "L'intervalle [-2 ; 3[", min: -5, max: 5, lowerBound: -2, upperBound: 3, lowerOpen: false, upperOpen: true },
  base_ten_blocks: { type: "base_ten_blocks", hundreds: 1, tens: 2, units: 3, caption: "123 : 1 centaine, 2 dizaines et 3 unités" },
  place_value_chart: { type: "place_value_chart", caption: "Le nombre 4 025", number: 4025 },
  column_operation: { type: "column_operation", operator: "+", operands: ["24", "15"], result: "39", carries: [] },
  scientific_notation_converter: { type: "scientific_notation_converter", caption: "Écriture scientifique", value: 3.2, exponent: -6 },
  equation_balancer: { type: "equation_balancer", caption: "3x + 2 = 11", leftTerms: ["3x", "2"], rightTerms: ["11"] },
  balance_scale: {
    type: "balance_scale",
    caption: "3 + 4 est égal à 7",
    left: [3, 4], right: [7],
    left_label: "", right_label: "",
    tilt: "auto",
    _note: "tilt : auto (déduit des masses) | level | left | right, pour une balance volontairement déséquilibrée.",
  },
  ruler_measurer: { type: "ruler_measurer", caption: "Mesure le segment", segmentLength: 7, unit: "cm" },
  interactive_protractor: { type: "interactive_protractor", caption: "Mesure l'angle", angleDeg: 45 },
  compass_tool: { type: "compass_tool", caption: "Trace un cercle de rayon 5", radius: 5, centerLabel: "O" },
  clock: { type: "clock", caption: "Il est 3h15", hours: 3, minutes: 15, interactive: true },
  thermometer_axis: {
    type: "thermometer_axis",
    caption: "Températures relevées dans la semaine",
    min: -10, max: 10,
    points: [{ value: -3, label: "Lundi" }, { value: 5, label: "Mardi" }],
  },
  fraction: { type: "fraction", caption: "Trois quarts", numerator: 3, denominator: 4, shape: "bar" },
  fraction_strips: { type: "fraction_strips", caption: "Comparaison de fractions", fractions: [{ numerator: 1, denominator: 2 }, { numerator: 3, denominator: 4 }] },
  solid: { type: "solid", solid: "cylinder", caption: "Cylindre de rayon 3 cm et de hauteur 8 cm", labels: { radius: "3 cm", height: "8 cm" }, _note: "solid : cube|box|cylinder|cone|pyramid|triangular_prism|sphere ; labels : height, radius, base, length, width, depth, side (selon le solide)." },
  labeled_polygon: { type: "labeled_polygon", shape: "right_triangle", caption: "Triangle rectangle en A", labels: { a: "3 cm", b: "4 cm", c: "5 cm" }, vertices: ["A", "B", "C"], _note: "shape : rectangle|square|right_triangle|triangle|parallelogram|trapezoid ; labels : length, width, side, base, height, a, b, c, big_base, small_base." },
  labeled_circle: { type: "labeled_circle", caption: "Cercle de rayon 4 cm", labels: { radius: "4 cm" }, _note: "labels : radius et/ou diameter." },
  brick_pyramid: { type: "brick_pyramid", caption: "Complète la pyramide : chaque brique est la différence des deux briques qui la soutiennent", levels: [[""], ["", "(+2)"], ["(-4)", "(+2)", "(-3)"]] },
  fill_grid: { type: "fill_grid", caption: "Carré magique à compléter", cells: [["-2", "", "-6"], ["", "4", ""], ["", "", "2"]] },
  tape_diagram: { type: "tape_diagram", caption: "Partage en parts", parts: [{ label: "part 1", value: 4, tone: "blue" }, { label: "part 2", value: 6, tone: "green" }] },
  line_chart: {
    type: "line_chart",
    caption: "Évolution de la température",
    x_label: "Mois", y_label: "°C",
    x_values: ["janv.", "févr.", "mars", "avril"],
    series: [{ name: "Paris", tone: "blue", values: [5, 7, 10, 13] }],
    _note: "1 à 4 séries partageant le même axe. Accepte aussi points:[{x,y}] pour une série unique.",
  },
  flowchart: {
    type: "flowchart",
    caption: "Boucle « tant que »",
    nodes: [
      { label: "Début", kind: "start" },
      { label: "i < 5 ?", kind: "condition" },
      { label: "Afficher i", kind: "action" },
      { label: "Fin", kind: "end" },
    ],
    loop_from: 2, loop_to: 1,
    _note: "kind : start | end | action | condition. loop_from/loop_to (indices) tracent la flèche de retour d'une boucle.",
  },
  ratio_mixer: { type: "ratio_mixer", caption: "Proportionnalité", ratios: [{ label: "1 kg", value: 3, tone: "blue" }, { label: "2 kg", value: 6, tone: "green" }] },
  coin_purse: { type: "coin_purse", caption: "Porte-monnaie", coins: [100, 50, 20, 20], target: 190 },
  grid_painter: { type: "grid_painter", caption: "7 cases sur 10", rows: 2, cols: 5, highlighted: 7 },
  pattern_maker: { type: "pattern_maker", caption: "Complète la suite", sequence: ["●", "●●", "●●●"], options: ["●●●●", "●●"], answer: "●●●●" },
  net_folder: { type: "net_folder", caption: "Patron d'un cube", solid: "cube", width: 4, height: 4, depth: 4 },
  algo_sandbox: { type: "algo_sandbox", caption: "Essaie ce code", code: "for i in range(5):\n    print(i)", language: "python" },

  // ---- statistiques / probabilités ----------------------------------------
  pie_chart: { type: "pie_chart", caption: "Répartition de la classe", slices: [{ label: "Filles", value: 12, tone: "blue" }, { label: "Garçons", value: 8, tone: "green" }] },
  bar_chart: { type: "bar_chart", caption: "Notes de la semaine", bars: [{ label: "Lundi", value: 5, tone: "blue" }, { label: "Mardi", value: 8, tone: "green" }] },
  box_plot: { type: "box_plot", caption: "Répartition des notes /20", min: 2, q1: 8, median: 12, q3: 15, max: 19, axis_label: "Notes /20" },
  probability_tree: {
    type: "probability_tree",
    caption: "Tirage avec remise",
    branches: [
      { label: "Rouge", probability: "1/2", children: [{ label: "Rouge", probability: "1/2" }, { label: "Bleu", probability: "1/2" }] },
      { label: "Bleu", probability: "1/2", children: [{ label: "Rouge", probability: "1/2" }, { label: "Bleu", probability: "1/2" }] },
    ],
  },

  // ---- divers --------------------------------------------------------------
  definition: { type: "definition", term: "Nombre premier", definition: "Un entier supérieur à 1 qui n'a que deux diviseurs : 1 et lui-même.", example: "$7$ est premier." },
  image: {
    type: "image",
    url: "https://exemple.org/photo.jpg",
    caption: "Légende de la photo",
    _note: "Fournis directement une URL (pas de recherche automatique côté import à la main) : image libre de droits, lien direct.",
  },

  // ---- emplacement d'exercice intégré (cours) -------------------------------
  exercise: {
    type: "exercise",
    exercise_index: 1,
    _note: "Position dans le tableau \"exercises\" de LA LEÇON (1, 2, 3...), voir le modèle de cours.",
  },
};
