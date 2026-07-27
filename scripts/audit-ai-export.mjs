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
  console.log("OK — aucune formule KaTeX invalide, aucun LaTeX brut et aucun id dupliqué.");
}
