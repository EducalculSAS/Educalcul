/**
 * AI service wrapper that supports either a local Qwen-like endpoint
 * or OpenRouter. The active provider is controlled by `process.env.AI_PROVIDER`.
 */

const AI_PROVIDER = (process.env.AI_PROVIDER || "local").toLowerCase();

const OPENROUTER_API_URL = "https://openrouter.io/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/auto";

const QWEN_API_URL = process.env.QWEN_API_URL || "http://localhost:11434/api/generate";
const QWEN_MODEL = process.env.QWEN_MODEL || "llava:7b";

type Message = { role: "user" | "assistant" | "system"; content: string };

async function callOpenRouterAPI(messages: Message[], temperature: number = 0.7, maxTokens?: number): Promise<string> {
  const requestBody: any = {
    model: OPENROUTER_MODEL,
    messages,
    temperature,
    ...(maxTokens && { max_tokens: maxTokens }),
  };

  const resp = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.OPENROUTER_API_KEY ? { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } : {}),
    },
    body: JSON.stringify(requestBody),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenRouter error ${resp.status}: ${err}`);
  }

  const data = await resp.json().catch(() => null as any);
  return (data?.choices?.[0]?.message?.content || (await resp.text())).trim();
}

async function callLocalQwenAPI(messages: Message[], temperature: number = 0.7, maxTokens?: number): Promise<string> {
  // Many local Qwen endpoints expect a single `prompt` string.
  const prompt = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

  const body: any = {
    model: QWEN_MODEL,
    prompt,
    temperature,
    ...(maxTokens && { max_tokens: maxTokens }),
  };

  const resp = await fetch(QWEN_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Local Qwen error ${resp.status}: ${err}`);
  }

  // Try JSON then fallback to plain text
  const json = await resp.json().catch(() => null as any);
  if (json) {
    // common shape: { output: string } or {choices:[{text:...}]}
    return (json.output || json.choices?.[0]?.text || JSON.stringify(json)).toString().trim();
  }

  return (await resp.text()).trim();
}

async function callProvider(messages: Message[], temperature = 0.7, maxTokens?: number) {
  if (AI_PROVIDER === "local") return callLocalQwenAPI(messages, temperature, maxTokens);
  return callOpenRouterAPI(messages, temperature, maxTokens);
}

export async function callQwenModel(prompt: string, temperature: number = 0.7): Promise<string> {
  const messages: Message[] = [{ role: "user", content: prompt }];
  return callProvider(messages, temperature);
}

/**
 * Grade quiz/exercise answer using OpenRouter
 * Returns JSON with grading results
 */
export async function gradeWithQwen(
  question: string,
  correctAnswer: string,
  studentAnswer: string,
  explanation: string | undefined,
  level: string,
  maxPoints: number
): Promise<{ is_correct: boolean; score: number; feedback: string }> {
  const systemPrompt = `Tu es un professeur de mathématiques bienveillant qui corrige un élève de niveau "${level || "6ème"}".
RÉGLES STRICTES POUR LE FEEDBACK :
1. Adapte ton vocabulaire et tes explications au niveau "${level || "6ème"}".
2. Analyse précisément la réponse : si la méthode est bonne mais qu'il y a une erreur d'étourderie ou de calcul, dis-lui explicitement qu'il y était presque et valorise son raisonnement.
3. INTERDIT d'utiliser des tournures banales ou répétitives (ex: évite de commencer tes phrases par "Car", "En effet", "C'est incorrect car").
4. Sois original, direct, et encourageant dans tes corrections.
5. Sois souple sur la forme (orthographe, casse) mais rigoureux sur le fond mathématique.
6. Réponds UNIQUEMENT au format JSON sur une seule ligne: { "is_correct": boolean, "score": number, "feedback": string }.
7. Le score doit être 0 (incorrect) ou ${maxPoints} (correct).`;

  const userPrompt = `Question : ${question}
Réponse attendue : ${correctAnswer}
Explication : ${explanation || "Aucune"}

Voici la réponse de l'élève : ${studentAnswer}

Réponds uniquement en JSON : {"is_correct": boolean, "score": number, "feedback": string}`;

  const messages: Message[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  try {
    const responseText = await callProvider(messages, 0.3);
    
    // Extract JSON from response
    let jsonStr = responseText;
    
    // Try to extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      // Try to find JSON object directly
      const objMatch = responseText.match(/\{[\s\S]*\}/);
      if (objMatch) {
        jsonStr = objMatch[0];
      }
    }

    const result = JSON.parse(jsonStr);
    return {
      is_correct: result.is_correct === true,
      score: result.score || 0,
      feedback: result.feedback || "Pas de feedback disponible",
    };
  } catch (error) {
    console.error("❌ Error parsing OpenRouter response:", error);
    throw new Error("Failed to parse OpenRouter grading response");
  }
}

/**
 * Generate exercise using OpenRouter
 */
export async function generateWithQwen(prompt: string): Promise<unknown> {
  try {
    const messages: Message[] = [
      { role: "user", content: prompt },
    ];
    
    const response = await callProvider(messages, 0.8);
    
    // Try to extract JSON
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      const objMatch = response.match(/\{[\s\S]*\}/);
      if (objMatch) {
        jsonStr = objMatch[0];
      }
    }

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("❌ Error parsing OpenRouter generation response:", error);
    throw new Error("Failed to parse OpenRouter generation response");
  }
}

/**
 * Generate content using OpenRouter (courses, exercises, quizzes)
 */
export async function generateContentWithQwen(
  prompt: string,
  systemPrompt: string,
  temperature: number = 0.7
): Promise<unknown> {
  const messages: Message[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  try {
    const response = await callProvider(messages, temperature);
    
    // Try to extract JSON
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      // Try to find JSON object directly
      const objMatch = response.match(/\{[\s\S]*\}/);
      if (objMatch) {
        jsonStr = objMatch[0];
      }
    }

    // Try to parse the JSON
    try {
      return JSON.parse(jsonStr);
    } catch (parseError) {
      // Try to repair LaTeX backslashes (common issue)
      console.warn("First JSON parse failed, attempting to repair LaTeX backslashes...");
      try {
        const repairedContent = jsonStr.replace(
          /(?<!\\)\\(?!["\\/bfnrtu])/g,
          "\\\\"
        );
        return JSON.parse(repairedContent);
      } catch {
        console.error("JSON Parse Error (Fatal):", parseError);
        console.error("Content snippet:", jsonStr.substring(0, 500) + "...");
        throw new Error("Format JSON invalide reçu de l'IA");
      }
    }
  } catch (error) {
    console.error("❌ Error in OpenRouter content generation:", error);
    throw error;
  }
}

/**
 * Chat with OpenRouter (for AI Tutor)
 * Maintains conversation context
 */
export async function chatWithQwen(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string,
  temperature: number = 0.65,
  maxTokens: number = 300
): Promise<string> {
  // Convert messages to OpenRouter format and add system prompt
  const openRouterMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((msg) => ({ role: msg.role as "user" | "assistant", content: msg.content })),
  ];

  try {
    const response = await callProvider(openRouterMessages, temperature, maxTokens);
    return response.trim();
  } catch (error) {
    console.error("❌ Error in OpenRouter chat:", error);
    throw error;
  }
}
