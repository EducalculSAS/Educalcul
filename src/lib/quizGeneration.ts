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
  normalizeStructuredQuizDraft,
  repairInvalidStructuredMath,
  structuredRichTextToPlainText,
  type StructuredQuizDraft,
  type StructuredQuizQuestion,
} from "@/lib/ai/structuredContent";
import {
  quizDraftSchema,
  topicAnglesSchema,
} from "@/lib/ai/schemas";
import { compileStructuredQuizDraft } from "@/lib/ai/compiler";
import {
  quizQuestionContainsEmbeddedOptions,
  sanitizeStructuredQuizDraft,
} from "@/lib/ai/pedagogy";

const BATCH_SIZE = 4;

export type QuizGenerationParams = {
  linkedCourseId?: number | string | null;
  subject: string;
  level: string;
  difficulty: string;
  questionCount?: number;
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

function richTextContainsRawMath(value: { parts: Array<{ type: string; value?: string }> }): boolean {
  return value.parts.some((part) => {
    if (part.type !== "text") return false;
    const text = part.value || "";
    return /(?:[A-Za-z][A-Za-z0-9_]*\s*\([^)]*\)\s*[=<>≤≥]|[A-Za-z]\s*['′]\s*=|\b(?:exp|ln|lim|sqrt|sin|cos|tan)\s*\(|\b[A-Za-z]_[A-Za-z0-9]+\b|\d+\s*[/×*^]\s*[A-Za-z0-9]|[=≤≥<>]\s*[A-Za-z0-9])/i.test(text);
  });
}

function isCompleteQuizQuestion(question: StructuredQuizQuestion): boolean {
  const options = question.options.map((option) =>
    structuredRichTextToPlainText(option).trim().toLocaleLowerCase("fr"),
  );
  return (
    question.text.parts.length > 0 &&
    question.options.length === 4 &&
    options.every(Boolean) &&
    new Set(options).size === 4 &&
    question.correctOptionIndex >= 0 &&
    question.correctOptionIndex < question.options.length &&
    question.explanation.parts.length > 0 &&
    !quizQuestionContainsEmbeddedOptions(question) &&
    !richTextContainsRawMath(question.text) &&
    !question.options.some(richTextContainsRawMath) &&
    !richTextContainsRawMath(question.explanation)
  );
}

function quizDraftScore(draft: StructuredQuizDraft, expectedCount: number): number {
  const complete = draft.questions.filter(isCompleteQuizQuestion).length;
  return complete * 100 + Math.min(draft.questions.length, expectedCount);
}

function keepCompleteQuizQuestions(
  draft: StructuredQuizDraft,
  expectedCount: number,
): StructuredQuizDraft {
  return {
    ...draft,
    questions: draft.questions
      .filter(isCompleteQuizQuestion)
      .slice(0, expectedCount),
  };
}

function buildQuizSystemPrompt(options: {
  level: string;
  subject: string;
  difficulty: string;
  count: number;
  totalQuestions: number;
  firstBatch: boolean;
  programmeBlock: string;
}): string {
  return `Tu es un professeur de mathématiques expert qui crée un QCM pour le niveau ${options.level}.
Sujet : ${options.subject}.
Difficulté : ${options.difficulty}.
${options.programmeBlock}

${STRUCTURED_MATH_OUTPUT_RULES}

${RICH_TEXT_SCHEMA_PROMPT}

Structure JSON exacte :
{
  "title": "Titre global en texte brut",
  "description": "Description globale en texte brut",
  "time_limit": 10,
  "max_attempts": 3,
  "questions": [
    {
      "text": RICH_TEXT,
      "options": [RICH_TEXT, RICH_TEXT, RICH_TEXT, RICH_TEXT],
      "correct_option_index": 0,
      "explanation": RICH_TEXT,
      "points": 1,
      "resources": []
    }
  ]
}

RÈGLES :
• questions contient exactement ${options.count} question(s), distinctes et progressives.
• Le champ text contient uniquement le tronc commun de la question. Il ne contient JAMAIS les quatre propositions, aucune lettre A/B/C/D et aucune copie des options.
• Chaque élément de options contient uniquement le texte de la proposition, sans préfixe A., B., C., D., 1., 2., etc.
• Chaque question a exactement 4 options, une seule réponse correcte et correct_option_index est un entier 0, 1, 2 ou 3.
• Chaque question contient resources, tableau de 0 ou 1 ressource structurée parmi table, sign_table, variation_table, graph ou figure.
• Les quiz peuvent demander de lire une courbe, un tableau, un camembert, un diagramme ou un schéma. Toute courbe mathématique utilise exclusivement graph/mathGraph ; figure/SVG est réservé aux schémas et diagrammes, jamais aux courbes.
• Toute écriture mathématique dans text, options et explanation doit être un objet math dans RICH_TEXT. Interdiction d'écrire exp(x), y' = y, N(t), ln(2)/lambda ou une égalité mathématique en texte brut.
• Les symboles, variables, nombres dans une formule, dérivées, limites, fractions, intervalles et équations sont toujours placés dans un part {"type":"math","latex":"..."}.
• Les distracteurs sont plausibles, distincts et issus d'erreurs fréquentes, mais ils ne sont jamais des variantes purement typographiques de la bonne réponse.
• L'explication recalcule la réponse, nomme clairement le raisonnement correct et explique les distracteurs lorsque c'est utile. Elle ne contient aucune autocorrection visible.
• ${options.firstBatch
  ? `title et description concernent le quiz complet de ${options.totalQuestions} questions.`
  : "title et description peuvent être des chaînes vides."}
• Aucun id n'est produit : le serveur génère q-1, q-2, etc.
• Aucun HTML, aucun Markdown et aucun délimiteur $.
• Réponds uniquement avec le JSON demandé.`;
}

export async function runQuizGeneration(
  generationId: string,
  params: QuizGenerationParams,
  adminId: number,
): Promise<void> {
  const tracker = createGenerationTracker("quiz_generations", generationId);
  const {
    linkedCourseId,
    subject,
    level,
    difficulty,
    questionCount,
    instructions,
    folder_id,
  } = params;

  const totalQuestions = clampCount(questionCount, 7, 1, 40);
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
      message: "Élaboration du plan du quiz...",
    });

    let courseContext = "";
    if (linkedCourseId) {
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("title, content_json")
        .eq("id", linkedCourseId)
        .single();
      if (course) {
        courseContext = `\nLe quiz est lié au cours « ${course.title} ». Extrait interne, à utiliser sans recopier le HTML :\n${JSON.stringify(course.content_json || "").slice(0, 2500)}\n`;
      }
    }

    const programmeBlock = getProgrammePromptBlock(level);
    let angles: string[] = [];
    if (totalQuestions > 1) {
      try {
        const plan = (await generate(
          `Sujet : ${subject}\nNiveau : ${level}\n${instructions?.trim() ? `Consignes : ${instructions.trim()}` : ""}`,
          `Tu conçois un QCM de mathématiques. Retourne uniquement {"angles":["..."]} avec exactement ${totalQuestions} sous-thèmes distincts, complémentaires et courts, sans HTML ni LaTeX.`,
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
        const assignedAngles = angles.slice(
          offsets[batchIndex],
          offsets[batchIndex] + count,
        );
        const systemPrompt = buildQuizSystemPrompt({
          level,
          subject,
          difficulty,
          count,
          totalQuestions,
          firstBatch: batchIndex === 0,
          programmeBlock,
        });
        const userPrompt = `Génère la partie ${batchIndex + 1}/${batches.length} du quiz.
Angles attribués :
${assignedAngles.length > 0 ? assignedAngles.map((angle, index) => `${index + 1}. ${angle}`).join("\n") : "Choisis des angles distincts et pertinents."}
${instructions?.trim() ? `Instructions prioritaires de l'enseignant :\n${instructions.trim()}` : ""}
${courseContext}`;

        let raw = await generate(
          userPrompt,
          systemPrompt,
          quizDraftSchema(count),
          0.25,
          8_000,
          false,
        );
        let draft = sanitizeStructuredQuizDraft(
          normalizeStructuredQuizDraft(raw, count),
        );
        const firstScore = quizDraftScore(draft, count);
        const firstComplete = keepCompleteQuizQuestions(draft, count);
        if (firstComplete.questions.length < count) {
          raw = await generate(
            `${userPrompt}\n\nLa sortie précédente était incomplète ou contenait une question inutilisable. Renvoie exactement ${count} questions complètes, chacune avec exactement 4 options distinctes, un correct_option_index valide et une explication, sans HTML, sans $ et sans ids. Toute écriture mathématique doit être dans un part math, y compris dans les options et explications.`,
            systemPrompt,
            quizDraftSchema(count),
            0.08,
            8_000,
            false,
          );
          const retry = sanitizeStructuredQuizDraft(
            normalizeStructuredQuizDraft(raw, count),
          );
          if (quizDraftScore(retry, count) >= firstScore) draft = retry;
        }
        draft = keepCompleteQuizQuestions(draft, count);
        if (draft.questions.length === 0) {
          throw new Error(
            `La partie ${batchIndex + 1} n'a produit aucune question de quiz complète.`,
          );
        }

        const repaired = await repairInvalidStructuredMath(draft, {
          generate,
          label: `quiz ${subject}, partie ${batchIndex + 1}`,
          enableModelRepair: true,
        });
        draft = repaired.value;
        if (repaired.report.invalidBefore > 0) {
          console.info(
            `[quiz-ai] Partie ${batchIndex + 1}: ${repaired.report.invalidBefore} formule(s) invalides, ${repaired.report.repairedByModel} corrigée(s), ${repaired.report.fallbackCount} repli(s).`,
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
    const combined = sanitizeStructuredQuizDraft({
      title: first?.title || `Quiz : ${subject}`,
      description: first?.description || "",
      timeLimit: first?.timeLimit || 10,
      maxAttempts: first?.maxAttempts || 3,
      questions: results
        .flatMap((result) => result.draft.questions)
        .slice(0, totalQuestions),
    });

    if (combined.questions.length === 0) {
      throw new Error("Aucune question valide n'a été générée.");
    }

    const compiled = compileStructuredQuizDraft(combined);

    await tracker.updateProgress({
      step: "final-check",
      current: batches.length + 1,
      total: batches.length + 1,
      message: "Enregistrement du quiz...",
    });

    const { data: quizRow, error: insertError } = await supabaseAdmin
      .from("quizzes")
      .insert({
        title: compiled.title || `Quiz : ${subject}`,
        description: compiled.description || "",
        course_id: linkedCourseId || null,
        time_limit_minutes: compiled.timeLimit,
        status: "draft",
        folder_id: folder_id || null,
        thumbnail_filename: "",
        content_json: compiled.questions,
        type: "standard",
        level,
        difficulty_level: difficulty,
        max_attempts: compiled.maxAttempts,
        grading_type: "auto",
        estimated_time: 15,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await auditLog({
      action: AuditAction.CONTENT_CREATED,
      adminId,
      targetType: "quiz",
      targetId: String(quizRow.id),
      details: {
        title: quizRow.title,
        source: "ai_structured_v2_clean",
      },
    });

    await tracker.setStatus("done", { quiz_id: quizRow.id });
  } catch (error: unknown) {
    if (error instanceof GenerationCancelledError) {
      await tracker.setStatus("cancelled");
      return;
    }
    console.error("❌ Erreur génération quiz IA structurée:", error);
    await tracker.setStatus("error", {
      error: error instanceof Error ? error.message : "Erreur de génération",
    });
  }
}
