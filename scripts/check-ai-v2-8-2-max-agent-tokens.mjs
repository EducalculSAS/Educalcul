import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const generation = read("src/lib/courseGeneration.ts");
const pipeline = read("src/lib/ai/coursePipeline.ts");
const review = read("src/lib/ai/courseReview.ts");

const checks = [
  [
    "le planificateur principal conserve 128 000 tokens",
    generation.includes('"AI_COURSE_BLUEPRINT_MAX_TOKENS",\n      128_000'),
  ],
  [
    "le vérificateur du plan utilise 128 000 tokens par défaut",
    generation.includes('envNumber("AI_COURSE_BLUEPRINT_REVIEW_MAX_TOKENS", 128_000'),
  ],
  [
    "chaque rédacteur peut utiliser 128 000 tokens",
    pipeline.includes("AI_COURSE_WRITER_MAX_TOKENS") &&
      pipeline.includes(": 128_000;"),
  ],
  [
    "le relecteur de leçon n'est plus limité à 5 000 tokens",
    review.includes('courseReviewTokenLimit("AI_COURSE_LESSON_REVIEW_MAX_TOKENS")') &&
      !review.includes("\n    5_000,\n    true,\n  );"),
  ],
  [
    "le coordinateur d'exercices peut utiliser 128 000 tokens",
    review.includes('courseReviewTokenLimit("AI_COURSE_DUPLICATE_REPAIR_MAX_TOKENS")'),
  ],
  [
    "tous les juges et correcteurs de publication utilisent 128 000 tokens par défaut",
    [
      "AI_COURSE_PUBLICATION_REVIEW_MAX_TOKENS",
      "AI_COURSE_PUBLICATION_REPAIR_MAX_TOKENS",
      "AI_COURSE_GLOBAL_REVIEW_MAX_TOKENS",
      "AI_COURSE_GLOBAL_REPAIR_MAX_TOKENS",
    ].every((name) => {
      const index = generation.indexOf(`\"${name}\"`);
      return index >= 0 && generation.slice(index, index + 100).includes("128_000");
    }),
  ],
  [
    "une troncature de rédacteur conserve le plafond maximal",
    generation.includes("job.budget.maxOutputTokens,\n          );") &&
      !generation.includes("Math.min(9_500, job.budget.maxOutputTokens)"),
  ],
  [
    "un écart marginal de mots n'annule plus tout le cours",
    generation.includes("Math.floor(job.budget.hardMinWords * 0.9)") &&
      generation.includes("minWordsPerLesson: structuralMinWords"),
  ],
];

let failed = false;
for (const [label, ok] of checks) {
  if (ok) console.log(`OK — ${label}`);
  else {
    failed = true;
    console.error(`ERREUR — ${label}`);
  }
}

if (failed) process.exit(1);
console.log("OK — V2.8.2 : plafond Leanstral 128k appliqué à tous les agents du cours.");
