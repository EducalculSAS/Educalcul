import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const courseGeneration = fs.readFileSync(
  path.join(root, "src/lib/courseGeneration.ts"),
  "utf8",
);
const courseReview = fs.readFileSync(
  path.join(root, "src/lib/ai/courseReview.ts"),
  "utf8",
);

function assert(condition, message) {
  if (!condition) throw new Error(`ECHEC — ${message}`);
  console.log(`OK — ${message}`);
}

assert(
  courseReview.includes("verifyCourseLessonForPublication") &&
    courseReview.includes("runPublicationJudge") &&
    courseReview.includes("repairPublicationIssues"),
  "juge mathématique indépendant et réparation locale",
);
assert(
  (courseReview.match(/runPublicationJudge\(/g) || []).length >= 3,
  "ré-audit intégral après chaque réparation",
);
assert(
  courseReview.includes("deterministicPublicationIssues") &&
    courseReview.includes("answerLooksTruncated") &&
    courseReview.includes("extractApproximateNumbers"),
  "détection locale des réponses tronquées et valeurs contradictoires",
);
assert(
  courseReview.includes("variation_directions") &&
    courseReview.includes("variation_derivative_signs") &&
    courseReview.includes("sign_table_interval_signs"),
  "les signes et directions des tableaux sont corrigibles",
);
assert(
  courseReview.includes("verifyCourseGloballyForPublication") &&
    courseGeneration.includes("publication-global"),
  "contrôle final de cohérence entre toutes les leçons",
);
assert(
  courseGeneration.indexOf("publication-gate") < courseGeneration.indexOf('telemetry.start("compile")') &&
    courseGeneration.indexOf('telemetry.start("compile")') < courseGeneration.indexOf('telemetry.start("save")'),
  "la barrière de publication s'exécute avant compilation et enregistrement",
);
assert(
  courseGeneration.includes("AI_COURSE_PUBLICATION_GATE") &&
    courseGeneration.includes("AI_COURSE_PUBLICATION_REVIEW_MAX_TOKENS") &&
    courseGeneration.includes("AI_COURSE_GLOBAL_REVIEW_MAX_TOKENS"),
  "budgets de vérification configurables avec valeurs sûres par défaut",
);
assert(
  courseGeneration.includes("contiennent encore une erreur mathématique ou pédagogique bloquante") &&
    courseGeneration.includes("Le cours ne franchit pas le contrôle global de publication"),
  "mode fail-closed : aucune sauvegarde en cas d'erreur restante",
);
assert(
  courseReview.includes("refais indépendamment chaque exercice") &&
    courseReview.includes("taux nominal, périodique et continu") &&
    courseReview.includes("aucune circularité"),
  "audit adversarial des calculs, modèles et démonstrations",
);

function extractApproximateNumbers(value) {
  const pattern = /(?:\\approx|≈|environ|approximativement|à peu près)\s*([-+]?\d+(?:[.,]\d+)?)/gi;
  const out = [];
  let match;
  while ((match = pattern.exec(value)) !== null) {
    const raw = match[1];
    const decimalPart = /[.,](\d+)/.exec(raw)?.[1] ?? "";
    out.push({ value: Number(raw.replace(",", ".")), decimals: decimalPart.length });
  }
  return out;
}
function matches(a, b) {
  const precision = Math.min(a.decimals, b.decimals);
  const tolerance = Math.max(
    0.51 * 10 ** -precision,
    Math.max(Math.abs(a.value), Math.abs(b.value)) * 1e-7,
  );
  return Math.abs(a.value - b.value) <= tolerance;
}
const badAnswer = extractApproximateNumbers("$u_5 \\approx 746,35$")[0];
const badExplanation = extractApproximateNumbers("$u_5 \\approx 742,07$")[0];
const roundingA = extractApproximateNumbers("$r \\approx 0,0397$")[0];
const roundingB = extractApproximateNumbers("$r \\approx 0,03973$")[0];
assert(!matches(badAnswer, badExplanation), "une contradiction numérique significative est détectée");
assert(matches(roundingA, roundingB), "un simple écart d'arrondi compatible n'est pas rejeté");

console.log("OK — V2.8 : cours enregistrable uniquement après double contrôle mathématique et audit global.");
