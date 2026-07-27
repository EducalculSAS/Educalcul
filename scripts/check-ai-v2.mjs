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
    value.forEach((entry, index) => collectStrings(entry, `${path}[${index}]`, out));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) =>
      collectStrings(entry, `${path}.${key}`, out),
    );
  }
  return out;
}

function extractMath(value) {
  const formulas = [];
  let rest = value.replace(/\$\$([\s\S]*?)\$\$/g, (_match, latex) => {
    formulas.push(latex);
    return " ";
  });
  rest = rest.replace(/\$([^$\r\n]+?)\$/g, (_match, latex) => {
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
  issues.forEach((issue) => console.error(`  - ${issue}`));
  return issues;
}

const body = Array.from(
  { length: 75 },
  (_, index) =>
    `Cette explication guidée numéro ${index + 1} présente une propriété, justifie chaque étape et relie le calcul à la définition étudiée.`,
).join(" ");

const courseRaw = {
  title: "Fonction exponentielle",
  lessons: [
    {
      title: "Définition, exemple et variations",
      duration: 30,
      blocks: [
        { type: "heading", level: 3, content: rich(text("Définition")) },
        { type: "paragraph", content: rich(text(body)) },
        { type: "heading", level: 3, content: rich(text("Exemple guidé")) },
        {
          type: "paragraph",
          content: rich(text("On calcule "), math("\\exp(0)"), text(" à partir de la condition initiale.")),
        },
        {
          type: "display_math",
          latex: "\\begin{aligned}\\exp(0)&=1\\\\\\exp(a+b)&=\\exp(a)\\exp(b)\\end{aligned}",
        },
        {
          type: "variation_table",
          function: rich(math("\\exp")),
          intervals: [
            {
              domain: rich(math("]-\\infty,+\\infty[")),
              direction: "increasing",
              start_value: rich(math("0")),
              end_value: rich(math("+\\infty")),
            },
          ],
        },
        {
          type: "graph",
          expression: "exp(x)",
          xmin: -5,
          xmax: 5,
          caption: "Courbe croissante de la fonction exponentielle.",
          vectors: [],
          parameter: null,
        },
        { type: "exercise", exercise_index: 1 },
        {
          type: "paragraph",
          content: rich(text("La croissance permet ensuite de comparer deux images et de résoudre une inéquation.")),
        },
        { type: "exercise", exercise_index: 2 },
        {
          type: "geometry_diagram",
          caption: "Repère géométrique de contrôle du compilateur.",
          points: [
            { name: "A", x: 30, y: 130, label_dx: -10, label_dy: 14 },
            { name: "B", x: 30, y: 30, label_dx: -10, label_dy: -8 },
            { name: "C", x: 160, y: 130, label_dx: 10, label_dy: 14 },
          ],
          segments: [
            { from: "A", to: "B", dashed: false, arrow: false },
            { from: "A", to: "C", dashed: false, arrow: false },
            { from: "B", to: "C", dashed: false, arrow: false },
          ],
          circles: [],
          polygons: [],
        },
        { type: "heading", level: 3, content: rich(text("Points-clés à retenir")) },
        {
          type: "list",
          ordered: false,
          items: [rich(math("\\exp(0)=1")), rich(text("La fonction est strictement croissante."))],
        },
        {
          type: "paragraph",
          content: rich(text("Formule volontairement invalide : "), math("\\begin{cases}x")),
        },
      ],
      exercises: [
        {
          question: rich(
            text("Quelle est la valeur de "),
            math("\\exp(0)"),
            text(" ? "),
            math("\\exp(0)=1"),
            text(" On obtient donc la réponse."),
          ),
          answer: rich(math("1")),
          hint: rich(text("Utiliser la condition initiale.")),
          explanation: rich(text("Par définition, "), math("\\exp(0)=1"), text(".")),
        },
        {
          question: rich(text("Résoudre "), math("\\exp(x)=\\exp(2)"), text(".")),
          answer: rich(math("x=2")),
          hint: rich(text("Utiliser l'injectivité.")),
          explanation: rich(text("L'injectivité donne "), math("x=2"), text(".")),
        },
      ],
    },
  ],
};

let courseStructured = normalizeStructuredCourseChapter(courseRaw, {
  expectedLessonCount: 1,
  durationPerLesson: 30,
  includeExercises: true,
  maxExercisesPerLesson: 3,
});
courseStructured = normalizeStructuredCoursePedagogy(courseStructured);
const pedagogyIssues = auditStructuredCoursePedagogy(courseStructured, {
  expectedLessonCount: 1,
  includeExercises: true,
  minExercises: 2,
  maxExercises: 3,
  durationPerLesson: 30,
  subject: "fonction exponentielle",
  chapterTitle: "définition et variations",
});
assert(pedagogyIssues.length === 0, `Audit pédagogique : ${JSON.stringify(pedagogyIssues)}`);
assert(
  !structuredRichTextToPlainText(courseStructured.lessons[0].exercises[0].question).includes("On obtient"),
  "La correction a fui dans la question de cours.",
);
const courseStable = await repairInvalidStructuredMath(courseStructured, {
  label: "test cours",
  enableModelRepair: false,
});
assert(courseStable.report.remainingInvalid.length === 0, "Une formule invalide subsiste dans le cours.");
assert(courseStable.report.fallbackCount === 1, "Le repli de formule invalide n'a pas été déclenché.");
const course = compileStructuredCourseChapter(courseStable.value, {
  chapterIndex: 0,
  durationPerLesson: 30,
});
assert(course.lessons[0].content.includes("math-table-variation"), "Le tableau de variations n'est pas compilé.");
assert(course.lessons[0].content.includes("math-graph-placeholder"), "Le graphique n'est pas compilé.");
assert(course.lessons[0].content.includes("course-figure"), "La figure géométrique n'est pas compilée.");

function exerciseRaw(blockType) {
  const prompt =
    blockType === "qcm"
      ? rich(text("Quelle valeur vaut l'exponentielle en zéro ? A. 0 B. 1 C. e D. -1"))
      : rich(text("Quelle est la valeur de "), math("\\exp(0)"), text(" ? "), math("1"), text(" La réponse est 1."));
  const base = {
    prompt,
    explanation: rich(text("On utilise "), math("\\exp(0)=1"), text(".")),
    points: 2,
  };
  if (blockType === "qcm") {
    return {
      ...base,
      options: [rich(text("A. "), math("0")), rich(text("B. "), math("1")), rich(text("C. "), math("e")), rich(text("D. "), math("-1"))],
      correct_option_indexes: [1],
    };
  }
  if (blockType === "true_false") return { ...base, correct_option_indexes: [0] };
  if (blockType === "fill_in_the_blank") {
    return {
      ...base,
      content: rich(text("Compléter : "), math("\\exp(0)"), text(" = {{1}}.")),
      accepted_answers: [[rich(math("1"))]],
    };
  }
  if (blockType === "matching") {
    return {
      ...base,
      pairs: [
        { left: rich(math("\\exp(0)")), right: rich(math("1")) },
        { left: rich(math("\\exp(1)")), right: rich(math("e")) },
        { left: rich(math("\\exp(-1)")), right: rich(math("e^{-1}")) },
      ],
    };
  }
  if (blockType === "ordering") {
    return {
      ...base,
      items: [rich(text("Identifier la propriété")), rich(text("Remplacer les valeurs")), rich(text("Conclure"))],
    };
  }
  return { ...base, answer: rich(math("1")) };
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
  const raw = {
    title: `Exercice ${blockType}`,
    description: "Test",
    introduction: [],
    questions: [exerciseRaw(blockType)],
  };
  const normalized = normalizeStructuredExerciseDraft(raw, 1, blockType);
  assert(normalized.questions.length === 1, `Question ${blockType} absente après normalisation.`);
  const prompt = structuredRichTextToPlainText(normalized.questions[0].prompt);
  assert(!/La réponse est|\bA\.\s*0\b/.test(prompt), `Fuite dans le prompt ${blockType}: ${prompt}`);
  const stable = await repairInvalidStructuredMath(normalized, {
    label: blockType,
    enableModelRepair: false,
  });
  const compiled = compileStructuredExerciseDraft(stable.value, {
    blockType,
    exerciseType: "simple",
  });
  allIssues.push(...auditCompiled(`Exercice ${blockType}`, compiled));
}

const quizRaw = {
  title: "Quiz",
  description: "Test",
  time_limit: 10,
  max_attempts: 3,
  questions: [
    {
      text: rich(text("Quelle est la valeur de "), math("\\exp(0)"), text(" ? A. 0 B. 1 C. e D. -1")),
      options: [rich(text("A. 0")), rich(text("B. 1")), rich(text("C. e")), rich(text("D. -1"))],
      correct_option_index: 1,
      explanation: rich(text("Par définition, "), math("\\exp(0)=1"), text(".")),
      points: 1,
    },
  ],
};
const quizNormalized = normalizeStructuredQuizDraft(quizRaw, 1);
assert(quizNormalized.questions.length === 1, "Question de quiz absente.");
assert(
  structuredRichTextToPlainText(quizNormalized.questions[0].text).endsWith("?"),
  `Les options sont restées dans l'énoncé : ${structuredRichTextToPlainText(quizNormalized.questions[0].text)}`,
);
assert(
  quizNormalized.questions[0].options.every(
    (option) => !/^[A-D][.)\-:]/.test(structuredRichTextToPlainText(option)),
  ),
  "Un préfixe A/B/C/D est resté dans les options.",
);
const quizStable = await repairInvalidStructuredMath(quizNormalized, {
  label: "quiz",
  enableModelRepair: false,
});
const quiz = compileStructuredQuizDraft(quizStable.value);
allIssues.push(...auditCompiled("Quiz", quiz));

if (allIssues.length) process.exitCode = 1;
else {
  console.log(
    "OK — LaTeX, pédagogie, visuels, tableaux spécialisés, exercices et quiz validés.",
  );
}
