import { NextRequest } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { generateStructuredContentWithSchema } from "@/lib/llm";
import {
  COURSE_BLOCK_SCHEMA_PROMPT,
  RICH_TEXT_SCHEMA_PROMPT,
  STRUCTURED_MATH_OUTPUT_RULES,
  normalizeStructuredCourseChapter,
  normalizeStructuredExerciseDraft,
  normalizeStructuredQuizDraft,
  repairInvalidStructuredMath,
  type StructuredCourseChapter,
  type StructuredExerciseDraft,
  type StructuredQuizDraft,
} from "@/lib/ai/structuredContent";
import {
  courseChapterSchema,
  exerciseDraftSchema,
  quizDraftSchema,
  type JsonSchemaContract,
} from "@/lib/ai/schemas";
import {
  compileStructuredCourseChapter,
  compileStructuredExerciseDraft,
  compileStructuredQuizDraft,
} from "@/lib/ai/compiler";
import {
  normalizeStructuredCoursePedagogy,
  sanitizeStructuredExerciseDraft,
  sanitizeStructuredQuizDraft,
} from "@/lib/ai/pedagogy";

export const maxDuration = 120;

type EditType =
  | "lesson"
  | "chapter"
  | "add_lesson"
  | "add_chapter"
  | "page"
  | "block"
  | "add_page"
  | "add_block"
  | "question"
  | "add_question";

type Generate = <T>(
  userPrompt: string,
  systemPrompt: string,
  contract: JsonSchemaContract,
  temperature?: number,
  maxTokens?: number,
  reasoning?: boolean,
) => Promise<T>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inferExerciseBlockType(value: unknown, instruction: string): string {
  const current = text(asRecord(value).type).toLowerCase();
  if (
    [
      "qcm",
      "true_false",
      "fill_in_the_blank",
      "matching",
      "ordering",
      "coding",
      "standard",
      "text_input",
    ].includes(current)
  ) {
    return current === "text_input" ? "standard" : current;
  }

  const source = instruction.toLowerCase();
  if (/vrai\s*\/\s*faux|vrai ou faux|true.?false/.test(source)) return "true_false";
  if (/texte à trous|texte a trous|trou|compléter|completer/.test(source)) return "fill_in_the_blank";
  if (/associer|association|apparier|matching/.test(source)) return "matching";
  if (/ordre|ordonner|classer|ordering/.test(source)) return "ordering";
  if (/code|algorithme|programmation/.test(source)) return "coding";
  if (/qcm|choix|option|proposition/.test(source)) return "qcm";
  return "standard";
}

function commonSystem(level: string): string {
  return `Tu es un professeur de mathématiques expert pour Educalcul, niveau ${level}.
${STRUCTURED_MATH_OUTPUT_RULES}
${RICH_TEXT_SCHEMA_PROMPT}
Règles absolues :
• applique exactement la demande de l'enseignant ;
• ne produis aucun HTML, aucun Markdown et aucun délimiteur $ ;
• recalcule chaque résultat ;
• n'écris jamais « erreur », « recalculons », « en fait » ou une autocorrection ;
• réponds uniquement avec l'objet JSON conforme au schéma imposé.`;
}

function courseSystem(options: {
  level: string;
  lessonCount: number;
  duration: number;
  includeExercises: boolean;
}): string {
  return `${commonSystem(options.level)}
${COURSE_BLOCK_SCHEMA_PROMPT}
Le chapitre contient exactement ${options.lessonCount} leçon(s).
Chaque leçon a duration = ${options.duration}, 7 à 35 blocs utiles et vise environ 480 à 760 mots.
Ordre pédagogique obligatoire : définition ou contexte, explication, exemple guidé, approfondissement, puis exercice.
Utilise les blocs sign_table et variation_table dédiés ; une variation s'accompagne d'un graph. Une courbe n'est jamais dessinée par figure.
Le chapitre contient au moins un visuel utile : table, sign_table, variation_table, graph ou figure.
${options.includeExercises
  ? "Chaque leçon contient exactement 3 mini-exercices, chacun placé après la notion expliquée ; question ne contient jamais la réponse."
  : "Chaque leçon a exercises = [] et aucun bloc exercise."}
Le serveur crée tous les identifiants.`;
}

