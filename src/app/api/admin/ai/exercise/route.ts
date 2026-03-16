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
      exercise_type,
      question_count,
      difficulty,
      additional_info,
    } = data;

    if (!grade_level || !subject || !exercise_type || !question_count) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Le niveau, le sujet, le type d'exercice et le nombre de questions sont requis",
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

    const systemMessage = `Tu es un assistant spécialisé dans la création d'exercices interactifs de mathématiques pour Educalcul, une plateforme éducative française.

Ta mission est de générer un exercice interactif complet et structuré sur un sujet mathématique spécifique, adapté au niveau scolaire demandé.

Voici les règles à suivre :

1. L'exercice doit être adapté au niveau scolaire spécifié (primaire, collège ou lycée).
2. Les questions doivent être pédagogiques, claires et progressives.
3. Utilise un langage adapté à l'âge des élèves.
4. Respecte le type d'exercice demandé (calcul mental, résolution de problème, saisie libre, etc.).
5. Fournis le nombre exact de questions/étapes demandé.
6. IMPORTANT : Ne génère JAMAIS de questions à choix multiples (QCM). Les exercices doivent être interactifs avec saisie libre, manipulation, construction, etc.
7. Pour chaque question, fournis une réponse correcte précise et des explications.
8. Inclus des indices progressifs pour aider les élèves.
9. Fournis le contenu au format JSON selon la structure demandée.

Tu dois générer un JSON qui respecte exactement cette structure :

{
  "title": "Titre de l'exercice",
  "description": "Description courte de l'exercice",
  "grade_level": "Niveau scolaire",
  "subject": "Sujet de l'exercice",
  "exercise_type": "Type d'exercice",
  "difficulty_level": "Niveau de difficulté",
  "estimated_time_minutes": 15,
  "content_json": [
    {
      "question": "Énoncé de la question/étape",
      "answer_type": "numeric",
      "correct_answer": "Réponse attendue",
      "explanation": "Explication de la solution",
      "hint_available": true,
      "hints": ["Premier indice", "Deuxième indice"],
      "unit": "cm",
      "tolerance": 0.1
    }
  ]
}

Types d'exercices possibles :
- "calcul_mental" : Calculs à effectuer mentalement
- "resolution_probleme" : Problèmes à résoudre étape par étape
- "saisie_libre" : Questions ouvertes avec validation intelligente
- "completion_texte" : Textes à compléter
- "manipulation_formules" : Transformation de formules mathématiques
- "construction_geometrique" : Construction de figures géométriques
- "exercice_progressif" : Exercices adaptatifs

Types de réponses (answer_type) :
- "numeric" : Réponse numérique (avec tolérance possible)
- "text" : Réponse textuelle
- "equation" : Équation mathématique
- "formula" : Formule mathématique
- "list" : Liste de valeurs

Adapte le niveau de difficulté selon le paramètre fourni (facile, moyen, difficile).

Réponds UNIQUEMENT avec le JSON demandé, sans texte supplémentaire.`;

    let userMessage = `Génère un exercice interactif de mathématiques complet sur le sujet '${subject}' pour le niveau '${grade_level}'.`;
    userMessage += ` Type d'exercice : ${exercise_type}.`;
    userMessage += ` Nombre de questions/étapes : ${question_count}.`;
    userMessage += ` Niveau de difficulté : ${difficulty || "moyen"}.`;

    switch (exercise_type) {
      case "calcul_mental":
        userMessage +=
          " Crée des calculs mentaux progressifs sans calculatrice. Chaque question doit avoir une réponse numérique précise.";
        break;
      case "resolution_probleme":
        userMessage +=
          " Crée un problème concret avec des étapes de résolution claires. L'élève doit expliquer sa démarche et donner la réponse finale.";
        break;
      case "saisie_libre":
        userMessage +=
          " Crée des questions ouvertes où l'élève doit saisir librement sa réponse (pas de choix multiples).";
        break;
      case "completion_texte":
        userMessage +=
          " Crée un texte mathématique avec des espaces à compléter (formules, définitions, propriétés).";
        break;
      case "manipulation_formules":
        userMessage +=
          " Crée des exercices de transformation et manipulation de formules mathématiques.";
        break;
      case "construction_geometrique":
        userMessage +=
          " Crée des exercices de construction géométrique avec des étapes précises.";
        break;
      case "exercice_progressif":
        userMessage +=
          " Crée un exercice adaptatif qui s'ajuste selon les réponses de l'élève.";
        break;
    }

    if (additional_info) {
      userMessage += ` Informations supplémentaires : ${additional_info}`;
    }

    userMessage +=
      " IMPORTANT : Ne génère AUCUNE question à choix multiples. Tous les exercices doivent être interactifs avec saisie libre, manipulation ou construction.";

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
      console.error("Gemini AI API Error:", response.status, errorText);
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

    let exerciseData;
    try {
      exerciseData = JSON.parse(aiContent);
    } catch (e) {
      console.error("JSON Parse Error:", e, aiContent);
      return NextResponse.json(
        { success: false, message: "Format JSON invalide reçu de l'IA" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, exercise: exerciseData });
  } catch (error: any) {
    console.error("AI Exercise Gen Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}
