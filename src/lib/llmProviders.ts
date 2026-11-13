import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Aiguillage gratuit pour la génération de contenu : gpt-oss-120b (bon en calcul et en raisonnement) chez Cerebras puis
 * Groq (offres gratuites), compatibles OpenAI. Quand l'un atteint son quota (429, quota du jour, requête trop
 * grosse), on passe au suivant ; quand tous sont indisponibles, l'appelant retombe sur Mistral. Seuls les fournisseurs
 * dont la clé est renseignée (variables d'environnement Vercel) sont utilisés.
 */

export interface RoutedProvider {
  id: string;
  url: string;
  key: string;
  model: string;
  /** Le fournisseur accepte response_format json_object. */
  jsonObject: boolean;
}

const CANDIDATES: { id: string; url: string; keyEnv: string; modelEnv: string; model: string; jsonObject: boolean }[] = [
  { id: "cerebras", url: "https://api.cerebras.ai/v1/chat/completions", keyEnv: "CEREBRAS_API_KEY", modelEnv: "CEREBRAS_MODEL", model: "gpt-oss-120b", jsonObject: true },
  { id: "groq", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY", modelEnv: "GROQ_MODEL", model: "openai/gpt-oss-120b", jsonObject: true },
  // NVIDIA NIM écarté (novembre 2026) : gpt-oss-120b retiré, autres modèles en délai dépassé ou introuvables.
];

export function configuredProviders(env: Record<string, string | undefined> = process.env): RoutedProvider[] {
  return CANDIDATES.flatMap((c) => {
    const key = env[c.keyEnv]?.trim();
    if (!key) return [];
    return [{ id: c.id, url: c.url, key, model: env[c.modelEnv]?.trim() || c.model, jsonObject: c.jsonObject }];
  });
}

export function hasRoutedProviders(): boolean {
  return configuredProviders().length > 0;
}

/** Active l'aiguillage pour tous les appels IA faits pendant `fn` (génération d'exercices, relecture). */
const routeStore = new AsyncLocalStorage<true>();
export function withProviderRoute<T>(fn: () => Promise<T>): Promise<T> {
  return routeStore.run(true, fn);
}
export function providerRouteActive(): boolean {
  return routeStore.getStore() === true && hasRoutedProviders();
}

/** Fournisseur saturé → indisponible jusqu'à cette date (par instance serveur). */
const blockedUntil = new Map<string, number>();

/** Durée de mise à l'écart après un refus : Retry-After s'il est donné, une heure pour un quota du jour. */
export function cooldownMs(status: number, body: string, retryAfter: string | null): number {
  const header = Number(retryAfter);
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1_000, 6 * 3_600_000);
  if (status === 429 && /per day|daily|\bTPD\b|\bRPD\b|quota/i.test(body)) return 3_600_000;
  if (status === 429) return 60_000;
  return 30_000;
}

export type RoutedResult = { ok: boolean; text: string; status: number; retryAfter?: string | null; provider?: string };

export async function callRoutedProviders(
  messages: unknown[],
  opts: { temperature: number; maxTokens?: number; reasoning: boolean; jsonMode: boolean; signal: AbortSignal },
): Promise<RoutedResult | null> {
  const now = Date.now();
  for (const p of configuredProviders()) {
    if ((blockedUntil.get(p.id) ?? 0) > now) continue;
    // gpt-oss raisonne avant de répondre : son raisonnement compte dans max_tokens, d'où la marge.
    const body: Record<string, unknown> = {
      model: p.model,
      messages,
      temperature: opts.temperature,
      reasoning_effort: opts.reasoning ? "high" : "medium",
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens + (opts.reasoning ? 12_000 : 6_000) } : {}),
    };
    if (opts.jsonMode && p.jsonObject) body.response_format = { type: "json_object" };
    let resp: Response;
    try {
      resp = await fetch(p.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (err) {
      if (opts.signal.aborted) throw err;
      blockedUntil.set(p.id, Date.now() + 30_000);
      continue;
    }
    const text = await resp.text();
    if (resp.ok) {
      // Réponse sans contenu (raisonnement seul, coupé par max_tokens) : on tente le fournisseur suivant.
      try {
        const parsed = JSON.parse(text) as { choices?: { message?: { content?: unknown } }[] };
        const content = parsed.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim()) return { ok: true, text, status: resp.status, provider: p.id };
      } catch { /* réponse illisible : fournisseur suivant */ }
      continue;
    }
    // Trop gros pour ce fournisseur (413), quota (429) ou panne (5xx) : fournisseur suivant.
    if (resp.status === 413) continue;
    if (resp.status === 429 || resp.status >= 500) {
      blockedUntil.set(p.id, Date.now() + cooldownMs(resp.status, text, resp.headers.get("retry-after")));
      continue;
    }
    // Clé refusée : on écarte le fournisseur pour une heure et on le signale dans les journaux.
    if (resp.status === 401 || resp.status === 403) {
      console.error(`[llm-route] ${p.id} : clé refusée (${resp.status})`);
      blockedUntil.set(p.id, Date.now() + 3_600_000);
      continue;
    }
    console.warn(`[llm-route] ${p.id} erreur ${resp.status} : ${text.slice(0, 300)}`);
    blockedUntil.set(p.id, Date.now() + 30_000);
  }
  return null;
}
