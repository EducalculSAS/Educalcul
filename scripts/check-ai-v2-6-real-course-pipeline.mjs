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
const review = read("src/lib/ai/courseReview.ts");
const schemas = read("src/lib/ai/schemas.ts");

const checks = [
  [
    "plan global unique avec toutes les leçons",
    course.includes("courseBlueprintSchema") &&
      schemas.includes("educalcul_course_blueprint") &&
      !course.includes("courseLessonPlanSchema"),
  ],
  [
    "propriété exclusive des notions entre agents",
    pipeline.includes("conceptOwners") &&
      pipeline.includes("forbiddenDevelopments") &&
      course.includes("NOTIONS ATTRIBUÉES AUX AUTRES AGENTS"),
  ],
  [
    "rédacteurs et relecteurs en pipeline parallèle",
    course.includes("AI_COURSE_WRITER_CONCURRENCY") &&
      course.includes("AI_COURSE_REVIEW_CONCURRENCY") &&
      course.includes("reviewedLessonPromises") &&
      course.includes("createTaskLimiter"),
  ],
  [
    "une seule relecture locale par leçon",
    course.includes("reviewCourseLesson") &&
      review.includes("corrections locales") &&
      review.includes("au maximum 14 patches") &&
      !course.includes("runStructuredQualityGuard"),
  ],
  [
    "Markdown mathématique sans agent de réparation LaTeX",
    course.includes("COURSE_MARKDOWN_JSON_PROMPT") &&
      course.includes("enableModelRepair: false") &&
      !course.includes("repairUnstructuredMathText"),
  ],
  [
    "budget utile global et par leçon",
    course.includes("AI_COURSE_MAX_USEFUL_CHARS") &&
      pipeline.includes("createLessonJobs") &&
      pipeline.includes("targetMaxChars") &&
      course.includes("aucun agent ne devra écrire pour remplir"),
  ],
  [
    "déduplication conservatrice entre leçons",
    pipeline.includes("deduplicateCourseChapters") &&
      pipeline.includes("jaccard") &&
      course.includes("Déduplication annulée"),
  ],
  [
    "télémétrie par plan, rédacteur, relecteur et sauvegarde",
    pipeline.includes("CourseGenerationTelemetry") &&
      course.includes("writer c${job.chapterIndex + 1}-l${job.lessonIndex + 1}") &&
      course.includes("review c${job.chapterIndex + 1}-l${job.lessonIndex + 1}") &&
      course.includes("timings_ms"),
  ],
  [
    "contrôle explicite des erreurs observées",
    course.includes("une tangente n'est horizontale") &&
      course.includes("minimum et infimum") &&
      review.includes("légendes de graphiques") &&
      review.includes("answer et explanation"),
  ],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERREUR"} — ${label}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
console.log(
  "\nOK — V2.6 : plan global anti-chevauchement, rédacteurs/relecteurs pipelinés, patches locaux, Markdown déterministe et budget utile mesuré.",
);
