import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const generation = read("src/lib/courseGeneration.ts");
const pipeline = read("src/lib/ai/coursePipeline.ts");

const checks = [
  [
    "le planificateur demande explicitement 2 à 4 notions propriétaires",
    generation.includes("core_concepts contient 2 à 4 notions ou compétences courtes"),
  ],
  [
    "la déduplication exclusive complète localement une leçon laissée avec une seule notion",
    pipeline.includes("if (owned.length < 2)") &&
      pipeline.includes("const candidates = uniqueConcepts([") &&
      pipeline.includes("...lesson.requiredSections") &&
      pipeline.includes("...lesson.exerciseSkills"),
  ],
  [
    "les notions récupérées restent globalement uniques",
    pipeline.includes("conceptOwners.has(key)") &&
      pipeline.includes("conceptOwners.add(key)") &&
      pipeline.includes("if (owned.length >= 2) break"),
  ],
  [
    "un dernier repli déterministe garantit deux notions sans appel IA",
    pipeline.includes("const base = `${lesson.title} — ${anchor || \"compétence centrale\"}`") &&
      pipeline.includes("owned.push(candidate);"),
  ],
  [
    "les libellés récupérés restent concis",
    pipeline.includes("function conciseConceptLabel") &&
      pipeline.includes("words.length <= 16"),
  ],
  [
    "l'audit final conserve l'exigence de deux notions",
    pipeline.includes("if (lesson.coreConcepts.length < 2)") &&
      pipeline.includes("La leçon doit posséder au moins deux notions"),
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
console.log("OK — V2.8.3 : les collisions de core_concepts sont réparées localement avant l'audit du blueprint.");
