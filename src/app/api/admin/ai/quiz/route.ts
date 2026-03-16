import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const {
      grade_level,
      subject,
      quiz_type,
      question_count,
      difficulty,
      additional_info,
    } = data;

    if (!grade_level || !subject || !quiz_type || !question_count) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Le niveau, le sujet, le type de quiz et le nombre de questions sont requis",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Configuration API manquante (GEMINI_API_KEY)",
        },
        { status: 500 }
      );
    }

    const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const systemMessage = `Tu es un assistant spécialisé dans la création de quiz de mathématiques pour Educalcul, une plateforme éducative française. 

Ta mission est de générer un quiz complet et structuré sur un sujet mathématique spécifique, adapté au niveau scolaire demandé.

Voici les règles à suivre :

1. Le quiz doit être adapté au niveau scolaire spécifié (primaire, collège ou lycée).
2. Les questions doivent être pédagogiques, claires et progressives.
3. Utilise un langage adapté à l'âge des élèves.
4. Respecte le type de questions demandé (QCM, Vrai/Faux, réponses courtes, ou mixte).
5. Fournis le nombre exact de questions demandé.
6. Pour les QCM, propose 4 options de réponse avec une seule bonne réponse.
7. Pour les questions Vrai/Faux, formule des affirmations claires.
8. Pour les réponses courtes, pose des questions précises avec des réponses courtes attendues.
9. Fournis le contenu au format JSON selon la structure demandée.

Tu dois générer un JSON qui respecte exactement cette structure :

{
  "title": "Titre du quiz",
  "description": "Description courte du quiz",
  "grade_level": "Niveau scolaire",
  "subject": "Sujet du quiz",
  "questions": [
    {
      "question": "Énoncé de la question",
      "type": "qcm",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correct_answer": 0
    },
    {
      "question": "Énoncé de la question vrai/faux",
      "type": "vrai_faux",
      "options": ["Vrai", "Faux"],
      "correct_answer": 1
    },
    {
      "question": "Énoncé de la question à réponse courte",
      "type": "reponse_courte",
      "correct_answer": "Réponse attendue"
    }
  ]
}

Types de questions possibles :
- "qcm" : Questions à choix multiples avec 4 options
- "vrai_faux" : Questions Vrai/Faux avec 2 options
- "reponse_courte" : Questions à réponse courte (pas d'options, juste correct_answer)

Pour les questions QCM et Vrai/Faux, correct_answer est l'index de la bonne réponse (0, 1, 2, 3).
Pour les questions à réponse courte, correct_answer est directement la réponse attendue.

Adapte le niveau de difficulté selon le paramètre fourni (facile, moyen, difficile).

Réponds UNIQUEMENT avec le JSON demandé, sans texte supplémentaire.`;

    let userMessage = `Génère un quiz de mathématiques complet sur le sujet '${subject}' pour le niveau '${grade_level}'.`;
    userMessage += ` Type de questions : ${quiz_type}.`;
    userMessage += ` Nombre de questions : ${question_count}.`;
    userMessage += ` Niveau de difficulté : ${difficulty || "moyen"}.`;
    if (additional_info) {
      userMessage += ` Informations supplémentaires : ${additional_info}`;
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: userMessage }],
        },
      ],
      system_instruction: {
        parts: [{ text: systemMessage }],
      },
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    };

    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", response.status, errorText);
      return NextResponse.json(
        { success: false, message: `Erreur API externe: ${response.status}` },
        { status: response.status }
      );
    }

    const dataRes = await response.json();
    let aiContent = dataRes.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiContent) {
      return NextResponse.json(
        { success: false, message: "Réponse IA vide ou structure inattendue" },
        { status: 500 }
      );
    }

    aiContent = aiContent.trim();
    aiContent = aiContent.replace(/^```json\n/m, "").replace(/\n```$/m, "");

    let quizData;
    try {
      quizData = JSON.parse(aiContent);
    } catch (e) {
      console.error("JSON Parse Error:", e, aiContent);
      return NextResponse.json(
        { success: false, message: "Format JSON invalide reçu de l'IA" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, quiz: quizData });
  } catch (error: any) {
    console.error("AI Quiz Gen Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}
