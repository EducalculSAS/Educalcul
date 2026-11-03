
import { JsonSchema, noExtra, courseBlock, courseExercise } from "./blockSchemas";


import { JsonSchemaContract } from "./exerciseSchemas";
export * from "./exerciseSchemas";
export function courseBlueprintSchema(options: {
  chapterCount: number;
  lessonsPerChapter: number;
}): JsonSchemaContract {
  const lesson = {
    type: "object",
    properties: {
      title: { type: "string", minLength: 1 },
      objective: { type: "string", minLength: 1 },
      scope: { type: "string", minLength: 1 },
      core_concepts: {
        type: "array",
        minItems: 2,
        maxItems: 7,
        items: { type: "string", minLength: 1 },
      },
      prerequisite_recall: {
        type: "array",
        minItems: 0,
        maxItems: 4,
        items: { type: "string", minLength: 1 },
      },
      visual_focus: {
        type: "string",
        enum: [
          "graph",
          "variation_table",
          "sign_table",
          "table",
          "figure",
          "none",
        ],
      },
      complexity: { type: "integer", minimum: 1, maximum: 3 },
    },
    required: [
      "title",
      "objective",
      "scope",
      "core_concepts",
      "prerequisite_recall",
      "visual_focus",
      "complexity",
    ],
    ...noExtra,
  } as JsonSchema;

  return {
    name: "educalcul_course_blueprint",
    description:
      "Plan global exact d'un cours, avec répartition exclusive des notions entre les leçons.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 },
        chapters: {
          type: "array",
          minItems: options.chapterCount,
          maxItems: options.chapterCount,
          items: {
            type: "object",
            properties: {
              title: { type: "string", minLength: 1 },
              scope: { type: "string", minLength: 1 },
              lessons: {
                type: "array",
                minItems: options.lessonsPerChapter,
                maxItems: options.lessonsPerChapter,
                items: lesson,
              },
            },
            required: ["title", "scope", "lessons"],
            ...noExtra,
          },
        },
      },
      required: ["title", "description", "chapters"],
      ...noExtra,
    },
  };
}

export function courseChapterSchema(options: {
  lessonCount: number;
  includeExercises: boolean;
  minExercises: number;
  maxExercises: number;
}): JsonSchemaContract {
  const exerciseMin = options.includeExercises ? options.minExercises : 0;
  const exerciseMax = options.includeExercises ? options.maxExercises : 0;
  return {
    name: "educalcul_course_chapter",
    description: "Chapitre Educalcul en blocs structurés, sans HTML ni délimiteur LaTeX.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 },
        lessons: {
          type: "array",
          minItems: options.lessonCount,
          maxItems: options.lessonCount,
          items: {
            type: "object",
            properties: {
              title: { type: "string", minLength: 1 },
              duration: { type: "number", minimum: 5, maximum: 90 },
              blocks: {
                type: "array",
                minItems: 7,
                maxItems: 45,
                items: courseBlock,
              },
              exercises: {
                type: "array",
                minItems: exerciseMin,
                maxItems: exerciseMax,
                items: courseExercise,
              },
            },
            required: ["title", "duration", "blocks", "exercises"],
            ...noExtra,
          },
        },
      },
      required: ["title", "lessons"],
      ...noExtra,
    },
  };
}

export function mathRepairSchema(issueCount: number): JsonSchemaContract {
  return {
    name: "educalcul_math_repairs",
    description: "Corrections ciblées de corps LaTeX invalides.",
    schema: {
      type: "object",
      properties: {
        repairs: {
          type: "array",
          minItems: issueCount,
          maxItems: issueCount,
          items: {
            type: "object",
            properties: {
              id: { type: "string", minLength: 1 },
              latex: { type: "string", minLength: 1 },
            },
            required: ["id", "latex"],
            ...noExtra,
          },
        },
      },
      required: ["repairs"],
      ...noExtra,
    },
  };
}

export function topicAnglesSchema(count: number): JsonSchemaContract {
  return {
    name: "educalcul_topic_angles",
    description: "Sous-thèmes distincts pour une génération pédagogique.",
    schema: {
      type: "object",
      properties: {
        angles: {
          type: "array",
          minItems: count,
          maxItems: count,
          items: { type: "string", minLength: 1 },
        },
      },
      required: ["angles"],
      ...noExtra,
    },
  };
}

