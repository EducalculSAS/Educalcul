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
  STRUCTURED_COURSE_PEDAGOGY_RULES,
  normalizeStructuredCoursePedagogy,
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
${STRUCTURED_COURSE_PEDAGOGY_RULES}
Le chapitre contient exactement ${options.lessonCount} leçon(s).
Chaque leçon a duration = ${options.duration}, au moins 7 blocs utiles et une longueur adaptée à sa durée.
Chaque leçon contient une section explicitement nommée « Exemple guidé », « Application guidée » ou « Méthode » avant le premier exercice, puis une section finale « Points-clés à retenir » ou « Synthèse ».
${options.includeExercises
  ? "Chaque leçon contient 2 à 3 mini-exercices. Le champ question ne contient jamais la réponse. Un bloc exercise est placé juste après la notion et l'exemple qui permettent de le résoudre."
  : "Chaque leçon a exercises = [] et aucun bloc exercise."}
Pour une étude de fonction, un bloc graph est obligatoire. Un tableau de variations utilise variation_table et doit être cohérent avec le graph.
Le serveur crée tous les identifiants.`;
}
function exerciseSystem(level: string, blockType: string, questionCount: number): string {
  const common = `${commonSystem(level)}
Crée un exercice structuré contenant exactement ${questionCount} question(s).
Le champ prompt contient uniquement l'énoncé : jamais la réponse, la correction ni les explications.
Le serveur crée tous les identifiants.`;
  if (blockType === "qcm") {
    return `${common}
Chaque question contient uniquement prompt, explanation, points, options et correct_option_indexes.
Il y a exactement 4 options distinctes sans préfixe A./B./C./D., et le prompt ne recopie aucune option.`;
  }
  if (blockType === "true_false") {
    return `${common}
Chaque question contient uniquement prompt, explanation, points et correct_option_indexes. L'index 0 signifie Vrai et l'index 1 signifie Faux.`;
  }
  if (blockType === "fill_in_the_blank") {
    return `${common}
Chaque question contient uniquement prompt, content, explanation, points et accepted_answers. content contient {{1}}, éventuellement {{2}} et {{3}}, avec exactement un tableau de réponses acceptées par trou.`;
  }
  if (blockType === "matching") {
    return `${common}
Chaque question contient uniquement prompt, explanation, points et 3 à 5 pairs distinctes.`;
  }
  if (blockType === "ordering") {
    return `${common}
Chaque question contient uniquement prompt, explanation, points et 3 à 5 items déjà placés dans l'ordre correct.`;
  }
  return `${common}
Chaque question contient uniquement prompt, answer, explanation et points. answer est la réponse exacte ; explanation se termine par la même conclusion.`;
}
function quizSystem(level: string, questionCount: number): string {
  return `${commonSystem(level)}
Crée exactement ${questionCount} question(s) de quiz à choix unique.
Chaque question a exactement 4 options plausibles et distinctes, un correct_option_index entre 0 et 3, une explication et des points.
Le champ text contient uniquement la question : jamais les options, jamais les préfixes A./B./C./D.
Les options ne commencent jamais par A., B., C. ou D.
Le serveur crée tous les identifiants.`;
}

async function stabilizeCourse(
  raw: unknown,
  generate: Generate,
  lessonCount: number,
  duration: number,
  includeExercises: boolean,
): Promise<StructuredCourseChapter> {
  const normalized = normalizeStructuredCourseChapter(raw, {
    expectedLessonCount: lessonCount,
    durationPerLesson: duration,
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
  const normalized = normalizeStructuredExerciseDraft(
    raw,
    questionCount,
    blockType,
  );
  const repaired = await repairInvalidStructuredMath(normalized, {
    generate,
    label: "édition d'exercice",
    enableModelRepair: true,
  });
  return repaired.value as StructuredExerciseDraft;
}

async function stabilizeQuiz(
  raw: unknown,
  generate: Generate,
  questionCount: number,
): Promise<StructuredQuizDraft> {
  const normalized = normalizeStructuredQuizDraft(raw, questionCount);
  const repaired = await repairInvalidStructuredMath(normalized, {
    generate,
    label: "édition de quiz",
    enableModelRepair: true,
  });
  return repaired.value as StructuredQuizDraft;
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
        minExercises: includeExercises ? 2 : 0,
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
      const stable = await stabilizeCourse(
        raw,
        generate,
        lessonCount,
        duration,
        includeExercises,
      );
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
      const contract = exerciseDraftSchema(questionCount, blockType);
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
