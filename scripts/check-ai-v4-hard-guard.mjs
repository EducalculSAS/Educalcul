import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const review = read("src/lib/ai/courseReview.ts");
const pipeline = read("src/lib/ai/coursePipeline.ts");
const generation = read("src/lib/courseGeneration.ts");
const programmes = read("src/lib/programmes-nationaux.ts");

const checks = [
  [review.includes("Le certificateur a rendu verdict=fail sans fournir"), "verdict fail-closed du certificateur"],
  [review.includes('"lesson-title"') && review.includes('"lesson_title"'), "titre de leçon auditable et réparable"],
  [review.includes("wrongFunctionalProof"), "détection de preuve fonctionnelle invalide"],
  [review.includes("wrongTangentAtZero"), "détection de tangente erronée en 0"],
  [review.includes("invalidPositivityContradiction"), "détection de preuve de positivité invalide"],
  [review.includes("positiveGrowthHalfLife"), "détection demi-vie/croissance incohérente"],
  [review.includes("cubicRootsCoefficientConflict"), "détection de conflit sur les racines complexes"],
  [review.includes("strictFirstExponent"), "barrière déterministe de niveau"],
  [pipeline.includes("forbidden_level_concept"), "blocage hors programme dès le plan"],
  [generation.includes("String(grade_level)") && generation.includes("localBlueprintAuditMessages"), "niveau transmis à l'audit local du plan"],
  [programmes.includes("STRICT_PROGRAMME_GUARDRAILS"), "limites strictes du programme"],
  [programmes.includes("Fonction exponentielle : définition comme unique fonction dérivable"), "programme 2026 de Première enrichi"],
];

let failed = false;
for (const [ok, label] of checks) {
  if (ok) {
    console.log(`OK - ${label}`);
  } else {
    failed = true;
    console.error(`ERREUR - ${label}`);
  }
}

if (failed) process.exit(1);
console.log("OK - Educalcul V4 hard guard installé");
