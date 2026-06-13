import { NextRequest } from "next/server";
import { generateStructuredContent } from "@/lib/llm";

export const maxDuration = 120;

const TABLE_GRAPH_RULES = `═══ TABLEAUX & GRAPHIQUES ═══
• Tableau (signes/variations/valeurs) : <table class="math-table math-table-sign|math-table-variation|math-table-value"><thead><tr><th>x</th>...</tr></thead><tbody><tr><td>...</td></tr></tbody></table>. Utilise ↗, ↘, +, -, 0, ∞, ‖.
• Courbe simple : <div class="math-graph-placeholder" data-function="x^2 - 2*x + 1" data-xmin="-5" data-xmax="5"></div>
• N'en ajoute que si pertinent et demandé ou utile pour la notion.`;

const FORMAT_RULES = `═══ FORMAT ═══
• HTML pour le contenu : <h3>, <h4>, <p>, <ul>/<li>, <strong>, <em>, <blockquote>, <table>.
• LaTeX pour les formules : inline $...$, bloc $$...$$.
• N'utilise JAMAIS de retour à la ligne littéral à l'intérieur des chaînes JSON.
• DOUBLE-ÉCHAPPE les backslashes JSON : \\\\frac{a}{b} → donne \\frac{a}{b} dans le rendu.
• N'utilise QUE des commandes LaTeX standards (lettres latines a-z/A-Z) — n'écris JAMAIS de caractères cyrilliques ou non-latins à l'intérieur d'une formule $...$ ou $$...$$, et ne mélange jamais du HTML à l'intérieur d'une formule.
${TABLE_GRAPH_RULES}`;

const PATCH_FORMAT = `═══ FORMAT DE RÉPONSE (TRÈS IMPORTANT) ═══
Modification LOCALISÉE et RAPIDE : ne touche QUE ce que l'enseignant a explicitement demandé. Si la demande porte sur un seul élément (ex: renommer une leçon, corriger une question), ne renvoie QUE cet élément modifié — n'en profite pas pour réécrire ou "améliorer" d'autres éléments non demandés.
Ne renvoie QUE ce qui change. Ne renvoie JAMAIS les éléments inchangés.
Réponds UNIQUEMENT avec ce JSON, sans texte avant/après :
{
  "items": [ /* UNIQUEMENT les éléments NOUVEAUX ou MODIFIÉS, structure complète de chaque élément, avec son "id" existant si modifié, ou un nouvel id unique si ajouté. Pour un élément ajouté, inclus aussi "after_id": "<id de l'élément après lequel l'insérer>" (ou null pour l'insérer en première position) */ ],
  "deleted": [ /* ids des éléments à supprimer entièrement, sinon [] */ ]
}`;

// Format de réponse à DEUX NIVEAUX (chapitre/leçon ou page/bloc) — permet de ne renvoyer
// QUE la leçon/le bloc modifié(e) sans réécrire tout le chapitre/la page parente.
function patchFormatTwoLevel(parentLabel: string, childLabel: string, parentField: string) {
  return `═══ FORMAT DE RÉPONSE (TRÈS IMPORTANT) ═══
Modification LOCALISÉE et RAPIDE : ne touche QUE ce que l'enseignant a explicitement demandé, et renvoie l'élément AU NIVEAU LE PLUS PRÉCIS POSSIBLE.
• Si la demande ne concerne QU'UN(E) SEUL(E) ${childLabel} (ex: renommer son titre, corriger son contenu), renvoie UNIQUEMENT cet(te) ${childLabel} avec "level": "${childLabel}", son "id" existant, et "parent_id": l'id du ${parentLabel} qui le/la contient. NE RENVOIE PAS le ${parentLabel} entier ni ses autres ${childLabel}s.
• Si la demande concerne un ${parentLabel} entier (ex: ajouter un nouveau ${parentLabel}, le réorganiser), renvoie un item avec "level": "${parentLabel}" et la structure complète du ${parentLabel} (y compris son tableau "${parentField}").
• Pour ajouter un nouvel élément, inclus "after_id": l'id de l'élément (du même niveau et du même parent) après lequel l'insérer, ou null pour l'insérer en première position. Pour un nouveau ${childLabel}, "parent_id" est obligatoire.
Réponds UNIQUEMENT avec ce JSON, sans texte avant/après :
{
  "items": [ /* éléments "${parentLabel}" ou "${childLabel}" NOUVEAUX/MODIFIÉS, voir règles ci-dessus */ ],
  "deleted": [ /* ids des éléments (de n'importe quel niveau) à supprimer entièrement, sinon [] */ ]
}`;
}

