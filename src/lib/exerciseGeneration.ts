import { EDUFIG_PROMPT_GUIDE } from "@/lib/figures/promptGuide";
import { getProgrammePromptBlock } from "@/lib/programmes-nationaux";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { auditLog, AuditAction } from "@/lib/auditLog";
import {
  createGenerationTracker,
  createLlmStartGate,
  DEFAULT_LLM_MIN_START_INTERVAL_MS,
  GenerationCancelledError,
} from "@/lib/backgroundGeneration";
import {
  RICH_TEXT_SCHEMA_PROMPT,
  STRUCTURED_MATH_OUTPUT_RULES,
  normalizeStructuredExerciseDraft,
  repairInvalidStructuredMath,
  structuredRichTextToPlainText,
  type StructuredExerciseDraft,
  type StructuredExerciseQuestion,
} from "@/lib/ai/structuredContent";
import {
  exerciseDraftSchema,
  topicAnglesSchema,
} from "@/lib/ai/schemas";
import { compileStructuredExerciseDraft } from "@/lib/ai/compiler";
import {
  sanitizeStructuredExerciseDraft,
} from "@/lib/ai/pedagogy";
import { runStructuredQualityGuard } from "@/lib/ai/qualityGuard";
import { runPhotoExerciseGeneration } from "@/lib/exerciseFromPhoto";
import { buildCourseLevelContext } from "@/lib/ai/courseContext";
import { checkExerciseFigures } from "@/lib/figures/checkContent";
import { answerShownInStatement, stripStatementLeaks } from "@/lib/ai/statementLeaks";

const BATCH_SIZE = 2;

export type ExerciseGenerationParams = {
  exerciseType?: "simple" | "contextual";
  blockType?: string;
  linkedCourseId?: number | string | null;
  subject: string;
  level: string;
  difficulty: string;
  questionCount?: number;
  subjectArea?: string;
  instructions?: string;
  folder_id?: number | null;
  /** Exercice photographié, transcrit puis relu par l'admin : génération dédiée (exerciseFromPhoto.ts). */
  sourceExercise?: string;
  sourceFigureDescription?: string;
  /** Copie fidèle de la source (défaut) ou variante. */
  copyMode?: boolean;
  sourceFigures?: unknown[];
};

/** Exigences de qualité communes aux exercices liés à un cours (génération unitaire et par lots). */
const COURSE_QUALITY_RULES = `EXIGENCES DE QUALITÉ (prioritaires) :
• Niveau : celui du cours et de ses exercices, jamais en dessous. Pas de question triviale d'un niveau inférieur (ex. en 3ème : « quel est le signe de 3/−5 ? » est interdit).
• Chaque question a UNE réponse précise et vérifiable : pas d'ensemble infini, pas de « réponds par une phrase » vague. Si plusieurs réponses sont possibles, demande-les toutes dans un format imposé.
• Titre précis et unique qui dit ce que l'élève va faire (jamais le simple nom du chapitre).
• Explications rigoureuses : chaque affirmation est mathématiquement vraie (attention aux inégalités entre nombres négatifs, aux arrondis, aux unités). Refais le calcul avant d'écrire la réponse.
• Pas de répétition : l'énoncé ne recopie pas deux fois les mêmes données.`;

function clampCount(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, Math.trunc(parsed)))
    : fallback;
}

function buildBatches(total: number): number[] {
  const batches: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    const size = Math.min(BATCH_SIZE, remaining);
    batches.push(size);
    remaining -= size;
  }
  return batches;
}

function richTextHasContent(value: { parts: unknown[] }): boolean {
  return Array.isArray(value.parts) && value.parts.length > 0;
}

