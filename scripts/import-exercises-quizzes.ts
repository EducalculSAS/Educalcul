import { createClient } from "@supabase/supabase-js";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { compileCourseBlock } from "../src/lib/ai/compiler";
import { normalizeCourseBlock } from "../src/lib/ai/structuredContent";

/* ============================================================
   CONFIG
   ============================================================ */

const ROOT = process.cwd();
const EXERCISES_SOURCE_DIR = path.join(ROOT, "educalcul_exercises_final");
const QUIZZES_SOURCE_DIR = path.join(ROOT, "educalcul_quizzes_final");
const COURSES_SOURCE_DIR = path.join(ROOT, "educalcul_courses_final");

const APPLY = process.argv.includes("--apply");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL manque dans .env.local");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE manque dans .env.local");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ============================================================
   NORMALISATION — même logique que import-educalcul-courses.ts,
   dupliquée volontairement (script indépendant).
   ============================================================ */

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeLevel(value: string): string {
  const level = normalizeText(value);
  const aliases: Record<string, string> = {
    cp: "cp", ce1: "ce1", ce2: "ce2", cm1: "cm1", cm2: "cm2",
    "6eme": "6eme", "6e": "6eme",
    "5eme": "5eme", "5e": "5eme",
    "4eme": "4eme", "4e": "4eme",
    "3eme": "3eme", "3e": "3eme",
    seconde: "2nde", "2nde": "2nde",
    "premiere-sans-spe-maths": "1ere-generale", "premiere-generale": "1ere-generale", "1ere-generale": "1ere-generale",
    "premiere-spe-maths": "1ere-generale-maths", "premiere-generale-maths": "1ere-generale-maths", "1ere-generale-maths": "1ere-generale-maths",
    "terminale-sans-maths": "terminale-generale", "terminale-generale": "terminale-generale",
    "terminale-maths-complementaires": "terminale-generale-complementaires", "terminale-generale-complementaires": "terminale-generale-complementaires",
    "terminale-spe-maths": "terminale-generale-maths", "terminale-generale-maths": "terminale-generale-maths",
    "terminale-maths-expertes": "terminale-generale-expertes", "terminale-generale-expertes": "terminale-generale-expertes",
  };
  return aliases[level] ?? level;
}

function inferLevelFromFile(file: string, declaredLevel: string): string {
  const filename = path.basename(file).toLowerCase();
  if (filename.startsWith("1ere-generale-maths-")) return "1ere-generale-maths";
  if (filename.startsWith("1ere-generale-")) return "1ere-generale";
  if (filename.startsWith("terminale-generale-complementaires-")) return "terminale-generale-complementaires";
  if (filename.startsWith("terminale-generale-expertes-")) return "terminale-generale-expertes";
  if (filename.startsWith("terminale-generale-maths-")) return "terminale-generale-maths";
  if (filename.startsWith("terminale-generale-")) return "terminale-generale";
  return normalizeLevel(declaredLevel);
}

/* ============================================================
   HTML — même règle que compileStructuredRichText côté app :
   texte échappé, $latex$ conservé tel quel pour le rendu KaTeX
   client (renderLatexInHTML), tout enveloppé dans <p>.
   ============================================================ */

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Le modèle écrit du texte brut avec des $...$ : on échappe le HTML SAUF les
// segments $...$ eux-mêmes (qui doivent rester lisibles tels quels pour le
// rendu KaTeX côté client, comme le fait compileStructuredRichText).
function textToHtml(value: string): string {
  const raw = String(value ?? "");
  const parts = raw.split(/(\$[^$]*\$)/g);
  const html = parts
    .map((part) => (part.startsWith("$") && part.endsWith("$") ? part : escapeHtml(part)))
    .join("")
    .replace(/\n+/g, "<br>");
  return `<p>${html}</p>`;
}

// Réutilise EXACTEMENT le même compilateur de figures que les cours
// (normalizeCourseBlock + compileCourseBlock), pour que les exercices/quiz
// affichent les mêmes visuels que ceux déjà utilisés dans les cours.
function compileFigureHtml(figure: unknown): string {
  if (!figure || typeof figure !== "object") return "";
  try {
    const normalized = normalizeCourseBlock(figure);
    if (!normalized) return "";
    return compileCourseBlock(normalized, [], new Set());
  } catch {
    return "";
  }
}

// Ajoute le HTML de la figure (le cas échéant) après le texte de l'énoncé.
function withOptionalFigure(contentHtml: string, figure: unknown): string {
  const figureHtml = compileFigureHtml(figure);
  return figureHtml ? `${contentHtml}\n${figureHtml}` : contentHtml;
}

