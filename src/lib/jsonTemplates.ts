/** Modèles JSON à remplir à la main pour créer un cours / exercice / quiz,
 * puis à importer via "Importer un fichier" en admin.
 *
 * `_format: "source"` dit à l'import de COMPILER ce fichier (texte brut avec
 * $...$, blocs déclaratifs) vers le format affiché par le site — sans ce
 * champ, l'import suppose que le contenu est déjà compilé (ex: un export
 * récupéré puis ré-importé tel quel) et ne le touche pas.
 * Voir `src/lib/ai/handAuthoredContent.ts` pour la compilation, et
 * `src/lib/figureCatalog.ts` pour le catalogue complet des blocs/figures.
 */
import { FIGURE_CATALOG, FIGURE_CATALOG_COMMENT } from "@/lib/figureCatalog";

export const COURSE_JSON_TEMPLATE = {
  _type: "course",
  _version: "2",
  _format: "source",
  _comment:
    "MODÈLE DE COURS — remplis title/description/subject/level puis content_json. " +
    "Chaque leçon a des \"blocks\" (le cours, dans l'ordre) et des \"exercises\" " +
    "(les mini-exercices intégrés : 2 à 3 par leçon, référencés depuis \"blocks\" " +
    "par {\"type\":\"exercise\",\"exercise_index\":N}, N = position dans \"exercises\"). " +
    "Texte : chaîne brute, LaTeX entre $...$ (jamais de HTML, jamais d'unicode ² × √). " +
    "Voir \"_blocks_catalogue\" ci-dessous pour TOUS les blocs/figures disponibles.",
  title: "Titre du cours",
  description: "Ce que l'élève saura faire à la fin (2-3 phrases).",
  subject: "Nombres et calculs",
  level: "6eme",
  status: "draft",
  thumbnail_url: "",
  folder_id: null,
  estimated_time: 30,
  _blocks_catalogue: { _comment: FIGURE_CATALOG_COMMENT, ...FIGURE_CATALOG },
  content_json: [
    {
      title: "Nom du chapitre",
      lessons: [
        {
          title: "Titre de la première leçon",
          duration: 15,
          blocks: [
            { type: "paragraph", content: "Paragraphe d'accroche : une situation concrète, un exemple du quotidien." },
            { type: "callout", variant: "note", title: "Définition", paragraphs: ["La définition ou la propriété clé de la leçon."] },
            { type: "display_math", latex: "a^2 + b^2 = c^2" },
            { type: "exercise", exercise_index: 1 },
            { type: "paragraph", content: "La méthode, expliquée pas à pas, avec un exemple traité : $3 \\times 4 = 12$." },
            { type: "exercise", exercise_index: 2 },
          ],
          exercises: [
            {
              question: "Énoncé du 1er mini-exercice, en lien direct avec ce qui précède.",
              answer: "Réponse attendue, concise.",
              hint: "Un indice d'une phrase.",
              explanation: "Correction complète, expliquée.",
            },
            {
              question: "Énoncé du 2e mini-exercice.",
              answer: "Réponse attendue.",
              hint: "Un indice.",
              explanation: "Correction complète.",
            },
          ],
        },
        {
          title: "Titre de la deuxième leçon (avec une figure)",
          duration: 15,
          blocks: [
            { type: "paragraph", content: "Cette leçon illustre l'usage d'une figure géométrique composable." },
            {
              type: "shape",
              caption: "Triangle ABC rectangle en A",
              width: 9,
              height: 7,
              parts: [
                {
                  kind: "right_triangle",
                  x: 1, y: 1, w: 7, h: 5,
                  tone: "navy", filled: true,
                  vertex_labels: ["A", "B", "C"],
                  side_labels: ["", "5 cm", "3 cm"],
                  right_angle_at: 0,
                },
              ],
            },
            { type: "exercise", exercise_index: 1 },
          ],
          exercises: [
            {
              question: "Question sur la figure ci-dessus.",
              answer: "Réponse.",
              hint: "Indice.",
              explanation: "Correction complète.",
            },
          ],
        },
      ],
    },
  ],
};

