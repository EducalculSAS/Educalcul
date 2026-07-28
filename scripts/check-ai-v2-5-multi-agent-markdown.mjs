import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const course = read("src/lib/courseGeneration.ts");
const guard = read("src/lib/ai/qualityGuard.ts");
const schemas = read("src/lib/ai/schemas.ts");

const checks = [
  [
    "cours en Markdown mathématique",
    course.includes("COURSE_MARKDOWN_JSON_PROMPT") &&
      course.includes('mathTextMode: "markdown"'),
  ],
  [
    "pas de seconde passe IA LaTeX",
    course.includes("enableModelRepair: false") &&
      !course.includes("await enrichLessonToMinimum("),
  ],
  [
    "chapitres multi-agents",
    course.includes("AI_COURSE_CHAPTER_CONCURRENCY") &&
      course.includes("chapterConcurrency"),
  ],
  [
    "leçons multi-agents",
    course.includes("AI_COURSE_LESSON_CONCURRENCY") &&
      course.includes("lessonConcurrency"),
  ],
  [
    "agents de vérification parallèles",
    course.includes("AI_COURSE_REVIEW_CONCURRENCY") &&
      guard.includes("mapWithConcurrency(") &&
      guard.includes("options.concurrency ?? 3"),
  ],
  [
    "budget de caractères sans remplissage",
    course.includes("maxCourseCharacters") &&
      course.includes("N'allonge jamais avec des généralités ou des répétitions"),
  ],
  [
    "schémas compatibles chaînes Markdown",
    schemas.includes('{ type: "string", minLength: 1 }') &&
      schemas.includes("structuredRichTextObject"),
  ],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "OK" : "ERREUR"} — ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log("\nOK — V2.5 : génération multi-agent parallèle, Markdown mathématique local et budget de contenu utile.");
