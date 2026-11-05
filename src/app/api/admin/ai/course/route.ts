import { getClientIp } from "@/lib/apiAuth";
import { after } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { requireRole } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { runCourseGeneration, type CourseGenerationParams } from "@/lib/courseGeneration";

// Plafond de sécurité uniquement ; il ne ralentit pas la génération, il
// coupe seulement la requête si elle dépasse cette durée. La génération
// réelle tourne via after() après la réponse HTTP — ce plafond couvre la
// fenêtre pendant laquelle Vercel maintient encore la fonction active pour
// le travail en arrière-plan. Relevé à 800s (nécessite Fluid Compute sur
// Pro/Enterprise ; sinon Vercel plafonne silencieusement à sa propre limite).
export const maxDuration = 300;

/**
 * Démarre une génération de cours en ARRIÈRE-PLAN : crée immédiatement une
 * ligne course_generations et répond avec son id, puis lance le vrai travail
 * via after() — qui continue même si l'admin quitte la page ou recharge.
 * Plus de flux SSE, plus d'étape de validation manuelle : le cours final est
 * inséré directement dans `courses` par runCourseGeneration.
 */
export async function POST(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(request);
  const config = RATE_LIMITS["ai:admin"];
  const rl = await rateLimitWithBackoff(
    `ai:admin:${ip}`,
    config.maxAttempts,
    config.windowMs,
  );
  if (!rl.allowed) {
    return Response.json(
      { error: "Trop de générations IA, réessaie dans quelques minutes." },
      { status: 429 },
    );
  }

  const data = await request.json();
  const { grade_level, subject } = data;
  if (!grade_level || !subject) {
    return Response.json(
      { success: false, message: "Le niveau et le sujet sont requis" },
      { status: 400 },
    );
  }

  const params: CourseGenerationParams = {
    grade_level,
    subject,
    additional_info: data.additional_info,
    page_count: data.page_count,
    lessons_per_chapter: data.lessons_per_chapter,
    content_style: data.content_style,
    include_exercises: data.include_exercises,
    language_level: data.language_level,
    subject_area: data.subject_area,
    duration_per_lesson: data.duration_per_lesson,
    difficulty: data.difficulty,
    quality_mode: data.quality_mode,
    folder_id: data.folder_id ?? null,
  };

  const { data: generation, error } = await supabaseAdmin
    .from("content_generations")
    .insert({
      kind: "course",
      admin_id: admin.id,
      status: "pending",
      params,
      progress: {
        step: "outline",
        current: 0,
        total: Number(params.page_count) || 4,
        message: "En attente de démarrage...",
      },
    })
    .select("id")
    .single();

  if (error || !generation) {
    return Response.json(
      { error: sanitizeErrorMessage(error?.message || "Impossible de démarrer la génération.") },
      { status: 500 },
    );
  }

  const generationId = generation.id as string;

  after(async () => {
    try {
      await runCourseGeneration(generationId, params, admin.id);
    } catch (err) {
      console.error("[course-ai] Échec inattendu en arrière-plan:", err);
    }
  });

  return Response.json({ generationId }, { status: 202 });
}
