import type { Chapter } from "@/components/admin/CourseBuilder";
import type { Page } from "@/components/admin/ExerciseBuilder";
import type { Question } from "@/components/admin/QuizBuilder";

/**
 * Contenu de DÉMONSTRATION de la page Offres : un petit cours, un exercice et un quiz sur les fractions (6e), jouables
 * sans compte. Rien n'est enregistré. Les réponses ne partent jamais vers le navigateur avant correction : la page
 * envoie une copie sans réponses (stripAnswers) et la correction se fait côté serveur (/api/demo/grade).
 */
export const DEMO_ID = "demo";

export const DEMO_COURSE: { id: string; title: string; level: string; content_json: Chapter[] } = {
  id: DEMO_ID,
  title: "Les fractions (6e)",
  level: "6ème",
  content_json: [
    {
      id: "demo-ch-1",
      title: "Comprendre les fractions",
      lessons: [
        {
          id: "demo-l-1",
          type: "text",
          title: "1. Une fraction, c'est un partage",
          duration: 5,
          content:
            "<p>Une <strong>fraction</strong> décrit une partie d'un tout partagé en parts égales.</p>" +
            '<blockquote class="course-callout course-callout-note"><strong>Définition</strong><p>Dans la fraction $\\frac{a}{b}$, le <strong>dénominateur</strong> $b$ indique en combien de parts égales on partage, et le <strong>numérateur</strong> $a$ combien de parts on prend.</p></blockquote>' +
            "<p>Exemple : une pizza coupée en 8 parts égales, dont on mange 3 parts.</p><p>$$\\text{On a mangé } \\frac{3}{8} \\text{ de la pizza.}$$</p>" +
            '<blockquote class="course-callout course-callout-warning"><strong>Attention</strong><p>Les parts doivent être <strong>égales</strong> : sinon, ce n\'est pas une fraction du tout.</p></blockquote>',
        },
        {
          id: "demo-l-2",
          type: "text",
          title: "2. Fractions égales",
          duration: 5,
          content:
            "<p>On obtient une fraction égale en multipliant (ou en divisant) le numérateur et le dénominateur par le même nombre non nul.</p>" +
            "<p>$$\\frac{1}{2} = \\frac{1 \\times 3}{2 \\times 3} = \\frac{3}{6}$$</p>" +
            '<blockquote class="course-callout course-callout-note"><strong>Astuce</strong><p>Pour simplifier $\\frac{6}{8}$, on divise en haut et en bas par 2 : $\\frac{6}{8} = \\frac{3}{4}$.</p></blockquote>',
        },
        {
          id: "demo-l-3",
          type: "text",
          title: "3. Placer une fraction sur une droite",
          duration: 5,
          content:
            "<p>Pour placer $\\frac{3}{4}$ entre 0 et 1, on partage l'unité en 4 parts égales et on compte 3 parts à partir de 0.</p>" +
            "<p>$$0 < \\frac{3}{4} < 1$$</p><p>Une fraction dont le numérateur est plus petit que le dénominateur est toujours <strong>inférieure à 1</strong>.</p>",
        },
      ],
    },
  ],
};

export const DEMO_EXERCISE: { id: string; title: string; level: string; grading_type: "auto"; min_score_percent: number; content_json: Page[] } = {
  id: DEMO_ID,
  title: "Exercice : les fractions",
  level: "6ème",
  grading_type: "auto",
  min_score_percent: 50,
  content_json: [
    {
      id: "demo-p-1",
      title: "Lire une fraction",
      blocks: [
        { id: "demo-b-1", type: "single_choice", title: "Question 1", points: 1, content: "<p>Une tablette de chocolat a 12 carrés. Léa en mange 5. Quelle fraction de la tablette a-t-elle mangée ?</p>", options: ["$\\frac{5}{12}$", "$\\frac{12}{5}$", "$\\frac{5}{7}$", "$\\frac{7}{12}$"], correctAnswer: "$\\frac{5}{12}$", explanation: "<p>On partage en 12 parts égales (dénominateur) et on en prend 5 (numérateur) : $\\frac{5}{12}$.</p>" },
      ],
    },
    {
      id: "demo-p-2",
      title: "Fractions égales",
      blocks: [
        {
          id: "demo-b-2", type: "matching", title: "Question 2", points: 3, content: "<p>Relie chaque fraction à la fraction qui lui est égale.</p>",
          pairs: [{ left: "$\\frac{1}{2}$", right: "$\\frac{4}{8}$" }, { left: "$\\frac{2}{3}$", right: "$\\frac{6}{9}$" }, { left: "$\\frac{3}{4}$", right: "$\\frac{9}{12}$" }],
          explanation: "<p>On multiplie le numérateur et le dénominateur par le même nombre : par 4, par 3, puis par 3.</p>",
        },
      ],
    },
    {
      id: "demo-p-3",
      title: "Ranger des fractions",
      blocks: [
        { id: "demo-b-3", type: "ordering", title: "Question 3", points: 1, content: "<p>Range ces fractions de la plus petite à la plus grande.</p>", items: ["$\\frac{1}{4}$", "$\\frac{2}{4}$", "$\\frac{3}{4}$", "$\\frac{5}{4}$"], explanation: "<p>Même dénominateur : on compare les numérateurs, 1 < 2 < 3 < 5.</p>" },
      ],
    },
    {
      id: "demo-p-4",
      title: "Sur la droite graduée",
      blocks: [
        { id: "demo-b-4", type: "number_line_point", title: "Question 4", points: 1, content: "<p>Place $\\frac{3}{4}$ sur la droite graduée.</p>", numberLineMin: 0, numberLineMax: 1, numberLineStep: 0.25, correctAnswer: "0.75", explanation: "<p>L'unité est partagée en 4 : on compte 3 graduations à partir de 0.</p>" },
      ],
    },
  ],
};

export const DEMO_QUIZ: { id: string; title: string; level: string; min_score_percent: number; content_json: Question[] } = {
  id: DEMO_ID,
  title: "Quiz : les fractions",
  level: "6ème",
  min_score_percent: 50,
  content_json: [
    { id: "demo-q-1", type: "single_choice", points: 1, text: "<p>Quelle fraction est égale à $\\frac{2}{5}$ ?</p>", options: ["$\\frac{4}{10}$", "$\\frac{2}{10}$", "$\\frac{5}{2}$", "$\\frac{4}{5}$"], correctAnswer: "$\\frac{4}{10}$", explanation: "<p>$\\frac{2 \\times 2}{5 \\times 2} = \\frac{4}{10}$.</p>" },
    { id: "demo-q-2", type: "true_false", points: 1, text: "<p>$\\frac{7}{6}$ est plus grand que 1.</p>", options: ["Vrai", "Faux"], correctAnswer: "Vrai", explanation: "<p>Le numérateur (7) est plus grand que le dénominateur (6), donc la fraction dépasse 1.</p>" },
    { id: "demo-q-3", type: "multiple_choice", points: 1, text: "<p>Lesquelles de ces fractions sont égales à $\\frac{1}{3}$ ?</p>", options: ["$\\frac{2}{6}$", "$\\frac{3}{9}$", "$\\frac{3}{6}$", "$\\frac{1}{6}$"], correctAnswer: ["$\\frac{2}{6}$", "$\\frac{3}{9}$"], explanation: "<p>$\\frac{2}{6}$ et $\\frac{3}{9}$ se simplifient toutes deux en $\\frac{1}{3}$.</p>" },
  ],
};
