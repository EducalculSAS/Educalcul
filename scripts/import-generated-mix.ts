// Importe les exercices/quiz produits par le générateur autonome
// (C:\Users\ruben\educalcul-content-generator, séparé de ce repo — voir son
// README) : chaque fichier JSON porte déjà son course_id exact (pas de
// résolution floue par titre, contrairement à scripts/import-exercises-quizzes.ts
// qui traite l'ancien pipeline offline). Réutilise les mêmes compilateurs que
// l'import à la main depuis l'admin (compileHandAuthoredExercise/Quiz), donc
// même comportement pour les figures (src/lib/figureCatalog.ts) et les types
// de blocs/questions (voir src/lib/ai/handAuthoredContent.ts).
import type { Loose } from "../src/types/loose";
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { compileHandAuthoredExercise, compileHandAuthoredQuiz } from "../src/lib/ai/handAuthoredContent";

const APPLY = process.argv.includes("--apply");
const SOURCE_DIR = process.argv.find((a) => a.startsWith("--dir="))?.slice("--dir=".length)
  || path.join("C:\\Users\\ruben\\educalcul-content-generator", "output");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL manque dans .env.local");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE manque dans .env.local");

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

interface GeneratedExercise {
  _kind: "exercise";
  course_id: number;
  level: string;
  category: string;
  difficulty_level: string;
  title: string;
  description?: string;
  content_json: unknown[];
}

interface GeneratedQuiz {
  _kind: "quiz";
  course_id: number;
  level: string;
  difficulty_level: string;
  title: string;
  description?: string;
  content_json: unknown[];
}

// Supabase/PostgREST plafonne une simple .select() à 1000 lignes par défaut :
// au-delà (la table exercises dépasse ce seuil), la vérification "déjà
// présent" ne voyait qu'une partie des titres existants et réimportait en
// double tout le reste (bug constaté et corrigé le 2026-09-21 — 5352
// doublons créés puis nettoyés). Pagination explicite obligatoire ici.
async function fetchAllTitleKeys(table: "exercises" | "quizzes"): Promise<Set<string>> {
  const keys = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase.from(table).select("title,course_id").range(from, from + pageSize - 1);
    if (error) throw error;
    for (const r of data ?? []) keys.add(`${r.course_id}::${String(r.title).toLowerCase().trim()}`);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return keys;
}

// Rangement en dossiers (exercise_folders / quiz_folders) — même logique que
// scripts/import-exercises-quizzes.ts : un dossier racine par niveau scolaire
// (déjà existant, jamais créé ici) puis un sous-dossier par cours, nommé
// d'après le titre du cours. Sans ça, `folder_id` reste NULL et l'exercice/
// quiz apparaît "à la racine" du catalogue au lieu d'être nichée dans son
// niveau puis son cours (bug constaté et corrigé le 2026-09-21 : 6854
// exercices + 757 quiz importés sans folder_id).
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

type FolderRow = { id: number; name: string; grade_level: string | null; parent_id: number | null; course_id: number | null };

async function loadFolders(table: "exercise_folders" | "quiz_folders"): Promise<FolderRow[]> {
  const { data, error } = await supabase.from(table).select("id,name,grade_level,parent_id,course_id");
  if (error) throw new Error(`Impossible de lire ${table} : ${error.message}`);
  return (data ?? []) as FolderRow[];
}

function findLevelRoot(folders: FolderRow[], level: string): FolderRow | undefined {
  const normalizedLevel = normalizeLevel(level);
  const roots = folders.filter((f) => f.parent_id === null);
  return roots.find((root) => normalizeLevel(root.grade_level ?? "") === normalizedLevel);
}

const folderCache = new Map<string, number>();

async function resolveCourseFolder(
  table: "exercise_folders" | "quiz_folders",
  folders: FolderRow[],
  level: string,
  courseTitle: string,
  courseId: number,
): Promise<number | null> {
  const root = findLevelRoot(folders, level);
  if (!root) return null;
  const key = `${table}::${courseId}`;
  const cached = folderCache.get(key);
  if (cached) return cached;

  // On retrouve le dossier par son cours, pas par son nom : un cours renommé
  // garde son dossier (le déclencheur courses_sync_folder_names en aligne le
  // nom), là où une comparaison de titres en aurait créé un second.
  const existing =
    folders.find((f) => f.course_id === courseId) ??
    folders.find((f) => f.parent_id === root.id && normalizeText(f.name) === normalizeText(courseTitle));
  if (existing) {
    folderCache.set(key, existing.id);
    return existing.id;
  }

  if (!APPLY) return -1;

  // color et grade_level sont hérités du dossier racine par déclencheur.
  const { data, error } = await supabase
    .from(table)
    .insert({ name: courseTitle, parent_id: root.id, status: "draft", course_id: courseId })
    .select("id")
    .single();
  if (error) throw new Error(`Impossible de créer le dossier "${courseTitle}" dans ${table} : ${error.message}`);
  folders.push({ id: data.id, name: courseTitle, grade_level: null, parent_id: root.id, course_id: courseId });
  folderCache.set(key, data.id);
  return data.id;
}

const courseTitleCache = new Map<number, string>();

