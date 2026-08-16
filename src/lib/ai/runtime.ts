import { generateStructuredContentWithSchema } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseClient";
import type { JsonSchemaContract } from "@/lib/ai/schemas";

export type GenerateStructured = <T = unknown>(
  userPrompt: string,
  systemPrompt: string,
  contract: JsonSchemaContract,
  temperature?: number,
  maxTokens?: number,
  reasoning?: boolean,
) => Promise<T>;

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
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(new Error(`${label} a dépassé ${timeoutMs} ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Espace uniquement le démarrage des appels Mistral. Les requêtes déjà
 * lancées restent parallèles. Chaque appel est contraint par un JSON Schema et
 * peut être interrompu immédiatement si l'admin annule la génération.
 */
export function createLlmStartGate(
  minIntervalMs: number,
  checkCancelled: () => Promise<boolean>,
): GenerateStructured {
  let queue: Promise<void> = Promise.resolve();
  let lastStartAt = 0;

  return async <T>(
    userPrompt: string,
    systemPrompt: string,
    contract: JsonSchemaContract,
    temperature = 0.2,
    maxTokens = 8_000,
    reasoning = false,
  ): Promise<T> => {
    let release!: () => void;
    const previous = queue;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    const elapsed = Date.now() - lastStartAt;
    const waitMs = minIntervalMs > 0 ? Math.max(0, minIntervalMs - elapsed) : 0;
    if (waitMs > 0) await sleep(waitMs);
    lastStartAt = Date.now();
    release();

    if (await checkCancelled()) throw new GenerationCancelledError();

    const controller = new AbortController();
    let monitorActive = true;

    // Permet de distinguer une vraie annulation demandée en base
    // d'un abort technique déclenché par le timeout Mistral.
    let abortedByCancellationRequest = false;

    void (async () => {
      try {
        while (monitorActive && !controller.signal.aborted) {
          if (await checkCancelled()) {
            abortedByCancellationRequest = true;
            controller.abort();
            break;
          }

          await sleep(250);
        }
      } catch {
        // L'échec du polling ne doit pas interrompre une génération valide.
      }
    })();

    try {
      const configuredTimeout = Number(process.env.MISTRAL_REQUEST_TIMEOUT_MS);
      const requestTimeoutMs =
        Number.isFinite(configuredTimeout) && configuredTimeout >= 30_000
          ? configuredTimeout
          : 180_000;
      return await withTimeout(
        generateStructuredContentWithSchema<T>(
          userPrompt,
          systemPrompt,
          contract,
          temperature,
          maxTokens,
          reasoning,
          controller.signal,
        ),
        requestTimeoutMs,
        `La requête Mistral (${contract.name})`,
        () => controller.abort(),
      );
    } catch (error) {
      const cancellationWasActuallyRequested =
        abortedByCancellationRequest || (await checkCancelled());

      if (cancellationWasActuallyRequested) {
        throw new GenerationCancelledError();
      }

      // Un AbortError causé par withTimeout est une erreur technique,
      // pas une annulation demandée par l'utilisateur.
      throw error;
    } finally {
      monitorActive = false;
    }
  };
}

export const DEFAULT_LLM_MIN_START_INTERVAL_MS = 1_700;
export const REASONING_TOKEN_BUFFER = 10_000;

export type GenerationsTable =
  | "course_generations"
  | "exercise_generations"
  | "quiz_generations"
  | "scan_runs"
  | "minigame_generations";

/** Une génération "pending"/"running"/"cancel_requested" reste dans cet état
 * pour toujours si le processus serveur qui la faisait avancer meurt avant
 * d'écrire un statut terminal (redémarrage du serveur en dev, dépassement de
 * maxDuration en prod, crash) — rien d'autre ne la fait jamais progresser,
 * puisque c'est justement CE processus qui aurait dû détecter l'annulation
 * ou finir le travail. Plutôt qu'un job de nettoyage à part, chaque route qui
 * LIT ces tables se corrige elle-même : toute ligne active dont `updated_at`
 * n'a pas bougé depuis STALE_MS est considérée morte et reçoit un statut
 * terminal. Un "cancel_requested" mort devient "cancelled" (l'utilisateur
 * avait déjà demandé l'arrêt) ; un "pending"/"running" mort devient "error"
 * (le travail ne s'est jamais terminé). */
const STALE_GENERATION_MS = 3 * 60 * 1000;

export async function reconcileStaleGenerations(table: GenerationsTable): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_GENERATION_MS).toISOString();
  const { data: stale } = await supabaseAdmin
    .from(table)
    .select("id, status")
    .in("status", ["pending", "running", "cancel_requested"])
    .lt("updated_at", cutoff);

  if (!stale || stale.length === 0) return;

  await Promise.all(
    stale.map((row) => {
      const nextStatus = row.status === "cancel_requested" ? "cancelled" : "error";
      const extra =
        nextStatus === "error"
          ? { error: "Génération interrompue : le processus serveur s'est arrêté avant la fin (redémarrage, délai maximal dépassé, ou plantage)." }
          : {};
      return supabaseAdmin
        .from(table)
        .update({ status: nextStatus, updated_at: new Date().toISOString(), ...extra })
        .eq("id", row.id);
    }),
  );
}

export function createGenerationTracker(
  table: GenerationsTable,
  generationId: string,
) {
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
          ? {
              chapters: {
                ...((current.chapters as object) || {}),
                ...((patch.chapters as object) || {}),
              },
            }
          : {}),
      };
      await supabaseAdmin
        .from(table)
        .update({ progress: merged, updated_at: new Date().toISOString() })
        .eq("id", generationId);
    },

    async setStatus(
      status: string,
      extra?: Record<string, unknown>,
    ): Promise<void> {
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
