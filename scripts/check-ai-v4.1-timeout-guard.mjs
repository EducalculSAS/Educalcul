import fs from "node:fs";

const generation = fs.readFileSync("src/lib/courseGeneration.ts", "utf8");
const review = fs.readFileSync("src/lib/ai/courseReview.ts", "utf8");

const checks = [
  [generation.includes("AI_COURSE_WALL_CLOCK_BUDGET_MS"), "watchdog interne présent"],
  [generation.includes("const progressTotal = totalLessonCount * 2 + 2"), "progression 100 % réservée au statut done"],
  [generation.includes("clearTimeout(wallClockTimer)"), "watchdog nettoyé en fin de tâche"],
  [review.includes('AI_COURSE_PUBLICATION_MAX_REPAIR_CYCLES", 1, 1, 2'), "un seul cycle de réparation par défaut"],
  [review.includes("publicationJudgeScopeForIssues"), "recertification ciblée théorie/exercices"],
  [review.includes("stagnantRounds >= 1"), "arrêt immédiat en cas de stagnation"],
];

let ok = true;
for (const [pass, label] of checks) {
  console.log(`${pass ? "OK" : "ERREUR"} — ${label}`);
  if (!pass) ok = false;
}
if (!ok) process.exit(1);
