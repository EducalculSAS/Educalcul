import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "src/lib/courseGeneration.ts");
const source = fs.readFileSync(file, "utf8");
const checks = [
  ["enrichissement ciblé", source.includes("enrichLessonToMinimum")],
  ["complément au lieu d'une régénération complète", source.includes("onlyEnrichmentIssues")],
  ["deux tentatives d'enrichissement", source.includes("attempt < 2")],
  ["fusion avant la synthèse", source.includes("isSynthesisHeading")],
  ["validation du nombre de mots après fusion", source.includes("structuredLessonWordCount(mergedLesson)")],
];
let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERREUR"} — ${label}`);
  if (!ok) failed += 1;
}
if (failed > 0) process.exit(1);
console.log("OK — enrichissement automatique des leçons courtes installé.");
