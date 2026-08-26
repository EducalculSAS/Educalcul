import { createClient } from "@supabase/supabase-js";
import {
  compileStructuredCourseChapter,
  type CompiledCourseChapter,
} from "../src/lib/ai/compiler";
import {
  normalizeStructuredCourseChapter,
  type StructuredCourseChapter,
} from "../src/lib/ai/structuredContent";

const APPLY = process.argv.includes("--apply");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL manque dans .env.local");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE manque dans .env.local");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isAlreadyCompiled(chapter: any): boolean {
  const lessons = chapter?.lessons;
  if (!Array.isArray(lessons) || lessons.length === 0) return false;
  return lessons.every((l: any) => typeof l?.content === "string" && !Array.isArray(l?.blocks));
}

async function main() {
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, slug, title, level, content_json")
    .order("id");
  if (error) throw error;
  if (!courses) throw new Error("Aucun cours retourne");

  let toFix = 0;
  let alreadyOk = 0;
  let failed = 0;
  const failures: { id: number; title: string; error: string }[] = [];

  for (const course of courses) {
    const rawChapters = course.content_json as any[] | null;
    if (!rawChapters || rawChapters.length === 0) continue;
    const rawChapter = rawChapters[0];

    if (isAlreadyCompiled(rawChapter)) {
      alreadyOk++;
      continue;
    }

    toFix++;
    try {
      const rawLessonCount = Array.isArray(rawChapter?.lessons) ? rawChapter.lessons.length : 0;
      const normalized: StructuredCourseChapter = normalizeStructuredCourseChapter(rawChapter, {
        expectedLessonCount: rawLessonCount,
        durationPerLesson: 12,
        includeExercises: true,
        maxExercisesPerLesson: 10,
      });
      const compiled: CompiledCourseChapter = compileStructuredCourseChapter(normalized, {
        chapterIndex: 0,
        durationPerLesson: 12,
      });
      // Restaure la duree d'origine de chaque lecon (le compilateur applique
      // sinon la meme duree uniforme a toutes les lecons du chapitre).
      compiled.lessons.forEach((lesson, i) => {
        const originalDuration = rawChapter.lessons?.[i]?.duration;
        if (typeof originalDuration === "number") lesson.duration = originalDuration;
      });

      if (APPLY) {
        const { error: updateError } = await supabase
          .from("courses")
          .update({ content_json: [compiled] })
          .eq("id", course.id);
        if (updateError) throw updateError;
      }
      console.log(`${APPLY ? "OK" : "DRY"} [${course.level}] ${course.id} ${course.title}`);
    } catch (e: any) {
      failed++;
      failures.push({ id: course.id, title: course.title, error: String(e?.message || e) });
      console.log(`ERREUR [${course.level}] ${course.id} ${course.title}: ${e?.message || e}`);
    }
  }

  console.log("\n=== RESUME ===");
  console.log("total cours:", courses.length);
  console.log("deja compiles:", alreadyOk);
  console.log("a corriger:", toFix);
  console.log("echecs:", failed);
  if (!APPLY) console.log("\n(mode simulation, relance avec --apply pour ecrire en base)");
  if (failures.length) {
    console.log("\nDetail des echecs:");
    failures.forEach((f) => console.log(`  - [${f.id}] ${f.title}: ${f.error}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
