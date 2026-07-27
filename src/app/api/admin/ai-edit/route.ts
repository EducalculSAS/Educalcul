import { NextRequest } from "next/server";
import { generateStructuredContent } from "@/lib/llm";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import {
  AI_COURSE_FORMAT_RULES,
  auditAnyContentDeep,
  repairAnyContentDeep,
  type CourseQualityIssue,
} from "@/lib/aiCourseContent";

export const maxDuration = 120;

// Mêmes règles de format/LaTeX/figures que la génération de cours/exercices/
// quiz (voir aiCourseContent.ts) — une modification de chapitre/leçon/bloc ne
// doit pas suivre un contrat plus permissif que la génération d'origine.
const FORMAT_RULES = AI_COURSE_FORMAT_RULES;

const PATCH_FORMAT = `═══ FORMAT DE RÉPONSE (TRÈS IMPORTANT) ═══
Modification LOCALISÉE et RAPIDE : ne touche QUE ce que l'enseignant a explicitement demandé. Si la demande porte sur un seul élément (ex: renommer une leçon, corriger une question), ne renvoie QUE cet élément — n'en profite pas pour réécrire ou "améliorer" d'autres éléments non demandés.
Ne renvoie QUE ce qui change. Ne renvoie JAMAIS les éléments inchangés.
⚡ POUR ALLER VITE : pour un élément MODIFIÉ, renvoie son "id" existant + UNIQUEMENT les champs qui changent (ne ré-écris PAS les champs inchangés). Exception : si tu modifies un TABLEAU (ex: "options" d'une question), renvoie le tableau COMPLET. Pour un élément AJOUTÉ, renvoie sa structure complète + un nouvel id unique.
Réponds UNIQUEMENT avec ce JSON, sans texte avant/après :
{
  "items": [ /* éléments MODIFIÉS (id + champs changés) ou AJOUTÉS (structure complète + nouvel id + "after_id": id de l'élément après lequel insérer, ou null pour insérer en 1re position) */ ],
  "deleted": [ /* ids des éléments à supprimer entièrement, sinon [] */ ]
}`;

// Format de réponse à DEUX NIVEAUX (chapitre/leçon ou page/bloc) — permet de ne renvoyer
// QUE la leçon/le bloc modifié(e) sans réécrire tout le chapitre/la page parente.
function patchFormatTwoLevel(
  parentLabel: string,
  childLabel: string,
  parentField: string,
) {
  return `═══ FORMAT DE RÉPONSE (TRÈS IMPORTANT) ═══
Modification LOCALISÉE et RAPIDE : ne touche QUE ce que l'enseignant a explicitement demandé, et renvoie l'élément AU NIVEAU LE PLUS PRÉCIS POSSIBLE.
• Si la demande ne concerne QU'UN(E) SEUL(E) ${childLabel} (ex: renommer son titre, corriger son contenu), renvoie UNIQUEMENT cet(te) ${childLabel} avec "level": "${childLabel}", son "id" existant, et "parent_id": l'id du ${parentLabel} qui le/la contient. NE RENVOIE PAS le ${parentLabel} entier ni ses autres ${childLabel}s.
• Si la demande concerne un ${parentLabel} entier (ex: ajouter un nouveau ${parentLabel}, le réorganiser), renvoie un item avec "level": "${parentLabel}" et la structure complète du ${parentLabel} (y compris son tableau "${parentField}").
⚡ POUR ALLER VITE (essentiel) : pour un élément MODIFIÉ, renvoie son "id" (+ "parent_id"/"level") et UNIQUEMENT les champs qui changent — ne ré-écris PAS les champs inchangés (ex: pour renommer une ${childLabel}, renvoie juste { "id", "parent_id", "level", "title" }). Exception : si tu modifies le tableau "blocks" d'une ${childLabel}, renvoie le tableau "blocks" COMPLET (tous ses éléments). Pour un élément AJOUTÉ uniquement, donne la structure complète.
• Pour ajouter un nouvel élément, inclus "after_id": l'id de l'élément (du même niveau et du même parent) après lequel l'insérer, ou null pour l'insérer en première position. Pour un nouveau ${childLabel}, "parent_id" est obligatoire.
Réponds UNIQUEMENT avec ce JSON, sans texte avant/après :
{
  "items": [ /* éléments "${parentLabel}" ou "${childLabel}" NOUVEAUX/MODIFIÉS, voir règles ci-dessus */ ],
  "deleted": [ /* ids des éléments (de n'importe quel niveau) à supprimer entièrement, sinon [] */ ]
}`;
}