function exerciseSystem(level: string, blockType: string, questionCount: number): string {
  return `${commonSystem(level)}
Crée un exercice structuré contenant exactement ${questionCount} question(s).
Chaque question possède prompt, content, answer, explanation, points, options, correct_option_indexes, accepted_answers, pairs et items.
Type demandé : ${blockType}.
• qcm : exactement 4 options, au moins un index correct ;
• true_false : index [0] pour Vrai ou [1] pour Faux ;
• fill_in_the_blank : content contient {{1}}, éventuellement {{2}} et {{3}}, avec accepted_answers correspondants ;
• matching : 3 à 5 pairs ;
• ordering : 3 à 5 items dans l'ordre correct ;
• coding/standard : answer contient la solution attendue.
prompt contient uniquement la question, jamais la réponse ou la correction. Pour un exercice simple hors texte à trous, content vaut {"parts":[]}.
answer contient uniquement la réponse finale ; explanation contient la résolution propre et cohérente.
Les tableaux non utilisés restent vides. Le serveur crée tous les identifiants.`;
}

function quizSystem(level: string, questionCount: number): string {
  return `${commonSystem(level)}
Crée exactement ${questionCount} question(s) de quiz à choix unique.
Chaque question a exactement 4 options plausibles, un correct_option_index entre 0 et 3, une explication et des points.
Le champ text contient seulement l'énoncé : aucune option, aucune lettre A/B/C/D. Les options n'ont aucun préfixe de lettre.
Le serveur crée tous les identifiants.`;
}

async function stabilizeCourse(
  raw: unknown,
  generate: Generate,
  lessonCount: number,
  includeExercises: boolean,
): Promise<StructuredCourseChapter> {
  const normalized = normalizeStructuredCourseChapter(raw, {
    expectedLessonCount: lessonCount,
    durationPerLesson: 30,
    includeExercises,
    maxExercisesPerLesson: includeExercises ? 3 : 0,
  });
  const repaired = await repairInvalidStructuredMath(normalized, {
    generate,
    label: "édition de cours",
    enableModelRepair: true,
  });
  return normalizeStructuredCoursePedagogy(
    repaired.value as StructuredCourseChapter,
  );
}

async function stabilizeExercise(
  raw: unknown,
  generate: Generate,
  questionCount: number,
  blockType: string,
): Promise<StructuredExerciseDraft> {
  const normalized = sanitizeStructuredExerciseDraft(
    normalizeStructuredExerciseDraft(raw, questionCount),
    { blockType, exerciseType: "simple" },
  );
  const repaired = await repairInvalidStructuredMath(normalized, {
    generate,
    label: "édition d'exercice",
    enableModelRepair: true,
  });
  return sanitizeStructuredExerciseDraft(
    repaired.value as StructuredExerciseDraft,
    { blockType, exerciseType: "simple" },
  );
}

