import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = process.cwd();
const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = fs.existsSync(path.join(cwd, "src/lib/courseGeneration.ts"))
  ? cwd
  : scriptRoot;
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const generation = read("src/lib/courseGeneration.ts");
const llm = read("src/lib/llm.ts");

const checks = [
  [
    "le blueprint reçoit par défaut le plafond Leanstral de 128 000 tokens",
    generation.includes('"AI_COURSE_BLUEPRINT_MAX_TOKENS",\n      128_000') &&
      generation.includes("12_000,\n      128_000"),
  ],
  [
    "le premier plan n'est plus relancé avec des budgets 6 500 puis 8 500",
    !generation.includes("Math.max(6_500, 3_000 + totalLessonCount * 500)") &&
      !generation.includes("blueprintMaxTokens + 2_000") &&
      generation.includes("const rawBlueprint = await generate("),
  ],
  [
    "la réparation du plan dispose du même plafond que le plan initial",
    generation.includes("blueprintContract,\n        0.08,\n        blueprintMaxTokens,\n        true"),
  ],
  [
    "l'audit indépendant possède un budget configurable plus large",
    generation.includes('envNumber("AI_COURSE_BLUEPRINT_REVIEW_MAX_TOKENS", 16_000, 3_000, 128_000)'),
  ],
  [
    "Mistral conserve top_p=1 pour les appels greedy ou raisonnement",
    llm.includes("top_p: 1"),
  ],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERREUR"} — ${label}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log(
  "\nOK — V2.7.2 : blueprint et réparation disposent du plafond de sortie Leanstral sans double appel progressif.",
);
