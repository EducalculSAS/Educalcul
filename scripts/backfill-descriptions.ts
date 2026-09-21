// One-off : renseigne une description mentionnant le cours pour les
// exercices/quiz déjà importés dont la carte admin affiche "Aucune
// description" (exercises.question / quizzes.description jamais remplis par
// le générateur). Ne touche que les lignes vides — jamais un texte déjà
// écrit à la main.
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL manque dans .env.local");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE manque dans .env.local");

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function fetchRows(table: "exercises" | "quizzes", emptyField: string): Promise<{ id: number; course_id: number }[]> {
  const out: { id: number; course_id: number }[] = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(`id,course_id,${emptyField}`)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const row of (data ?? []) as any[]) {
      const value = row[emptyField];
      if (value === null || value === undefined || String(value).trim() === "") {
        out.push({ id: row.id, course_id: row.course_id });
      }
    }
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

async function backfillExercises() {
  const rows = await fetchRows("exercises", "question");
  console.log(`exercises : ${rows.length} ligne(s) sans question/description.`);
  if (rows.length === 0) return { updated: 0, failed: 0 };

  const courseTitles = await fetchCourseTitles(rows.map((r) => r.course_id));
  let updated = 0, failed = 0;
  for (const row of rows) {
    const title = courseTitles.get(row.course_id);
    if (!title) {
      console.error(`❌ exercises#${row.id} : cours introuvable pour course_id=${row.course_id}`);
      failed++;
      continue;
    }
    const text = `Exercice du chapitre « ${title} ».`;
    if (APPLY) {
      const { error } = await supabase.from("exercises").update({ question: text, description: text }).eq("id", row.id);
      if (error) {
        console.error(`❌ exercises#${row.id} : ${error.message}`);
        failed++;
        continue;
      }
    }
    updated++;
  }
  return { updated, failed };
}

async function backfillQuizzes() {
  const rows = await fetchRows("quizzes", "description");
  console.log(`quizzes : ${rows.length} ligne(s) sans description.`);
  if (rows.length === 0) return { updated: 0, failed: 0 };

  const courseTitles = await fetchCourseTitles(rows.map((r) => r.course_id));
  let updated = 0, failed = 0;
  for (const row of rows) {
    const title = courseTitles.get(row.course_id);
    if (!title) {
      console.error(`❌ quizzes#${row.id} : cours introuvable pour course_id=${row.course_id}`);
      failed++;
      continue;
    }
    const text = `Quiz du chapitre « ${title} ».`;
    if (APPLY) {
      const { error } = await supabase.from("quizzes").update({ description: text }).eq("id", row.id);
      if (error) {
        console.error(`❌ quizzes#${row.id} : ${error.message}`);
        failed++;
        continue;
      }
    }
    updated++;
  }
  return { updated, failed };
}

async function main() {
  console.log(`\n=== BACKFILL descriptions (${APPLY ? "APPLY" : "TEST"}) ===\n`);
  const exResult = await backfillExercises();
  const qResult = await backfillQuizzes();
  console.log(`\nExercices : ${exResult.updated} ${APPLY ? "mis à jour" : "prêts"}, ${exResult.failed} échecs`);
  console.log(`Quiz      : ${qResult.updated} ${APPLY ? "mis à jour" : "prêts"}, ${qResult.failed} échecs`);
  if (!APPLY) console.log("\nPour appliquer réellement : npx tsx --env-file=.env.local scripts/backfill-descriptions.ts --apply");
}

main().catch((e) => {
  console.error("💥 BACKFILL ARRÊTÉ", e);
  process.exit(1);
});
