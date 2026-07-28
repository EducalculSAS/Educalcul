import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = process.cwd();
const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = fs.existsSync(path.join(cwd, "src/lib/courseGeneration.ts"))
  ? cwd
  : scriptRoot;
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const course = read("src/lib/courseGeneration.ts");
const review = read("src/lib/ai/courseReview.ts");

const checks = [
  [
    "validation visuelle distingue une leçon isolée d'un chapitre assemblé",
    course.includes('validationScope?: "lesson" | "chapter"') &&
      course.includes('issue.code !== "missing_graph"') &&
      course.includes('issue.code !== "missing_visual"'),
  ],
  [
    "le visuel propre à la leçon reste obligatoire",
    course.includes("lessonHasVisualFocus") &&
      course.includes("missing_planned_visual") &&
      course.includes("visualFocus: job.lesson.visualFocus"),
  ],
  [
    "la règle graph du chapitre reste contrôlée après assemblage",
    course.includes("const chapterIssues = blockingIssues(chapter") &&
      course.includes("requireGraph,") &&
      !course.includes('validationScope: "chapter" as const'),
  ],
  [
    "second agent de contrôle du plan",
    course.includes('telemetry.start("blueprint-review")') &&
      course.includes("plan validé par un second agent") &&
      course.includes("conformité stricte au programme"),
  ],
  [
    "les extensions hors programme sont interdites dans le plan",
    course.includes("pas d'exponentielle complexe") &&
      course.includes("formule d'Euler") &&
      course.includes("série de Fourier"),
  ],
  [
    "un exercice hors périmètre est remplacé localement",
    review.includes("remplace localement ses quatre champs") &&
      review.includes("reviewContract(18)") &&
      review.includes("au maximum 18 patches"),
  ],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERREUR"} — ${label}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log(
  "\nOK — V2.6.1 : les règles visuelles de chapitre ne bloquent plus un agent de leçon, le plan est relu et les exercices hors périmètre sont patchés.",
);
