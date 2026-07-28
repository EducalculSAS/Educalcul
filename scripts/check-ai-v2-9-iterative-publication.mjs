import {
  verifyCourseGloballyForPublication,
  verifyCourseLessonForPublication,
} from "@/lib/ai/courseReview";

function rich(value) {
  return { parts: [{ type: "text", value }] };
}

const lessonPlan = {
  title: "Test de cohérence numérique",
  objective: "Vérifier une valeur approchée",
  scope: "Exercice numérique simple",
  coreConcepts: ["calcul numérique", "arrondi"],
  prerequisiteRecall: [],
  requiredSections: ["Méthode", "Application"],
  exerciseSkills: ["calculer et arrondir"],
  forbiddenConcepts: [],
  visualFocus: "none",
  complexity: 1,
};

const boundaries = {
  ownedConcepts: ["calcul numérique", "arrondi"],
  allowedRecall: [],
  forbiddenDevelopments: [],
};

const lesson = {
  title: lessonPlan.title,
  duration: 30,
  blocks: [
    { type: "heading", level: 3, content: rich("Application") },
    { type: "paragraph", content: rich("On calcule une valeur approchée.") },
    { type: "exercise", exerciseIndex: 1 },
  ],
  exercises: [
    {
      question: rich("Calculer la valeur demandée."),
      answer: rich("Le résultat vaut environ -2,47."),
      hint: rich("Vérifier le signe."),
      explanation: rich("Le calcul donne environ 2,47."),
    },
  ],
};

let repairCalls = 0;
let rewriteCalls = 0;
let judgeCalls = 0;

const generate = async (_userPrompt, _systemPrompt, contract) => {
  switch (contract.name) {
    case "educalcul_course_publication_judge":
      judgeCalls += 1;
      return { verdict: "pass", summary: "Audit simulé", issues: [] };
    case "educalcul_course_publication_repairs":
      repairCalls += 1;
      // Première passe volontairement insuffisante : elle modifie l'indice,
      // mais laisse la contradiction answer/explanation pour forcer le repli
      // par reconstruction complète de l'exercice.
      return {
        patches: [
          {
            id: "e0-hint",
            replacement: "Recalculer soigneusement le signe avant de conclure.",
            reason: "Indice plus précis",
          },
        ],
      };
    case "educalcul_course_publication_exercise_rewrite":
      rewriteCalls += 1;
      return {
        question: "Calculer la valeur demandée.",
        answer: "Le résultat vaut environ $-2{,}47$.",
        hint: "Vérifier le signe avant l'arrondi.",
        explanation:
          "Le calcul complet conduit à une valeur négative. Conclusion : le résultat vaut environ $-2{,}47$.",
      };
    default:
      throw new Error(`Contrat inattendu : ${contract.name}`);
  }
};

const checked = await verifyCourseLessonForPublication(lesson, {
  generate,
  courseTitle: "Cours test",
  chapterTitle: "Chapitre test",
  lessonPlan,
  boundaries,
  level: "Première",
  subject: "Mathématiques",
  reviewMaxTokens: 128000,
  repairMaxTokens: 128000,
});

const answer = checked.value.exercises[0].answer.parts
  .map((part) => (part.type === "text" ? part.value : part.latex))
  .join("");
const explanation = checked.value.exercises[0].explanation.parts
  .map((part) => (part.type === "text" ? part.value : part.latex))
  .join("");

const failures = [];
if (checked.report.unresolved.length !== 0) {
  failures.push("la leçon conserve une erreur bloquante");
}
if (checked.report.repairRounds < 1) {
  failures.push("aucun cycle de réparation n'a été enregistré");
}
if (checked.report.fallbackExerciseRewrites !== 1) {
  failures.push("l'exercice incohérent n'a pas été reconstruit");
}
if (!answer.includes("-2{,}47") || !explanation.includes("-2{,}47")) {
  failures.push("answer et explanation ne sont pas harmonisés");
}
if (repairCalls !== 1 || rewriteCalls !== 1 || judgeCalls < 2) {
  failures.push(
    `appels inattendus : repair=${repairCalls}, rewrite=${rewriteCalls}, judge=${judgeCalls}`,
  );
}

