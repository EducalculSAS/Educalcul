import { generateStructuredContent } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseClient";

export type GenerateStructured = (
  userPrompt: string,
  systemPrompt: string,
  temperature?: number,
  maxTokens?: number,
  reasoning?: boolean,
) => Promise<unknown>;

export class GenerationCancelledError extends Error {
  constructor() {
    super("Génération annulée par l'utilisateur.");
    this.name = "GenerationCancelledError";
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} a dépassé ${timeoutMs} ms.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Espace uniquement le DÉMARRAGE des requêtes Mistral (voir courses). Partagé
 * par la génération de cours, d'exercices et de quiz — même comportement de
 * throttling/annulation/raisonnement pour tous les types de contenu.
 */
export function createLlmStartGate(
  minIntervalMs: number,
  checkCancelled: () => Promise<boolean>,
): GenerateStructured {
  let queue: Promise<void> = Promise.resolve();
  let lastStartAt = 0;

  return async (userPrompt, systemPrompt, temperature, maxTokens, reasoning = false) => {
    let release!: () => void;
    const previous = queue;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    const elapsed = Date.now() - lastStartAt;
    const waitMs = Math.max(0, minIntervalMs - elapsed);
    if (waitMs > 0) await sleep(waitMs);
    lastStartAt = Date.now();
    release();

    if (await checkCancelled()) {
      throw new GenerationCancelledError();
    }

    return generateStructuredContent(userPrompt, systemPrompt, temperature, maxTokens, reasoning);
  };
}

export const DEFAULT_LLM_MIN_START_INTERVAL_MS = 1700;
// Le raisonnement consomme des tokens de complétion avant la réponse finale —
// marge ajoutée aux budgets des appels qui l'activent (passes de correction).
export const REASONING_TOKEN_BUFFER = 10_000;

type GenerationsTable = "course_generations" | "exercise_generations" | "quiz_generations";

/**
 * Helpers génériques de suivi de progression, paramétrés par table — mêmes
 * garanties (persistance, annulation) pour cours/exercices/quiz.
 */
export function createGenerationTracker(table: GenerationsTable, generationId: string) {
  return {
    async updateProgress(patch: Record<string, unknown>): Promise<void> {
      const { data } = await supabaseAdmin
        .from(table)
        .select("progress")
        .eq("id", generationId)
        .maybeSingle();
      const current = (data?.progress as Record<string, unknown>) || {};
      const merged = {
        ...current,
        ...patch,
        ...(patch.chapters || current.chapters
          ? { chapters: { ...(current.chapters as object || {}), ...(patch.chapters as object || {}) } }
          : {}),
      };
      await supabaseAdmin
        .from(table)
        .update({ progress: merged, updated_at: new Date().toISOString() })
        .eq("id", generationId);
    },

    async setStatus(status: string, extra?: Record<string, unknown>): Promise<void> {
      await supabaseAdmin
        .from(table)
        .update({ status, updated_at: new Date().toISOString(), ...extra })
        .eq("id", generationId);
    },

    async isCancelRequested(): Promise<boolean> {
      const { data } = await supabaseAdmin
        .from(table)
        .select("status")
        .eq("id", generationId)
        .maybeSingle();
      return data?.status === "cancel_requested";
    },
  };
}
