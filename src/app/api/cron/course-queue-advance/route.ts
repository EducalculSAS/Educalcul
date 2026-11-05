import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { runCourseGeneration, type CourseGenerationParams } from "@/lib/courseGeneration";

export const maxDuration = 300;

// Chaîne auto-entretenue de génération du catalogue de cours : chaque appel
// traite UN élément de course_generation_queue, puis, une fois terminé (dans
// after(), donc toujours côté Vercel), se rappelle lui-même pour l'élément
// suivant — jusqu'à ce que la file soit vide. Un seul déclenchement manuel
// (POST une fois) suffit à traiter toute la file, sans dépendre du poste qui
// a lancé le premier appel ni d'un script externe qui doit rester ouvert.
const ADMIN_ID = 55; // admin2@educalcul.com (super admin)
const MAX_ATTEMPTS = 2;
const STALE_RUNNING_MINUTES = 12;
const SELF_URL = "https://educalcul.com/api/cron/course-queue-advance";

// Sans Fluid Compute, Vercel peut tuer un after() en plein travail sans
// lever d'erreur (observé en prod : la ligne course_generations reste
// "running" pour toujours, et comme la relance en chaîne se fait dans le
// after() qui vient de mourir, plus rien ne se déclenche — la file entière
// s'arrête silencieusement). On repère et on relibère ces items "running"
// trop vieux à chaque appel, pour que le prochain passage (manuel ou via le
// vrai cron ci-dessous) puisse les reprendre.
async function recoverStale() {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MINUTES * 60 * 1000).toISOString();
  const { data: stale } = await supabaseAdmin
    .from("course_generation_queue")
    .select("id, attempts")
    .eq("status", "running")
    .lt("updated_at", cutoff);

  for (const row of stale || []) {
    const nextAttempts = row.attempts + 1;
    await supabaseAdmin
      .from("course_generation_queue")
      .update({
        status: nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
        attempts: nextAttempts,
        last_error: "Génération interrompue : le processus serveur s'est arrêté avant la fin (redémarrage, délai maximal dépassé, ou plantage).",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
}

async function claimNext() {
  await recoverStale();

  const { data: candidate } = await supabaseAdmin
    .from("course_generation_queue")
    .select("id")
    .or(`status.eq.pending,and(status.eq.failed,attempts.lt.${MAX_ATTEMPTS})`)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!candidate) return null;

  const { data: claimed } = await supabaseAdmin
    .from("course_generation_queue")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", candidate.id)
    .neq("status", "running")
    .select("*")
    .maybeSingle();

  return claimed;
}

async function advanceQueue() {
  try {
    await fetch(SELF_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
  } catch (err) {
    console.error("[course-queue-advance] Échec de l'auto-relance:", err);
  }
}

// GET pour le vrai Vercel Cron (voir vercel.json) — filet de sécurité qui
// relance la chaîne toutes les 5 min si elle s'est arrêtée (voir
// recoverStale ci-dessus). POST pour un déclenchement manuel et pour
// l'auto-relance en chaîne (advanceQueue).
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const item = await claimNext();
  if (!item) {
    console.info("[course-queue-advance] File vide, rien à faire.");
    return NextResponse.json({ done: true });
  }

  // Modèle gratuit + concurrence réduite : voir bulk-generate-course/route.ts
  // pour le détail (labs-leanstral-1-5-1 sature vite en concurrence par défaut).
  process.env.MISTRAL_MODEL = "labs-leanstral-1-5-1";
  process.env.AI_COURSE_WRITER_CONCURRENCY = "1";
  process.env.AI_COURSE_REVIEW_CONCURRENCY = "1";
  process.env.AI_COURSE_LESSON_CONCURRENCY = "1";
  process.env.MISTRAL_MIN_REQUEST_INTERVAL_MS = "7000";

  const params: CourseGenerationParams = {
    grade_level: item.grade_level,
    subject: item.subject,
    additional_info: item.additional_info,
    folder_id: item.folder_id,
    page_count: item.page_count ?? undefined,
    lessons_per_chapter: item.lessons_per_chapter ?? undefined,
  };

  const { data: generation } = await supabaseAdmin
    .from("content_generations")
    .insert({
      kind: "course",
      admin_id: ADMIN_ID,
      status: "pending",
      params,
      progress: { step: "outline", current: 0, total: 4, message: "En attente de démarrage..." },
    })
    .select("id")
    .single();

  after(async () => {
    try {
      if (generation) {
        await runCourseGeneration(generation.id, params, ADMIN_ID);
        const { data: gen2 } = await supabaseAdmin
          .from("content_generations")
          .select("status, error, course_id:target_id")
          .eq("id", generation.id)
          .single();
        if (gen2?.status === "done") {
          await supabaseAdmin
            .from("course_generation_queue")
            .update({ status: "done", course_id: gen2.course_id, last_error: null, updated_at: new Date().toISOString() })
            .eq("id", item.id);
        } else {
          await supabaseAdmin
            .from("course_generation_queue")
            .update({ status: "failed", last_error: gen2?.error || "erreur inconnue", updated_at: new Date().toISOString() })
            .eq("id", item.id);
        }
      } else {
        await supabaseAdmin
          .from("course_generation_queue")
          .update({ status: "failed", last_error: "insertion content_generations échouée", updated_at: new Date().toISOString() })
          .eq("id", item.id);
      }
    } catch (err) {
      console.error("[course-queue-advance] Échec en arrière-plan:", err);
      await supabaseAdmin
        .from("course_generation_queue")
        .update({ status: "failed", last_error: String(err), updated_at: new Date().toISOString() })
        .eq("id", item.id);
    } finally {
      await advanceQueue();
    }
  });

  return NextResponse.json({ started: item.id, grade_level: item.grade_level, subject: item.subject }, { status: 202 });
}