/* ============================================================
   LECTURE RÉCURSIVE
   ============================================================ */

async function findJsonFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const result: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await findJsonFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) result.push(fullPath);
  }
  return result.sort();
}

/* ============================================================
   DOSSIERS — un dossier par cours, nommé comme le cours, sous
   le dossier racine du niveau (exercise_folders / quiz_folders).
   ============================================================ */

type FolderRow = { id: number; name: string; grade_level: string | null; parent_id: number | null };

async function loadFolders(table: "exercise_folders" | "quiz_folders"): Promise<FolderRow[]> {
  const { data, error } = await supabase.from(table).select("id,name,grade_level,parent_id");
  if (error) throw new Error(`Impossible de lire ${table} : ${error.message}`);
  return (data ?? []) as FolderRow[];
}

function findLevelRoot(folders: FolderRow[], level: string): FolderRow | undefined {
  const normalizedLevel = normalizeLevel(level);
  const roots = folders.filter((f) => f.parent_id === null);
  return roots.find((root) => normalizeLevel(root.grade_level ?? "") === normalizedLevel);
}

const folderCache = new Map<string, number>(); // `${table}::${rootId}::${normalizedTitle}` -> folder id

async function resolveCourseFolder(
  table: "exercise_folders" | "quiz_folders",
  folders: FolderRow[],
  level: string,
  courseTitle: string,
): Promise<number | null> {
  const root = findLevelRoot(folders, level);
  if (!root) return null;
  const key = `${table}::${root.id}::${normalizeText(courseTitle)}`;
  const cached = folderCache.get(key);
  if (cached) return cached;

  const existing = folders.find(
    (f) => f.parent_id === root.id && normalizeText(f.name) === normalizeText(courseTitle),
  );
  if (existing) {
    folderCache.set(key, existing.id);
    return existing.id;
  }

  if (!APPLY) {
    // En mode simulation on ne crée rien : on retourne un id fictif pour que
    // le reste de la validation puisse s'exécuter sans toucher la base.
    return -1;
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ name: courseTitle, parent_id: root.id, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(`Impossible de créer le dossier "${courseTitle}" dans ${table} : ${error.message}`);
  folders.push({ id: data.id, name: courseTitle, grade_level: null, parent_id: root.id });
  folderCache.set(key, data.id);
  return data.id;
}

/* ============================================================
   RÉSOLUTION DU COURS SOURCE (à partir du fichier généré)
   ============================================================ */

type CourseInfo = { id: number; title: string; level: string; subject: string };

async function loadCourseInfoFromFile(generatedFilePath: string, sourceRootDir: string): Promise<{
  title: string;
  level: string;
  subject: string;
} | null> {
  // educalcul_exercises_final/<levelDir>/<code>__exN-type.json
  //   -> educalcul_courses_final/<levelDir>/<code>.json
  const relative = path.relative(sourceRootDir, generatedFilePath);
  const levelDir = relative.split(path.sep)[0];
  const base = path.basename(generatedFilePath);
  const code = base.split("__")[0];
  const courseFile = path.join(COURSES_SOURCE_DIR, levelDir, `${code}.json`);
  try {
    const raw = JSON.parse(await readFile(courseFile, "utf8"));
    const level = inferLevelFromFile(courseFile, String(raw.level || levelDir));
    return { title: String(raw.title || ""), level, subject: String(raw.subject || "") };
  } catch {
    return null;
  }
}

async function loadCoursesIndex(): Promise<Map<string, CourseInfo>> {
  const { data, error } = await supabase.from("courses").select("id,title,level,subject");
  if (error) throw new Error(`Impossible de lire courses : ${error.message}`);
  const index = new Map<string, CourseInfo>();
  for (const row of data ?? []) {
    const key = [normalizeLevel(String(row.level ?? "")), normalizeText(String(row.subject ?? "")), normalizeText(String(row.title ?? ""))].join("::");
    index.set(key, { id: Number(row.id), title: String(row.title), level: String(row.level), subject: String(row.subject) });
  }
  return index;
}

/* ============================================================
   COMPILATION EXERCICE / QUIZ — depuis le JSON brut généré vers
   le format exact stocké en base (identique à ce que produit
   compileStructuredExerciseDraft / compileStructuredQuizDraft
   côté app, en plus simple car le modèle écrit déjà du texte
   brut + $...$ au lieu du format RICH_TEXT structuré).
   ============================================================ */

function compileExerciseBlocks(raw: any): any[] {
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  return blocks.map((b: any, index: number) => {
    const id = `block-${index + 1}`;
    const title = String(b.title || `Question ${index + 1}`);
    const content = withOptionalFigure(textToHtml(b.content || ""), b.figure);
    const explanation = textToHtml(b.explanation || "");
    const points = typeof b.points === "number" ? b.points : 2;
    const type = raw._type as string;

    if (type === "fill_in_the_blank") {
      return { id, type, title, content, points, blanks: Array.isArray(b.blanks) ? b.blanks.map(String) : [], explanation };
    }
    if (type === "matching") {
      return {
        id, type, title, content, points,
        pairs: Array.isArray(b.pairs) ? b.pairs.map((p: any) => ({ left: escapeHtml(p.left || ""), right: String(p.right || "") })) : [],
        explanation,
      };
    }
    if (type === "ordering") {
      return { id, type, title, content, points, items: Array.isArray(b.items) ? b.items.map((i: string) => escapeHtml(i)) : [], explanation };
    }
    // text_input / coding
    return { id, type, title, content, points, correctAnswer: String(b.correctAnswer || ""), explanation };
  });
}

function compileQuizQuestions(raw: any): any[] {
  const questions = Array.isArray(raw.questions) ? raw.questions : [];
  return questions.map((q: any, index: number) => {
    const options = Array.isArray(q.options) ? q.options.map((o: string) => escapeHtml(o)) : [];
    const correctRaw = String(q.correctAnswer || "");
    const correctIndex = (Array.isArray(q.options) ? q.options : []).findIndex((o: string) => o === correctRaw);
    const correctAnswer = correctIndex >= 0 ? options[correctIndex] : options[0] || escapeHtml(correctRaw);
    return {
      id: `q-${index + 1}`,
      text: withOptionalFigure(textToHtml(q.text || ""), q.figure),
      type: "single_choice" as const,
      points: typeof q.points === "number" ? q.points : 1,
      options,
      correctAnswer,
      explanation: textToHtml(q.explanation || ""),
    };
  });
}

/* ============================================================
   IMPORT
   ============================================================ */

async function main() {
  console.log("");
  console.log("══════════════════════════════════════════════");
  console.log(" EDUCALCUL — IMPORT EXERCICES + QUIZ");
  console.log("══════════════════════════════════════════════");
  console.log("");
  console.log(APPLY ? "🚀 MODE IMPORT" : "🔎 MODE TEST (relance avec --apply pour écrire)");
  console.log("");

  const exerciseFiles = await findJsonFiles(EXERCISES_SOURCE_DIR);
  const quizFiles = await findJsonFiles(QUIZZES_SOURCE_DIR);
  console.log(`📚 ${exerciseFiles.length} fichiers exercices, ${quizFiles.length} fichiers quiz trouvés.`);

  const coursesIndex = await loadCoursesIndex();
  const exerciseFolders = await loadFolders("exercise_folders");
  const quizFolders = await loadFolders("quiz_folders");

  // Anti-doublon : un import peut être relancé après une correction (comme
  // pour les cours cette nuit) — on ne réinsère jamais un titre déjà présent
  // pour le même course_id.
  const { data: existingExRows } = await supabase.from("exercises").select("title,course_id");
  const existingExKeys = new Set((existingExRows ?? []).map((r) => `${r.course_id}::${normalizeText(String(r.title ?? ""))}`));
  const { data: existingQRows } = await supabase.from("quizzes").select("title,course_id");
  const existingQKeys = new Set((existingQRows ?? []).map((r) => `${r.course_id}::${normalizeText(String(r.title ?? ""))}`));

  let exInserted = 0, exSkipped = 0, exFailed = 0, exDuplicate = 0;
  let qInserted = 0, qSkipped = 0, qFailed = 0, qDuplicate = 0;
  const unresolved = new Set<string>();

  for (const file of exerciseFiles) {
    const raw = JSON.parse(await readFile(file, "utf8"));
    if (raw._status !== "done") { exSkipped += 1; continue; }
    const courseInfo = await loadCourseInfoFromFile(file, EXERCISES_SOURCE_DIR);
    if (!courseInfo) { unresolved.add(`fichier cours introuvable pour ${file}`); exFailed += 1; continue; }
    const key = [normalizeLevel(courseInfo.level), normalizeText(courseInfo.subject), normalizeText(courseInfo.title)].join("::");
    const course = coursesIndex.get(key);
    if (!course) { unresolved.add(`cours non trouvé en base : ${courseInfo.level} | ${courseInfo.subject} | ${courseInfo.title}`); exFailed += 1; continue; }

    const exTitle = raw.title || `Exercice : ${courseInfo.title}`;
    const dedupeKey = `${course.id}::${normalizeText(String(exTitle))}`;
    if (existingExKeys.has(dedupeKey)) { exDuplicate += 1; continue; }

    const folderId = await resolveCourseFolder("exercise_folders", exerciseFolders, courseInfo.level, courseInfo.title);
    if (!folderId) { unresolved.add(`dossier de niveau introuvable pour exercise_folders : ${courseInfo.level}`); exFailed += 1; continue; }

    const blocks = compileExerciseBlocks(raw);
    if (blocks.length === 0) { exFailed += 1; continue; }

    if (APPLY) {
      const { error } = await supabase.from("exercises").insert({
        title: raw.title || `Exercice : ${courseInfo.title}`,
        question: "",
        course_id: course.id,
        folder_id: folderId,
        difficulty_level: "medium",
        type: raw._type || "standard",
        level: courseInfo.level,
        status: "draft",
        is_published: false,
        thumbnail_url: "",
        content_json: [{ id: "page-1", title: "Questions", blocks }],
        time_limit: 20,
        max_attempts: 3,
        estimated_time: 15,
      });
      if (error) { console.error(`❌ exercice ${path.basename(file)} : ${error.message}`); exFailed += 1; continue; }
      existingExKeys.add(dedupeKey);
    }
    exInserted += 1;
  }

  for (const file of quizFiles) {
    const raw = JSON.parse(await readFile(file, "utf8"));
    if (raw._status !== "done") { qSkipped += 1; continue; }
    const courseInfo = await loadCourseInfoFromFile(file, QUIZZES_SOURCE_DIR);
    if (!courseInfo) { unresolved.add(`fichier cours introuvable pour ${file}`); qFailed += 1; continue; }
    const key = [normalizeLevel(courseInfo.level), normalizeText(courseInfo.subject), normalizeText(courseInfo.title)].join("::");
    const course = coursesIndex.get(key);
    if (!course) { unresolved.add(`cours non trouvé en base : ${courseInfo.level} | ${courseInfo.subject} | ${courseInfo.title}`); qFailed += 1; continue; }

    const qTitle = raw.title || `Quiz : ${courseInfo.title}`;
    const qDedupeKey = `${course.id}::${normalizeText(String(qTitle))}`;
    if (existingQKeys.has(qDedupeKey)) { qDuplicate += 1; continue; }

    const folderId = await resolveCourseFolder("quiz_folders", quizFolders, courseInfo.level, courseInfo.title);
    if (!folderId) { unresolved.add(`dossier de niveau introuvable pour quiz_folders : ${courseInfo.level}`); qFailed += 1; continue; }

    const questions = compileQuizQuestions(raw);
    if (questions.length === 0) { qFailed += 1; continue; }

    if (APPLY) {
      const { error } = await supabase.from("quizzes").insert({
        title: raw.title || `Quiz : ${courseInfo.title}`,
        description: "",
        course_id: course.id,
        time_limit_minutes: 10,
        status: "draft",
        folder_id: folderId,
        thumbnail_filename: "",
        content_json: questions,
        type: "standard",
        level: courseInfo.level,
        difficulty_level: "medium",
        max_attempts: 3,
        grading_type: "auto",
        estimated_time: 15,
      });
      if (error) { console.error(`❌ quiz ${path.basename(file)} : ${error.message}`); qFailed += 1; continue; }
      existingQKeys.add(qDedupeKey);
    }
    qInserted += 1;
  }

  console.log("");
  console.log("══════════════════════════════════════════════");
  console.log(` Exercices : ${exInserted} ${APPLY ? "importés" : "prêts"}, ${exDuplicate} déjà présents, ${exSkipped} ignorés (pas encore générés), ${exFailed} échecs`);
  console.log(` Quiz      : ${qInserted} ${APPLY ? "importés" : "prêts"}, ${qDuplicate} déjà présents, ${qSkipped} ignorés (pas encore générés), ${qFailed} échecs`);
  console.log("══════════════════════════════════════════════");
  if (unresolved.size > 0) {
    console.log("\n⚠️  Problèmes rencontrés (échantillon) :");
    [...unresolved].slice(0, 20).forEach((u) => console.log("  - " + u));
  }
  if (!APPLY) {
    console.log("\nPour importer réellement :");
    console.log("  npx tsx --env-file=.env.local scripts/import-exercises-quizzes.ts --apply");
  }
}

main().catch((error) => {
  console.error("💥 IMPORT ARRÊTÉ", error);
  process.exit(1);
});
