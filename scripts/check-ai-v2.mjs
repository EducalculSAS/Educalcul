import {
  normalizeStructuredCourseChapter,
  normalizeStructuredExerciseDraft,
  normalizeStructuredQuizDraft,
  repairInvalidStructuredMath,
  isStructuredLatexValid,
  structuredRichTextToPlainText,
} from "@/lib/ai/structuredContent";
import {
  compileStructuredCourseChapter,
  compileStructuredExerciseDraft,
  compileStructuredQuizDraft,
} from "@/lib/ai/compiler";
import {
  auditStructuredCoursePedagogy,
  normalizeStructuredCoursePedagogy,
  sanitizeStructuredExerciseDraft,
  sanitizeStructuredQuizDraft,
  quizQuestionContainsEmbeddedOptions,
} from "@/lib/ai/pedagogy";

const rich = (...parts) => ({ parts });
const text = (value) => ({ type: "text", value });
const math = (latex) => ({ type: "math", latex });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function collectStrings(value, path = "root", out = []) {
  if (typeof value === "string") out.push({ path, value });
  else if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      collectStrings(entry, `${path}[${index}]`, out),
    );
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) =>
      collectStrings(entry, `${path}.${key}`, out),
    );
  }
  return out;
}

function extractMath(value) {
  const formulas = [];
  let rest = value.replace(/\$\$([\s\S]*?)\$\$/g, (_m, latex) => {
    formulas.push(latex);
    return " ";
  });
  rest = rest.replace(/\$([^$\r\n]+?)\$/g, (_m, latex) => {
    formulas.push(latex);
    return " ";
  });
  return { formulas, rest };
}

function auditCompiled(label, value) {
  const issues = [];
  const ids = new Set();
  for (const { path, value: string } of collectStrings(value)) {
    if (path.endsWith(".id")) {
      if (ids.has(string)) issues.push(`${path}: id dupliqué ${string}`);
      ids.add(string);
    }
    const { formulas, rest } = extractMath(string);
    formulas.forEach((latex) => {
      if (!isStructuredLatexValid(latex)) {
        issues.push(`${path}: formule invalide ${latex}`);
      }
    });
    if (
      /\\(?:frac|sqrt|vec|overrightarrow|begin|end|text|mathbb|lim|exp|ln|sin|cos|tan)\b/.test(
        rest,
      )
    ) {
      issues.push(`${path}: commande LaTeX brute`);
    }
    if (/\$/.test(rest)) issues.push(`${path}: dollar orphelin`);
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(string)) {
      issues.push(`${path}: caractère de contrôle`);
    }
  }
  console.log(`${label}: ${issues.length} anomalie(s)`);
  if (issues.length) {
    issues.forEach((issue) => console.error(`  - ${issue}`));
  }
  return issues;
}