async function getCourseTitle(courseId: number): Promise<string> {
  const cached = courseTitleCache.get(courseId);
  if (cached) return cached;
  const { data, error } = await supabase.from("courses").select("title").eq("id", courseId).single();
  if (error || !data) throw new Error(`Cours introuvable pour course_id=${courseId} : ${error?.message ?? "aucune ligne"}`);
  courseTitleCache.set(courseId, data.title);
  return data.title;
}


/**
 * Durée affichée sur la fiche. Les exercices comptent désormais une dizaine
 * de questions réparties en plusieurs situations, là où 15 minutes forfaitaires
 * correspondaient à une question isolée : on compte donc environ 2 minutes par
 * question, borné pour rester crédible.
 */
function estimateMinutes(questionCount: number): number {
  return Math.min(45, Math.max(5, Math.round(questionCount * 2)));
}

/** Tentatives autorisées par exercice/quiz (5 depuis le 2026-09-21, 3 avant). */
const MAX_ATTEMPTS = 5;

async function findJsonFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await findJsonFiles(full)));
    else if (e.name.endsWith(".json")) out.push(full);
  }
  return out.sort();
}

async function main() {
  console.log(`\n=== IMPORT GÉNÉRATEUR MIX (${APPLY ? "APPLY" : "TEST"}) ===`);
  console.log(`Dossier source : ${SOURCE_DIR}\n`);

  const files = await findJsonFiles(SOURCE_DIR);
  console.log(`${files.length} fichier(s) trouvé(s).`);

  const existingExKeys = await fetchAllTitleKeys("exercises");
  const existingQKeys = await fetchAllTitleKeys("quizzes");
  const exerciseFolders = await loadFolders("exercise_folders");
  const quizFolders = await loadFolders("quiz_folders");

  let exOk = 0, exDup = 0, exFail = 0, qOk = 0, qDup = 0, qFail = 0;

  for (const file of files) {
    const raw = JSON.parse(await readFile(file, "utf8")) as GeneratedExercise | GeneratedQuiz;

    if (raw._kind === "exercise") {
      const key = `${raw.course_id}::${raw.title.toLowerCase().trim()}`;
      if (existingExKeys.has(key)) { exDup++; continue; }
      const { content, warnings } = compileHandAuthoredExercise({ _format: "source", content_json: raw.content_json });
      if (warnings.length) console.log(`⚠️  ${path.basename(file)} :`, warnings.join(" | "));
      if (!content.length) { exFail++; continue; }
      if (APPLY) {
        const courseTitle = await getCourseTitle(raw.course_id);
        const folderId = await resolveCourseFolder("exercise_folders", exerciseFolders, raw.level, courseTitle, raw.course_id);
        const exDescription = raw.description || `Exercice du chapitre « ${courseTitle} ».`;
        const { error } = await supabase.from("exercises").insert({
          title: raw.title,
          question: exDescription,
          description: exDescription,
          course_id: raw.course_id,
          category: raw.category,
          difficulty_level: raw.difficulty_level,
          type: "standard",
          level: raw.level,
          status: "draft",
          is_published: false,
          content_json: content,
          max_attempts: MAX_ATTEMPTS,
          estimated_time: estimateMinutes(
            raw.content_json.reduce(
              (total: number, page: Loose) => total + (page?.blocks?.length ?? 0),
              0,
            ),
          ),
          folder_id: folderId,
        });
        if (error) { console.error(`❌ ${path.basename(file)} : ${error.message}`); exFail++; continue; }
        existingExKeys.add(key);
      }
      exOk++;
    } else if (raw._kind === "quiz") {
      const key = `${raw.course_id}::${raw.title.toLowerCase().trim()}`;
      if (existingQKeys.has(key)) { qDup++; continue; }
      const { content, warnings } = compileHandAuthoredQuiz({ _format: "source", content_json: raw.content_json });
      if (warnings.length) console.log(`⚠️  ${path.basename(file)} :`, warnings.join(" | "));
      if (!content.length) { qFail++; continue; }
      if (APPLY) {
        const courseTitle = await getCourseTitle(raw.course_id);
        const folderId = await resolveCourseFolder("quiz_folders", quizFolders, raw.level, courseTitle, raw.course_id);
        const { error } = await supabase.from("quizzes").insert({
          title: raw.title,
          description: raw.description || `Quiz du chapitre « ${courseTitle} ».`,
          course_id: raw.course_id,
          status: "draft",
          content_json: content,
          type: "standard",
          level: raw.level,
          difficulty_level: raw.difficulty_level,
          max_attempts: MAX_ATTEMPTS,
          grading_type: "auto",
          estimated_time: estimateMinutes(raw.content_json.length),
          folder_id: folderId,
        });
        if (error) { console.error(`❌ ${path.basename(file)} : ${error.message}`); qFail++; continue; }
        existingQKeys.add(key);
      }
      qOk++;
    }
  }

  console.log(`\nExercices : ${exOk} ${APPLY ? "importés" : "prêts"}, ${exDup} déjà présents, ${exFail} échecs`);
  console.log(`Quiz      : ${qOk} ${APPLY ? "importés" : "prêts"}, ${qDup} déjà présents, ${qFail} échecs`);
  if (!APPLY) console.log("\nPour importer réellement : npx tsx --env-file=.env.local scripts/import-generated-mix.ts --apply");
}

main().catch((e) => {
  console.error("💥 IMPORT ARRÊTÉ", e);
  process.exit(1);
});
