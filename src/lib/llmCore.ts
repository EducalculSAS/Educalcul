import { AsyncLocalStorage } from "node:async_hooks";
import type { JsonSchemaContract } from "@/lib/ai/schemas";

/**
 * Educalcul — Couche transport IA via l'API Mistral directe (endpoint régional
 * EU — les données ne quittent jamais l'UE/EEE, voir docs.mistral.ai/studio-api/regional-inference).
 */

export const MISTRAL_URL = "https://api.eu.mistral.ai/v1/chat/completions";

export const MISTRAL_MODEL = process.env.MISTRAL_MODEL || "labs-leanstral-1-5-1";

export const MISTRAL_KEY = process.env.MISTRAL_API_KEY || "";

// Modèle de secours optionnel des échanges en direct (chat, Calia en classe) quand le
// modèle principal répond 429 malgré les nouvelles tentatives. Désactivé par défaut :
// avec la clé actuelle, mistral-small-latest répond lui-même 429 (testé le 2026-10-05).
// À renseigner (MISTRAL_FALLBACK_MODEL) une fois le plan payant activé.
export const MISTRAL_FALLBACK_MODEL = process.env.MISTRAL_FALLBACK_MODEL || "";


// ── Priorité aux échanges en direct ──────────────────────────────────────────
// Un élève qui parle à Calia ou écrit dans le chat doit avoir sa réponse tout de
// suite : ces appels sont marqués « interactifs » (runInteractive). Ils réessaient
// vite sur un 429 puis passent au modèle de secours, et les générations d'arrière-
// plan de la même instance s'effacent le temps qu'ils finissent (yieldToInteractive).
export const interactiveStore = new AsyncLocalStorage<true>();

export let interactiveInFlight = 0;


export function runInteractive<T>(fn: () => Promise<T>): Promise<T> {
  return interactiveStore.run(true, async () => {
    interactiveInFlight += 1;
    try {
      return await fn();
    } finally {
      interactiveInFlight -= 1;
    }
  });
}


/** Les générations d'arrière-plan attendent (4 s au plus) qu'un échange en direct soit terminé. */
export async function yieldToInteractive(maxWaitMs = 4_000): Promise<void> {
  const startedAt = Date.now();
  while (interactiveInFlight > 0 && Date.now() - startedAt < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}


export function retryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  const headerSeconds = Number(retryAfterHeader);
  const base = Number.isFinite(headerSeconds) && headerSeconds > 0 ? headerSeconds * 1_000 : 250 * 2 ** attempt;
  return Math.min(1_500, base) + Math.floor(Math.random() * 150);
}


// Pression de débit : monte à chaque 429 de Mistral, redescend à chaque succès. Les générations d'arrière-plan
// espacent d'autant le démarrage de leurs appels (plan gratuit : on ralentit quand ça sature, on accélère sinon).
export let rateLimitPressureMs = 0;

export function getRateLimitPressureMs(): number {
  return rateLimitPressureMs;
}


/** Attente avant de réessayer un 429 en arrière-plan : Retry-After s'il est donné, sinon 2 s, 4 s, 8 s, 12 s (± aléa). */
export function backgroundRetryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  const headerSeconds = Number(retryAfterHeader);
  const base = Number.isFinite(headerSeconds) && headerSeconds > 0 ? headerSeconds * 1_000 : 2_000 * 2 ** attempt;
  return Math.min(12_000, base) + Math.floor(Math.random() * 400);
}


export type Message = {
  role: "user" | "assistant" | "system";
  content: string | MessageContentPart[];
};

export type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: string };


// ── Mistral (texte) ──────────────────────────────────────────────────────────

/** Le contenu peut être une simple chaîne, ou (reasoning activé) une liste de
 * chunks {type:"thinking"|"text", ...} — on ne garde que le texte final,
 * jamais la trace de raisonnement (pas destinée à être montrée à l'élève). */
