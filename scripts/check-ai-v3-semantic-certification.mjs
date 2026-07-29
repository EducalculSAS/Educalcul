import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const reviewPath = path.join(root, "src/lib/ai/courseReview.ts");
const generationPath = path.join(root, "src/lib/courseGeneration.ts");

function fail(message) {
  console.error(`ERREUR — ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK — ${message}`);
}

for (const file of [reviewPath, generationPath]) {
  if (!fs.existsSync(file)) {
    fail(`fichier introuvable : ${file}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);

const review = fs.readFileSync(reviewPath, "utf8");
const generation = fs.readFileSync(generationPath, "utf8");

const checks = [
  [review.includes("educalcul_course_theory_certifier"), "certificateur théorique indépendant présent"],
  [review.includes("educalcul_course_exercise_certifier"), "solveur indépendant des exercices présent"],
  [review.includes("educalcul_course_global_consistency_certifier"), "contrôle global de cohérence présent"],
  [review.includes("educalcul_course_curriculum_certifier"), "inspection indépendante du programme présente"],
  [review.includes("deterministicSemanticRedFlags"), "garde déterministe sémantique présente"],
  [review.includes("VISIBLE_SCRATCHPAD_PATTERN"), "détection des brouillons et autocorrections présente"],
  [review.includes("falseExpCubicThreshold"), "contre-exemple déterministe des seuils exponentiels présent"],
  [review.includes("statesGeneralExpConvexity"), "contrôle de la dérivée seconde de e^{u(x)} présent"],
  [review.includes("assertsUniqueComposedSolution"), "contrôle des fausses unicités présent"],
  [review.includes("cherche activement un contre-exemple"), "méthode adversariale par contre-exemple activée"],
  [review.includes("curriculumPromptFragment(options)"), "programme injecté dans les audits et réparations"],
  [(generation.match(/curriculumContext:\s*programmeBlock/g) || []).length >= 5, "programme transmis à toutes les phases de certification"],
];

for (const [passed, message] of checks) {
  if (passed) ok(message);
  else fail(message);
}

if (!process.exitCode) {
  console.log("\nCertification sémantique V3 correctement installée.");
}
