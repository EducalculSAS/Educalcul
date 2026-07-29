import fs from "node:fs";

const generationPath = "src/lib/courseGeneration.ts";
const reviewPath = "src/lib/ai/courseReview.ts";

for (const file of [generationPath, reviewPath]) {
  if (!fs.existsSync(file)) {
    console.error(`ERREUR — fichier absent: ${file}`);
    process.exit(1);
  }
}

const generation = fs.readFileSync(generationPath, "utf8");
const review = fs.readFileSync(reviewPath, "utf8");

const checks = [
  [!generation.includes('telemetry.start("blueprint-review")'), "suppression du blueprint-review"],
  [!generation.includes('telemetry.start("blueprint-repair")'), "suppression du blueprint-repair"],
  [!generation.includes("reviewCourseLesson(lesson"), "suppression de la relecture IA généraliste"],
  [generation.includes("Adapte tes vérifications au domaine réellement traité"), "consignes universelles par domaine mathématique"],
  [generation.includes("wallClockBudgetMs"), "garde de temps Vercel conservée"],
  [review.includes("educalcul_universal_math_certifier"), "certificateur universel théorie + exercices"],
  [review.includes("educalcul_global_universal_math_certifier"), "certificateur global universel"],
  [review.includes('AI_COURSE_PUBLICATION_MAX_REPAIR_CYCLES", 1'), "une seule réparation par leçon par défaut"],
  [review.includes('AI_COURSE_GLOBAL_MAX_REPAIR_CYCLES", 1'), "une seule réparation globale par défaut"],
];

let failed = false;
for (const [ok, label] of checks) {
  if (ok) console.log(`OK — ${label}`);
  else {
    failed = true;
    console.error(`ERREUR — ${label}`);
  }
}

if (failed) process.exit(1);
console.log("OK — Educalcul V5 Universal Fast Math est installé.");