export function extractMistralText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const chunks = content.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const maybeType = (item as { type?: unknown }).type;
      if (
        maybeType === "text" &&
        typeof (item as { text?: unknown }).text === "string"
      ) {
        return [(item as { text: string }).text];
      }
      if (
        maybeType === "json" &&
        (item as { json?: unknown }).json !== undefined
      ) {
        const json = (item as { json: unknown }).json;
        return [typeof json === "string" ? json : JSON.stringify(json)];
      }
      return [];
    });
    if (chunks.length) return chunks.join("").trim();
  }
  if (typeof content === "object" && content !== null) {
    if ((content as { json?: unknown }).json !== undefined) {
      const json = (content as { json: unknown }).json;
      return typeof json === "string" ? json : JSON.stringify(json);
    }
  }
  return "";
}


export type MistralResult = { ok: boolean; text: string; status: number; retryAfter?: string | null };


/**
 * Appel Mistral avec gestion du 429. Appel interactif : jusqu'à 3 nouvelles
 * tentatives rapprochées (en respectant Retry-After, plafonné à 1,5 s), puis le
 * modèle de secours. Autre appel : un seul essai ici, les appelants ont leur
 * propre attente plus longue.
 */
export async function callMistralModel(
  model: string,
  msgs: Message[],
  temp: number,
  maxTokens?: number,
  reasoning = false,
  jsonMode = false,
  abortSignal?: AbortSignal,
  jsonSchema?: JsonSchemaContract,
): Promise<MistralResult> {
  let result = await callMistralModelOnce(model, msgs, temp, maxTokens, reasoning, jsonMode, abortSignal, jsonSchema);
  if (result.status !== 429) return result;

  // Génération d'arrière-plan : plusieurs nouvelles tentatives espacées de plus en plus (au lieu d'un échec qui
  // faisait découper la partie en deux, donc doubler les appels).
  if (!interactiveStore.getStore()) {
    for (let attempt = 0; attempt < 4 && result.status === 429; attempt++) {
      if (abortSignal?.aborted) return result;
      await new Promise((resolve) => setTimeout(resolve, backgroundRetryDelayMs(attempt, result.retryAfter ?? null)));
      result = await callMistralModelOnce(model, msgs, temp, maxTokens, reasoning, jsonMode, abortSignal, jsonSchema);
    }
    return result;
  }

  for (let attempt = 0; attempt < 3 && result.status === 429; attempt++) {
    if (abortSignal?.aborted) return result;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt, result.retryAfter ?? null)));
    result = await callMistralModelOnce(model, msgs, temp, maxTokens, reasoning, jsonMode, abortSignal, jsonSchema);
  }
  if (result.status === 429 && MISTRAL_FALLBACK_MODEL && MISTRAL_FALLBACK_MODEL !== model) {
    console.warn(`[llm] ${model} saturé (429), bascule sur ${MISTRAL_FALLBACK_MODEL} pour un échange en direct`);
    result = await callMistralModelOnce(MISTRAL_FALLBACK_MODEL, msgs, temp, maxTokens, reasoning, jsonMode, abortSignal, jsonSchema);
  }
  return result;
}