const EX_BLOCK_SCHEMA = `Un "block" a les champs communs : "id", "type", "title", "content" (énoncé/HTML), "points" (nombre), "explanation". Selon "type" :
• "text" : pas de champ supplémentaire (content = HTML).
• "image" : c'est un bloc MÉDIA (image/vidéo/audio) — content contient l'URL du fichier déjà téléversé par l'enseignant ; ne génère JAMAIS toi-même un bloc "image" (tu ne peux pas fournir de fichier), ne le modifie que si on te demande explicitement de changer son titre/légende.
• "qcm" (type à utiliser pour toute question à choix) : "options" (tableau de chaînes), "correctAnswer" TOUJOURS un tableau de chaînes — une seule entrée s'il n'y a qu'une bonne réponse, plusieurs sinon — chaque valeur doit être identique à une entrée de "options". Les anciens types "single_choice"/"multiple_choice" sont équivalents : si tu modifies un bloc existant de ce type, garde son "type" d'origine inchangé.
• "true_false" : "correctAnswer" = "true" ou "false" (chaîne).
• "text_input" : "correctAnswer" (chaîne, réponse exacte attendue).
• "fill_in_the_blank" : "content" contient des jetons {{1}}, {{2}}... à la place des mots manquants ; "blanks" (tableau de chaînes) donne, DANS L'ORDRE, la réponse attendue pour chaque trou (alternatives séparées par "|").
• "matching" : "pairs" (tableau d'objets {"left": "...", "right": "..."}) — éléments à associer.
• "ordering" : "items" (tableau de chaînes) DANS LEUR ORDRE CORRECT — l'élève les verra mélangés et devra les remettre dans cet ordre.
• "coding" : "content" décrit l'algorithme/code à écrire, "correctAnswer" contient une solution de référence (pseudo-code ou code) utilisée par l'IA pour corriger (pas d'exécution réelle).`;
const QUIZ_Q_SCHEMA = `Une "question" a les champs : "id", "text" (énoncé), "type" (single_choice|multiple_choice|true_false|text_input), "points" (nombre), "options" (tableau de chaînes), "correctAnswer" (chaîne, ou tableau pour multiple_choice), "explanation".`;

