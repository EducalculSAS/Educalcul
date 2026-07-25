/**
 * Educalcul — Couche transport IA via l'API Mistral directe (endpoint régional
 * EU — les données ne quittent jamais l'UE/EEE, voir docs.mistral.ai/studio-api/regional-inference).
 */

const MISTRAL_URL   = "https://api.eu.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || "mistral-small-latest";
const MISTRAL_KEY   = process.env.MISTRAL_API_KEY || "";

type Message = { role: "user" | "assistant" | "system"; content: string | MessageContentPart[] };
type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: string };

// ── Mistral (texte) ──────────────────────────────────────────────────────────

/** Le contenu peut être une simple chaîne, ou (reasoning activé) une liste de
 * chunks {type:"thinking"|"text", ...} — on ne garde que le texte final,
 * jamais la trace de raisonnement (pas destinée à être montrée à l'élève). */
function extractMistralText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const chunks = content.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const maybeType = (item as { type?: unknown }).type;
      if (maybeType === "text" && typeof (item as { text?: unknown }).text === "string") {
        return [(item as { text: string }).text];
      }
      if (maybeType === "json" && (item as { json?: unknown }).json !== undefined) {
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

async function callMistralModel(
  model: string, msgs: Message[], temp: number, maxTokens?: number, reasoning = false, jsonMode = false
): Promise<{ ok: boolean; text: string; status: number }> {
  const body: Record<string, unknown> = {
    model,
    messages: msgs,
    temperature: temp,
    reasoning_effort: reasoning ? "high" : "none",
  };
  if (maxTokens) body.max_tokens = maxTokens;
  // JSON garanti syntaxiquement valide côté serveur Mistral — élimine les
  // erreurs de parsing (guillemets non échappés, etc.) à la source plutôt
  // que d'essayer de réparer un texte mal formé après coup.
  if (jsonMode) body.response_format = { type: "json_object" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240_000); // 4 min max

  let resp: Response;
  try {
    resp = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${MISTRAL_KEY}`,
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

async function callMistral(
  msgs: Message[], temp = 0.7, maxTokens?: number, reasoning = false, jsonMode = false
): Promise<string> {
  const { ok, text, status } = await callMistralModel(MISTRAL_MODEL, msgs, temp, maxTokens, reasoning, jsonMode);

  if (ok) {
    try {
      const parsed = JSON.parse(text);
      const finishReason = parsed?.choices?.[0]?.finish_reason;
      if (finishReason === "length") {
        console.warn(`[llm] ${MISTRAL_MODEL} hit max_tokens (maxTokens=${maxTokens})`);
        throw new Error("Réponse IA tronquée (max_tokens atteint) — réessaie avec un contenu plus court, ou réessaie simplement.");
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
    console.warn(`[llm] ${MISTRAL_MODEL} rate-limited, nouvelle tentative dans 1.5s`);
    await new Promise(r => setTimeout(r, 1500));
    const retry = await callMistralModel(MISTRAL_MODEL, msgs, temp, maxTokens, reasoning, jsonMode);
    if (retry.ok) {
      try {
        const parsed = JSON.parse(retry.text);
        const msg = parsed?.choices?.[0]?.message;
        const content = extractMistralText(msg?.content) || (typeof msg?.content === "string" ? msg.content : "");
        if (content) return content.trim();
        return retry.text.trim();
      } catch { return retry.text.trim(); }
    }
    console.error(`[llm] ${MISTRAL_MODEL} retry error ${retry.status}: ${retry.text.slice(0, 400)}`);
  }

  console.error(`[llm] ${MISTRAL_MODEL} error ${status}: ${text.slice(0, 400)}`);
  throw new Error("Le modèle IA est indisponible. Réessaie dans quelques secondes.");
}

function dispatch(msgs: Message[], temp = 0.7, maxTokens?: number, reasoning = false, jsonMode = false) {
  return callMistral(msgs, temp, maxTokens, reasoning, jsonMode);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (block) return block[1];

  const start = text.indexOf("{");
  if (start === -1) return text;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return text.slice(start);
}

function normalizeJsonString(raw: string): string {
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

/** Échappe les guillemets non-échappés présents à l'intérieur des chaînes JSON
 * (ex: l'IA écrit un texte contenant des `"` littéraux, qui terminent la chaîne
 * prématurément). Heuristique : un `"` n'est considéré comme la fin réelle de
 * la chaîne que s'il est suivi (après espaces) par `,`, `:`, `}`, `]` ou la fin. */
function escapeUnescapedQuotesInStrings(raw: string): string {
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
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === "\\") { out += ch; escaped = true; continue; }
    if (ch === '"') {
      let j = i + 1;
      while (j < raw.length && /\s/.test(raw[j])) j++;
      const next = raw[j];
      if (next === undefined || next === "," || next === ":" || next === "}" || next === "]") {
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

function parseJSON(raw: string): unknown {
  try { return JSON.parse(raw); }
  catch {
    try { return JSON.parse(normalizeJsonString(raw)); }
    catch {
      try { return JSON.parse(raw.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\")); }
      catch {
        try { return JSON.parse(escapeControlCharsInStrings(raw)); }
        catch {
          try { return JSON.parse(escapeControlCharsInStrings(raw.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\"))); }
          catch {
            try { return JSON.parse(escapeUnescapedQuotesInStrings(escapeControlCharsInStrings(raw))); }
            catch {
              try { return JSON.parse(escapeUnescapedQuotesInStrings(escapeControlCharsInStrings(raw.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\")))); }
              catch (e) { throw new Error(`JSON invalide reçu de l'IA : ${(e as Error).message}`); }
            }
          }
        }
      }
    }
  }
}

async function repairStructuredJSON(
  raw: string,
  systemPrompt: string,
  prompt: string,
  temperature: number,
  maxTokens: number
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
    true
  );
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
8. Le feedback doit être complet mais clair : généralement 3 à 6 phrases, plus si la résolution étape par étape le nécessite. Utilise des sauts de ligne (\\n) entre les étapes pour la lisibilité.
9. FORMATE TOUTE expression mathématique en LaTeX entre $...$ (ex: $f(x) = x^2 + 6x + 4$, $(x+3)^2 - 5$, $\\frac{1}{2}$). N'écris JAMAIS de caractères Unicode comme ², ³, √, ½ ou × : utilise toujours LaTeX ($x^2$, $\\sqrt{x}$, $\\frac{1}{2}$, $\\times$).`;

  const user = `Question : ${question}\nRéponse attendue : ${correctAnswer}\nExplication / piste de correction (usage interne, ne pas la recopier telle quelle) : ${explanation || "Aucune"}\nRéponse élève : ${studentAnswer}\n→ {"is_correct":bool,"score":number,"feedback":"..."}`;
  const text = await dispatch([{ role: "system", content: system }, { role: "user", content: user }], 0.2, 800, false, true);
  const r = parseJSON(extractJSON(text)) as { is_correct?: boolean; score?: number; feedback?: string };
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
9. Le feedback doit être complet mais clair : généralement 3 à 6 phrases, plus si la résolution étape par étape le nécessite. Utilise des sauts de ligne (\\n) entre les étapes pour la lisibilité.
10. FORMATE TOUTE expression mathématique en LaTeX entre $...$ (ex: $f(x) = x^2 + 6x + 4$, $(x+3)^2 - 5$, $\\frac{1}{2}$). N'écris JAMAIS de caractères Unicode comme ², ³, √, ½ ou × : utilise toujours LaTeX.`;

  const userText = `Question : ${question}\nRéponse attendue : ${correctAnswer}\nExplication / piste de correction (usage interne, ne pas la recopier telle quelle) : ${explanation || "Aucune"}\nVoici la réponse de l'élève sous forme d'image (dessin/écriture manuscrite). Analyse-la.\n→ {"is_correct":bool,"score":number,"feedback":"..."}`;

  const msgs: Message[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        { type: "image_url", image_url: imageDataUrl },
      ],
    },
  ];

  const { ok, text, status } = await callMistralModel(MISTRAL_MODEL, msgs, 0.2, 800, false, true);
  if (!ok) {
    console.error(`[llm] vision ${MISTRAL_MODEL} error ${status}: ${text.slice(0, 400)}`);
    throw new Error("Le modèle de vision IA est indisponible. Réessaie dans quelques secondes.");
  }
  const parsed = JSON.parse(text);
  const content = extractMistralText(parsed?.choices?.[0]?.message?.content) || "";
  const r = parseJSON(extractJSON(content)) as { is_correct?: boolean; score?: number; feedback?: string };
  return { is_correct: r.is_correct === true, score: r.score || 0, feedback: r.feedback || "Pas de feedback" };
}

/** Générer un cours/exercice/quiz structuré → JSON parsé */
async function forceStructuredJSON(
  prompt: string,
  systemPrompt: string,
  maxTokens: number,
): Promise<string> {
  const forceSystem = `${systemPrompt}

TU ES UN ASSISTANT JSON.
Réponds UNIQUEMENT par un OBJET JSON parfaitement valide, sans texte avant ni après, sans markdown, sans explication.`;

  const forceUser = `${prompt}

IMPORTANT : renvoie uniquement le JSON valide attendu. Ne mets aucun texte d'accompagnement. Si tu ne peux pas, renvoie un objet vide valide : {}`;

  return dispatch(
    [
      { role: "system", content: forceSystem },
      { role: "user", content: forceUser },
    ],
    0,
    maxTokens,
    false,
    true,
  );
}

export async function generateStructuredContent(
  prompt: string, systemPrompt: string, temperature = 0.7, maxTokens = 8000
): Promise<unknown> {
  const text = await dispatch(
    [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
    temperature,
    maxTokens,
    false,
    true
  );
  const extracted = extractJSON(text);
  try {
    return parseJSON(extracted);
  } catch {
    const repaired = await repairStructuredJSON(text, systemPrompt, prompt, temperature, maxTokens);
    try {
      return parseJSON(extractJSON(repaired));
    } catch {
      const forced = await forceStructuredJSON(prompt, systemPrompt, maxTokens);
      try {
        return parseJSON(extractJSON(forced));
      } catch {
        const snippet = text.slice(0, 200).replace(/\s+/g, " ").trim();
        console.warn(`[llm] Impossible de récupérer du JSON structuré après plusieurs tentatives. Réponse brute : ${snippet}`);
        return {};
      }
    }
  }
}

/** Chatbot tuteur IA — reasoning activé (Mistral Small, mode reasoning) */
export async function chatWithAI(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string,
  temperature = 0.65,
  maxTokens = 700
): Promise<string> {
  return (await dispatch(
    [{ role: "system", content: systemPrompt }, ...messages.map(m => ({ role: m.role as "user"|"assistant", content: m.content }))],
    temperature, maxTokens,
    true
  )).trim();
}

// ── Aliases de compatibilité ───────────────────────────────────────────────────
export const gradeWithQwen           = gradeAnswer;
export const generateContentWithQwen = generateStructuredContent;
export const chatWithQwen            = chatWithAI;