if (failures.length > 0) {
  console.error("ÉCHEC V2.9 :");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("OK — check -> repair -> check est itératif");
console.log("OK — une incohérence persistante reconstruit uniquement l'exercice");
console.log("OK — answer et explanation sont harmonisés avant publication");
console.log("OK — le mode fail-closed reste actif si une erreur subsiste");

// Deuxième scénario : un champ de cours non mathématique nécessite deux
// corrections successives. Cela vérifie que la barrière ne s'arrête plus
// après une seule tentative.
process.env.AI_COURSE_PUBLICATION_EXERCISE_REWRITE_LIMIT = "0";
let textRepairCalls = 0;
const textLesson = {
  title: "Notation structurée",
  duration: 30,
  blocks: [
    {
      type: "paragraph",
      content: rich("La fonction est définie sur mathbb{R} et f(x)=x^2."),
    },
  ],
  exercises: [],
};
const textGenerate = async (_userPrompt, _systemPrompt, contract) => {
  if (contract.name === "educalcul_course_publication_judge") {
    return { verdict: "pass", summary: "Audit simulé", issues: [] };
  }
  if (contract.name === "educalcul_course_publication_repairs") {
    textRepairCalls += 1;
    return {
      patches: [
        {
          id: "lesson-b0-content",
          replacement:
            textRepairCalls === 1
              ? "La fonction est définie sur mathbb{R} et vérifie f(x)=x^2."
              : "La fonction est définie sur $\\mathbb{R}$ et vérifie $f(x)=x^2$.",
          reason: "Structurer les mathématiques",
        },
      ],
    };
  }
  throw new Error(`Contrat inattendu : ${contract.name}`);
};
const textChecked = await verifyCourseLessonForPublication(textLesson, {
  generate: textGenerate,
  courseTitle: "Cours test",
  chapterTitle: "Chapitre test",
  lessonPlan,
  boundaries,
  level: "Première",
  subject: "Mathématiques",
  reviewMaxTokens: 128000,
  repairMaxTokens: 128000,
});
if (
  textChecked.report.unresolved.length !== 0 ||
  textChecked.report.repairRounds !== 2 ||
  textRepairCalls !== 2
) {
  console.error(
    `ÉCHEC V2.9 multi-cycle : rounds=${textChecked.report.repairRounds}, calls=${textRepairCalls}, unresolved=${textChecked.report.unresolved.length}`,
  );
  process.exit(1);
}
console.log("OK — une erreur non-exercice peut être réparée sur plusieurs cycles");


// Troisième scénario : le contrôle global dispose lui aussi de plusieurs
// cycles et corrige uniquement les champs concernés.
let globalRepairCalls = 0;
const globalLesson = {
  ...lesson,
  exercises: [
    {
      question: rich("Calculer la valeur demandée."),
      answer: rich("Le résultat vaut environ 3,73."),
      hint: rich("Effectuer le calcul."),
      explanation: rich("Le calcul donne environ 3,39."),
    },
  ],
};
const blueprint = {
  title: "Cours test",
  description: "Test",
  chapters: [
    {
      title: "Chapitre test",
      scope: "Vérification globale",
      lessons: [lessonPlan],
    },
  ],
};
const globalGenerate = async (_userPrompt, _systemPrompt, contract) => {
  if (contract.name === "educalcul_course_publication_judge") {
    return { verdict: "pass", summary: "Audit simulé", issues: [] };
  }
  if (contract.name === "educalcul_course_publication_repairs") {
    globalRepairCalls += 1;
    return {
      patches: [
        {
          id: "c1-l1-e0-explanation",
          replacement:
            "Le calcul complet donne environ $3{,}73$. Conclusion : le résultat vaut environ $3{,}73$.",
          reason: "Harmoniser la valeur finale",
        },
      ],
    };
  }
  throw new Error(`Contrat global inattendu : ${contract.name}`);
};
const globalChecked = await verifyCourseGloballyForPublication(
  [{ title: "Chapitre test", lessons: [globalLesson] }],
  {
    generate: globalGenerate,
    blueprint,
    level: "Première",
    subject: "Mathématiques",
    reviewMaxTokens: 128000,
    repairMaxTokens: 128000,
  },
);
if (
  globalChecked.report.unresolved.length !== 0 ||
  globalChecked.report.repairRounds !== 1 ||
  globalRepairCalls !== 1
) {
  console.error(
    `ÉCHEC V2.9 global : rounds=${globalChecked.report.repairRounds}, calls=${globalRepairCalls}, unresolved=${globalChecked.report.unresolved.length}`,
  );
  process.exit(1);
}
console.log("OK — le contrôle global est lui aussi itératif et ciblé");

// Quatrième scénario : une erreur réellement persistante est tentée au maximum
// trois fois, puis reste bloquante (fail-closed).
process.env.AI_COURSE_PUBLICATION_MAX_REPAIR_CYCLES = "3";
process.env.AI_COURSE_PUBLICATION_EXERCISE_REWRITE_LIMIT = "0";
let persistentRepairCalls = 0;
const persistentGenerate = async (_userPrompt, _systemPrompt, contract) => {
  if (contract.name === "educalcul_course_publication_judge") {
    return { verdict: "pass", summary: "Audit simulé", issues: [] };
  }
  if (contract.name === "educalcul_course_publication_repairs") {
    persistentRepairCalls += 1;
    return {
      patches: [
        {
          id: "lesson-b0-content",
          replacement: `La fonction est définie sur mathbb{R} et vérifie f(x)=x^2. Tentative ${persistentRepairCalls}.`,
          reason: "Tentative volontairement insuffisante",
        },
      ],
    };
  }
  throw new Error(`Contrat persistant inattendu : ${contract.name}`);
};
const persistentChecked = await verifyCourseLessonForPublication(textLesson, {
  generate: persistentGenerate,
  courseTitle: "Cours test",
  chapterTitle: "Chapitre test",
  lessonPlan,
  boundaries,
  level: "Première",
  subject: "Mathématiques",
  reviewMaxTokens: 128000,
  repairMaxTokens: 128000,
});
if (
  persistentChecked.report.repairRounds !== 3 ||
  persistentRepairCalls !== 3 ||
  persistentChecked.report.unresolved.length === 0
) {
  console.error(
    `ÉCHEC V2.9 plafond : rounds=${persistentChecked.report.repairRounds}, calls=${persistentRepairCalls}, unresolved=${persistentChecked.report.unresolved.length}`,
  );
  process.exit(1);
}
console.log("OK — trois cycles maximum puis refus fail-closed si l'erreur persiste");
