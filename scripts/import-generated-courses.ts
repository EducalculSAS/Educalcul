// Remplace le CONTENU des cours par celui produit par le générateur autonome
// (C:\Users\ruben\educalcul-content-generator, dossier output-courses/).
//
// C'est un UPDATE, jamais un DELETE + INSERT : chaque cours garde son id, son
// titre, son dossier et son niveau, donc les exercices et quiz qui pointent
// vers lui (exercises.course_id, quizzes.course_id) restent rattachés. Seuls
// content_json et estimated_time sont réécrits.
//
// Réutilise compileHandAuthoredCourse, le même compilateur que l'import manuel
// depuis l'admin : même rendu des figures (src/lib/figureCatalog.ts), des
// encadrés et des mini-exercices.
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { compileHandAuthoredCourse } from "../src/lib/ai/handAuthoredContent";

const APPLY = process.argv.includes("--apply");
const SOURCE_DIR =
  process.argv.find((a) => a.startsWith("--dir="))?.slice("--dir=".length) ||
  path.join("C:\\Users\\ruben\\educalcul-content-generator", "output-courses");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL manque dans .env.local");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE manque dans .env.local");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface GeneratedCourse {
  _format?: string;
  course_id: number;
  level: string;
  subject: string;
  title: string;
  estimated_time?: number;
  content_json: unknown[];
}

async function main() {
  const files = (await readdir(SOURCE_DIR)).filter((f) => f.endsWith(".json"));
  console.log(`${files.length} cours à importer depuis ${SOURCE_DIR}\n`);

  let ok = 0;
  let introuvables = 0;
  let echecs = 0;
  let totalWarnings = 0;
  const warningsByKind = new Map<string, number>();

  for (const file of files) {
    let raw: GeneratedCourse;
    try {
      raw = JSON.parse(await readFile(path.join(SOURCE_DIR, file), "utf-8"));
    } catch (e) {
      console.error(`⚠️  ${file} : JSON illisible — ${(e as Error).message}`);
      echecs++;
      continue;
    }

    const { content, warnings } = compileHandAuthoredCourse(raw);
    for (const w of warnings) {
      totalWarnings++;
      // On regroupe par nature plutôt que d'imprimer 756 × n lignes.
      const kind = w.replace(/^.*? : /, "").replace(/"[^"]*"/g, '"…"').slice(0, 90);
      warningsByKind.set(kind, (warningsByKind.get(kind) ?? 0) + 1);
    }

    if (!Array.isArray(content) || content.length === 0) {
      console.error(`⚠️  ${file} : contenu compilé vide — cours ignoré`);
      echecs++;
      continue;
    }

    if (!APPLY) {
      ok++;
      continue;
    }

    const { error, count } = await supabase
      .from("courses")
      .update(
        {
          content_json: content,
          estimated_time: raw.estimated_time ?? null,
          updated_at: new Date().toISOString(),
        },
        { count: "exact" },
      )
      .eq("id", raw.course_id);

    if (error) {
      console.error(`⚠️  #${raw.course_id} : ${error.message}`);
      echecs++;
    } else if (!count) {
      // Un cours supprimé côté site entre la génération et l'import.
      console.error(`⚠️  #${raw.course_id} (${raw.title}) : aucun cours avec cet id`);
      introuvables++;
    } else {
      ok++;
    }
  }

  console.log(`\nCours ${APPLY ? "mis à jour" : "prêts"} : ${ok}`);
  if (introuvables) console.log(`Cours introuvables en base : ${introuvables}`);
  console.log(`Échecs : ${echecs}`);

  if (warningsByKind.size) {
    console.log(`\nAvertissements de compilation (${totalWarnings}) :`);
    for (const [kind, n] of [...warningsByKind.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`  ${String(n).padStart(5)} × ${kind}`);
    }
  }

  if (!APPLY) {
    console.log(`\nPour importer réellement : npx tsx --env-file=.env.local scripts/import-generated-courses.ts --apply`);
  }
}

main();
