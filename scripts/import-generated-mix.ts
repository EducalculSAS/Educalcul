// Importe les exercices/quiz produits par le générateur autonome
// (C:\Users\ruben\educalcul-content-generator, séparé de ce repo — voir son
// README) : chaque fichier JSON porte déjà son course_id exact (pas de
// résolution floue par titre, contrairement à scripts/import-exercises-quizzes.ts
// qui traite l'ancien pipeline offline). Réutilise les mêmes compilateurs que
// l'import à la main depuis l'admin (compileHandAuthoredExercise/Quiz), donc
// même comportement pour les figures (src/lib/figureCatalog.ts) et les types
// de blocs/questions (voir src/lib/ai/handAuthoredContent.ts).
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

  const { data: existingEx } = await supabase.from("exercises").select("title,course_id");
  const existingExKeys = new Set((existingEx ?? []).map((r) => `${r.course_id}::${String(r.title).toLowerCase().trim()}`));
  const { data: existingQ } = await supabase.from("quizzes").select("title,course_id");
  const existingQKeys = new Set((existingQ ?? []).map((r) => `${r.course_id}::${String(r.title).toLowerCase().trim()}`));

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
        const { error } = await supabase.from("exercises").insert({
          title: raw.title,
          question: raw.description || "",
          course_id: raw.course_id,
          category: raw.category,
          difficulty_level: raw.difficulty_level,
          type: "standard",
          level: raw.level,
          status: "draft",
          is_published: false,
          content_json: content,
          max_attempts: 3,
          estimated_time: 15,
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
        const { error } = await supabase.from("quizzes").insert({
          title: raw.title,
          description: raw.description || "",
          course_id: raw.course_id,
          status: "draft",
          content_json: content,
          type: "standard",
          level: raw.level,
          difficulty_level: raw.difficulty_level,
          max_attempts: 3,
          grading_type: "auto",
          estimated_time: 15,
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
