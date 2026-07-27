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

const BATCH_SIZE = 3;

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
};

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
  const questionOnly = `Le champ prompt contient uniquement l'énoncé ou la consigne à montrer à l'élève.
Il ne contient jamais la réponse, la correction, une conclusion ni un rappel qui résout directement la question.
Une question directe se termine par « ? ». Une démonstration ou une consigne peut être formulée à l'impératif.`;

  switch (blockType) {
    case "qcm":
      return `${questionOnly}
Chaque question contient exactement : prompt, explanation, points, options et correct_option_indexes.
options contient exactement 4 propositions distinctes, sans préfixe A., B., C. ou D.
correct_option_indexes contient les index 0-based des bonnes propositions, généralement un seul index.
Le texte de prompt ne recopie aucune option.`;
    case "true_false":
      return `${questionOnly}
Chaque question contient exactement : prompt, explanation, points et correct_option_indexes.
Le prompt est une affirmation à juger. correct_option_indexes vaut [0] pour Vrai ou [1] pour Faux.`;
    case "fill_in_the_blank":
      return `${questionOnly}
Chaque question contient exactement : prompt, content, explanation, points et accepted_answers.
content contient 1 à 3 jetons textuels {{1}}, {{2}}, {{3}} dans cet ordre.
accepted_answers contient un tableau d'alternatives par trou, par exemple [[RICH_TEXT],[RICH_TEXT,RICH_TEXT]].
Les jetons {{n}} restent dans un élément text.`;
    case "matching":
      return `${questionOnly}
Chaque question contient exactement : prompt, explanation, points et pairs.
pairs contient 3 à 5 objets {"left":RICH_TEXT,"right":RICH_TEXT}, sans doublon.`;
    case "ordering":
      return `${questionOnly}
Chaque question contient exactement : prompt, explanation, points et items.
items contient 3 à 5 éléments déjà rangés dans l'ordre correct.`;
    case "coding":
      return `${questionOnly}
Chaque question contient exactement : prompt, answer, explanation et points.
answer contient une solution de référence. Aucun HTML ni bloc de code Markdown.`;
    case "standard":
    default:
      return `${questionOnly}
Chaque question contient exactement : prompt, answer, explanation et points.
answer contient uniquement la réponse exacte attendue ; explanation contient la méthode et se termine par la même conclusion.`;
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
  "questions": [QUESTIONS_STRUCTURÉES]
}

RÈGLES :
• questions contient exactement ${options.count} question(s).
• ${options.firstBatch && options.exerciseType === "contextual"
  ? "introduction contient 1 à 2 paragraphes RICH_TEXT de mise en situation."
  : "introduction est exactement []."}
• ${options.firstBatch
  ? `title et description décrivent l'exercice complet de ${options.totalQuestions} questions.`
  : "title et description restent courts et décrivent le même contenu global."}
• Aucun id n'est produit : le serveur crée des ids uniques.
• Recalcule toutes les réponses et explications. Ne conserve jamais de texte d'autocorrection.
• Ne répète jamais une réponse ou une correction dans prompt.
• Réponds uniquement avec le JSON demandé.`;
}

export async function runExerciseGeneration(
  generationId: string,
  params: ExerciseGenerationParams,
  adminId: number,
): Promise<void> {
  const tracker = createGenerationTracker("exercise_generations", generationId);
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
        courseContext = `\nL'exercice est lié au cours « ${course.title} ». Extrait interne à utiliser comme contexte, sans recopier son HTML :\n${JSON.stringify(course.content_json || "").slice(0, 2500)}\n`;
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

        let raw = await generate(
          userPrompt,
          systemPrompt,
          exerciseDraftSchema(count, blockType),
          0.25,
          9_000,
          false,
        );
        let draft = normalizeStructuredExerciseDraft(raw, count, blockType);
        const firstScore = exerciseDraftScore(draft, count, blockType);
        const firstComplete = keepCompleteExerciseQuestions(draft, blockType, count);
        if (firstComplete.questions.length < count) {
          raw = await generate(
            `${userPrompt}\n\nLa réponse précédente était incomplète ou contenait des questions structurellement inutilisables. Renvoie exactement ${count} questions complètes du type ${blockType}, sans HTML, sans $, sans ids, avec toutes les options/réponses/paires/éléments requis par le schéma.`,
            systemPrompt,
            exerciseDraftSchema(count, blockType),
            0.08,
            9_000,
            false,
          );
          const retry = normalizeStructuredExerciseDraft(raw, count, blockType);
          if (exerciseDraftScore(retry, count, blockType) >= firstScore) {
            draft = retry;
          }
        }
        draft = keepCompleteExerciseQuestions(draft, blockType, count);
        if (draft.questions.length === 0) {
          throw new Error(
            `La partie ${batchIndex + 1} n'a produit aucune question ${blockType} complète.`,
          );
        }

        const repaired = await repairInvalidStructuredMath(draft, {
          generate,
          label: `exercice ${subject}, partie ${batchIndex + 1}`,
          enableModelRepair: true,
        });
        draft = keepCompleteExerciseQuestions(
          normalizeStructuredExerciseDraft(repaired.value, count, blockType),
          blockType,
          count,
        );
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
    const combined: StructuredExerciseDraft = {
      title: first?.title || `Exercice : ${subject}`,
      description: first?.description || "",
      introduction: first?.introduction || [],
      questions: results.flatMap((result) => result.draft.questions).slice(0, totalQuestions),
    };

    if (combined.questions.length === 0) {
      throw new Error("Aucune question valide n'a été générée.");
    }

    const compiled = compileStructuredExerciseDraft(combined, {
      blockType,
      exerciseType,
    });

    await tracker.updateProgress({
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

    await tracker.setStatus("done", { exercise_id: exerciseRow.id });
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