const courseRaw = {
  title: "Fonction exponentielle",
  lessons: [
    {
      title: "Définition, croissance et variations",
      duration: 30,
      blocks: [
        // Volontairement trop tôt : le normalisateur doit le déplacer.
        { type: "exercise", exercise_index: 1 },
        {
          type: "heading",
          level: 3,
          content: rich(text("Définition")),
        },
        {
          type: "paragraph",
          content: rich(
            text("La fonction "),
            math("\\exp(x)"),
            text(" est strictement positive."),
          ),
        },
        {
          type: "paragraph",
          content: rich(
            text("Elle est l'unique solution de "),
            math("y'=y"),
            text(" vérifiant "),
            math("y(0)=1"),
            text("."),
          ),
        },
        {
          type: "display_math",
          latex:
            "\\begin{aligned}\\exp(a+b)&=\\exp(a)\\exp(b)\\\\\\exp(0)&=1\\end{aligned}",
        },
        {
          type: "paragraph",
          content: rich(
            text("Une formule volontairement invalide : "),
            math("\\begin{cases}x"),
          ),
        },
        {
          type: "sign_table",
          expression: rich(math("x^2")),
          boundaries: [rich(math("0"))],
          interval_signs: ["positive", "positive"],
          boundary_signs: ["zero"],
        },
        {
          type: "variation_table",
          variable: rich(math("x")),
          function_name: rich(math("\\exp(x)")),
          points: [rich(math("-\\infty")), rich(math("+\\infty"))],
          values: [rich(math("0")), rich(math("+\\infty"))],
          directions: ["up"],
          derivative_signs: ["positive"],
        },
        {
          type: "graph",
          expression: "exp(x)",
          xmin: -5,
          xmax: 5,
          caption: "Courbe de la fonction exponentielle.",
          parameter: null,
          vectors: [
            {
              x: 1,
              y: 1,
              from_x: 0,
              from_y: 0,
              label: "u",
              tone: "red",
            },
          ],
        },
        {
          type: "figure",
          caption: "Triangle utilisé dans un exemple géométrique.",
          elements: [
            {
              type: "line",
              x1: 25,
              y1: 125,
              x2: 170,
              y2: 125,
              tone: "navy",
              dashed: false,
              arrow_end: false,
              label: rich(text("AB")),
              label_x: 95,
              label_y: 145,
            },
            {
              type: "point",
              x: 25,
              y: 125,
              tone: "gold",
              label: rich(text("A")),
              label_x: 15,
              label_y: 140,
            },
            {
              type: "point",
              x: 170,
              y: 125,
              tone: "gold",
              label: rich(text("B")),
              label_x: 176,
              label_y: 140,
            },
          ],
        },
        { type: "exercise", exercise_index: 2 },
        { type: "exercise", exercise_index: 3 },
      ],
      exercises: [
        {
          question: rich(text("Calculer "), math("\\exp(0)"), text(".")),
          answer: rich(math("1")),
          hint: rich(text("Utiliser la valeur remarquable.")),
          explanation: rich(math("\\exp(0)=1")),
        },
        {
          question: rich(
            text("Donner le signe de "),
            math("\\exp(x)"),
            text("."),
          ),
          answer: rich(text("Strictement positif")),
          hint: rich(text("Observer le tableau de signes.")),
          explanation: rich(math("\\exp(x)>0")),
        },
        {
          question: rich(text("Décrire les variations de l'exponentielle.")),
          answer: rich(text("Elle est strictement croissante.")),
          hint: rich(text("Étudier le signe de sa dérivée.")),
          explanation: rich(math("\\exp'(x)=\\exp(x)>0")),
        },
      ],
    },
  ],
};

let courseNormalized = normalizeStructuredCourseChapter(courseRaw, {
  expectedLessonCount: 1,
  durationPerLesson: 30,
  includeExercises: true,
  maxExercisesPerLesson: 4,
});
courseNormalized = normalizeStructuredCoursePedagogy(courseNormalized);

const firstExercisePosition = courseNormalized.lessons[0].blocks.findIndex(
  (block) => block.type === "exercise",
);
const substantiveBefore = courseNormalized.lessons[0].blocks
  .slice(0, firstExercisePosition)
  .filter((block) => block.type !== "heading" && block.type !== "exercise")
  .length;
assert(
  firstExercisePosition >= 0 && substantiveBefore >= 2,
  "Un exercice est encore placé avant l'explication et l'exemple.",
);

const pedagogyIssues = auditStructuredCoursePedagogy(courseNormalized, {
  expectedLessonCount: 1,
  includeExercises: true,
  minWordsPerLesson: 1,
  requireGraph: true,
}).filter((issue) => issue.severity === "error");
assert(
  pedagogyIssues.length === 0,
  `Audit pédagogique en échec : ${pedagogyIssues
    .map((issue) => issue.code)
    .join(", ")}`,
);

const courseStable = await repairInvalidStructuredMath(courseNormalized, {
  label: "test cours",
  enableModelRepair: false,
});
assert(
  courseStable.report.remainingInvalid.length === 0,
  "Une formule invalide subsiste dans le cours structuré.",
);
const course = compileStructuredCourseChapter(courseStable.value, {
  chapterIndex: 0,
  durationPerLesson: 30,
});
const courseHtml = course.lessons[0].content;
assert(
  courseHtml.includes("math-table-sign") &&
    courseHtml.includes("math-table-variation"),
  "Les tableaux structurés de signe/variation ne sont pas compilés.",
);
assert(
  courseHtml.includes("data-vectors=") && courseHtml.includes("course-figure"),
  "Le graphique vectorisé ou la figure structurée n'est pas compilé.",
);
assert(
  courseHtml.includes("La fonction $\\exp(x)$ est strictement positive."),
  "Les espaces entre texte et mathématiques ont été perdus.",
);