export async function callMistralModelOnce(
  model: string,
  msgs: Message[],
  temp: number,
  maxTokens?: number,
  reasoning = false,
  jsonMode = false,
  abortSignal?: AbortSignal,
  jsonSchema?: JsonSchemaContract,
): Promise<MistralResult> {
  const body: Record<string, unknown> = {
    model,
    messages: msgs,
    temperature: temp,
  };
  // Le paramètre de raisonnement est propre au modèle principal : le modèle de secours ne le connaît peut-être pas.
  if (model === MISTRAL_MODEL) body.reasoning_effort = reasoning ? "high" : "none";
  if (maxTokens) body.max_tokens = maxTokens;
  // Pour la génération de contenu, le schéma JSON est le contrat unique :
  // le modèle ne peut ni ajouter du HTML ni déplacer les champs
  // mathématiques. À défaut (modèle Labs/Leanstral, ou schéma refusé),
  // json_object garantit au moins un JSON syntaxiquement valide.
  if (jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: jsonSchema.name,
        description: jsonSchema.description,
        schema_definition: jsonSchema.schema,
        strict: true,
      },
    };
  } else if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240_000); // 4 min max

  // If an external abort signal is provided, link it to the local controller
  let externalListener: (() => void) | undefined;
  if (abortSignal) {
    if (abortSignal.aborted) {
      clearTimeout(timeout);
      controller.abort();
    } else {
      externalListener = () => controller.abort();
      abortSignal.addEventListener("abort", externalListener);
    }
  }

  let resp: Response;
  try {
    resp = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    if (abortSignal && externalListener)
      abortSignal.removeEventListener("abort", externalListener);
  }

  const text = await resp.text();
  rateLimitPressureMs = resp.status === 429 ? Math.min(6_000, rateLimitPressureMs + 800) : resp.ok ? Math.max(0, rateLimitPressureMs - 200) : rateLimitPressureMs;
  return { ok: resp.ok, text, status: resp.status, retryAfter: resp.headers.get("retry-after") };
}


export async function callMistral(
  msgs: Message[],
  temp = 0.7,
  maxTokens?: number,
  reasoning = false,
  jsonMode = false,
  abortSignal?: AbortSignal,
): Promise<string> {
  const { ok, text, status } = await callMistralModel(
    MISTRAL_MODEL,
    msgs,
    temp,
    maxTokens,
    reasoning,
    jsonMode,
    abortSignal,
  );

  if (ok) {
    try {
      const parsed = JSON.parse(text);
      const finishReason = parsed?.choices?.[0]?.finish_reason;
      if (finishReason === "length") {
        console.warn(
          `[llm] ${MISTRAL_MODEL} hit max_tokens (maxTokens=${maxTokens})`,
        );
        throw new Error(
          "Réponse IA tronquée (max_tokens atteint), réessaie avec un contenu plus court, ou réessaie simplement.",
        );
      }
      const msg = parsed?.choices?.[0]?.message;
      const content = extractMistralText(msg?.content);
      if (content) return content.trim();
      if (msg?.content && typeof msg.content === "object") {
        return JSON.stringify(msg.content).trim();
      }
      return text.trim();
    } catch (e) {
      if (e instanceof Error && e.message.includes("tronquée")) throw e;
      return text.trim();
    }
  }

  if (status === 429) {
    console.warn(
      `[llm] ${MISTRAL_MODEL} rate-limited, nouvelle tentative dans 1.5s`,
    );
    await new Promise((r) => setTimeout(r, 1500));
    const retry = await callMistralModel(
      MISTRAL_MODEL,
      msgs,
      temp,
      maxTokens,
      reasoning,
      jsonMode,
    );
    if (retry.ok) {
      try {
        const parsed = JSON.parse(retry.text);
        const msg = parsed?.choices?.[0]?.message;
        const content =
          extractMistralText(msg?.content) ||
          (typeof msg?.content === "string" ? msg.content : "");
        if (content) return content.trim();
        return retry.text.trim();
      } catch {
        return retry.text.trim();
      }
    }
    console.error(
      `[llm] ${MISTRAL_MODEL} retry error ${retry.status}: ${retry.text.slice(0, 400)}`,
    );
  }

  console.error(
    `[llm] ${MISTRAL_MODEL} error ${status}: ${text.slice(0, 400)}`,
  );
  throw new Error(
    "Le modèle IA est indisponible. Réessaie dans quelques secondes.",
  );
}


export function dispatch(
  msgs: Message[],
  temp = 0.7,
  maxTokens?: number,
  reasoning = false,
  jsonMode = false,
  abortSignal?: AbortSignal,
) {
  return callMistral(msgs, temp, maxTokens, reasoning, jsonMode, abortSignal);
}


