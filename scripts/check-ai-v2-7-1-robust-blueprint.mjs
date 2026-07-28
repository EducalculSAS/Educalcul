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
const pipeline = read("src/lib/ai/coursePipeline.ts");
const schemas = read("src/lib/ai/schemas.ts");
const llm = read("src/lib/llm.ts");

const checks = [
  [
    "Mistral reçoit top_p=1 et accepte le mode greedy du vérificateur",
    llm.includes("top_p: 1") &&
      llm.includes("Mistral exige top_p=1 lorsque temperature=0"),
  ],
  [
    "le premier plan dispose directement d'un budget compatible avec Leanstral",
    generation.includes("Math.max(6_500, 3_000 + totalLessonCount * 500)") &&
      generation.includes("Math.min(10_000, blueprintMaxTokens + 2_000)"),
  ],
  [
    "le vérificateur indépendant n'utilise plus la combinaison greedy invalide",
    generation.includes("courseBlueprintAuditSchema(),\n        0.05,\n        3_000,\n        false"),
  ],
  [
    "le planificateur est forcé à rester précis mais compact",
    generation.includes("scope de chapitre 30 à 65 mots") &&
      generation.includes("chaque entrée de core_concepts") &&
      schemas.includes('objective: { type: "string", minLength: 12, maxLength: 260 }') &&
      schemas.includes('scope: { type: "string", minLength: 20, maxLength: 420 }'),
  ],
  [
    "un scope de chapitre trop court est enrichi localement à partir des leçons",
    pipeline.includes("function preciseChapterScope") &&
      pipeline.includes("organise les apprentissages suivants") &&
      pipeline.includes("scope: preciseChapterScope(scope, title, lessons)"),
  ],
  [
    "un simple défaut de métadonnée de chapitre ne détruit plus tout le cours",
    generation.includes("blockingPlanIssues") &&
      generation.includes("métadonnées de chapitre stabilisées localement") &&
      generation.includes("Le périmètre du chapitre est trop vague"),
  ],
  [
    "les défauts réels de coordination restent bloquants après une correction",
    generation.includes("if (blockingPlanIssues.length > 0)") &&
      generation.includes("Le plan global reste insuffisamment précis après une correction"),
  ],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERREUR"} — ${label}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log(
  "\nOK — V2.7.1 : plan Leanstral non tronqué, audit Mistral compatible et métadonnées de chapitre stabilisées sans masquer les vrais doublons.",
);
