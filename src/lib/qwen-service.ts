/**
 * OpenRouter AI Service (Temporary replacement for Qwen)
 * Provides a wrapper for OpenRouter API models
 */

const OPENROUTER_API_URL = "https://openrouter.io/api/v1/chat/completions";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "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";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/auto";

interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function callOpenRouterAPI(messages: OpenRouterMessage[], temperature: number = 0.7, maxTokens?: number): Promise<string> {
  try {
    const requestBody: OpenRouterRequest = {
      model: OPENROUTER_MODEL,
      messages,
      temperature,
      ...(maxTokens && { max_tokens: maxTokens }),
    };

    console.log("🤖 Calling OpenRouter API...", { model: OPENROUTER_MODEL, messageCount: messages.length });

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://educalcul.fr",
        "X-Title": "Educalcul",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenRouter API Error:", errorText);
      throw new Error(`OpenRouter API responded with ${response.status}: ${errorText}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("❌ OpenRouter Service Error:", error);
    throw error;
  }
}

export async function callQwenModel(prompt: string, temperature: number = 0.7): Promise<string> {
  const messages: OpenRouterMessage[] = [
    {
      role: "user",
      content: prompt,
    },
  ];
  
  return callOpenRouterAPI(messages, temperature);
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

  const messages: OpenRouterMessage[] = [
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
    const responseText = await callOpenRouterAPI(messages, 0.3);
    
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
    const messages: OpenRouterMessage[] = [
      {
        role: "user",
        content: prompt,
      },
    ];
    
    const response = await callOpenRouterAPI(messages, 0.8);
    
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
  const messages: OpenRouterMessage[] = [
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
    const response = await callOpenRouterAPI(messages, temperature);
    
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
  const openRouterMessages: OpenRouterMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    ...messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];

  try {
    const response = await callOpenRouterAPI(openRouterMessages, temperature, maxTokens);
    return response.trim();
  } catch (error) {
    console.error("❌ Error in OpenRouter chat:", error);
    throw error;
  }
}
