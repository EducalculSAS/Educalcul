import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const forbiddenFiles = [
  "src/lib/latexRepair.ts",
  "src/lib/aiCourseContent.ts",
];
const problems = [];

for (const file of forbiddenFiles) {
  if (fs.existsSync(path.join(root, file))) problems.push(`Ancien fichier encore présent : ${file}`);
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [full] : [];
  });
}

for (const file of walk(path.join(root, "src"))) {
  const content = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  for (const token of ["@/lib/latexRepair", "@/lib/aiCourseContent", "repairLatex(", "AI_COURSE_FORMAT_RULES"]) {
    if (content.includes(token)) problems.push(`${relative} référence encore ${token}`);
  }
}

const required = [
  "src/lib/ai/schemas.ts",
  "src/lib/ai/structuredContent.ts",
  "src/lib/ai/compiler.ts",
  "src/lib/ai/runtime.ts",
  "src/app/api/admin/ai-edit/route.ts",
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) problems.push(`Fichier V2 absent : ${file}`);
}

if (problems.length) {
  console.error(`Migration incomplète : ${problems.length} problème(s)`);
  problems.forEach((problem) => console.error(`- ${problem}`));
  process.exit(1);
}
console.log("OK — ancien moteur HTML/LaTeX supprimé, aucun import résiduel.");
