// One-off : comble folder_id=NULL sur les exercices/quiz déjà importés par
// scripts/import-generated-mix.ts avant que celui-ci ne sache résoudre les
// dossiers (bug corrigé le 2026-09-21 — voir son commentaire en tête de
// fichier). Ne touche PAS aux lignes qui ont déjà un folder_id.
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL manque dans .env.local");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE manque dans .env.local");

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

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

const folderCache = new Map<string, number>();

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

  const existing = folders.find((f) => f.parent_id === root.id && normalizeText(f.name) === normalizeText(courseTitle));
  if (existing) {
    folderCache.set(key, existing.id);
    return existing.id;
  }

  if (!APPLY) return -1;

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

async function fetchAllNullFolder(table: "exercises" | "quizzes"): Promise<{ id: number; course_id: number; level: string }[]> {
  const out: { id: number; course_id: number; level: string }[] = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("id,course_id,level")
      .is("folder_id", null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...((data ?? []) as { id: number; course_id: number; level: string }[]));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function fetchCourseTitles(courseIds: number[]): Promise<Map<number, string>> {
  const uniqueIds = [...new Set(courseIds)];
  const map = new Map<number, string>();
  const chunkSize = 500;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const { data, error } = await supabase.from("courses").select("id,title").in("id", chunk);
    if (error) throw error;
    for (const row of data ?? []) map.set(row.id as number, row.title as string);
  }
  return map;
}

async function backfill(table: "exercises" | "quizzes", folderTable: "exercise_folders" | "quiz_folders") {
  const rows = await fetchAllNullFolder(table);
  console.log(`${table} : ${rows.length} ligne(s) sans folder_id.`);
  if (rows.length === 0) return { updated: 0, skippedNoRoot: 0, failed: 0 };

  const folders = await loadFolders(folderTable);
  const courseTitles = await fetchCourseTitles(rows.map((r) => r.course_id));

  let updated = 0, skippedNoRoot = 0, failed = 0;
  for (const row of rows) {
    const courseTitle = courseTitles.get(row.course_id);
    if (!courseTitle) {
      console.error(`❌ ${table}#${row.id} : cours introuvable pour course_id=${row.course_id}`);
      failed++;
      continue;
    }
    const folderId = await resolveCourseFolder(folderTable, folders, row.level, courseTitle);
    if (folderId === null) {
      console.error(`⚠️  ${table}#${row.id} : aucun dossier racine pour le niveau "${row.level}"`);
      skippedNoRoot++;
      continue;
    }
    if (APPLY) {
      const { error } = await supabase.from(table).update({ folder_id: folderId }).eq("id", row.id);
      if (error) {
        console.error(`❌ ${table}#${row.id} : ${error.message}`);
        failed++;
        continue;
      }
    }
    updated++;
  }
  return { updated, skippedNoRoot, failed };
}

async function main() {
  console.log(`\n=== BACKFILL folder_id (${APPLY ? "APPLY" : "TEST"}) ===\n`);
  const exResult = await backfill("exercises", "exercise_folders");
  const qResult = await backfill("quizzes", "quiz_folders");
  console.log(`\nExercices : ${exResult.updated} ${APPLY ? "mis à jour" : "prêts"}, ${exResult.skippedNoRoot} sans dossier racine, ${exResult.failed} échecs`);
  console.log(`Quiz      : ${qResult.updated} ${APPLY ? "mis à jour" : "prêts"}, ${qResult.skippedNoRoot} sans dossier racine, ${qResult.failed} échecs`);
  if (!APPLY) console.log("\nPour appliquer réellement : npx tsx --env-file=.env.local scripts/backfill-folder-ids.ts --apply");
}

main().catch((e) => {
  console.error("💥 BACKFILL ARRÊTÉ", e);
  process.exit(1);
});
