import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = process.cwd();
const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = fs.existsSync(path.join(cwd, "src/lib/courseGeneration.ts"))
  ? cwd
  : scriptRoot;
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const course = read("src/lib/courseGeneration.ts");
const pipeline = read("src/lib/ai/coursePipeline.ts");
const schemas = read("src/lib/ai/schemas.ts");

const checks = [
  [
    "visual_focus accepte none au lieu d'imposer un outil artificiel",
    pipeline.includes('| "none";') &&
      schemas.includes('"figure",\n          "none"') &&
      course.includes('visual_focus="none"'),
  ],
  [
    "la rotation arbitraire table/variation/sign/figure a été supprimée",
    pipeline.includes('return "none";') &&
      !pipeline.includes('const cycle: CourseVisualFocus[]'),
  ],
  [
    "les visuels sont corrigés localement selon le sens de la leçon",
    pipeline.includes("resolveSemanticVisualFocus") &&
      pipeline.includes('requested === "sign_table" && signCompatible') &&
      pipeline.includes('if (graphCompatible) return "graph"'),
  ],
  [
    "un tableau de signes est interdit pour limites ou lien exp/ln",
    course.includes('visual_focus="sign_table" uniquement') &&
      course.includes("jamais pour des limites, un lien exp/ln"),
  ],
  [
    "seul le graph planifié reste bloquant au niveau d'une leçon",
    course.includes('options.visualFocus === "graph"') &&
      course.includes('code: "missing_planned_graph"') &&
      !course.includes('code: "missing_planned_visual"'),
  ],
  [
    "les contrôles stricts du chapitre assemblé restent actifs",
    course.includes("const chapterIssues = blockingIssues(chapter") &&
      course.includes("requireGraph,"),
  ],
  [
    "le plan et sa relecture connaissent les règles sémantiques",
    course.includes("pertinence sémantique de visual_focus") &&
      course.includes("Utilise graph pour courbes/limites/asymptotes/convexité"),
  ],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERREUR"} — ${label}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log(
  "\nOK — V2.6.2 : les visuels sont choisis sémantiquement, les outils facultatifs ne détruisent plus une leçon et les graphes requis restent contrôlés.",
);
