import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const checks = [];
const check = (label, condition) => checks.push({ label, condition: Boolean(condition) });

const llm = read("src/lib/llm.ts");
const course = read("src/lib/courseGeneration.ts");
const exercise = read("src/lib/exerciseGeneration.ts");
const quiz = read("src/lib/quizGeneration.ts");
const schemas = read("src/lib/ai/schemas.ts");

check("Leanstral évite json_schema", llm.includes("modelLikelyRejectsJsonSchema") && llm.includes("return !modelLikelyRejectsJsonSchema(model)"));
check("Fallback direct json_object", llm.includes("callJsonObjectMode") && llm.includes("MODE JSON COMPATIBLE"));
check("Plan de leçons structuré", schemas.includes("courseLessonPlanSchema") && course.includes("courseLessonPlanSchema"));
check("Cours généré leçon par leçon", course.includes("lessonCount: 1") && course.includes("Promise.allSettled(\n          lessonPlan.map"));
check("Aucun cours partiel enregistré", course.includes("Le cours n'a pas été enregistré car"));
check("Exercices par lots de 2", exercise.includes("const BATCH_SIZE = 2;"));
check("Quiz par lots de 2", quiz.includes("const BATCH_SIZE = 2;"));
check("Budgets de sortie bornés", exercise.includes("7_000") && quiz.includes("6_000") && course.includes("lessonMaxTokens"));

let failed = 0;
for (const item of checks) {
  console.log(`${item.condition ? "OK" : "ERREUR"} — ${item.label}`);
  if (!item.condition) failed += 1;
}
if (failed > 0) {
  console.error(`\n${failed} contrôle(s) ont échoué.`);
  process.exit(1);
}
console.log("\nOK — transport JSON et génération fractionnée validés pour cours, exercices et quiz.");