/** Sortie du Scanner IA (admin) : findings détectés dans un lot de fichiers. */
export function scanFindingsSchema(): JsonSchemaContract {
  return {
    name: "educalcul_scan_findings",
    description: "Problèmes détectés dans un lot de fichiers source, par un audit automatisé.",
    schema: {
      type: "object",
      properties: {
        findings: {
          type: "array",
          maxItems: 30,
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] },
              file: { type: "string", minLength: 1 },
              title: { type: "string", minLength: 1, maxLength: 140 },
              description: { type: "string", minLength: 1 },
              fix: { type: "string" },
            },
            required: ["severity", "file", "title", "description", "fix"],
            ...noExtra,
          },
        },
      },
      required: ["findings"],
      ...noExtra,
    },
  };
}

/** Fiche quotidienne d'un mini-jeu "à paliers" (calcul mental, énigmes,
 * suites, langues) : questions courtes à réponse numérique OU texte unique
 * selon le jeu, voir src/lib/minigames/gameTypes.ts qui pilote `answerType`
 * et construit le prompt. */
export function dailySheetQuestionsSchema(count: number, answerType: "number" | "text"): JsonSchemaContract {
  return {
    name: "educalcul_daily_minigame_sheet",
    description: `Fiche de ${count} questions courtes, réponse ${answerType === "number" ? "numérique" : "texte"} unique.`,
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          minItems: count,
          maxItems: count,
          items: {
            type: "object",
            properties: {
              prompt: { type: "string", minLength: 1, maxLength: 300 },
              answer: answerType === "number" ? { type: "number" } : { type: "string", minLength: 1, maxLength: 60 },
            },
            required: ["prompt", "answer"],
            ...noExtra,
          },
        },
      },
      required: ["questions"],
      ...noExtra,
    },
  };
}

/** Un tour de "Calia en classe" (prof vocal) : ce qu'elle dit + au plus une
 * action de mise en scène (surligner/faire défiler/pointer/écrire au
 * tableau). Les blocs de leçon compilés n'ont pas d'id stable (voir
 * compileCourseBlock) — targetIndex référence donc la Nième cible du type
 * demandé dans lessonOutline, pas un id réel. */
export function caliaClasseTurnSchema(): JsonSchemaContract {
  return {
    name: "educalcul_calia_classe_turn",
    description: "Réplique de Calia (mode prof vocal) et action de mise en scène optionnelle.",
    schema: {
      type: "object",
      properties: {
        say: { type: "string", minLength: 1, maxLength: 900 },
        // Gestes de la réplique, dans l'ordre : chacun se déclenche pendant la
        // phrase n° atSentence de `say` (Calia se déplace en parlant).
        actions: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              atSentence: { type: "integer", minimum: 0 },
              kind: { type: "string", enum: ["point_at", "highlight", "scroll_to", "board_write", "board_clear", "ask_student_to_write", "next_lesson", "prev_lesson", "goto_lesson"] },
              targetKind: { type: ["string", "null"], enum: ["heading", "paragraph", "figure", "exercise", "formula", "item", "row", null] },
              targetIndex: { type: ["integer", "null"], minimum: 0 },
              latex: { type: ["string", "null"], minLength: 1, maxLength: 200 },
              label: { type: ["string", "null"], minLength: 1, maxLength: 40 },
            },
            required: ["atSentence", "kind", "targetKind", "targetIndex", "latex", "label"],
            additionalProperties: false,
          },
        },
      },
      required: ["say", "actions"],
      ...noExtra,
    },
  };
}

/** Resume compact d'une session Calia (vocal ou chat), genere une seule fois
 * en fin de session — sert a mettre a jour calia_student_profile. Tous les
 * champs sont bornes en longueur/nombre : le profil ne doit jamais grossir
 * sans limite (il est relu en entier a chaque tour futur). */
export function caliaSessionSummarySchema(): JsonSchemaContract {
  return {
    name: "educalcul_calia_session_summary",
    description: "Resume compact d'une session Calia pour mettre a jour le profil pedagogique de l'eleve.",
    schema: {
      type: "object",
      properties: {
        newMasteredNotions: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 60 },
          maxItems: 5,
        },
        newWeakNotions: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 60 },
          maxItems: 5,
        },
        methodUsed: {
          type: ["string", "null"],
          enum: ["exemples_concrets", "etape_par_etape", "questions_guidees", "essai_erreur", "analogie", null],
        },
        methodWorked: { type: ["boolean", "null"] },
        behaviorNotes: { type: "string", minLength: 1, maxLength: 300 },
        summary: { type: "string", minLength: 1, maxLength: 300 },
      },
      required: ["newMasteredNotions", "newWeakNotions", "methodUsed", "methodWorked", "behaviorNotes", "summary"],
      ...noExtra,
    },
  };
}
