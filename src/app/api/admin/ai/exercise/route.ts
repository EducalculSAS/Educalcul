import { after } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { requireRole } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { runExerciseGeneration, type ExerciseGenerationParams } from "@/lib/exerciseGeneration";

export const maxDuration = 800;

/**
 * Démarre une génération d'exercice en ARRIÈRE-PLAN (même architecture que
 * les cours) : crée immédiatement une ligne exercise_generations et répond
 * avec son id, puis lance le vrai travail via after() — qui continue même
 * si l'admin quitte la page ou recharge. L'exercice final est inséré
 * directement dans `exercises` par runExerciseGeneration.
 */
export async function POST(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const config = RATE_LIMITS["ai:admin"];
  const rl = await rateLimitWithBackoff(`ai:admin:${ip}`, config.maxAttempts, config.windowMs);
  if (!rl.allowed) {
    return Response.json(
      { error: "Trop de générations IA, réessaie dans quelques minutes." },
      { status: 429 },
    );
  }

  const data = await request.json();
  const { subject, level, difficulty, exerciseType } = data;
  if (!subject || !difficulty || !level || !exerciseType) {
    return Response.json(
      { error: "Champs requis manquants (subject, difficulty, level, exerciseType)" },
      { status: 400 },
    );
  }

  const params: ExerciseGenerationParams = {
    exerciseType: data.exerciseType,
    blockType: data.blockType,
    linkedCourseId: data.linkedCourseId ?? null,
    subject,
    level,
    difficulty,
    questionCount: data.questionCount,
    subjectArea: data.subjectArea,
    instructions: data.instructions,
    folder_id: data.folder_id ?? null,
  };

  const { data: generation, error } = await supabaseAdmin
    .from("content_generations")
    .insert({
      kind: "exercise",
      admin_id: admin.id,
      status: "pending",
      params,
      progress: {
        step: "outline",
        current: 0,
        total: Math.ceil((Number(params.questionCount) || 5) / 3),
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
      await runExerciseGeneration(generationId, params, admin.id);
    } catch (err) {
      console.error("[exercise-ai] Échec inattendu en arrière-plan:", err);
    }
  });

  return Response.json({ generationId }, { status: 202 });
}
