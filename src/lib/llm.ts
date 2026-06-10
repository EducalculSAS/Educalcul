/**
 * Educalcul — Couche transport IA via OpenRouter
 */

const OR_URL      = "https://openrouter.ai/api/v1/chat/completions";
const OR_MODEL    = process.env.OPENROUTER_MODEL   || "deepseek/deepseek-v4-flash";
const OR_FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "deepseek/deepseek-chat-v3-0324";
const OR_KEY      = process.env.OPENROUTER_API_KEY || "";

type Message = { role: "user" | "assistant" | "system"; content: string | MessageContentPart[] };
type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

const OR_VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || "inclusionai/ling-2.6-flash";

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240_000); // 4 min max

  let resp: Response;
  try {
    resp = await fetch(OR_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${OR_KEY}`,
        "HTTP-Referer":  "https://educalcul.com",
        "X-Title":       "Educalcul",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

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

/** Échappe les retours à la ligne / tabulations littéraux à l'intérieur des chaînes JSON */
function escapeControlCharsInStrings(raw: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of raw) {
    if (inString) {
      if (escaped) { out += ch; escaped = false; continue; }
      if (ch === "\\") { out += ch; escaped = true; continue; }
      if (ch === '"') { inString = false; out += ch; continue; }
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      out += ch;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    out += ch;
  }
  return out;
}

function parseJSON(raw: string): unknown {
  try { return JSON.parse(raw); }
  catch {
    try { return JSON.parse(raw.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\")); }
    catch {
      try { return JSON.parse(escapeControlCharsInStrings(raw)); }
      catch {
        try { return JSON.parse(escapeControlCharsInStrings(raw.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\"))); }
        catch (e) { throw new Error(`JSON invalide reçu de l'IA : ${(e as Error).message}`); }
      }
    }
  }
}

// ── Exports publics ───────────────────────────────────────────────────────────

/** Corriger une réponse élève */
export async function gradeAnswer(
  question: string, correctAnswer: string, studentAnswer: string,
  explanation: string | undefined, level: string, maxPoints: number
): Promise<{ is_correct: boolean; score: number; feedback: string }> {
  const system = `Tu es un professeur de mathématiques pour le niveau "${level || "6ème"}". Corrige vite et bien.
RÈGLES D'ÉQUIVALENCE (très important) :
- Accepte TOUTE forme mathématiquement équivalente à la réponse attendue, même si elle diffère de la formulation donnée : fraction non simplifiée ou simplifiée (ex: 4/8 = 1/2), nombre décimal vs fraction (ex: 0.5 = 1/2), forme développée vs factorisée, ordre différent des termes/solutions, unités équivalentes, écriture avec ou sans espace/virgule décimale, pourcentage vs décimal (ex: 50% = 0.5), racine simplifiée ou non.
- Seule l'exactitude mathématique compte, pas la forme exacte du texte.
RÈGLES pour le feedback :
1. Adapte ton vocabulaire au niveau de l'élève.
2. Si correct : félicite brièvement et confirme la bonne réponse (même si la forme diffère, précise que c'est une forme équivalente correcte si pertinent).
3. Si incorrect : donne OBLIGATOIREMENT la réponse correcte avec les calculs détaillés étape par étape.
4. Montre TOUJOURS la méthode ET le résultat final, pas seulement l'un des deux.
5. Sois encourageant même en cas d'erreur.
6. Réponds UNIQUEMENT en JSON sur une seule ligne, sans texte avant/après.
7. score = 0 si incorrect, ${maxPoints} si correct.
8. Reste concis : feedback de 2-4 phrases maximum.`;

  const user = `Question : ${question}\nRéponse attendue : ${correctAnswer}\nExplication : ${explanation || "Aucune"}\nRéponse élève : ${studentAnswer}\n→ {"is_correct":bool,"score":number,"feedback":"..."}`;
  const text = await dispatch([{ role: "system", content: system }, { role: "user", content: user }], 0.2, 500, false);
  const r = parseJSON(extractJSON(text)) as any;
  return { is_correct: r.is_correct === true, score: r.score || 0, feedback: r.feedback || "Pas de feedback" };
}

/** Corriger une réponse élève soumise sous forme de dessin (image base64) via un modèle vision */
export async function gradeImageAnswer(
  question: string, correctAnswer: string, imageDataUrl: string,
  explanation: string | undefined, level: string, maxPoints: number
): Promise<{ is_correct: boolean; score: number; feedback: string }> {
  const system = `Tu es un professeur de mathématiques pour le niveau "${level || "6ème"}".
Tu reçois une photo/dessin de la réponse manuscrite d'un élève.
RÈGLES D'ÉQUIVALENCE (très important) :
- Accepte TOUTE forme mathématiquement équivalente à la réponse attendue : fraction non simplifiée ou simplifiée, décimal vs fraction, forme développée vs factorisée, ordre différent, pourcentage vs décimal, racine simplifiée ou non.
- Seule l'exactitude mathématique compte, pas la forme exacte.
RÈGLES pour le feedback :
1. Adapte ton vocabulaire au niveau de l'élève.
2. Lis attentivement ce que l'élève a écrit ou dessiné sur l'image.
3. Si correct : félicite brièvement et confirme la bonne réponse.
4. Si incorrect : donne OBLIGATOIREMENT la réponse correcte avec les calculs détaillés étape par étape.
5. Montre TOUJOURS la méthode ET le résultat final, pas seulement l'un des deux.
6. Sois encourageant même en cas d'erreur.
7. Réponds UNIQUEMENT en JSON sur une seule ligne, sans texte avant/après.
8. score = 0 si incorrect, ${maxPoints} si correct.
9. Reste concis : feedback de 2-4 phrases maximum.`;

  const userText = `Question : ${question}\nRéponse attendue : ${correctAnswer}\nExplication : ${explanation || "Aucune"}\nVoici la réponse de l'élève sous forme d'image (dessin/écriture manuscrite). Analyse-la.\n→ {"is_correct":bool,"score":number,"feedback":"..."}`;

  const msgs: Message[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ];

  const { ok, text, status } = await callOpenRouterModel(OR_VISION_MODEL, msgs, 0.2, 500);
  if (!ok) {
    console.error(`[llm] vision model ${OR_VISION_MODEL} error ${status}: ${text.slice(0, 400)}`);
    throw new Error("Le modèle de vision IA est indisponible. Réessaie dans quelques secondes.");
  }
  const parsed = JSON.parse(text);
  const content = parsed?.choices?.[0]?.message?.content ?? "";
  const r = parseJSON(extractJSON(content)) as any;
  return { is_correct: r.is_correct === true, score: r.score || 0, feedback: r.feedback || "Pas de feedback" };
}

/** Générer un cours/exercice/quiz structuré → JSON parsé */
export async function generateStructuredContent(
  prompt: string, systemPrompt: string, temperature = 0.7
): Promise<unknown> {
  const text = await dispatch(
    [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
    temperature,
    8000,
    false  // reasoning désactivé : DeepSeek ne le supporte pas via OpenRouter
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