function isCompleteExerciseQuestion(
  question: StructuredExerciseQuestion,
  blockType: string,
): boolean {
  if (!richTextHasContent(question.prompt)) return false;
  if (!richTextHasContent(question.explanation)) return false;

  switch (blockType) {
    case "qcm":
      return (
        question.options.length === 4 &&
        question.correctOptionIndexes.length >= 1 &&
        question.correctOptionIndexes.every(
          (index) => index >= 0 && index < question.options.length,
        )
      );
    case "true_false":
      return (
        question.correctOptionIndexes.length === 1 &&
        (question.correctOptionIndexes[0] === 0 ||
          question.correctOptionIndexes[0] === 1)
      );
    case "fill_in_the_blank": {
      const content = structuredRichTextToPlainText(question.content);
      const placeholders = Array.from(content.matchAll(/\{\{(\d+)\}\}/g));
      if (placeholders.length < 1 || placeholders.length > 3) return false;
      const indexes = placeholders.map((match) => Number(match[1]));
      const expectedIndexes = Array.from(
        { length: placeholders.length },
        (_, index) => index + 1,
      );
      return (
        indexes.every((value, index) => value === expectedIndexes[index]) &&
        question.acceptedAnswers.length === placeholders.length &&
        question.acceptedAnswers.every((alternatives) => alternatives.length > 0)
      );
    }
    case "matching":
      return question.pairs.length >= 3 && question.pairs.length <= 5;
    case "ordering":
      return question.items.length >= 3 && question.items.length <= 5;
    case "coding":
    case "standard":
    default:
      return richTextHasContent(question.answer);
  }
}

function exerciseDraftScore(
  draft: StructuredExerciseDraft,
  expectedCount: number,
  blockType: string,
): number {
  const complete = draft.questions.filter((question) =>
    isCompleteExerciseQuestion(question, blockType),
  ).length;
  return complete * 100 + Math.min(draft.questions.length, expectedCount);
}

function keepCompleteExerciseQuestions(
  draft: StructuredExerciseDraft,
  blockType: string,
  expectedCount: number,
): StructuredExerciseDraft {
  return {
    ...draft,
    questions: draft.questions
      .filter((question) => isCompleteExerciseQuestion(question, blockType))
      .slice(0, expectedCount),
  };
}

function exerciseTypeRules(blockType: string): string {
  const common = `Chaque question possède toujours les clés :
{
  "prompt": RICH_TEXT,
  "content": RICH_TEXT,
  "answer": RICH_TEXT,
  "explanation": RICH_TEXT,
  "points": 2,
  "options": [],
  "correct_option_indexes": [],
  "accepted_answers": [],
  "pairs": [],
  "items": []
}`;

  switch (blockType) {
    case "qcm":
      return `${common}
Pour chaque question : options contient exactement 4 RICH_TEXT plausibles ; correct_option_indexes contient les index 0-based des bonnes options, généralement un seul index. answer peut reprendre la bonne option.`;
    case "true_false":
      return `${common}
Chaque question est une affirmation à juger. options reste vide. correct_option_indexes vaut [0] pour Vrai ou [1] pour Faux. answer contient le mot Vrai ou Faux.`;
    case "fill_in_the_blank":
      return `${common}
Le champ content contient 1 à 3 jetons textuels {{1}}, {{2}}, {{3}}. accepted_answers est un tableau par trou ; chaque trou contient un tableau de RICH_TEXT acceptés, par exemple [[RICH_TEXT],[RICH_TEXT,RICH_TEXT]]. answer résume toutes les réponses. Les jetons {{n}} restent dans un élément text.`;
    case "matching":
      return `${common}
Chaque question contient 3 à 5 paires dans pairs : [{"left":RICH_TEXT,"right":RICH_TEXT}]. Les autres tableaux restent vides.`;
    case "ordering":
      return `${common}
Chaque question contient 3 à 5 éléments dans items, déjà dans leur ordre correct. Les autres tableaux restent vides.`;
    case "coding":
      return `${common}
Le prompt et content décrivent l'algorithme ou le code demandé. answer contient une solution de référence structurée en texte et mathématiques. Aucun HTML ni bloc de code Markdown.`;
    default:
      return `${common}
Il s'agit d'une réponse libre courte. answer contient la réponse exacte attendue.`;
  }
}

