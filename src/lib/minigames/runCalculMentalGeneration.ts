import {
  createGenerationTracker,
  createLlmStartGate,
  GenerationCancelledError,
  DEFAULT_LLM_MIN_START_INTERVAL_MS,
} from "@/lib/ai/runtime";
import { calculMentalQuestionsSchema } from "@/lib/ai/schemas";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getCalculMentalRule, buildCalculMentalSystemPrompt } from "@/lib/minigames/calculMentalRules";

export interface CalculMentalGenerationParams {
  levelCode: string;
  questionCount?: number;
}

interface RawQuestion {
  prompt: string;
  answer: number;
}

/** Génère une fiche de calcul mental pour un niveau donné, en tâche de fond
 * — même patron que runScan.ts (scanner) / runQuizGeneration : un seul appel
 * IA suffit ici (pas besoin de batcher, le volume par fiche reste modeste). */
export async function runCalculMentalGeneration(
  generationId: string,
  params: CalculMentalGenerationParams,
): Promise<void> {
  const tracker = createGenerationTracker("minigame_generations", generationId);
  const rule = getCalculMentalRule(params.levelCode);

  if (!rule) {
    await tracker.setStatus("error", { error: "Niveau inconnu." });
    return;
  }

  const count = Math.min(50, Math.max(5, Number(params.questionCount) || 20));

  try {
    await tracker.setStatus("running");
    await tracker.updateProgress({ message: `Génération de ${count} questions pour ${rule.label}...` });

    const generate = createLlmStartGate(DEFAULT_LLM_MIN_START_INTERVAL_MS, () => tracker.isCancelRequested());

    const result = await generate<{ questions: RawQuestion[] }>(
      `Génère exactement ${count} questions de calcul mental pour le niveau ${rule.label}.`,
      buildCalculMentalSystemPrompt(rule),
      calculMentalQuestionsSchema(count),
      0.4,
    );

    const questions = (result.questions || []).filter(
      (q) => q && typeof q.prompt === "string" && q.prompt.trim().length > 0 && Number.isFinite(q.answer),
    );

    if (questions.length === 0) {
      await tracker.setStatus("error", { error: "Aucune question valide générée." });
      return;
    }

    await tracker.setStatus("done", {
      result_json: { levelCode: rule.code, levelLabel: rule.label, questions },
      progress: { message: `${questions.length} question(s) générée(s).` },
    });
  } catch (err) {
    if (err instanceof GenerationCancelledError) {
      await tracker.setStatus("cancelled");
      return;
    }
    console.error("[minigames] Échec génération calcul mental:", err);
    await tracker.setStatus("error", { error: err instanceof Error ? err.message : "Erreur inconnue" });
  }
}

/** Publie une fiche générée (déjà relue par l'admin) — la rend disponible
 * aux enfants du niveau correspondant. */
export async function publishCalculMentalGeneration(generationId: string): Promise<{ error?: string }> {
  const { data, error } = await supabaseAdmin
    .from("minigame_generations")
    .select("status")
    .eq("id", generationId)
    .maybeSingle();

  if (error || !data) return { error: "Génération introuvable." };
  if (data.status !== "done") return { error: "Seule une génération terminée peut être publiée." };

  const { error: updateError } = await supabaseAdmin
    .from("minigame_generations")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", generationId);

  return updateError ? { error: updateError.message } : {};
}
