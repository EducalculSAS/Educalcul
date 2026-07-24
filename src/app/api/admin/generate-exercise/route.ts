import { NextRequest, NextResponse } from "next/server";
import { generateStructuredContent } from "@/lib/llm";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getProgrammePromptBlock } from "@/lib/programmes-nationaux";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { requireRole } from "@/lib/apiAuth";

export const maxDuration = 120;

const BATCH_SIZE = 3;

// Type d'exercice (choisi par l'admin) → type de bloc réellement généré.
// C'est ce mapping qui manquait : avant, l'IA produisait toujours des blocs
// "text_input" quel que soit le type sélectionné dans le formulaire.
const BLOCK_TYPE_SCHEMAS: Record<string, { example: string; instruction: (count: number) => string }> = {
  standard: {
    example: `{
      "id": "block-1",
      "type": "text_input",
      "title": "Consigne explicite de la question",
      "content": "Texte optionnel d'aide ou reformulation",
      "points": 2,
      "correctAnswer": "réponse attendue",
      "explanation": "explication de la correction"
    }`,
    instruction: (count) => `Génère exactement ${count} question(s) de type "text_input" (réponse libre) dans "blocks".`,
  },
  qcm: {
    example: `{
      "id": "block-1",
      "type": "qcm",
      "title": "Consigne explicite de la question",
      "content": "Énoncé de la question",
      "points": 2,
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": ["Option A"],
      "explanation": "explication de la correction"
    }`,
    instruction: (count) => `Génère exactement ${count} question(s) de type "qcm" dans "blocks" (4 options plausibles). "correctAnswer" est TOUJOURS un tableau — une seule bonne réponse la plupart du temps (ex: ["Option A"]), mais plusieurs si pertinent (ex: ["Option A", "Option C"]). Chaque valeur du tableau doit être identique à l'une des chaînes de "options".`,
  },
  fill_in_the_blank: {
    example: `{
      "id": "block-1",
      "type": "fill_in_the_blank",
      "title": "Consigne explicite de la question",
      "content": "Texte de la phrase avec des trous, ex: 3 + 5 = {{1}} et 5 - 2 = {{2}}",
      "points": 2,
      "blanks": ["8", "3"],
      "explanation": "explication de la correction"
    }`,
    instruction: (count) => `Génère exactement ${count} question(s) de type "fill_in_the_blank" dans "blocks". Le champ "content" contient le texte avec des jetons {{1}}, {{2}}... à la place des mots/valeurs manquants (au moins 1 trou, 3 maximum par question) ; "blanks" contient, DANS L'ORDRE, la réponse attendue pour chaque trou (alternatives acceptées séparées par "|", ex: "8|huit").`,
  },
  matching: {
    example: `{
      "id": "block-1",
      "type": "matching",
      "title": "Consigne explicite de la question",
      "content": "Relie chaque expression à sa valeur simplifiée",
      "points": 3,
      "pairs": [
        { "left": "Élément à relier", "right": "Correspondance exacte" },
        { "left": "Élément à relier", "right": "Correspondance exacte" }
      ],
      "explanation": "explication de la correction"
    }`,
    instruction: (count) => `Génère exactement ${count} question(s) de type "matching" dans "blocks". Chaque question a "pairs" : un tableau de 3 à 5 paires {left, right} à associer (ex: expression ↔ résultat, terme ↔ définition).`,
  },
  ordering: {
    example: `{
      "id": "block-1",
      "type": "ordering",
      "title": "Consigne explicite de la question",
      "content": "Remets les étapes dans le bon ordre",
      "points": 2,
      "items": ["Étape 1 (dans le bon ordre)", "Étape 2", "Étape 3"],
      "explanation": "explication de la correction"
    }`,
    instruction: (count) => `Génère exactement ${count} question(s) de type "ordering" dans "blocks". "items" contient 3 à 5 éléments (étapes d'une résolution, valeurs à ranger, etc.) DANS LEUR ORDRE CORRECT — l'élève les verra mélangés et devra les remettre dans cet ordre.`,
  },
  coding: {
    example: `{
      "id": "block-1",
      "type": "coding",
      "title": "Consigne explicite de la question",
      "content": "Décris précisément l'algorithme ou le code à écrire",
      "points": 3,
      "correctAnswer": "Pseudo-code ou code de référence attendu, avec les étapes clés",
      "explanation": "explication de la correction"
    }`,
    instruction: (count) => `Génère exactement ${count} question(s) de type "coding" dans "blocks". "content" décrit précisément l'algorithme/le code à écrire ; "correctAnswer" contient une solution de référence (pseudo-code ou code) qui servira de base à la correction par IA — pas de code réellement exécuté, la correction jugera la démarche et la logique.`,
  },
};