export function normalizeJsonString(raw: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }

    if (escaped) {
      if ('"\\/bfnrtu'.includes(ch)) {
        out += "\\" + ch;
      } else {
        out += "\\\\" + ch;
      }
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = false;
      out += ch;
      continue;
    }

    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") {
      out += "\\r";
      continue;
    }
    if (ch === "\t") {
      out += "\\t";
      continue;
    }

    out += ch;
  }

  if (escaped) out += "\\\\";
  return out;
}


/** Échappe les retours à la ligne / tabulations littéraux à l'intérieur des chaînes JSON */
export function escapeControlCharsInStrings(raw: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of raw) {
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}


/** Échappe les guillemets non-échappés présents à l'intérieur des chaînes JSON
 * (ex: l'IA écrit un texte contenant des `"` littéraux, qui terminent la chaîne
 * prématurément). Heuristique : un `"` n'est considéré comme la fin réelle de
 * la chaîne que s'il est suivi (après espaces) par `,`, `:`, `}`, `]` ou la fin. */
export function escapeUnescapedQuotesInStrings(raw: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < raw.length && /\s/.test(raw[j])) j++;
      const next = raw[j];
      if (
        next === undefined ||
        next === "," ||
        next === ":" ||
        next === "}" ||
        next === "]"
      ) {
        inString = false;
        out += ch;
      } else {
        out += '\\"';
      }
      continue;
    }
    out += ch;
  }
  return out;
}


/** Commandes LaTeX dont le début ressemble à un échappement JSON (tabulation, retour chariot, saut de ligne, saut de page,
 * retour arrière) : sans cette protection, la commande « times » devenait une tabulation suivie de « imes » dans les
 * retours de l'IA. */
export const LATEX_LOOKALIKES = /(?<!\\)\\(times|text|textbf|theta|tan|tau|to|triangle|top|frac|dfrac|tfrac|forall|beta|bar|binom|begin|boldsymbol|bullet|right|rho|rightarrow|neq|ne|nu|nabla|neg|not|notin)(?![A-Za-z])/g;


export function parseJSON(raw: string): unknown {
  raw = raw.replace(LATEX_LOOKALIKES, "\\\\$1");
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(normalizeJsonString(raw));
    } catch {
      try {
        return JSON.parse(raw.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\"));
      } catch {
        try {
          return JSON.parse(escapeControlCharsInStrings(raw));
        } catch {
          try {
            return JSON.parse(
              escapeControlCharsInStrings(
                raw.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\"),
              ),
            );
          } catch {
            try {
              return JSON.parse(
                escapeUnescapedQuotesInStrings(
                  escapeControlCharsInStrings(raw),
                ),
              );
            } catch {
              try {
                return JSON.parse(
                  escapeUnescapedQuotesInStrings(
                    escapeControlCharsInStrings(
                      raw.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\"),
                    ),
                  ),
                );
              } catch (e) {
                throw new Error(
                  `JSON invalide reçu de l'IA : ${(e as Error).message}`,
                );
              }
            }
          }
        }
      }
    }
  }
}


export async function repairStructuredJSON(
  raw: string,
  systemPrompt: string,
  prompt: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const repairSystem = `${systemPrompt}

TU ES UN ASSISTANT JSON.
Ta réponse précédente n'était pas du JSON valide.
Tu dois maintenant renvoyer UNIQUEMENT un OBJET JSON valide, sans texte avant ni après, sans balises markdown, sans explication.
Conserve exactement le même contenu mathématique et les mêmes balises HTML que possible ; corrige seulement l'échappement JSON et les erreurs de format.
Si le texte invalide ne contient pas encore de JSON, reconstruis-le comme un JSON valide correspondant à la demande initiale.`;

  const repairUser = `Demande initiale :
${prompt}

Sortie invalide à corriger :
${raw}

Retourne uniquement le JSON valide correspondant à la demande initiale.`;

  return dispatch(
    [
      { role: "system", content: repairSystem },
      { role: "user", content: repairUser },
    ],
    Math.min(temperature, 0.2),
    maxTokens,
    false,
    true,
  );
}
