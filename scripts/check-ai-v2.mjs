import {
  normalizeStructuredCourseChapter,
  normalizeStructuredExerciseDraft,
  normalizeStructuredQuizDraft,
  repairInvalidStructuredMath,
  isStructuredLatexValid,
} from "@/lib/ai/structuredContent";
import {
  compileStructuredCourseChapter,
  compileStructuredExerciseDraft,
  compileStructuredQuizDraft,
} from "@/lib/ai/compiler";

const rich = (...parts) => ({ parts });
const text = (value) => ({ type: "text", value });
const math = (latex) => ({ type: "math", latex });

function collectStrings(value, path = "root", out = []) {
  if (typeof value === "string") out.push({ path, value });
  else if (Array.isArray(value)) value.forEach((entry, index) => collectStrings(entry, `${path}[${index}]`, out));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => collectStrings(entry, `${path}.${key}`, out));
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
      if (!isStructuredLatexValid(latex)) issues.push(`${path}: formule invalide ${latex}`);
    });
    if (/\\(?:frac|sqrt|vec|overrightarrow|begin|end|text|mathbb|lim|exp|ln|sin|cos|tan)\b/.test(rest)) {
      issues.push(`${path}: commande LaTeX brute`);
    }
    if (/\$/.test(rest)) issues.push(`${path}: dollar orphelin`);
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(string)) issues.push(`${path}: caractère de contrôle`);
  }
  console.log(`${label}: ${issues.length} anomalie(s)`);
  if (issues.length) issues.forEach((issue) => console.error(`  - ${issue}`));
  return issues;
}

const courseRaw = {
  title: "Exponentielle",
  lessons: [
    {
      title: "Définition",
      duration: 30,
      blocks: [
        { type: "heading", level: 3, content: rich(text("Définition")) },
        { type: "paragraph", content: rich(text("La fonction "), math("\\exp(x)"), text(" est positive.")) },
        { type: "display_math", latex: "\\begin{aligned}\\exp(a+b)&=\\exp(a)\\exp(b)\\\\\\exp(0)&=1\\end{aligned}" },
        { type: "paragraph", content: rich(text("Une formule volontairement invalide : "), math("\\begin{cases}x")) },
        { type: "list", ordered: false, items: [rich(text("Croissante")), rich(text("Positive"))] },
        { type: "callout", variant: "note", title: rich(text("À retenir")), paragraphs: [rich(math("\\exp(0)=1"))] },
        { type: "exercise", exercise_index: 1 },
      ],
      exercises: [
        {
          question: rich(text("Calculer "), math("\\exp(0)")),
          answer: rich(math("1")),
          hint: rich(text("Utiliser la valeur remarquable.")),
          explanation: rich(math("\\exp(0)=1")),
        },
      ],
    },
  ],
};
const courseNormalized = normalizeStructuredCourseChapter(courseRaw, {
  expectedLessonCount: 1,
  durationPerLesson: 30,
  includeExercises: true,
  maxExercisesPerLesson: 3,
});
const courseStable = await repairInvalidStructuredMath(courseNormalized, {
  label: "test cours",
  enableModelRepair: false,
});
if (courseStable.report.remainingInvalid.length) throw new Error("Une formule invalide subsiste dans le cours structuré");
const course = compileStructuredCourseChapter(courseStable.value, { chapterIndex: 0, durationPerLesson: 30 });

function exerciseRaw(blockType) {
  const base = {
    prompt: rich(text("Question sur "), math("x^2")),
    content: rich(text(blockType === "fill_in_the_blank" ? "Compléter {{1}} puis {{2}}." : "Énoncé.")),
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
  return { title: `Exercice ${blockType}`, description: "Test", introduction: [], questions: [base] };
}

const allIssues = [];
allIssues.push(...auditCompiled("Cours", course));
for (const blockType of ["standard", "qcm", "true_false", "fill_in_the_blank", "matching", "ordering", "coding"]) {
  const normalized = normalizeStructuredExerciseDraft(exerciseRaw(blockType), 1);
  const stable = await repairInvalidStructuredMath(normalized, { label: blockType, enableModelRepair: false });
  if (stable.report.remainingInvalid.length) throw new Error(`Formule invalide restante dans ${blockType}`);
  const compiled = compileStructuredExerciseDraft(stable.value, { blockType, exerciseType: "simple" });
  allIssues.push(...auditCompiled(`Exercice ${blockType}`, compiled));
}

const quizRaw = {
  title: "Quiz",
  description: "Test",
  time_limit: 10,
  max_attempts: 3,
  questions: [
    {
      text: rich(text("Quelle valeur vaut "), math("\\exp(0)"), text(" ?")),
      options: [rich(math("0")), rich(math("1")), rich(math("e")), rich(math("-1"))],
      correct_option_index: 1,
      explanation: rich(math("\\exp(0)=1")),
      points: 1,
    },
  ],
};
const quizNormalized = normalizeStructuredQuizDraft(quizRaw, 1);
const quizStable = await repairInvalidStructuredMath(quizNormalized, { label: "quiz", enableModelRepair: false });
const quiz = compileStructuredQuizDraft(quizStable.value);
allIssues.push(...auditCompiled("Quiz", quiz));

if (courseStable.report.fallbackCount !== 1) {
  throw new Error(`Le repli formule invalide attendu vaut 1, reçu ${courseStable.report.fallbackCount}`);
}
if (allIssues.length) process.exitCode = 1;
else console.log("OK — pipeline structuré, compilateur et repli KaTeX validés.");