function buildExerciseSystemPrompt(options: {
  level: string;
  subject: string;
  subjectArea: string;
  difficulty: string;
  blockType: string;
  exerciseType: "simple" | "contextual";
  count: number;
  totalQuestions: number;
  firstBatch: boolean;
  programmeBlock: string;
}): string {
  return `Tu es un professeur de mathématiques expert pour le niveau ${options.level}.
Sujet : ${options.subject}.
Domaine : ${options.subjectArea}.
Difficulté : ${options.difficulty}.
${options.programmeBlock}

${options.exerciseType === "contextual"
  ? "Crée un exercice contextuel cohérent : une mise en situation courte, puis des questions liées dans une progression logique."
  : "Crée des questions autonomes, directes, claires et sans narration inutile."}

${STRUCTURED_MATH_OUTPUT_RULES}

${RICH_TEXT_SCHEMA_PROMPT}

${exerciseTypeRules(options.blockType)}

Structure JSON exacte :
{
  "title": "Titre global en texte brut",
  "description": "Description globale en texte brut",
  "introduction": [RICH_TEXT],
  "questions": [QUESTIONS_STRUCTURÉES_AVEC_RESOURCES]
}

RÈGLES :
• questions contient exactement ${options.count} question(s), distinctes et progressives.
• prompt contient uniquement l'énoncé ou la consigne à afficher à l'élève. N'y écris jamais la réponse, la correction, un résultat déjà calculé ni une phrase d'explication.
• ÉNONCÉ PROPRE (prompt, content et introduction) : uniquement les données de la situation et la consigne. JAMAIS de calcul effectué, de vérification, de démarche, de résultat intermédiaire ni de réponse. Interdits dans l'énoncé : « Vérification : … », « On cherche… », « On calcule… », « … = 210 € », « la probabilité est bien … ». Toute démarche va dans explanation.
• ${options.exerciseType === "simple"
  ? options.blockType === "fill_in_the_blank"
    ? "Pour un texte à trous, content contient seulement le texte à compléter avec les jetons {{1}}, {{2}}, {{3}} ; prompt contient la consigne courte."
    : 'Pour un exercice simple, content vaut exactement {"parts":[]} : toutes les données utiles sont dans prompt, sans réponse.' 
  : "Pour un exercice contextuel, content contient uniquement les données ou le support commun nécessaires à la question, jamais la réponse ni la correction."}
• Chaque question contient resources, tableau de 0 à 2 ressources structurées. Utilise uniquement table, sign_table, variation_table, graph ou edufig (figure). L'ancien type "figure" est réservé aux cas qu'edufig ne couvre pas.
${EDUFIG_PROMPT_GUIDE}
• Utilise une ressource seulement lorsqu'elle sert réellement la question : lecture de courbe, tableau à interpréter, schéma, diagramme ou données.
• Une courbe mathématique utilise exclusivement graph/mathGraph. Une figure SVG sert uniquement aux schémas, camemberts, diagrammes, aires, fractions, frises ou processus ; jamais à tracer une courbe.
• Les ressources sont autorisées dans tous les types d'exercices.
• answer contient uniquement la réponse finale attendue, sans recopier l'énoncé.
• explanation donne une solution propre, cohérente avec answer, sans autocorrection visible.
• Une question évalue une notion principale et comporte au maximum deux sous-questions, sauf demande explicite de l'enseignant.
• ${options.firstBatch && options.exerciseType === "contextual"
  ? "introduction contient 1 à 2 paragraphes RICH_TEXT de mise en situation."
  : "introduction est exactement []."}
• ${options.firstBatch
  ? `title et description décrivent l'exercice complet de ${options.totalQuestions} questions.`
  : "title et description peuvent être des chaînes vides."}
