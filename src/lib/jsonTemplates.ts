/** Modèles JSON vides pour créer un cours / exercice / quiz à la main avant import */

export const COURSE_JSON_TEMPLATE = {
  _type: "course",
  _version: "1",
  title: "Titre du cours",
  description: "Description courte du cours",
  subject: "Algèbre",
  level: "6eme",
  status: "draft",
  thumbnail_url: "",
  content_json: [
    {
      id: "chapitre-1",
      title: "Titre du chapitre 1",
      lessons: [
        {
          id: "lecon-1",
          title: "Titre de la leçon 1",
          type: "text",
          content: "<h3>Titre</h3><p>Contenu de la leçon en HTML, avec LaTeX inline $x^2$ ou en bloc $$x^2 + y^2 = z^2$$.</p>",
          duration: 30,
          exercises: [
            {
              id: "ex-1",
              question: "Énoncé de l'exercice (peut contenir du LaTeX $...$)",
              type: "short_answer",
              answer: "réponse attendue",
              hint: "Indice optionnel",
              explanation: "Explication de la solution"
            }
          ]
        }
      ]
    }
  ]
};

export const EXERCISE_JSON_TEMPLATE = {
  _type: "exercise",
  _version: "1",
  title: "Titre de l'exercice",
  description: "Description courte de l'exercice",
  type: "standard",
  level: "6eme",
  status: "draft",
  thumbnail_url: "",
  time_limit: 0,
  time_limit_minutes: 0,
  min_score_percent: 0,
  max_attempts: 0,
  content_json: [
    {
      id: "page-1",
      title: "Page 1",
      blocks: [
        {
          id: "bloc-1",
          type: "text",
          title: "Consigne",
          content: "<p>Texte d'introduction ou de consigne en HTML, avec LaTeX $...$.</p>"
        },
        {
          id: "bloc-2",
          type: "single_choice",
          title: "Question 1",
          content: "Énoncé de la question",
          points: 1,
          options: ["Réponse A", "Réponse B", "Réponse C"],
          correctAnswer: "Réponse A",
          explanation: "Explication de la bonne réponse"
        },
        {
          id: "bloc-3",
          type: "text_input",
          title: "Question 2",
          content: "Énoncé de la question à réponse libre",
          points: 1,
          correctAnswer: "réponse attendue",
          explanation: "Explication de la solution"
        }
      ]
    }
  ]
};

export const QUIZ_JSON_TEMPLATE = {
  _type: "quiz",
  _version: "1",
  title: "Titre du quiz",
  description: "Description courte du quiz",
  type: "standard",
  level: "6eme",
  status: "draft",
  difficulty_level: "medium",
  time_limit_minutes: 0,
  min_score_percent: 0,
  max_attempts: 0,
  content_json: [
    {
      id: "question-1",
      text: "Énoncé de la question 1 (peut contenir du LaTeX $...$)",
      type: "single_choice",
      points: 1,
      options: ["Réponse A", "Réponse B", "Réponse C"],
      correctAnswer: "Réponse A",
      explanation: "Explication de la bonne réponse"
    },
    {
      id: "question-2",
      text: "Énoncé de la question 2 (vrai ou faux)",
      type: "true_false",
      points: 1,
      options: ["Vrai", "Faux"],
      correctAnswer: "Vrai",
      explanation: "Explication de la bonne réponse"
    },
    {
      id: "question-3",
      text: "Énoncé de la question 3 (réponse libre)",
      type: "text_input",
      points: 1,
      correctAnswer: "réponse attendue",
      explanation: "Explication de la bonne réponse"
    }
  ]
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
