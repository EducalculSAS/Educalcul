import fs from "node:fs";
import path from "node:path";
import katex from "katex";

const inputArg = process.argv[2];
if (!inputArg) {
  console.error(
    "Usage : node check_ai_export.mjs <export-course-exercise-ou-quiz.json>",
  );
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
const root = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const issues = [];
const formulas = [];
const ids = new Map();

function addIssue(type, location, details = {}) {
  issues.push({ type, location, ...details });
}


function comparable(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\$+/g, " ")
    .replace(/\\[A-Za-z]+/g, " ")
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inspectTables(html, location) {
  const tables = String(html).match(/<table\b[\s\S]*?<\/table>/gi) || [];
  tables.forEach((table, tableIndex) => {
    const rows = table.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
    const widths = rows.map(
      (row) => (row.match(/<(?:th|td)\b/gi) || []).length,
    );
    if (widths.length > 1 && new Set(widths).size > 1) {
      addIssue("inconsistent-table-width", `${location}.table[${tableIndex}]`, {
        widths,
      });
    }
  });
}

function extractMath(value, location) {
  let rest = value;
  const patterns = [
    { kind: "display", re: /\$\$([\s\S]*?)\$\$/g },
    { kind: "bracket", re: /\\\[([\s\S]*?)\\\]/g },
    { kind: "inline", re: /\$([^$\r\n]*?)\$/g },
    { kind: "paren", re: /\\\(([^\r\n]*?)\\\)/g },
  ];

  for (const { kind, re } of patterns) {
    rest = rest.replace(re, (_match, latex) => {
      const source = String(latex || "").trim();
      formulas.push({ location, kind, latex: source });
      if (!source) {
        addIssue("empty-formula", location);
        return " ";
      }
      try {
        katex.renderToString(source, {
          throwOnError: true,
          strict: false,
        });
      } catch (error) {
        addIssue("katex-invalid", location, {
          latex: source,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return " ";
    });
  }

  return rest;
}

function inspectString(value, location) {
  inspectTables(value, location);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
    addIssue("control-character", location);
  }

  const withoutMath = extractMath(value, location);
  const withoutTags = withoutMath
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;|&gt;|&amp;|&nbsp;/g, " ");

  if (/\\(?:frac|dfrac|sqrt|vec|overrightarrow|begin|end|text|exp|ln|lim|to|infty|mathbb|left|right|cdot|times|leq|geq|neq)\b/.test(withoutTags)) {
    addIssue("raw-latex-outside-delimiters", location, {
      excerpt: withoutTags.replace(/\s+/g, " ").trim().slice(0, 240),
    });
  }

  if (/\$/.test(withoutMath)) {
    addIssue("orphan-dollar", location, {
      excerpt: withoutMath.replace(/\s+/g, " ").trim().slice(0, 240),
    });
  }
}

function walk(value, location = "root") {
  if (typeof value === "string") {
    inspectString(value, location);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  if (typeof value.id === "string" && value.id.trim()) {
    const id = value.id.trim();
    const locations = ids.get(id) || [];
    locations.push(location);
    ids.set(id, locations);
  }

  if (Array.isArray(value.options) && value.correctAnswer !== undefined) {
    const answers = Array.isArray(value.correctAnswer)
      ? value.correctAnswer
      : [value.correctAnswer];
    for (const answer of answers) {
      if (typeof answer === "string" && !value.options.includes(answer)) {
        addIssue("correct-answer-not-in-options", location, {
          answer,
        });
      }
    }
  }

  if (Array.isArray(value.options) && typeof value.text === "string") {
    const stem = comparable(value.text);
    if (/(?:^|\s)(?:option\s*)?[a-d]\s*[.)\-:]/i.test(value.text)) {
      addIssue("quiz-option-marker-in-stem", location);
    }
    const duplicated = value.options.filter(
      (option) =>
        typeof option === "string" &&
        comparable(option).length >= 2 &&
        stem.includes(comparable(option)),
    );
    if (duplicated.length > 0) {
      addIssue("quiz-options-duplicated-in-stem", location, {
        count: duplicated.length,
      });
    }
  }

  if (
    typeof value.content === "string" &&
    value.correctAnswer !== undefined &&
    !Array.isArray(value.correctAnswer)
  ) {
    const answer = comparable(value.correctAnswer);
    const rawVisible = String(value.content).replace(/<[^>]*>/g, " ");
    const questionMark = rawVisible.indexOf("?");
    if (
      questionMark >= 0 &&
      answer.length >= 1 &&
      comparable(rawVisible.slice(questionMark + 1)).includes(answer)
    ) {
      addIssue("exercise-answer-leaked-after-question", location, {
        answer: String(value.correctAnswer).slice(0, 120),
      });
    }
  }

  Object.entries(value).forEach(([key, child]) =>
    walk(child, `${location}.${key}`),
  );
}

walk(root);

for (const [id, locations] of ids.entries()) {
  if (locations.length > 1) {
    addIssue("duplicate-id", "root", { id, locations });
  }
}

// Cohérence spécifique aux cours : chaque placeholder doit référencer un
// exercice de sa leçon, et chaque exercice doit avoir exactement un placeholder.
const chapters = Array.isArray(root.content_json) ? root.content_json : [];
chapters.forEach((chapter, chapterIndex) => {
  const lessons = Array.isArray(chapter?.lessons) ? chapter.lessons : [];
  lessons.forEach((lesson, lessonIndex) => {
    const exerciseIds = new Set(
      Array.isArray(lesson?.exercises)
        ? lesson.exercises
            .map((exercise) => exercise?.id)
            .filter((id) => typeof id === "string")
        : [],
    );
    const content = typeof lesson?.content === "string" ? lesson.content : "";
    const placeholderIds = Array.from(
      content.matchAll(/data-exercise-id=["']([^"']+)["']/g),
      (match) => match[1],
    );
    const counts = new Map();
    placeholderIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
    const location = `content_json[${chapterIndex}].lessons[${lessonIndex}]`;

    for (const id of placeholderIds) {
      if (!exerciseIds.has(id)) {
        addIssue("orphan-exercise-placeholder", location, { id });
      }
    }
    for (const id of exerciseIds) {
      const count = counts.get(id) || 0;
      if (count !== 1) {
        addIssue("exercise-placeholder-count", location, { id, count });
      }
    }
  });
});

const report = {
  file: inputPath,
  type: root._type || "unknown",
  formulasChecked: formulas.length,
  issues,
};
const reportPath = inputPath.replace(/\.json$/i, ".ai-audit.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`Type : ${report.type}`);
console.log(`Formules contrôlées : ${report.formulasChecked}`);
console.log(`Anomalies : ${issues.length}`);
console.log(`Rapport : ${reportPath}`);

if (issues.length > 0) {
  console.dir(issues, { depth: null });
  process.exitCode = 2;
} else {
  console.log("OK — LaTeX, ids, tableaux, énoncés d’exercices et questions de quiz validés.");
}