function buildPrompts(type: "course" | "exercise" | "quiz", instruction: string, content: unknown, level?: string) {
  if (type === "course") {
    const system = `Tu es un expert pédagogue en mathématiques pour Educalcul, une plateforme éducative française.
Tu reçois la structure JSON d'un cours (tableau de chapitres, chacun avec des leçons) ainsi qu'une demande de modification de l'enseignant pour le niveau "${level || "6ème"}".

Applique EXACTEMENT la demande, qu'elle soit minime (ex: "enlève ce paragraphe", "corrige cette phrase") ou importante (ex: "ajoute un chapitre entier entre le 1 et le 2 sur tel sujet", "ajoute 2 mini-exercices à la leçon 3 du chapitre 2").
Si tu ajoutes du contenu (chapitre, leçon, mini-exercice...), respecte EXACTEMENT le même style, la même longueur et le même niveau de détail que le contenu existant (cours magistral riche, 600-1200 mots par leçon en HTML+LaTeX).
Pour tout nouvel id (chapitre/leçon/exercice), génère une chaîne unique du type "chap-xxxx", "lesson-xxxx", "ex-xxxx".

═══ PÉDAGOGIE ═══
Pour tout contenu de leçon que tu écris ou modifies : commence toujours par une définition claire, suivie d'un exemple simple, en expliquant au maximum. Utilise une méthodologie "pas à pas", interactive et ludique. Chaque méthode d'exercice doit être expliquée clairement, simplement, et idéalement illustrée d'un mini-exercice d'application direct. Ne parle jamais d'une notion mathématique hors-programme, et n'utilise pas en début de chapitre une notion difficile ou qui ne sera vue qu'en fin de chapitre. Illustre avec des schémas simples, tableaux ou graphiques pour les fonctions.

${FORMAT_RULES}

${patchFormatTwoLevel("chapitre", "lesson", "lessons")}
Un "lesson" complet a les champs : id, title, type, content, duration, exercises[], blocks[], image_url. Un "chapitre" complet a : id, title, lessons[].`;

    const user = `Structure actuelle du cours (JSON) :\n${JSON.stringify(content)}\n\nDemande de modification : ${instruction}`;
    return { system, user, maxTokens: 12000 };
  }

  if (type === "exercise") {
    const system = `Tu es un expert pédagogue en mathématiques pour Educalcul, une plateforme éducative française.
Tu reçois la structure JSON d'un exercice (tableau de pages, chacune avec des blocs : texte, questions, etc.) ainsi qu'une demande de modification de l'enseignant pour le niveau "${level || "6ème"}".

Applique EXACTEMENT la demande, qu'elle soit minime (ex: "corrige l'énoncé de la question 2") ou importante (ex: "ajoute 3 questions sur tel sujet", "ajoute une page entière").
Si tu ajoutes du contenu, respecte EXACTEMENT le même style et niveau de détail que l'existant.
Pour tout nouvel id de page/bloc, génère une chaîne unique du type "page-xxxx", "block-xxxx".

${FORMAT_RULES}

${patchFormatTwoLevel("page", "block", "blocks")}
Un "block" complet a les champs : id, type, title, content, points, correctAnswer, explanation, options... Une "page" complète a : id, title, blocks[].`;

    const user = `Structure actuelle de l'exercice (JSON) :\n${JSON.stringify(content)}\n\nDemande de modification : ${instruction}`;
    return { system, user, maxTokens: 12000 };
  }

  // quiz
  const system = `Tu es un expert pédagogue en mathématiques pour Educalcul, une plateforme éducative française.
Tu reçois la structure JSON d'un quiz (tableau de questions QCM) ainsi qu'une demande de modification de l'enseignant pour le niveau "${level || "6ème"}".

Applique EXACTEMENT la demande, qu'elle soit minime (ex: "corrige l'option B de la question 1") ou importante (ex: "ajoute 3 questions sur tel sujet").
Si tu ajoutes des questions, respecte EXACTEMENT le même style et niveau de détail que l'existant (type "single_choice", 4 options, correctAnswer identique à une option, explanation).
Pour tout nouvel id de question, génère une chaîne unique du type "q-xxxx".

${FORMAT_RULES}

${PATCH_FORMAT}
Ici, chaque élément de "items" est une QUESTION complète (id, text, type, points, options, correctAnswer, explanation).`;

  const user = `Structure actuelle du quiz (JSON) :\n${JSON.stringify(content)}\n\nDemande de modification : ${instruction}`;
  return { system, user, maxTokens: 12000 };
}

export async function POST(req: NextRequest) {
  try {
    const { type, instruction, content, level } = await req.json();

    if (!type || !instruction || content === undefined) {
      return Response.json({ error: "Champs manquants (type, instruction, content)" }, { status: 400 });
    }

    const { system, user, maxTokens } = buildPrompts(type, instruction, content, level);
    const result = (await generateStructuredContent(user, system, 0.5, maxTokens)) as any;

    if (!result || !Array.isArray(result.items)) {
      throw new Error("Réponse IA invalide");
    }

    return Response.json({
      items: result.items,
      deleted: Array.isArray(result.deleted) ? result.deleted : [],
    });
  } catch (e: any) {
    console.error("❌ Erreur ai-edit:", e.message);
    return Response.json({ error: e.message || "Erreur de modification" }, { status: 500 });
  }
}