export const EXERCISE_JSON_TEMPLATE = {
  _type: "exercise",
  _version: "2",
  _format: "source",
  _comment:
    "MODÈLE D'EXERCICE — une \"page\" de \"blocks\", chaque bloc = une question. " +
    "type possible : text_input | fill_in_the_blank | matching | ordering | coding | single_choice | true_false. " +
    "\"figure\" (optionnel, sur n'importe quel bloc) : une entrée du catalogue de src/lib/figureCatalog.ts. " +
    "Texte brut, LaTeX entre $...$.",
  title: "Titre de l'exercice",
  description: "Description courte",
  type: "standard",
  level: "6eme",
  status: "draft",
  thumbnail_url: "",
  time_limit: 0,
  time_limit_minutes: 20,
  min_score_percent: 0,
  max_attempts: 3,
  content_json: [
    {
      id: "page-1",
      title: "Questions",
      blocks: [
        {
          id: "block-1",
          type: "text_input",
          title: "Question 1",
          content: "Calcule $\\frac{3}{4} + \\frac{1}{4}$.",
          correctAnswer: "1",
          explanation: "$\\frac{3}{4} + \\frac{1}{4} = \\frac{4}{4} = 1$.",
          points: 2,
        },
        {
          id: "block-2",
          type: "fill_in_the_blank",
          title: "Question 2",
          content: "La somme de $12$ et $8$ est [...].",
          blanks: ["20"],
          explanation: "$12 + 8 = 20$.",
          points: 2,
        },
        {
          id: "block-3",
          type: "matching",
          title: "Question 3",
          content: "Associe chaque nombre à sa nature.",
          pairs: [
            { left: "4", right: "Pair" },
            { left: "7", right: "Impair" },
          ],
          explanation: "4 est divisible par 2 (pair) ; 7 ne l'est pas (impair).",
          points: 2,
        },
        {
          id: "block-4",
          type: "text_input",
          title: "Question 4 (avec figure)",
          content: "Quelle est la mesure de l'angle marqué ?",
          figure: { type: "interactive_protractor", caption: "Mesure l'angle", angleDeg: 60 },
          correctAnswer: "60",
          explanation: "Le rapporteur indique 60°.",
          points: 2,
        },
      ],
    },
  ],
};

export const QUIZ_JSON_TEMPLATE = {
  _type: "quiz",
  _version: "2",
  _format: "source",
  _comment:
    "MODÈLE DE QUIZ — un tableau de questions à choix unique. " +
    "\"options\" : exactement 4 propositions distinctes. \"correctAnswer\" : recopie EXACTEMENT une des options. " +
    "\"figure\" (optionnel) : une entrée du catalogue de src/lib/figureCatalog.ts. Texte brut, LaTeX entre $...$.",
  title: "Titre du quiz",
  description: "Description courte",
  type: "standard",
  level: "6eme",
  status: "draft",
  difficulty_level: "medium",
  time_limit_minutes: 10,
  min_score_percent: 0,
  max_attempts: 3,
  content_json: [
    {
      id: "q-1",
      text: "Combien font $6 \\times 7$ ?",
      options: ["36", "42", "48", "40"],
      correctAnswer: "42",
      explanation: "$6 \\times 7 = 42$.",
      points: 1,
    },
    {
      id: "q-2",
      text: "Quelle affirmation est vraie ?",
      options: ["$\\sqrt{2} \\in \\mathbb{Q}$", "$\\sqrt{2} \\notin \\mathbb{Q}$", "$\\sqrt{2} \\in \\mathbb{Z}$", "$\\sqrt{2} \\in \\mathbb{N}$"],
      correctAnswer: "$\\sqrt{2} \\notin \\mathbb{Q}$",
      explanation: "$\\sqrt{2}$ est irrationnel : il n'appartient pas à $\\mathbb{Q}$.",
      points: 1,
    },
    {
      id: "q-3",
      text: "Sur la figure, quel point correspond à $-3$ ?",
      figure: {
        type: "number_line",
        caption: "Droite graduée avec points A, B, C",
        min: -5, max: 5,
        points: [{ value: -3, label: "A" }, { value: 0, label: "B" }, { value: 2, label: "C" }],
      },
      options: ["A", "B", "C", "Aucun"],
      correctAnswer: "A",
      explanation: "Le point A est placé sur la graduation $-3$.",
      points: 1,
    },
  ],
};

/** Télécharge un modèle JSON à remplir à la main */
export function downloadJSONTemplate(template: object, filename: string) {
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
