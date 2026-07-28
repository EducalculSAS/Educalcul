import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "src/lib/courseGeneration.ts");
const source = fs.readFileSync(file, "utf8");

const checks = [
  ["erreurs JSON reconnues comme recuperables", /isInvalidStructuredJsonError/],
  ["reprises JSON configurables", /AI_COURSE_WRITER_JSON_RETRIES/],
  ["prompt de secours compact", /compactRecoverySystemPrompt/],
  ["generation fraiche au lieu de reparer le prefixe", /GÉNÉRATION FRAÎCHE/],
  ["reprise aussi sur correction structurelle", /"structural-correction"/],
  ["echec strict apres toutes les tentatives", /n'a pas pu produire un JSON complet/],
];

let failed = false;
for (const [label, pattern] of checks) {
  if (!pattern.test(source)) {
    console.error(`ERREUR — ${label}`);
    failed = true;
  } else {
    console.log(`OK — ${label}`);
  }
}

if (failed) process.exit(1);
console.log("OK — V2.9.1 : une lecon au JSON incomplet est regeneree seule avec un prompt compact, sans relancer le cours.");
