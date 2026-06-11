import { NextRequest } from "next/server";
import { generateStructuredContent } from "@/lib/llm";

export const maxDuration = 180;

const TABLE_GRAPH_RULES = `═══ TABLEAUX & GRAPHIQUES ═══
• Tableau (signes/variations/valeurs) : <table class="math-table math-table-sign|math-table-variation|math-table-value"><thead><tr><th>x</th>...</tr></thead><tbody><tr><td>...</td></tr></tbody></table>. Utilise ↗, ↘, +, -, 0, ∞, ‖.
• Courbe simple : <div class="math-graph-placeholder" data-function="x^2 - 2*x + 1" data-xmin="-5" data-xmax="5"></div>
• N'en ajoute que si pertinent et demandé ou utile pour la notion.`;

const FORMAT_RULES = `═══ FORMAT ═══
• HTML pour le contenu : <h3>, <h4>, <p>, <ul>/<li>, <strong>, <em>, <blockquote>, <table>.
• LaTeX pour les formules : inline $...$, bloc $$...$$.
• N'utilise JAMAIS de retour à la ligne littéral à l'intérieur des chaînes JSON.
• DOUBLE-ÉCHAPPE les backslashes JSON : \\\\frac{a}{b} → donne \\frac{a}{b} dans le rendu.
${TABLE_GRAPH_RULES}`;

function buildPrompts(type: "course" | "exercise" | "quiz", instruction: string, content: unknown, level?: string) {
  if (type === "course") {
    const system = `Tu es un expert pédagogue en mathématiques pour Educalcul, une plateforme éducative française.
Tu reçois la structure JSON COMPLÈTE d'un cours (tableau de chapitres, chacun avec des leçons) ainsi qu'une demande de modification de l'enseignant pour le niveau "${level || "6ème"}".

Applique EXACTEMENT la demande, qu'elle soit minime (ex: "enlève ce paragraphe", "corrige cette phrase") ou importante (ex: "ajoute un chapitre entier entre le 1 et le 2 sur tel sujet", "ajoute 2 mini-exercices à la leçon 3 du chapitre 2").
Si tu ajoutes du contenu (chapitre, leçon, mini-exercice...), respecte EXACTEMENT le même style, la même longueur et le même niveau de détail que le contenu existant (cours magistral riche, 600-1200 mots par leçon en HTML+LaTeX).
Pour tout nouvel id (chapitre/leçon/exercice), génère une chaîne unique du type "chap-xxxx", "lesson-xxxx", "ex-xxxx".
Conserve TOUT le reste du contenu strictement inchangé (ne réécris pas ce qui n'a pas été demandé).

${FORMAT_RULES}

Réponds UNIQUEMENT avec le JSON suivant, sans texte avant/après :
{ "chapters": [ /* la structure COMPLÈTE et mise à jour, même format que la structure reçue (id, title, lessons[] avec id, title, type, content, duration, exercises[]) */ ] }`;

    const user = `Structure actuelle du cours (JSON) :\n${JSON.stringify(content)}\n\nDemande de modification : ${instruction}`;
    return { system, user, maxTokens: 16000 };
  }

  if (type === "exercise") {
    const system = `Tu es un expert pédagogue en mathématiques pour Educalcul, une plateforme éducative française.
Tu reçois la structure JSON COMPLÈTE d'un exercice (tableau de pages, chacune avec des blocs : texte, questions, etc.) ainsi qu'une demande de modification de l'enseignant pour le niveau "${level || "6ème"}".

Applique EXACTEMENT la demande, qu'elle soit minime (ex: "corrige l'énoncé de la question 2") ou importante (ex: "ajoute 3 questions sur tel sujet", "ajoute une page entière").
Si tu ajoutes du contenu, respecte EXACTEMENT le même style et niveau de détail que l'existant.
Pour tout nouvel id de page/bloc, génère une chaîne unique du type "page-xxxx", "block-xxxx".
Conserve TOUT le reste du contenu strictement inchangé.

${FORMAT_RULES}

Réponds UNIQUEMENT avec le JSON suivant, sans texte avant/après :
{ "pages": [ /* la structure COMPLÈTE et mise à jour, même format que la structure reçue (id, title, blocks[] avec id, type, title, content, points, correctAnswer, explanation, options...) */ ] }`;

    const user = `Structure actuelle de l'exercice (JSON) :\n${JSON.stringify(content)}\n\nDemande de modification : ${instruction}`;
    return { system, user, maxTokens: 16000 };
  }

  // quiz
  const system = `Tu es un expert pédagogue en mathématiques pour Educalcul, une plateforme éducative française.
Tu reçois la structure JSON COMPLÈTE d'un quiz (tableau de questions QCM) ainsi qu'une demande de modification de l'enseignant pour le niveau "${level || "6ème"}".

Applique EXACTEMENT la demande, qu'elle soit minime (ex: "corrige l'option B de la question 1") ou importante (ex: "ajoute 3 questions sur tel sujet").
Si tu ajoutes des questions, respecte EXACTEMENT le même style et niveau de détail que l'existant (type "single_choice", 4 options, correctAnswer identique à une option, explanation).
Pour tout nouvel id de question, génère une chaîne unique du type "q-xxxx".
Conserve TOUT le reste du contenu strictement inchangé.

${FORMAT_RULES}

Réponds UNIQUEMENT avec le JSON suivant, sans texte avant/après :
{ "questions": [ /* la structure COMPLÈTE et mise à jour, même format que la structure reçue (id, text, type, points, options, correctAnswer, explanation) */ ] }`;

  const user = `Structure actuelle du quiz (JSON) :\n${JSON.stringify(content)}\n\nDemande de modification : ${instruction}`;
  return { system, user, maxTokens: 16000 };
}

export async function POST(req: NextRequest) {
  try {
    const { type, instruction, content, level } = await req.json();

    if (!type || !instruction || content === undefined) {
      return Response.json({ error: "Champs manquants (type, instruction, content)" }, { status: 400 });
    }

    const { system, user, maxTokens } = buildPrompts(type, instruction, content, level);
    const result = (await generateStructuredContent(user, system, 0.5, maxTokens)) as any;

    const key = type === "course" ? "chapters" : type === "exercise" ? "pages" : "questions";
    if (!result || !Array.isArray(result[key])) {
      throw new Error("Réponse IA invalide");
    }

    return Response.json({ [key]: result[key] });
  } catch (e: any) {
    console.error("❌ Erreur ai-edit:", e.message);
    return Response.json({ error: e.message || "Erreur de modification" }, { status: 500 });
  }
}
