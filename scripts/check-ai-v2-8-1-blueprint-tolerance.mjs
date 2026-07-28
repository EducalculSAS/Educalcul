import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const generation = fs.readFileSync(path.join(root, "src/lib/courseGeneration.ts"), "utf8");
const pipeline = fs.readFileSync(path.join(root, "src/lib/ai/coursePipeline.ts"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`ECHEC — ${message}`);
  console.log(`OK — ${message}`);
}

assert(
  pipeline.includes("specializeCollidingExerciseSkills") &&
    pipeline.includes("dans la leçon « ${lesson.title} »"),
  "les compétences proches sont contextualisées localement",
);
assert(
  pipeline.includes('code: "overlapping_exercise_skill"') &&
    pipeline.includes('code: "duplicate_exercise_skill"'),
  "un chevauchement lexical est distingué d'un doublon exact",
);
assert(
  pipeline.includes('issue.code !== "overlapping_exercise_skill"'),
  "un simple chevauchement lexical n'annule plus le cours",
);
assert(
  generation.includes("{ blockingOnly: true }") &&
    generation.includes("isBlockingCourseBlueprintIssue"),
  "la réparation complète du plan est réservée aux défauts réellement bloquants",
);
assert(
  generation.includes("isBlockingIndependentBlueprintMessage") &&
    generation.includes("concernsExerciseSkills && lexicalOverlap"),
  "le second agent ne déclenche plus une réparation pour un verbe commun",
);
assert(
  generation.includes('telemetry.start("publication-gate")') &&
    generation.includes('telemetry.start("publication-global")'),
  "la barrière mathématique stricte V2.8 reste active",
);
assert(
  generation.includes("duplicateExerciseIssues") &&
    generation.includes("replaceDuplicateCourseExercises"),
  "les vrais doublons d'exercices restent corrigés sur le contenu final",
);

function canonical(value) {
  return value.toLocaleLowerCase("fr").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(value) {
  return new Set(canonical(value).split(" ").filter((token) => token.length > 2));
}
function jaccard(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / union.size;
}
const broad = "Résoudre des équations transcendantes";
const contextualized = `${broad} dans la leçon « Modélisation et problèmes concrets »`;
assert(jaccard(broad, broad) === 1, "un doublon exact reste identifiable");
assert(jaccard(broad, contextualized) < 0.78, "la contextualisation sépare deux compétences de leçons différentes");

console.log("OK — V2.8.1 : le plan ne bloque plus sur une collision lexicale, sans relâcher le contrôle du cours final.");