function exerciseRaw(blockType) {
  const answerBearingSupport = rich(
    text("Support erroné contenant déjà la réponse "),
    math("x=2"),
    text("."),
  );
  const base = {
    prompt: rich(text("Résoudre "), math("x^2=4"), text(".")),
    content:
      blockType === "fill_in_the_blank"
        ? rich(text("Compléter {{1}} puis {{2}}."))
        : answerBearingSupport,
    answer: rich(math("x=2")),
    explanation: rich(text("On obtient "), math("x=2"), text(".")),
    points: 2,
    options: [],
    correct_option_indexes: [],
    accepted_answers: [],
    pairs: [],
    items: [],
  };
  if (blockType === "qcm") {
    base.options = [rich(math("1")), rich(math("2")), rich(math("3")), rich(math("4"))];
    base.correct_option_indexes = [1];
  } else if (blockType === "true_false") {
    base.correct_option_indexes = [0];
  } else if (blockType === "fill_in_the_blank") {
    base.accepted_answers = [[rich(math("2"))], [rich(math("4"))]];
  } else if (blockType === "matching") {
    base.pairs = [
      { left: rich(math("1")), right: rich(text("un")) },
      { left: rich(math("2")), right: rich(text("deux")) },
      { left: rich(math("3")), right: rich(text("trois")) },
    ];
  } else if (blockType === "ordering") {
    base.items = [rich(text("Étape 1")), rich(text("Étape 2")), rich(text("Étape 3"))];
  }
  return {
    title: `Exercice ${blockType}`,
    description: "Test",
    introduction: [rich(text("Introduction qui doit disparaître en mode simple."))],
    questions: [base],
  };
}

const allIssues = [];
allIssues.push(...auditCompiled("Cours", course));
for (const blockType of [
  "standard",
  "qcm",
  "true_false",
  "fill_in_the_blank",
  "matching",
  "ordering",
  "coding",
]) {
  let normalized = normalizeStructuredExerciseDraft(exerciseRaw(blockType), 1);
  normalized = sanitizeStructuredExerciseDraft(normalized, {
    blockType,
    exerciseType: "simple",
  });
  const stable = await repairInvalidStructuredMath(normalized, {
    label: blockType,
    enableModelRepair: false,
  });
  assert(
    stable.report.remainingInvalid.length === 0,
    `Formule invalide restante dans ${blockType}.`,
  );
  const compiled = compileStructuredExerciseDraft(stable.value, {
    blockType,
    exerciseType: "simple",
  });
  const firstBlock = compiled.contentJson[0].blocks[0];
  if (blockType !== "fill_in_the_blank") {
    assert(
      !String(firstBlock.content ?? "").includes("Support erroné"),
      `Le support contenant la réponse a fuité dans l'énoncé ${blockType}.`,
    );
  }
  allIssues.push(...auditCompiled(`Exercice ${blockType}`, compiled));
}

const quizRaw = {
  title: "Quiz",
  description: "Test",
  time_limit: 10,
  max_attempts: 3,
  questions: [
    {
      text: rich(
        text("Quelle est la valeur de "),
        math("\\exp(0)"),
        text(" ? A. 0 B. 1 C. e D. -1"),
      ),
      options: [
        rich(text("A. "), math("0")),
        rich(text("B. "), math("1")),
        rich(text("C. "), math("e")),
        rich(text("D. "), math("-1")),
      ],
      correct_option_index: 1,
      explanation: rich(math("\\exp(0)=1")),
      points: 1,
    },
  ],
};
let quizNormalized = normalizeStructuredQuizDraft(quizRaw, 1);
quizNormalized = sanitizeStructuredQuizDraft(quizNormalized);
assert(
  !quizQuestionContainsEmbeddedOptions(quizNormalized.questions[0]),
  "Les options sont encore dupliquées dans l'énoncé du quiz.",
);
const optionPlain = quizNormalized.questions[0].options.map((option) =>
  structuredRichTextToPlainText(option),
);
assert(
  optionPlain.every((option) => !/^[A-D][.)\-:]/i.test(option)),
  "Les labels A/B/C/D n'ont pas été retirés des options.",
);
const quizStable = await repairInvalidStructuredMath(quizNormalized, {
  label: "quiz",
  enableModelRepair: false,
});
const quiz = compileStructuredQuizDraft(quizStable.value);
assert(
  !quiz.questions[0].text.includes("A.") &&
    !quiz.questions[0].text.includes("B."),
  "Les propositions sont encore présentes dans le champ text du quiz compilé.",
);
allIssues.push(...auditCompiled("Quiz", quiz));

assert(
  courseStable.report.fallbackCount === 1,
  `Le repli formule invalide attendu vaut 1, reçu ${courseStable.report.fallbackCount}.`,
);

if (allIssues.length) {
  process.exitCode = 1;
} else {
  console.log(
    "OK — pédagogie, visuels structurés, exercices, quiz et repli KaTeX validés.",
  );
}