async function stabilizeQuiz(
  raw: unknown,
  generate: Generate,
  questionCount: number,
): Promise<StructuredQuizDraft> {
  const normalized = sanitizeStructuredQuizDraft(
    normalizeStructuredQuizDraft(raw, questionCount),
  );
  const repaired = await repairInvalidStructuredMath(normalized, {
    generate,
    label: "édition de quiz",
    enableModelRepair: true,
  });
  return sanitizeStructuredQuizDraft(repaired.value as StructuredQuizDraft);
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRole(request, ["admin"]);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const config = RATE_LIMITS["ai:admin"];
    const rate = await rateLimitWithBackoff(
      `ai:admin:${ip}`,
      config.maxAttempts,
      config.windowMs,
    );
    if (!rate.allowed) {
      return Response.json(
        { error: "Trop de générations IA, réessaie dans quelques minutes." },
        { status: 429 },
      );
    }

    const body = asRecord(await request.json());
    const type = text(body.type) as EditType;
    const instruction = text(body.instruction);
    const content = body.content;
    const level = text(body.level, "6ème");

    const supported: EditType[] = [
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
    if (!supported.includes(type) || !instruction) {
      return Response.json(
        { error: "Type ou instruction invalide." },
        { status: 400 },
      );
    }

    const generate: Generate = async <T>(
      userPrompt: string,
      systemPrompt: string,
      contract: JsonSchemaContract,
      temperature = 0.16,
      maxTokens = 8_000,
      reasoning = false,
    ) =>
      generateStructuredContentWithSchema<T>(
        userPrompt,
        systemPrompt,
        contract,
        temperature,
        maxTokens,
        reasoning,
        request.signal,
      );

    if (
      type === "lesson" ||
      type === "chapter" ||
      type === "add_lesson" ||
      type === "add_chapter"
    ) {
      const current = asRecord(content);
      const existingLessons = asArray(current.lessons);
      const lessonCount =
        type === "add_lesson" || type === "lesson"
          ? 1
          : Math.min(6, Math.max(1, existingLessons.length || 3));
      const duration =
        type === "lesson"
          ? Math.min(90, Math.max(5, finiteNumber(current.duration, 30)))
          : 30;
      const includeExercises =
        type === "lesson"
          ? Array.isArray(current.exercises) && current.exercises.length > 0
          : true;
      const contract = courseChapterSchema({
        lessonCount,
        includeExercises,
        minExercises: includeExercises ? 3 : 0,
        maxExercises: includeExercises ? 3 : 0,
      });
      const user = `Demande : ${instruction}
Contexte actuel : ${JSON.stringify(content ?? {})}
Crée uniquement le chapitre structuré demandé. Pour une édition, conserve le sens, le niveau et les éléments non concernés autant que possible.`;
      const raw = await generate<unknown>(
        user,
        courseSystem({ level, lessonCount, duration, includeExercises }),
        contract,
        0.16,
        lessonCount === 1 ? 10_000 : Math.min(24_000, 7_500 * lessonCount),
      );
      const stable = await stabilizeCourse(raw, generate, lessonCount, includeExercises);
      const compiled = compileStructuredCourseChapter(stable, {
        chapterIndex: 0,
        durationPerLesson: duration,
      });

      if (type === "lesson" || type === "add_lesson") {
        const item = compiled.lessons[0];
        if (type === "lesson" && typeof current.id === "string") item.id = current.id;
        return Response.json({ item });
      }

      if (type === "chapter" && typeof current.id === "string") {
        compiled.id = current.id;
        compiled.lessons = compiled.lessons.map((lesson, index) => {
          const old = asRecord(existingLessons[index]);
          return typeof old.id === "string" ? { ...lesson, id: old.id } : lesson;
        });
      }
      return Response.json({ item: compiled });
    }

    if (
      type === "page" ||
      type === "block" ||
      type === "add_page" ||
      type === "add_block"
    ) {
      const current = asRecord(content);
      const currentBlocks = asArray(current.blocks);
      const blockType = inferExerciseBlockType(
        type === "block" ? content : currentBlocks[0],
        instruction,
      );
      const questionCount =
        type === "page"
          ? Math.min(
              8,
              Math.max(
                1,
                currentBlocks.filter(
                  (entry) => text(asRecord(entry).type) !== "text",
                ).length || 3,
              ),
            )
          : type === "add_page"
            ? 3
            : 1;
      const contract = exerciseDraftSchema(questionCount);
      const raw = await generate<unknown>(
        `Demande : ${instruction}
Contexte actuel : ${JSON.stringify(content ?? {})}`,
        exerciseSystem(level, blockType, questionCount),
        contract,
        0.16,
        Math.min(18_000, 4_500 + questionCount * 2_800),
      );
      const stable = await stabilizeExercise(raw, generate, questionCount, blockType);
      const compiled = compileStructuredExerciseDraft(stable, {
        blockType,
        exerciseType: type === "page" || type === "add_page" ? "contextual" : "simple",
      });
      const page = compiled.contentJson[0];

      if (type === "page" || type === "add_page") {
        if (type === "page" && typeof current.id === "string") page.id = current.id;
        return Response.json({ item: page });
      }

      const item = page.blocks.find((entry) => entry.type !== "text") ?? page.blocks[0];
      if (!item) {
        return Response.json({ error: "Aucun bloc valide généré." }, { status: 422 });
      }
      if (type === "block" && typeof current.id === "string") item.id = current.id;
      return Response.json({ item });
    }

    const current = asRecord(content);
    const contract = quizDraftSchema(1);
    const raw = await generate<unknown>(
      `Demande : ${instruction}
Question actuelle ou contexte : ${JSON.stringify(content ?? {})}`,
      quizSystem(level, 1),
      contract,
      0.14,
      4_500,
    );
    const stable = await stabilizeQuiz(raw, generate, 1);
    const compiled = compileStructuredQuizDraft(stable);
    const item = compiled.questions[0];
    if (!item) {
      return Response.json({ error: "Aucune question valide générée." }, { status: 422 });
    }
    if (type === "question" && typeof current.id === "string") item.id = current.id;
    return Response.json({ item });
  } catch (error) {
    console.error("[ai-edit-structured]", error);
    return Response.json(
      {
        error: sanitizeErrorMessage(
          error instanceof Error ? error.message : String(error),
        ),
      },
      { status: 500 },
    );
  }
}