• Aucun id n'est produit : le serveur crée des ids uniques.
• Recalcule toutes les réponses et explications. Ne conserve jamais de texte d'autocorrection.
• Réponds uniquement avec le JSON demandé.`;
}

export async function runExerciseGeneration(
  generationId: string,
  params: ExerciseGenerationParams,
  adminId: number,
): Promise<void> {
  // Exercice inspiré d'une photo : plan par sections puis pages au format « source ».
  if (params.sourceExercise?.trim()) {
    await runPhotoExerciseGeneration(
      generationId,
      {
        subject: params.subject,
        level: params.level,
        difficulty: params.difficulty,
        questionCount: params.questionCount,
        subjectArea: params.subjectArea,
        instructions: params.instructions,
        folder_id: params.folder_id,
        linkedCourseId: params.linkedCourseId,
        blockType: params.blockType,
        sourceExercise: params.sourceExercise,
        sourceFigureDescription: params.sourceFigureDescription,
        copyMode: params.copyMode !== false,
        sourceFigures: params.sourceFigures,
      },
      adminId,
    );
    return;
  }

  const tracker = createGenerationTracker("content_generations", generationId);
  const {
    exerciseType = "simple",
    blockType = "standard",
    linkedCourseId,
    subject,
    level,
    difficulty,
    questionCount,
    subjectArea = "Mathématiques",
    instructions,
    folder_id,
  } = params;

  const totalQuestions = clampCount(questionCount, 5, 1, 30);
  const batches = buildBatches(totalQuestions);
  const configuredInterval = Number(process.env.MISTRAL_MIN_REQUEST_INTERVAL_MS);
  const minInterval =
    Number.isFinite(configuredInterval) && configuredInterval >= 0
      ? configuredInterval
      : DEFAULT_LLM_MIN_START_INTERVAL_MS;
  const generate = createLlmStartGate(minInterval, () => tracker.isCancelRequested());

  try {
    await tracker.setStatus("running");
    await tracker.updateProgress({
      step: "outline",
      current: 0,
      total: batches.length,
      message: "Élaboration du plan de l'exercice...",
    });

    let courseContext = "";
    if (linkedCourseId) {
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("title, content_json")
        .eq("id", linkedCourseId)
        .single();
      if (course) {
        courseContext = `\nL'exercice est lié au cours ci-dessous. Reste strictement dans ses notions et ses méthodes, au niveau de ses exercices, sans recopier son texte. Quand une question porte sur une figure (géométrie, repère, statistiques, probabilités), fournis-la au format edufig, conforme aux données de l'énoncé.\n${COURSE_QUALITY_RULES}\n${buildCourseLevelContext(String(course.title || ""), course.content_json)}\n`;
        // Exercices déjà créés pour ce cours (lots en parallèle) : l'IA choisit un autre sujet, un autre contexte et un
        // autre titre, au lieu de produire trois fois « Repérage dans le plan ».
        const { data: siblings } = await supabaseAdmin
          .from("exercises")
          .select("title")
          .eq("course_id", linkedCourseId)
          .order("created_at", { ascending: false })
          .limit(25);
        const taken = (siblings ?? []).map((e) => String(e.title || "").trim()).filter(Boolean);
        if (taken.length) {
          courseContext += `\nExercices DÉJÀ créés pour ce cours : choisis un autre angle, une autre situation et un titre clairement différent de chacun :\n${taken.map((t) => `- ${t}`).join("\n")}\n`;
        }
      }
    }

    const programmeBlock = getProgrammePromptBlock(level);
    let angles: string[] = [];
    if (totalQuestions > 1) {
      try {
        const plan = (await generate(
          `Sujet : ${subject}\nNiveau : ${level}\n${instructions?.trim() ? `Consignes : ${instructions.trim()}` : ""}`,
          `Tu conçois une évaluation de mathématiques. Retourne uniquement {"angles":["..."]} avec exactement ${totalQuestions} sous-thèmes distincts, complémentaires, courts et sans HTML ni LaTeX.`,
          topicAnglesSchema(totalQuestions),
          0.3,
          2_500,
          false,
        )) as { angles?: unknown[] };
        angles = Array.isArray(plan.angles)
          ? plan.angles
              .filter((angle): angle is string => typeof angle === "string" && angle.trim().length > 0)
              .map((angle) => angle.trim())
              .slice(0, totalQuestions)
          : [];
      } catch {
        angles = [];
      }
    }

    const offsets: number[] = [];
    let offset = 0;
    for (const count of batches) {
      offsets.push(offset);
      offset += count;
    }

    await tracker.updateProgress({
      step: "chapter",
      current: 0,
      total: batches.length,
      message: `Rédaction des ${totalQuestions} question(s) en parallèle...`,
    });

    let completed = 0;
    const results = await Promise.all(
      batches.map(async (count, batchIndex) => {
        const firstBatch = batchIndex === 0;
        const assignedAngles = angles.slice(
          offsets[batchIndex],
          offsets[batchIndex] + count,
        );
        const systemPrompt = buildExerciseSystemPrompt({
          level,
          subject,
          subjectArea,
          difficulty,
          blockType,
          exerciseType,
          count,
          totalQuestions,
          firstBatch,
          programmeBlock,
        });
        const userPrompt = `Génère la partie ${batchIndex + 1}/${batches.length} de l'exercice.
