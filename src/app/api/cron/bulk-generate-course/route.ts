import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { runCourseGeneration, type CourseGenerationParams } from "@/lib/courseGeneration";

export const maxDuration = 800;

// Déclenché manuellement (pas par Vercel Cron) pour la génération en masse
// du catalogue de cours — même garde CRON_SECRET que les routes cron, pour
// pouvoir lancer chaque cours par un simple curl sans session admin/2FA.
// Un cours par appel : la génération réelle tourne via after() sur
// l'infrastructure Vercel, indépendamment du poste qui a déclenché l'appel.
const ADMIN_ID = 55; // admin2@educalcul.com (super admin), attribution des course_generations

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Modèle gratuit (labs-leanstral-1-5) — l'abonnement Mistral est sur le
  // plan gratuit et mistral-medium-latest y est saturé (429 permanent),
  // bloquant toute génération de cours tant que le plan n'est pas mis à
  // niveau. Reste actif pour tout le conteneur tant qu'il est chaud.
  process.env.MISTRAL_MODEL = "labs-leanstral-1-5";
  // Concurrence par défaut (6 rédacteurs + 6 relecteurs, voir
  // courseGeneration.ts) sature quand même labs-leanstral-1-5 dès que
  // plusieurs cours tournent en parallèle sur des instances Vercel
  // distinctes — observé en prod : la quasi-totalité des leçons échouait
  // même en tirant seulement 2 cours à 90s d'écart. Ramené au réglage qui a
  // fonctionné de façon fiable en local (1 requête à la fois, 7s d'écart).
  process.env.AI_COURSE_WRITER_CONCURRENCY = "1";
  process.env.AI_COURSE_REVIEW_CONCURRENCY = "1";
  process.env.AI_COURSE_LESSON_CONCURRENCY = "1";
  process.env.MISTRAL_MIN_REQUEST_INTERVAL_MS = "7000";

  const body = await req.json().catch(() => ({}));
  const { grade_level, subject, additional_info, folder_id } = body;
  if (!grade_level || !subject) {
    return NextResponse.json({ error: "grade_level et subject requis" }, { status: 400 });
  }

  const params: CourseGenerationParams = { grade_level, subject, additional_info, folder_id: folder_id ?? null };

  const { data: generation, error } = await supabaseAdmin
    .from("course_generations")
    .insert({
      admin_id: ADMIN_ID,
      status: "pending",
      params,
      progress: { step: "outline", current: 0, total: 4, message: "En attente de démarrage..." },
    })
    .select("id")
    .single();

  if (error || !generation) {
    return NextResponse.json({ error: error?.message || "Impossible de démarrer la génération." }, { status: 500 });
  }

  const generationId = generation.id as string;

  after(async () => {
    try {
      await runCourseGeneration(generationId, params, ADMIN_ID);
    } catch (err) {
      console.error("[bulk-generate-course] Échec en arrière-plan:", err);
    }
  });

  return NextResponse.json({ generationId }, { status: 202 });
}
