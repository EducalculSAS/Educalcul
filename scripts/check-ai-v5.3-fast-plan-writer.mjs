import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/lib/courseGeneration.ts");
const source = fs.readFileSync(file, "utf8");
const checks = [
  ["plan bloquant corrigé avant les rédacteurs", source.includes('telemetry.start("blueprint-sanitize")')],
  ["arrêt précoce si le plan reste hors programme", source.includes("Le plan reste hors programme après une correction ciblée")],
  ["une seule reprise JSON par défaut", /AI_COURSE_WRITER_JSON_RETRIES[\s\S]{0,80}\n\s*1,\n\s*0,\n\s*2,/.test(source)],
  ["trois rédacteurs concurrents maximum par défaut", source.includes("Math.min(3, legacyLessonConcurrency)")],
  ["budget rédacteur borné à 16k par défaut", /AI_COURSE_WRITER_MAX_TOKENS[\s\S]{0,80}\n\s*16_000,\n\s*8_000,\n\s*32_000,/.test(source)],
  ["budget de secours borné à 10k", source.includes('"AI_COURSE_WRITER_RECOVERY_MAX_TOKENS"') && source.includes("10_000")],
  ["timeout rédacteur récupérable", source.includes("isRequestTimeoutError")],
  ["diagnostic précis des champs manquants", source.includes("incompleteLessonMessages") && source.includes("exercice ${index + 1} incomplet")],
  ["budget blueprint borné", /AI_COURSE_BLUEPRINT_MAX_TOKENS[\s\S]{0,80}\n\s*16_000,\n\s*8_000,\n\s*32_000,/.test(source)],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ECHEC"} — ${label}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`\n${failed} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("\nOK — V5.3 Fast Plan/Writer installée.");