export async function POST(req: NextRequest) {
  // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const config = RATE_LIMITS["ai:admin"];
  const rl = rateLimitWithBackoff(`ai:admin:${ip}`, config.maxAttempts, config.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Trop de générations IA, réessaie dans quelques minutes." }, { status: 429 });
  }

  const body = await req.json();
  const {
    exerciseType,
    blockType,
    linkedCourseId,
    subject,
    level,
    difficulty,
    questionCount,
    subjectArea,
    instructions,
  } = body;

  if (!subject || !difficulty || !level || !exerciseType) {
    return Response.json(
      { error: "Missing required fields (subject, difficulty, level, exerciseType)" },
      { status: 400 }
    );
  }

  const schema = BLOCK_TYPE_SCHEMAS[blockType as string] || BLOCK_TYPE_SCHEMAS.standard;

  const totalQuestions = questionCount || 5;
  const batches: number[] = [];
  let remaining = totalQuestions;
  while (remaining > 0) {
    const n = Math.min(BATCH_SIZE, remaining);
    batches.push(n);
    remaining -= n;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      try {
        send({ type: "progress", step: "outline", current: 0, total: batches.length, message: "Élaboration du plan de l'exercice..." });

        let courseContext = "";
        if (linkedCourseId) {
          const { data: course } = await supabaseAdmin
            .from("courses")
            .select("title, content_json")
            .eq("id", linkedCourseId)
            .single();
          if (course) {
            const summary = JSON.stringify(course.content_json || "").slice(0, 2000);
            courseContext = `\n\nL'exercice doit être lié au cours "${course.title}". Voici un extrait du contenu du cours pour t'aider à rester cohérent :\n${summary}\n`;
          }
        }

        const typeInstruction =
          exerciseType === "simple"
            ? "Crée un exercice de calcul direct. Chaque question est autonome, courte, avec une consigne claire. Pas de contexte narratif."
            : "Crée un exercice long avec une introduction narrative (mise en situation), puis des questions numérotées qui se suivent logiquement. Chaque question a une consigne explicite.";

        const programmeBlock = getProgrammePromptBlock(level);

        // ── PLAN : répartit le contenu en angles DISTINCTS (un par question) pour
        // que les lots, générés en parallèle, ne se répètent pas (comme les cours). ──
        let angles: string[] = [];
        if (totalQuestions > 1) {
          try {
            const planSystem = `Tu es un concepteur d'évaluations en mathématiques (niveau ${level}).
Propose EXACTEMENT ${totalQuestions} angles/sous-thèmes de questions DISTINCTS et COMPLÉMENTAIRES sur "${subject}" (domaine ${subjectArea || "Mathématiques"}), difficulté ${difficulty}, SANS aucun recoupement entre eux.${instructions && String(instructions).trim() ? " Couvre EXACTEMENT le programme de l'enseignant fourni, notion par notion." : ""}
Réponds UNIQUEMENT en JSON : { "angles": ["angle 1", "angle 2", ...] } avec ${totalQuestions} angles courts et précis.`;
            const planUser = `Sujet : ${subject}\nNiveau : ${level}${instructions && String(instructions).trim() ? `\nProgramme de l'enseignant :\n${String(instructions).trim()}` : ""}`;
            const plan = (await generateStructuredContent(planUser, planSystem, 0.5)) as { angles?: string[] };
            angles = (plan?.angles || []).filter((a): a is string => !!a && !!a.trim()).slice(0, totalQuestions);
          } catch { angles = []; }
        }
        // Offsets cumulés pour assigner une tranche d'angles à chaque lot.
        const offsets: number[] = [];
        { let acc = 0; for (const c of batches) { offsets.push(acc); acc += c; } }

        send({
          type: "progress",
          step: "chapter",
          current: 0,
          total: batches.length,
          message: `Rédaction des ${totalQuestions} question(s) en parallèle...`,
        });

        let completed = 0;
        const results = await Promise.all(batches.map(async (count, batchIndex) => {
          const myAngles = angles.slice(offsets[batchIndex], offsets[batchIndex] + count);
          const otherAngles = angles.filter((_, i) => i < offsets[batchIndex] || i >= offsets[batchIndex] + count);
          const isFirst = batchIndex === 0;
          const firstBlockHint =
            isFirst && exerciseType === "contextual"
              ? `Pour un exercice contextuel, le premier bloc de la page doit être de type "text" avec une introduction HTML (mise en situation, contexte narratif). Puis viennent les blocs questions.`
              : `Ne mets PAS de bloc d'introduction, uniquement des blocs questions.`;

          const systemPrompt = `Tu es un professeur de mathématiques expert qui crée des exercices pour le niveau scolaire "${level}".
${programmeBlock ? programmeBlock + "\n" : ""}${typeInstruction}

Domaine : ${subjectArea || "Mathématiques"}.
Difficulté : ${difficulty}.

${firstBlockHint}
${isFirst ? `Donne aussi un titre et une description globale pour l'exercice complet (qui contiendra ${totalQuestions} questions au total, réparties en plusieurs parties).` : `Ne te préoccupe pas du titre/description globaux, concentre-toi uniquement sur les questions de cette partie.`}

Tu DOIS répondre UNIQUEMENT avec un objet JSON valide respectant exactement cette structure :
{
  "title": "Titre de l'exercice",
  "description": "Description courte",
  "type": "${blockType || "standard"}",
  "grading_type": "ai",
  "difficulty_level": "${difficulty}",
  "time_limit": 20,
  "max_attempts": 3,
  "blocks": [
    ${
      isFirst && exerciseType === "contextual"
        ? `{ "id": "block-intro", "type": "text", "content": "<p>Texte d'introduction et mise en situation...</p>" },`
        : ""
    }
    ${schema.example}
  ]
}

═══ TABLEAUX & GRAPHIQUES (à utiliser SI PERTINENT, sans en abuser) ═══
• Si l'exercice s'y prête (étude de fonction, signe, variations, tableau de valeurs), tu peux insérer dans le "content" d'un bloc "text" un tableau au format :
  <table class="math-table math-table-sign"><thead><tr><th>x</th>...</tr></thead><tbody><tr><td>...</td></tr></tbody></table>
  (classes possibles : math-table-value, math-table-sign, math-table-variation). Utilise ↗, ↘, +, -, 0, ∞, ‖ pour les signes/variations.
• Pour une courbe simple, insère un placeholder de graphique au format :
  <div class="math-graph-placeholder" data-function="x^2 - 2*x + 1" data-xmin="-5" data-xmax="5"></div>
• N'insère ces éléments QUE quand ils apportent une vraie valeur pédagogique pour ce type d'exercice.

${schema.instruction(count)} Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`;

          const userPrompt = `Sujet : ${subject}
Niveau : ${level}
Difficulté : ${difficulty}
Domaine : ${subjectArea || "Mathématiques"}
Cette partie doit contenir ${count} question(s) (sur un total de ${totalQuestions} pour l'exercice entier, réparti en ${batches.length} partie(s)).
${myAngles.length ? `
═══ ANGLES ASSIGNÉS À CETTE PARTIE (un angle par question, dans cet ordre) ═══
${myAngles.map((a, idx) => `${idx + 1}. ${a}`).join("\n")}
${otherAngles.length ? `NE TRAITE PAS ces angles (réservés aux autres parties) : ${otherAngles.join(" ; ")}.\n` : ""}RÈGLE ANTI-RÉPÉTITION : chaque question porte sur un angle DISTINCT ci-dessus, aucune redite avec les autres parties.
` : ""}${instructions && String(instructions).trim() ? `
═══ ⚠️ INSTRUCTIONS PRIORITAIRES DE L'ENSEIGNANT — À RESPECTER À LA LETTRE ═══
Ces consignes PRIMENT sur tout choix par défaut. Génère les questions en couvrant EXACTEMENT les notions/contenus demandés ci-dessous, sans rien ajouter hors-programme ni omettre :
«««
${String(instructions).trim()}
»»»
` : ""}${courseContext}`;

          const generated = (await generateStructuredContent(userPrompt, systemPrompt, 0.7)) as any;

          completed++;
          send({
            type: "progress",
            step: "chapter",
            current: completed,
            total: batches.length,
            message: `Partie ${batchIndex + 1}/${batches.length} terminée (${count} question(s))`,
          });

          return { batchIndex, generated };
        }));

        results.sort((a, b) => a.batchIndex - b.batchIndex);

        const first = results[0]?.generated || {};
        // Chaque lot génère ses ids indépendamment (ex: "block-1", "block-2") en
        // suivant l'exemple du prompt → collisions garanties une fois les lots
        // fusionnés. On renumérote pour garantir l'unicité (sinon éditer un bloc
        // dans l'éditeur en modifie un autre partageant le même id).
        const blocks = results
          .flatMap((r) => r.generated?.blocks || [])
          .map((b: any, i: number) => ({ ...b, id: `block-${i + 1}` }));

        send({
          type: "done",
          data: {
            content: [
              {
                id: "page-1",
                title: exerciseType === "contextual" ? "Présentation" : "Questions",
                blocks,
              },
            ],
            metadata: {
              title: first.title,
              description: first.description,
              type: blockType || first.type || "standard",
              grading_type: first.grading_type || "ai",
              difficulty_level: first.difficulty_level || difficulty,
              level,
              time_limit: first.time_limit || 20,
              max_attempts: first.max_attempts || 3,
            },
          },
        });
      } catch (error: any) {
        console.error("❌ Erreur génération exercice IA:", error);
        send({ type: "error", message: sanitizeErrorMessage(error?.message || "Erreur de génération") });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
