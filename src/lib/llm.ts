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

const OR_VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || "qwen/qwen2.5-vl-72b-instruct";

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
  const body: any = {
    model,
    messages: msgs,
    temperature: temp,
    // Route to the highest-throughput provider for this model (same model =
    // same quality, just faster generation). Keep fallbacks on for reliability.
    provider: { sort: "throughput", allow_fallbacks: true },
  };
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
  const system = `Tu es un professeur de mathématiques pour le niveau "${level || "6ème"}". Corrige avec soin et pédagogie.
RÈGLES D'ÉQUIVALENCE (très important) :
- Accepte TOUTE forme mathématiquement équivalente à la réponse attendue, même si elle diffère de la formulation donnée : fraction non simplifiée ou simplifiée (ex: 4/8 = 1/2), nombre décimal vs fraction (ex: 0.5 = 1/2), forme développée vs factorisée, ordre différent des termes/solutions, unités équivalentes, écriture avec ou sans espace/virgule décimale, pourcentage vs décimal (ex: 50% = 0.5), racine simplifiée ou non.
- Seule l'exactitude mathématique compte, pas la forme exacte du texte.
RÈGLES pour le feedback :
1. Adapte ton vocabulaire et ton niveau de détail au niveau de l'élève.
2. EXPLIQUE TOUJOURS LA MÉTHODE pas à pas, étape par étape, que la réponse soit correcte ou non — pas seulement le résultat. L'objectif est que l'élève comprenne le raisonnement, pas juste s'il a "bon" ou "faux".
3. Si correct : confirme la bonne réponse (en précisant si la forme diffère mais reste équivalente), PUIS récapitule brièvement la méthode/le raisonnement qui mène à cette réponse pour consolider la compréhension.
4. Si incorrect : explique d'abord où se situe l'erreur dans le raisonnement de l'élève si elle est identifiable, donne ensuite la résolution complète étape par étape menant à la réponse correcte, avec les calculs détaillés.
5. Sois encourageant même en cas d'erreur, sans être condescendant.
6. Réponds UNIQUEMENT en JSON sur une seule ligne, sans texte avant/après.
7. score = 0 si incorrect, ${maxPoints} si correct.
8. Le feedback doit être complet mais clair : généralement 3 à 6 phrases, plus si la résolution étape par étape le nécessite. Utilise des sauts de ligne (\\n) entre les étapes pour la lisibilité.`;

  const user = `Question : ${question}\nRéponse attendue : ${correctAnswer}\nExplication / piste de correction (usage interne, ne pas la recopier telle quelle) : ${explanation || "Aucune"}\nRéponse élève : ${studentAnswer}\n→ {"is_correct":bool,"score":number,"feedback":"..."}`;
  const text = await dispatch([{ role: "system", content: system }, { role: "user", content: user }], 0.2, 800, false);
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
1. Adapte ton vocabulaire et ton niveau de détail au niveau de l'élève.
2. Lis attentivement ce que l'élève a écrit ou dessiné sur l'image (démarche ET résultat final).
3. EXPLIQUE TOUJOURS LA MÉTHODE pas à pas, étape par étape, que la réponse soit correcte ou non — pas seulement le résultat. L'objectif est que l'élève comprenne le raisonnement.
4. Si correct : confirme la bonne réponse, PUIS récapitule brièvement la méthode/le raisonnement qui mène à cette réponse pour consolider la compréhension.
5. Si incorrect : explique d'abord où se situe l'erreur dans la démarche de l'élève si elle est identifiable sur l'image, donne ensuite la résolution complète étape par étape menant à la réponse correcte, avec les calculs détaillés.
6. Sois encourageant même en cas d'erreur, sans être condescendant.
7. Réponds UNIQUEMENT en JSON sur une seule ligne, sans texte avant/après.
8. score = 0 si incorrect, ${maxPoints} si correct.
9. Le feedback doit être complet mais clair : généralement 3 à 6 phrases, plus si la résolution étape par étape le nécessite. Utilise des sauts de ligne (\\n) entre les étapes pour la lisibilité.`;

  const userText = `Question : ${question}\nRéponse attendue : ${correctAnswer}\nExplication / piste de correction (usage interne, ne pas la recopier telle quelle) : ${explanation || "Aucune"}\nVoici la réponse de l'élève sous forme d'image (dessin/écriture manuscrite). Analyse-la.\n→ {"is_correct":bool,"score":number,"feedback":"..."}`;

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

  const { ok, text, status } = await callOpenRouterModel(OR_VISION_MODEL, msgs, 0.2, 800);
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
  prompt: string, systemPrompt: string, temperature = 0.7, maxTokens = 8000
): Promise<unknown> {
  const text = await dispatch(
    [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
    temperature,
    maxTokens,
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