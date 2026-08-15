import { after } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { requireRole } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { runCalculMentalGeneration, type CalculMentalGenerationParams } from "@/lib/minigames/runCalculMentalGeneration";
import { getCalculMentalRule } from "@/lib/minigames/calculMentalRules";

export const maxDuration = 800;

// Seul "calcul_mental" est branché pour l'instant — les futurs types de
// mini-jeux générés (énigmes, suites, langues) suivront le même patron,
// avec leur propre orchestrateur dans src/lib/minigames/.
const RUNNERS: Record<string, (id: string, params: any) => Promise<void>> = {
  calcul_mental: runCalculMentalGeneration,
};

export async function GET(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("minigame_generations")
    .select("id, game_type, status, progress, params, error, created_at")
    .eq("admin_id", admin.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return Response.json({ generations: data || [] });
}

export async function POST(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const config = RATE_LIMITS["ai:admin"];
  const rl = await rateLimitWithBackoff(`ai:admin:${ip}`, config.maxAttempts, config.windowMs);
  if (!rl.allowed) {
    return Response.json({ error: "Trop de générations IA, réessaie dans quelques minutes." }, { status: 429 });
  }

  const data = await request.json();
  const gameType = data.gameType as string;
  const runner = RUNNERS[gameType];
  if (!runner) {
    return Response.json({ error: "Type de mini-jeu inconnu ou non générable par IA." }, { status: 400 });
  }

  if (gameType === "calcul_mental") {
    if (!getCalculMentalRule(data.levelCode)) {
      return Response.json({ error: "Niveau inconnu." }, { status: 400 });
    }
  }

  const params: CalculMentalGenerationParams = { levelCode: data.levelCode, questionCount: data.questionCount };

  const { data: generation, error } = await supabaseAdmin
    .from("minigame_generations")
    .insert({
      admin_id: admin.id,
      game_type: gameType,
      params,
      status: "pending",
      progress: { message: "En attente de démarrage..." },
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
      await runner(generationId, params);
    } catch (err) {
      console.error("[minigames-ai] Échec inattendu en arrière-plan:", err);
    }
  });

  return Response.json({ generationId }, { status: 202 });
}