Angles attribués à cette partie :
${assignedAngles.length > 0 ? assignedAngles.map((angle, index) => `${index + 1}. ${angle}`).join("\n") : "Choisis des angles distincts et pertinents."}
${instructions?.trim() ? `Instructions prioritaires de l'enseignant :\n${instructions.trim()}` : ""}
${courseContext}`;

        // Réponse tronquée (max_tokens atteint) : un seul nouvel essai, en exigeant
        // une rédaction beaucoup plus courte et sans figure détaillée.
        const draftCall = async (prompt: string, temperature: number) => {
          try {
            return await generate(prompt, systemPrompt, exerciseDraftSchema(count), temperature, 7_000, false);
          } catch (error) {
            if (!(error instanceof Error) || !error.message.includes("tronquée")) throw error;
            console.warn(`[exercise-ai] partie ${batchIndex + 1} tronquée, nouvel essai plus concis`);
            return await generate(
              `${prompt}\n\nATTENTION : la réponse précédente était trop longue et a été coupée. Sois BEAUCOUP plus concis : explications de 1 à 2 phrases, aucune ressource (figure, graphique, tableau) sauf si la question est impossible sans, jamais de SVG détaillé.`,
              systemPrompt,
              exerciseDraftSchema(count),
              0.1,
              7_000,
              false,
            );
          }
        };
        let raw = await draftCall(userPrompt, 0.25);
        let draft = sanitizeStructuredExerciseDraft(
          normalizeStructuredExerciseDraft(raw, count),
          { blockType, exerciseType },
        );
        const firstScore = exerciseDraftScore(draft, count, blockType);
        const firstComplete = keepCompleteExerciseQuestions(draft, blockType, count);
        if (firstComplete.questions.length < count) {
          raw = await draftCall(
            `${userPrompt}\n\nLa réponse précédente était incomplète ou contenait des questions structurellement inutilisables. Renvoie exactement ${count} questions complètes du type ${blockType}, sans HTML, sans $, sans ids, avec toutes les options/réponses/paires/éléments requis par le schéma.`,
            0.08,
          );
          const retry = sanitizeStructuredExerciseDraft(
            normalizeStructuredExerciseDraft(raw, count),
            { blockType, exerciseType },
          );
          if (exerciseDraftScore(retry, count, blockType) >= firstScore) {
            draft = retry;
          }
        }
        draft = keepCompleteExerciseQuestions(draft, blockType, count);
        if (draft.questions.length === 0) {
          // Une partie ratée ne fait plus échouer tout l'exercice : on garde les questions valides des autres parties
          // (au moins deux au total, vérifié plus bas).
          console.warn(`[exercise-ai] partie ${batchIndex + 1} sans question ${blockType} complète, ignorée`);
          completed += 1;
          return { batchIndex, draft };
        }

        const guarded = await runStructuredQualityGuard(draft, {
          generate,
          label: `exercice ${subject}, partie ${batchIndex + 1}`,
          level,
          subject,
          semanticAudit: true,
        });
        draft = sanitizeStructuredExerciseDraft(guarded.value, {
          blockType,
          exerciseType,
        });
        if (
          guarded.report.semanticPatches > 0 ||
          guarded.report.mathTextRepairs > 0 ||
          guarded.report.removedCurveFigures > 0
        ) {
          console.info(
            `[exercise-ai] Partie ${batchIndex + 1}: ${guarded.report.semanticPatches} correction(s) mathématique(s), ${guarded.report.mathTextRepairs} restructuration(s) LaTeX, ${guarded.report.removedCurveFigures} figure(s) de courbe supprimée(s).`,
          );
        }

        const repaired = await repairInvalidStructuredMath(draft, {
          generate,
          label: `exercice ${subject}, partie ${batchIndex + 1}`,
          enableModelRepair: true,
        });
        draft = repaired.value;
        if (repaired.report.invalidBefore > 0) {
          console.info(
            `[exercise-ai] Partie ${batchIndex + 1}: ${repaired.report.invalidBefore} formule(s) invalides, ${repaired.report.repairedByModel} corrigée(s), ${repaired.report.fallbackCount} repli(s).`,
          );
        }

        completed += 1;
        await tracker.updateProgress({
          step: "chapter",
          current: completed,
          total: batches.length,
          message: `Partie ${batchIndex + 1}/${batches.length} terminée (${draft.questions.length} question(s))`,
        });
        return { batchIndex, draft };
      }),
    );

    results.sort((a, b) => a.batchIndex - b.batchIndex);
    const first = results[0]?.draft;
    const combined = sanitizeStructuredExerciseDraft(
      {
        title: first?.title || `Exercice : ${subject}`,
        description: first?.description || "",
        introduction: first?.introduction || [],
        questions: results
          .flatMap((result) => result.draft.questions)
          .slice(0, totalQuestions),
      },
      { blockType, exerciseType },
    );

    if (combined.questions.length < Math.min(2, totalQuestions)) {
      throw new Error(
        combined.questions.length === 0
          ? `Aucune question ${blockType} complète n'a été générée.`
          : `Une seule question ${blockType} complète a été générée : exercice trop court.`,
      );
    }

    const compiled = compileStructuredExerciseDraft(combined, {
      blockType,
      exerciseType,
    });

    // Chaque figure est confrontée à son énoncé (longueurs, angle droit, parallèles…) : un écart est signalé dans le
    // suivi de la génération pour que l'admin corrige la figure avant publication.
    const figureWarnings = checkExerciseFigures(compiled.contentJson);

    // Énoncés propres : aucune démarche ni réponse dans l'énoncé (elles vont dans la correction).
    let questionNo = 0;
    for (const page of (Array.isArray(compiled.contentJson) ? compiled.contentJson : []) as { blocks?: Record<string, unknown>[] }[]) {
      for (const block of page.blocks ?? []) {
        if (typeof block.content !== "string") continue;
        if (block.type !== "text") questionNo += 1;
        const { html, removed } = stripStatementLeaks(block.content);
        if (removed.length) {
          block.content = html;
          figureWarnings.push(`Question ${questionNo || 1} : démarche retirée de l'énoncé (« ${removed[0]}… »).`);
        }
        if (block.type !== "text" && answerShownInStatement(html, block.correctAnswer)) {
          figureWarnings.push(`Question ${questionNo} : la réponse attendue apparaît dans l'énoncé.`);
        }
      }
    }

    await tracker.updateProgress({
      ...(figureWarnings.length ? { warnings: figureWarnings } : {}),
      step: "final-check",
      current: batches.length + 1,
      total: batches.length + 1,
      message: "Enregistrement de l'exercice...",
    });

    const { data: exerciseRow, error: insertError } = await supabaseAdmin
      .from("exercises")
      .insert({
        title: compiled.title || `Exercice : ${subject}`,
        question: compiled.description || "",
        course_id: linkedCourseId || null,
        difficulty_level: difficulty,
        type: blockType || "standard",
        level,
        status: "draft",
        is_published: false,
        folder_id: folder_id || null,
        thumbnail_url: "",
        content_json: compiled.contentJson,
        time_limit: 20,
        max_attempts: 3,
        estimated_time: 15,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await auditLog({
      action: AuditAction.CONTENT_CREATED,
      adminId,
      targetType: "exercise",
      targetId: String(exerciseRow.id),
      details: {
        title: exerciseRow.title,
        source: "ai_structured_v2_clean",
      },
    });

    await tracker.setStatus("done", { target_id: exerciseRow.id });
  } catch (error: unknown) {
    if (error instanceof GenerationCancelledError) {
      await tracker.setStatus("cancelled");
      return;
    }
    console.error("❌ Erreur génération exercice IA structurée:", error);
    await tracker.setStatus("error", {
      error: error instanceof Error ? error.message : "Erreur de génération",
    });
  }
}
