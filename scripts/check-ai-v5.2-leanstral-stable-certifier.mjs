import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const llmPath = path.join(root, "src/lib/llm.ts");
const reviewPath = path.join(root, "src/lib/ai/courseReview.ts");

function read(file) {
  if (!fs.existsSync(file)) {
    console.error(`ECHEC — fichier absent: ${file}`);
    process.exit(1);
  }
  return fs.readFileSync(file, "utf8");
}

const llm = read(llmPath);
const review = read(reviewPath);
let failures = 0;

function check(label, condition) {
  if (condition) console.log(`OK — ${label}`);
  else {
    failures += 1;
    console.error(`ECHEC — ${label}`);
  }
}

check("top_p=1 pour le mode glouton Leanstral", /top_p:\s*1/.test(llm));
check("contrat JSON exact injecté en mode json_object", llm.includes("CONTRAT JSON EXACT"));
check("contrat minimal pass/errors", review.includes('pass: { type: "boolean" }') && review.includes('required: ["pass", "errors"]'));
check("aucun expected_fix requis par le certificateur", !review.slice(review.indexOf("function publicationJudgeContract"), review.indexOf("function publicationRepairContract")).includes("expected_fix"));
check("raisonnement désactivé pour le juge", /Math\.min\(4_000,[\s\S]{0,120}?false,/.test(review));
check("sortie du juge limitée à 4000 tokens", review.includes("Math.min(4_000, Math.max(800, maxTokens))"));
check("une seule reprise de protocole", review.includes("attempt <= 2"));
check("erreur de protocole distincte d'une erreur mathématique", review.includes("n'est pas classé comme faux"));
check("12 erreurs maximum par leçon", review.includes("educalcul_universal_math_certifier_v52") && /publicationJudgeContract\(\s*12,/.test(review));
check("20 erreurs maximum pour l'audit global", review.includes("educalcul_global_universal_math_certifier_v52") && /publicationJudgeContract\(\s*20,/.test(review));

function normalizePass(record) {
  if (typeof record.pass === "boolean") return record.pass;
  const verdict = String(record.verdict ?? "").trim().toLowerCase();
  if (["pass", "passed", "ok", "valid", "validated", "success"].includes(verdict)) return true;
  if (["fail", "failed", "invalid", "reject", "rejected"].includes(verdict)) return false;
  return undefined;
}

function parse(record, validIds) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  const pass = normalizePass(record);
  if (pass === undefined) return false;
  const errors = Array.isArray(record.errors) ? record.errors : Array.isArray(record.issues) ? record.issues : [];
  const valid = errors.filter((e) => e && validIds.has(String(e.id ?? "")) && String(e.message ?? e.reason ?? "").trim());
  if (pass) return errors.length === 0;
  return valid.length > 0;
}

const ids = new Set(["lesson-title", "e0-answer"]);
check("protocole accepte pass=true vide", parse({ pass: true, errors: [] }, ids));
check("protocole accepte fail ciblé", parse({ pass: false, errors: [{ id: "e0-answer", message: "Résultat faux" }] }, ids));
check("compatibilité verdict=ok", parse({ verdict: "ok", issues: [] }, ids));
check("protocole refuse fail sans erreur", !parse({ pass: false, errors: [] }, ids));
check("protocole refuse un identifiant inventé", !parse({ pass: false, errors: [{ id: "fake", message: "Erreur" }] }, ids));
check("protocole refuse pass avec erreurs", !parse({ pass: true, errors: [{ id: "e0-answer", message: "Erreur" }] }, ids));

if (failures > 0) {
  console.error(`\nRESULTAT: ECHEC — ${failures} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("\nRESULTAT: OK — V5.2 Leanstral stable certifier installé.");
