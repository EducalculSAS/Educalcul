/**
 * Educalcul — Couche transport IA via OpenRouter
 */

const OR_URL      = "https://openrouter.ai/api/v1/chat/completions";
const OR_MODEL    = process.env.OPENROUTER_MODEL   || "deepseek/deepseek-chat";
const OR_FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "deepseek/deepseek-chat-v3-0324";
const OR_KEY      = process.env.OPENROUTER_API_KEY || "";

type Message = { role: "user" | "assistant" | "system"; content: string };

// ── Providers ─────────────────────────────────────────────────────────────────

// Modèles de fallback si le principal est rate-limité (dans l'ordre de préférence)
const FALLBACK_MODELS = [
  OR_MODEL,
  OR_FALLBACK_MODEL,
  "deepseek/deepseek-chat",
];

async function callOpenRouterModel(
  model: string, msgs: Message[], temp: number, maxTokens?: number, reasoning = false
): Promise<{ ok: boolean; text: string; status: number }> {
  const body: any = { model, messages: msgs, temperature: temp };
  if (maxTokens) body.max_tokens = maxTokens;
  // Reasoning seulement pour la génération de contenu, jamais pour le chat
  if (reasoning) body.reasoning = { enabled: true };

  const resp = await fetch(OR_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${OR_KEY}`,
      "HTTP-Referer":  "https://educalcul.fr",
      "X-Title":       "Educalcul",
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  return { ok: resp.ok, text, status: resp.status };
}

async function callOpenRouter(
  msgs: Message[], temp = 0.7, maxTokens?: number, reasoning = false
): Promise<string> {
  const rateLimited: string[] = [];

  async function tryModel(model: string): Promise<string | null> {
    const { ok, text, status } = await callOpenRouterModel(model, msgs, temp, maxTokens, reasoning);

    if (ok) {
      try {
        const parsed = JSON.parse(text);
        const msg = parsed?.choices?.[0]?.message;
        const content = msg?.content ?? msg?.reasoning ?? parsed?.choices?.[0]?.text ?? null;
        if (content) return content.trim();
        const finishReason = parsed?.choices?.[0]?.finish_reason;
        if (finishReason === "length") { console.warn(`[llm] ${model} hit max_tokens`); return null; }
        return text.trim();
      } catch { return text.trim(); }
    }

    if (status === 429 || status === 503) {
      console.warn(`[llm] ${model} rate-limited (${status}), queued for retry`);
      rateLimited.push(model);
      return null;
    }

    console.error(`[llm] ${model} error ${status}: ${text.slice(0, 400)}`);
    return null;
  }

  // 1ère passe : tous les modèles
  for (const model of FALLBACK_MODELS) {
    const result = await tryModel(model);
    if (result) return result;
  }

  // 2ème passe : retenter les modèles rate-limités avec un court délai
  if (rateLimited.length > 0) {
    await new Promise(r => setTimeout(r, 1500));
    for (const model of rateLimited) {
      console.log(`[llm] retrying rate-limited model: ${model}`);
      const result = await tryModel(model);
      if (result) return result;
    }
  }

  throw new Error("Tous les modèles IA sont indisponibles. Réessaie dans quelques secondes.");
}

function dispatch(msgs: Message[], temp = 0.7, maxTokens?: number, reasoning = false) {
  return callOpenRouter(msgs, temp, maxTokens, reasoning);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (block) return block[1];
  const obj = text.match(/\{[\s\S]*\}/);
  return obj ? obj[0] : text;
}

function parseJSON(raw: string): unknown {
  try { return JSON.parse(raw); }
  catch {
    try { return JSON.parse(raw.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\")); }
    catch (e) { throw new Error(`JSON invalide reçu de l'IA : ${(e as Error).message}`); }
  }
}

// ── Exports publics ───────────────────────────────────────────────────────────

/** Corriger une réponse élève */
export async function gradeAnswer(
  question: string, correctAnswer: string, studentAnswer: string,
  explanation: string | undefined, level: string, maxPoints: number
): Promise<{ is_correct: boolean; score: number; feedback: string }> {
  const system = `Tu es un professeur de mathématiques pour le niveau "${level || "6ème"}".
RÈGLES pour le feedback :
1. Adapte ton vocabulaire au niveau de l'élève.
2. Si correct : félicite brièvement et confirme la bonne réponse.
3. Si incorrect : donne OBLIGATOIREMENT la réponse correcte avec les calculs détaillés étape par étape.
4. Montre TOUJOURS la méthode ET le résultat final, pas seulement l'un des deux.
5. Sois encourageant même en cas d'erreur.
6. Réponds UNIQUEMENT en JSON sur une seule ligne.
7. score = 0 si incorrect, ${maxPoints} si correct.`;

  const user = `Question : ${question}\nRéponse attendue : ${correctAnswer}\nExplication : ${explanation || "Aucune"}\nRéponse élève : ${studentAnswer}\n→ {"is_correct":bool,"score":number,"feedback":"..."}`;
  const text = await dispatch([{ role: "system", content: system }, { role: "user", content: user }], 0.3, undefined, false);
  const r = parseJSON(extractJSON(text)) as any;
  return { is_correct: r.is_correct === true, score: r.score || 0, feedback: r.feedback || "Pas de feedback" };
}

/** Générer un cours/exercice/quiz structuré → JSON parsé (reasoning activé) */
export async function generateStructuredContent(
  prompt: string, systemPrompt: string, temperature = 0.7
): Promise<unknown> {
  const text = await dispatch(
    [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
    temperature,
    8000,
    true  // ← reasoning activé : meilleure qualité pédagogique, structure logique
  );
  return parseJSON(extractJSON(text));
}

/** Chatbot tuteur IA — reasoning DÉSACTIVÉ pour la rapidité */
export async function chatWithAI(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string,
  temperature = 0.65,
  maxTokens = 700
): Promise<string> {
  return (await dispatch(
    [{ role: "system", content: systemPrompt }, ...messages.map(m => ({ role: m.role as "user"|"assistant", content: m.content }))],
    temperature, maxTokens,
    false  // ← reasoning désactivé : réponses instantanées pour l'élève
  )).trim();
}

// ── Aliases de compatibilité ───────────────────────────────────────────────────
export const gradeWithQwen           = gradeAnswer;
export const generateContentWithQwen = generateStructuredContent;
export const chatWithQwen            = chatWithAI;