function buildPrompts(
  type:
    | "course"
    | "exercise"
    | "quiz"
    | "lesson"
    | "chapter"
    | "add_lesson"
    | "add_chapter"
    | "page"
    | "block"
    | "add_page"
    | "add_block"
    | "question"
    | "add_question",
  instruction: string,
  content: unknown,
  level?: string,
) {
  // ── Exercices : édition / création d'une page ou d'un bloc ──
  if (
    type === "page" ||
    type === "add_page" ||
    type === "block" ||
    type === "add_block"
  ) {
    const lvl = level || "6ème";
    const base = `Tu es un expert pédagogue en mathématiques pour Educalcul (plateforme éducative française), niveau "${lvl}".`;
    if (type === "page") {
      const system = `${base}
Tu reçois UNE page d'exercice (titre + blocs) au format JSON et une demande. Applique EXACTEMENT la demande, garde le même "id" de page et les "id" des blocs inchangés.
${FORMAT_RULES}
═══ FORMAT DE RÉPONSE ═══
Réponds UNIQUEMENT avec le JSON de la page COMPLÈTE modifiée { "id", "title", "blocks":[...] }, en conservant tous les blocs non concernés. ${EX_BLOCK_SCHEMA}`;
      const user = `Page actuelle (JSON) :\n${JSON.stringify(content)}\n\nDemande : ${instruction}`;
      return { system, user, maxTokens: 12000 };
    }
    if (type === "block") {
      const system = `${base}
Tu reçois UN bloc d'exercice au format JSON et une demande. Applique EXACTEMENT la demande, garde le même "id".
${FORMAT_RULES}
═══ FORMAT DE RÉPONSE ═══
Réponds UNIQUEMENT avec le JSON du bloc COMPLET modifié. ${EX_BLOCK_SCHEMA}`;
      const user = `Bloc actuel (JSON) :\n${JSON.stringify(content)}\n\nDemande : ${instruction}`;
      return { system, user, maxTokens: 6000 };
    }
    if (type === "add_page") {
      const ctx = (content || {}) as any;
      const system = `${base}
Crée UNE nouvelle page d'exercice (titre + plusieurs blocs/questions) selon la demande.
${FORMAT_RULES}
═══ FORMAT DE RÉPONSE ═══
Réponds UNIQUEMENT avec le JSON de la page { "id":"page-xxxx", "title", "blocks":[...] }. ${EX_BLOCK_SCHEMA}`;
      const user = `Contexte — Exercice : "${ctx.exerciseTitle || ""}".\nPage à créer : ${instruction}`;
      return { system, user, maxTokens: 12000 };
    }
    // add_block
    const ctx = (content || {}) as any;
    const system = `${base}
Crée UN nouveau bloc/question d'exercice selon la demande.
${FORMAT_RULES}
═══ FORMAT DE RÉPONSE ═══
Réponds UNIQUEMENT avec le JSON du bloc { "id":"block-xxxx", ... }. ${EX_BLOCK_SCHEMA}`;
    const user = `Contexte — Page : "${ctx.pageTitle || ""}".\nBloc à créer : ${instruction}`;
    return { system, user, maxTokens: 6000 };
  }

  // ── Quiz : édition / création d'une question ──
  if (type === "question" || type === "add_question") {
    const lvl = level || "6ème";
    const base = `Tu es un expert pédagogue en mathématiques pour Educalcul (plateforme éducative française), niveau "${lvl}".`;
    if (type === "question") {
      const system = `${base}
Tu reçois UNE question de quiz au format JSON et une demande. Applique EXACTEMENT la demande, garde le même "id".
${FORMAT_RULES}
═══ FORMAT DE RÉPONSE ═══
Réponds UNIQUEMENT avec le JSON de la question COMPLÈTE modifiée. ${QUIZ_Q_SCHEMA}`;
      const user = `Question actuelle (JSON) :\n${JSON.stringify(content)}\n\nDemande : ${instruction}`;
      return { system, user, maxTokens: 5000 };
    }
    // add_question
    const ctx = (content || {}) as any;
    const system = `${base}
Crée UNE nouvelle question de quiz QCM selon la demande (type "single_choice" par défaut, 4 options, une bonne réponse, explication).
${FORMAT_RULES}
═══ FORMAT DE RÉPONSE ═══
Réponds UNIQUEMENT avec le JSON de la question { "id":"q-xxxx", ... }. ${QUIZ_Q_SCHEMA}`;
    const user = `Contexte — Quiz : "${ctx.quizTitle || ""}".\nQuestion à créer : ${instruction}`;
    return { system, user, maxTokens: 5000 };
  }
  // ── CRÉATION d'une nouvelle leçon ──
  if (type === "add_lesson") {
    const ctx = (content || {}) as any;
    const system = `Tu es un expert pédagogue en mathématiques pour Educalcul (plateforme éducative française), niveau "${level || "6ème"}".
Crée UNE nouvelle leçon de cours selon la demande de l'enseignant, dans le style d'un cours magistral riche (600-1200 mots) en HTML + LaTeX.

═══ PÉDAGOGIE ═══
Commence par une définition claire, puis un exemple simple, en expliquant pas à pas, de façon ludique. N'utilise jamais une notion hors-programme pour ce niveau. Illustre avec des tableaux/graphiques si pertinent.

${FORMAT_RULES}

═══ FORMAT DE RÉPONSE ═══
Réponds UNIQUEMENT avec le JSON de la leçon, sans texte autour, avec les champs : "id" (chaîne unique "lesson-xxxx"), "title", "type": "text", "content" (le cours en HTML+LaTeX), "duration" (minutes, nombre).`;
    const user = `Contexte — Chapitre : "${ctx.chapterTitle || ""}". Cours : "${ctx.courseTitle || ""}".\nLeçon à créer : ${instruction}`;
    return { system, user, maxTokens: 8000 };
  }

  // ── CRÉATION d'un nouveau chapitre (avec ses leçons) ──
  if (type === "add_chapter") {
    const ctx = (content || {}) as any;
    const system = `Tu es un expert pédagogue en mathématiques pour Educalcul (plateforme éducative française), niveau "${level || "6ème"}".
Crée UN nouveau chapitre complet (titre + plusieurs leçons) selon la demande de l'enseignant. Chaque leçon est un cours magistral riche (600-1200 mots) en HTML + LaTeX.

═══ PÉDAGOGIE ═══
Progression logique : commence par les notions simples avant les difficiles. Définition claire → exemple simple → méthode pas à pas. Jamais de notion hors-programme pour ce niveau.

${FORMAT_RULES}

═══ FORMAT DE RÉPONSE ═══
Réponds UNIQUEMENT avec le JSON du chapitre, sans texte autour : { "id": "chap-xxxx", "title": "...", "lessons": [ { "id": "lesson-xxxx", "title": "...", "type": "text", "content": "<html+latex>", "duration": <nombre> }, ... ] }.`;
    const user = `Contexte — Cours : "${ctx.courseTitle || ""}".\nChapitre à créer : ${instruction}`;
    return { system, user, maxTokens: 14000 };
  }

  // ── Édition CIBLÉE d'une seule leçon (rapide : on n'envoie que la leçon) ──
  if (type === "lesson") {
    const system = `Tu es un expert pédagogue en mathématiques pour Educalcul (plateforme éducative française), niveau "${level || "6ème"}".
Tu reçois UNE seule leçon au format JSON et une demande de modification de l'enseignant.
Applique EXACTEMENT la demande, en ne touchant qu'à ce qui est demandé. Conserve le même "id".
Si tu écris/réécris du contenu de leçon, garde le même style riche (HTML + LaTeX) et le même niveau de détail que l'existant.

═══ PÉDAGOGIE ═══
Commence par une définition claire, puis un exemple simple, en expliquant au maximum, pas à pas. N'utilise jamais une notion hors-programme pour ce niveau.

${FORMAT_RULES}

═══ FORMAT DE RÉPONSE ═══
Réponds UNIQUEMENT avec le JSON de la leçon COMPLÈTE modifiée (mêmes champs : id, title, type, content, duration, exercises, blocks, image_url), sans texte avant/après.`;
    const user = `Leçon actuelle (JSON) :\n${JSON.stringify(content)}\n\nDemande de modification : ${instruction}`;
    return { system, user, maxTokens: 8000 };
  }

  // ── Édition CIBLÉE d'un seul chapitre (on n'envoie que ce chapitre) ──
  if (type === "chapter") {
    const system = `Tu es un expert pédagogue en mathématiques pour Educalcul (plateforme éducative française), niveau "${level || "6ème"}".
Tu reçois UN seul chapitre au format JSON (avec son titre et ses leçons) et une demande de modification de l'enseignant.
Applique EXACTEMENT la demande, en ne touchant qu'à ce qui est demandé. Conserve le même "id" du chapitre et les "id" des leçons inchangées. Pour une nouvelle leçon, génère un id unique "lesson-xxxx".
Si tu écris/réécris du contenu, garde le même style riche (HTML + LaTeX) et le même niveau de détail que l'existant.

═══ PÉDAGOGIE ═══
Commence par une définition claire, puis un exemple simple, pas à pas. N'utilise jamais une notion hors-programme pour ce niveau.

${FORMAT_RULES}

═══ FORMAT DE RÉPONSE ═══
Réponds UNIQUEMENT avec le JSON du chapitre COMPLET modifié (champs : id, title, lessons[]), en conservant TOUTES les leçons qui ne sont pas concernées par la demande, sans texte avant/après.`;
    const user = `Chapitre actuel (JSON) :\n${JSON.stringify(content)}\n\nDemande de modification : ${instruction}`;
    return { system, user, maxTokens: 14000 };
  }

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
    return { system, user, maxTokens: 16000 };
  }

  if (type === "exercise") {
    const system = `Tu es un expert pédagogue en mathématiques pour Educalcul, une plateforme éducative française.
Tu reçois la structure JSON d'un exercice (tableau de pages, chacune avec des blocs : texte, questions, etc.) ainsi qu'une demande de modification de l'enseignant pour le niveau "${level || "6ème"}".

Applique EXACTEMENT la demande, qu'elle soit minime (ex: "corrige l'énoncé de la question 2") ou importante (ex: "ajoute 3 questions sur tel sujet", "ajoute une page entière").
Si tu ajoutes du contenu, respecte EXACTEMENT le même style et niveau de détail que l'existant.
Pour tout nouvel id de page/bloc, génère une chaîne unique du type "page-xxxx", "block-xxxx".

${FORMAT_RULES}

${patchFormatTwoLevel("page", "block", "blocks")}
${EX_BLOCK_SCHEMA} Une "page" complète a : id, title, blocks[].`;

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
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(req, ["admin"]);
    if (!admin)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const config = RATE_LIMITS["ai:admin"];
    const rl = await rateLimitWithBackoff(
      `ai:admin:${ip}`,
      config.maxAttempts,
      config.windowMs,
    );
    if (!rl.allowed) {
      return Response.json(
        { error: "Trop de générations IA, réessaie dans quelques minutes." },
        { status: 429 },
      );
    }

    const { type, instruction, content, level } = await req.json();

    if (!type || !instruction || content === undefined) {
      return Response.json(
        { error: "Champs manquants (type, instruction, content)" },
        { status: 400 },
      );
    }

    const { system, user, maxTokens } = buildPrompts(
      type,
      instruction,
      content,
      level,
    );
    const result = (await generateStructuredContent(
      user,
      system,
      0.5,
      maxTokens,
    )) as any;

    // Édition ciblée / création : l'IA renvoie un objet unique (leçon, chapitre,
    // page, bloc ou question).
    const SINGLE_TYPES = [
      "lesson",
      "chapter",
      "add_lesson",
      "add_chapter",
      "page",
      "block",
      "add_page",
      "add_block",
      "question",
      "add_question",
    ];
    if (SINGLE_TYPES.includes(type)) {
      // Certaines IA encapsulent dans { item: {...} } ou { lesson/page/...: {...} }
      const item =
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        result.id
          ? result
          : result?.item || result?.[type];
      if (!item || typeof item !== "object" || !item.id) {
        throw new Error("Réponse IA invalide");
      }
      // Même filet de sécurité que la génération : répare le LaTeX et
      // signale (sans bloquer, une édition ciblée doit rester rapide) toute
      // anomalie déterministe (auto-correction, symbole Unicode brut, courbe
      // dessinée à la main...) détectée dans l'élément renvoyé.
      const repairedItem = repairAnyContentDeep(item);
      const editIssues: CourseQualityIssue[] = [];
      auditAnyContentDeep(repairedItem, type, editIssues);
      if (editIssues.some((i) => i.severity === "error")) {
        console.warn(`[ai-edit] Anomalies détectées sur "${type}" :`, editIssues);
      }
      return Response.json({ item: repairedItem });
    }

    if (!result || !Array.isArray(result.items)) {
      throw new Error("Réponse IA invalide");
    }

    // Ne garde que les items exploitables (objet avec un id) pour éviter
    // d'injecter des leçons/blocs vides côté client.
    const items = repairAnyContentDeep(
      result.items.filter(
        (it: any) =>
          it &&
          typeof it === "object" &&
          typeof it.id === "string" &&
          it.id.length > 0,
      ),
    );
    const editIssues: CourseQualityIssue[] = [];
    auditAnyContentDeep(items, type, editIssues);
    if (editIssues.some((i) => i.severity === "error")) {
      console.warn(`[ai-edit] Anomalies détectées sur "${type}" :`, editIssues);
    }

    return Response.json({
      items,
      deleted: Array.isArray(result.deleted) ? result.deleted : [],
    });
  } catch (e: any) {
    console.error("❌ Erreur ai-edit:", e);
    return Response.json(
      { error: sanitizeErrorMessage(e?.message || "Erreur de modification") },
      { status: 500 },
    );
  }
}
