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
        {
          id: "demo-l-4",
          type: "text",
          title: "Bilan : je sais faire",
          duration: 2,
          content:
            "<p>Coche ce que tu sais faire maintenant. S'il reste une case vide, relis la leçon correspondante.</p>" +
            '<ul class="course-checklist"><li>Je sais lire une fraction : numérateur et dénominateur</li><li>Je sais trouver une fraction égale en multipliant en haut et en bas</li><li>Je sais simplifier une fraction</li><li>Je sais placer une fraction sur une droite graduée</li></ul>',
        },
      ],
    },
  ],
};

export const DEMO_COURSE_PYTHAGORE: { id: string; title: string; level: string; content_json: Chapter[] } = {
  id: DEMO_ID,
  title: "Le théorème de Pythagore (4e)",
  level: "4ème",
  content_json: [
    {
      id: "demo-py-ch-1",
      title: "Le théorème de Pythagore",
      lessons: [
        {
          id: "demo-py-l-1",
          type: "text",
          title: "1. Le triangle rectangle",
          duration: 4,
          content:
            "<p>Un triangle <strong>rectangle</strong> possède un angle droit. Le côté opposé à l'angle droit est le plus long : c'est l'<strong>hypoténuse</strong>.</p>" +
            '<blockquote class="course-callout course-callout-note"><strong>À retenir</strong><p>Dans le triangle $ABC$ rectangle en $A$, l\'hypoténuse est $[BC]$.</p></blockquote>',
        },
        {
          id: "demo-py-l-2",
          type: "text",
          title: "2. L'égalité de Pythagore",
          duration: 6,
          content:
            '<blockquote class="course-callout course-callout-note"><strong>Théorème</strong><p>Si le triangle $ABC$ est rectangle en $A$, alors $BC^2 = AB^2 + AC^2$.</p></blockquote>' +
            "<p>Exemple : $AB = 3$ cm et $AC = 4$ cm.</p><p>$$BC^2 = 3^2 + 4^2 = 9 + 16 = 25 \\quad\\text{donc}\\quad BC = \\sqrt{25} = 5 \\text{ cm}$$</p>",
        },
        {
          id: "demo-py-l-3",
          type: "text",
          title: "3. Calculer un côté de l'angle droit",
          duration: 6,
          content:
            "<p>Si l'on connaît l'hypoténuse, on soustrait : $AB^2 = BC^2 - AC^2$.</p>" +
            "<p>Exemple : $BC = 13$ et $AC = 5$.</p><p>$$AB^2 = 13^2 - 5^2 = 169 - 25 = 144 \\quad\\text{donc}\\quad AB = 12$$</p>" +
            '<blockquote class="course-callout course-callout-warning"><strong>Attention</strong><p>Le théorème ne s\'applique qu\'aux triangles <strong>rectangles</strong>.</p></blockquote>',
        },
        {
          id: "demo-py-l-4",
          type: "text",
          title: "Bilan : je sais faire",
          duration: 2,
          content:
            "<p>Coche ce que tu sais faire maintenant.</p>" +
            '<ul class="course-checklist"><li>Je sais repérer l\'hypoténuse d\'un triangle rectangle</li><li>Je sais écrire l\'égalité de Pythagore</li><li>Je sais calculer l\'hypoténuse</li><li>Je sais calculer un côté de l\'angle droit</li></ul>',
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
    { id: "demo-p-1", title: "Lire une fraction", blocks: [
      { id: "demo-b-1", type: "text_input", title: "Question 1", points: 1, content: "<p>Une tablette de chocolat a 12 carrés. Léa en mange 5. Quelle fraction de la tablette a-t-elle mangée ?</p><p><em>Écris ta réponse sous la forme a/b.</em></p>", correctAnswer: "5/12", explanation: "<p>12 parts égales (dénominateur), on en prend 5 (numérateur) : $\\frac{5}{12}$.</p>" },
    ] },
    { id: "demo-p-2", title: "Fractions égales", blocks: [
      { id: "demo-b-2", type: "text_input", title: "Question 2", points: 1, content: "<p>Complète : $\\frac{3}{4} = \\frac{\\ldots}{12}$</p><p><em>Écris le nombre manquant.</em></p>", correctAnswer: "9", explanation: "<p>On passe de 4 à 12 en multipliant par 3, donc $3 \\times 3 = 9$ : $\\frac{3}{4} = \\frac{9}{12}$.</p>" },
    ] },
    { id: "demo-p-3", title: "Simplifier", blocks: [
      { id: "demo-b-3", type: "text_input", title: "Question 3", points: 1, content: "<p>Simplifie au maximum la fraction $\\frac{6}{8}$.</p>", correctAnswer: "3/4", explanation: "<p>On divise en haut et en bas par 2 : $\\frac{6}{8} = \\frac{3}{4}$, qu'on ne peut plus simplifier.</p>" },
    ] },
    { id: "demo-p-4", title: "Additionner", blocks: [
      { id: "demo-b-4", type: "text_input", title: "Question 4", points: 1, content: "<p>Calcule $\\frac{1}{4} + \\frac{2}{4}$.</p>", correctAnswer: "3/4", explanation: "<p>Même dénominateur : on additionne les numérateurs, $1 + 2 = 3$, donc $\\frac{3}{4}$.</p>" },
    ] },
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
