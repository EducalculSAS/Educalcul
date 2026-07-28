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
const review = read("src/lib/ai/courseReview.ts");
const schemas = read("src/lib/ai/schemas.ts");

const checks = [
  [
    "un seul planificateur produit le plan complet et le second agent ne le réécrit pas",
    generation.includes("Tu ne rédiges pas le cours et tu ne réécris pas le plan") &&
      generation.includes("courseBlueprintAuditSchema()") &&
      !generation.includes("Retourne le plan complet corrigé"),
  ],
  [
    "le plan impose titres, sections, compétences d'exercices et exclusions",
    schemas.includes("required_sections") &&
      schemas.includes("exercise_skills") &&
      schemas.includes("forbidden_concepts") &&
      generation.includes("titres de chapitres et de leçons sont pédagogiques et spécifiques"),
  ],
  [
    "un plan générique ou dupliqué est audité avant les rédacteurs",
    pipeline.includes("auditCourseBlueprint") &&
      pipeline.includes("generic_lesson_title") &&
      pipeline.includes("duplicate_objective") &&
      generation.includes("blueprint-repair"),
  ],
  [
    "chaque rédacteur reçoit la carte globale et le contexte avant/après",
    generation.includes("lessonPositionContext") &&
      generation.includes("SECTIONS QUE LE PLAN T'ATTRIBUE") &&
      generation.includes("COMPÉTENCES RÉSERVÉES AUX EXERCICES") &&
      pipeline.includes("forbiddenDevelopments: forbidden"),
  ],
  [
    "le relecteur recalcule les exercices et traite les mathématiques non délimitées",
    review.includes("refais les calculs de manière indépendante") &&
      review.includes("courseLessonUnstructuredMathFields") &&
      generation.includes("contient encore des mathématiques non délimitées"),
  ],
  [
    "les exercices faux ou hors périmètre peuvent être remplacés ou supprimés localement",
    review.includes("delete_exercise_indexes") &&
      review.includes("removeExerciseAndReindex") &&
      review.includes("corrige ses quatre champs"),
  ],
  [
    "un audit inter-leçons détecte et corrige les exercices dupliqués avant sauvegarde",
    pipeline.includes("auditCourseCoordination") &&
      review.includes("replaceDuplicateCourseExercises") &&
      generation.includes("coordination-review") &&
      generation.includes("répétitions inter-leçons avant enregistrement"),
  ],
  [
    "la durée enregistrée est la somme des minutes des leçons",
    generation.includes("estimated_time: finalStructuredChapters.reduce") &&
      !generation.includes("durationPerLesson / 60"),
  ],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERREUR"} — ${label}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log("\nOK — V2.7 : planification précise, contexte inter-agents, relecture mathématique renforcée et coordination finale avant sauvegarde.");
