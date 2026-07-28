export type JsonSchemaContract = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
};

type JsonSchema = Record<string, unknown>;

const noExtra = { additionalProperties: false } as const;

const textPart: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["text"] },
    value: { type: "string", minLength: 1 },
  },
  required: ["type", "value"],
  ...noExtra,
};

const mathPart: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["math"] },
    latex: { type: "string", minLength: 1 },
  },
  required: ["type", "latex"],
  ...noExtra,
};

const structuredRichTextObject: JsonSchema = {
  type: "object",
  properties: {
    parts: {
      type: "array",
      minItems: 1,
      maxItems: 30,
      items: { oneOf: [textPart, mathPart] },
    },
  },
  required: ["parts"],
  ...noExtra,
};

// Les générateurs récents peuvent écrire les champs enrichis sous forme de
// chaînes Markdown avec mathématiques délimitées par $...$ ou $$...$$. Le
// normaliseur les transforme ensuite localement en parts text/math. On garde
// l'ancien objet parts pour compatibilité avec les exercices et quiz existants.
const richText: JsonSchema = {
  oneOf: [
    { type: "string", minLength: 1 },
    structuredRichTextObject,
  ],
};

const optionalRichText: JsonSchema = {
  oneOf: [
    { type: "string" },
    {
      type: "object",
      properties: {
        parts: {
          type: "array",
          minItems: 0,
          maxItems: 30,
          items: { oneOf: [textPart, mathPart] },
        },
      },
      required: ["parts"],
      ...noExtra,
    },
  ],
};

const paragraphBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["paragraph"] },
    content: richText,
  },
  required: ["type", "content"],
  ...noExtra,
};

const displayMathBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["display_math"] },
    latex: { type: "string", minLength: 1 },
  },
  required: ["type", "latex"],
  ...noExtra,
};

const listBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["list"] },
    ordered: { type: "boolean" },
    items: {
      type: "array",
      minItems: 1,
      maxItems: 14,
      items: richText,
    },
  },
  required: ["type", "ordered", "items"],
  ...noExtra,
};

const calloutBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["callout"] },
    variant: { type: "string", enum: ["note", "warning"] },
    title: richText,
    paragraphs: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: richText,
    },
  },
  required: ["type", "variant", "title", "paragraphs"],
  ...noExtra,
};

const tableBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["table"] },
    variant: { type: "string", enum: ["value"] },
    headers: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: richText,
    },
    rows: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: richText,
      },
    },
  },
  required: ["type", "variant", "headers", "rows"],
  ...noExtra,
};

const signValueSchema: JsonSchema = {
  type: "string",
  enum: ["negative", "zero", "positive", "undefined"],
};

const signTableBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["sign_table"] },
    expression: richText,
    boundaries: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: richText,
    },
    interval_signs: {
      type: "array",
      minItems: 2,
      maxItems: 7,
      items: signValueSchema,
    },
    boundary_signs: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: signValueSchema,
    },
  },
  required: [
    "type",
    "expression",
    "boundaries",
    "interval_signs",
    "boundary_signs",
  ],
  ...noExtra,
};

const variationTableBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["variation_table"] },
    variable: richText,
    function_name: richText,
    points: {
      type: "array",
      minItems: 2,
      maxItems: 7,
      items: richText,
    },
    values: {
      type: "array",
      minItems: 2,
      maxItems: 7,
      items: richText,
    },
    directions: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", enum: ["up", "down", "constant"] },
    },
    derivative_signs: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: signValueSchema,
    },
  },
  required: [
    "type",
    "variable",
    "function_name",
    "points",
    "values",
    "directions",
    "derivative_signs",
  ],
  ...noExtra,
};

const graphVector: JsonSchema = {
  type: "object",
  properties: {
    x: { type: "number", minimum: -100, maximum: 100 },
    y: { type: "number", minimum: -100, maximum: 100 },
    from_x: { type: "number", minimum: -100, maximum: 100 },
    from_y: { type: "number", minimum: -100, maximum: 100 },
    label: { type: "string", maxLength: 20 },
    tone: {
      type: "string",
      enum: ["navy", "gold", "blue", "green", "red", "gray"],
    },
  },
  required: ["x", "y", "from_x", "from_y", "label", "tone"],
  ...noExtra,
};

const graphBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["graph"] },
    expression: { type: "string", minLength: 1, maxLength: 180 },
    xmin: { type: "number" },
    xmax: { type: "number" },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    parameter: {
      oneOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 2 },
            min: { type: "number" },
            max: { type: "number" },
            default: { type: "number" },
          },
          required: ["name", "min", "max", "default"],
          ...noExtra,
        },
      ],
    },
    vectors: {
      type: "array",
      minItems: 0,
      maxItems: 5,
      items: graphVector,
    },
  },
  required: [
    "type",
    "expression",
    "xmin",
    "xmax",
    "caption",
    "parameter",
    "vectors",
  ],
  ...noExtra,
};

const figureTone: JsonSchema = {
  type: "string",
  enum: ["navy", "gold", "blue", "green", "red", "gray"],
};

const figureLabelProperties = {
  tone: figureTone,
  label: optionalRichText,
  label_x: { type: "number", minimum: 0, maximum: 200 },
  label_y: { type: "number", minimum: 0, maximum: 160 },
};

const figureLine: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["line"] },
    x1: { type: "number", minimum: 0, maximum: 200 },
    y1: { type: "number", minimum: 0, maximum: 160 },
    x2: { type: "number", minimum: 0, maximum: 200 },
    y2: { type: "number", minimum: 0, maximum: 160 },
    dashed: { type: "boolean" },
    arrow_end: { type: "boolean" },
    ...figureLabelProperties,
  },
  required: [
    "type",
    "x1",
    "y1",
    "x2",
    "y2",
    "dashed",
    "arrow_end",
    "tone",
    "label",
    "label_x",
    "label_y",
  ],
  ...noExtra,
};

const figurePoint: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["point"] },
    x: { type: "number", minimum: 0, maximum: 200 },
    y: { type: "number", minimum: 0, maximum: 160 },
    ...figureLabelProperties,
  },
  required: ["type", "x", "y", "tone", "label", "label_x", "label_y"],
  ...noExtra,
};

const figureCircle: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["circle"] },
    cx: { type: "number", minimum: 0, maximum: 200 },
    cy: { type: "number", minimum: 0, maximum: 160 },
    r: { type: "number", minimum: 2, maximum: 80 },
    filled: { type: "boolean" },
    ...figureLabelProperties,
  },
  required: [
    "type",
    "cx",
    "cy",
    "r",
    "filled",
    "tone",
    "label",
    "label_x",
    "label_y",
  ],
  ...noExtra,
};

const figurePolygon: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["polygon"] },
    points: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          x: { type: "number", minimum: 0, maximum: 200 },
          y: { type: "number", minimum: 0, maximum: 160 },
        },
        required: ["x", "y"],
        ...noExtra,
      },
    },
    filled: { type: "boolean" },
    ...figureLabelProperties,
  },
  required: [
    "type",
    "points",
    "filled",
    "tone",
    "label",
    "label_x",
    "label_y",
  ],
  ...noExtra,
};

const figureArc: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["arc"] },
    cx: { type: "number", minimum: 0, maximum: 200 },
    cy: { type: "number", minimum: 0, maximum: 160 },
    r: { type: "number", minimum: 2, maximum: 80 },
    start_angle: { type: "number", minimum: -360, maximum: 360 },
    end_angle: { type: "number", minimum: -360, maximum: 360 },
    ...figureLabelProperties,
  },
  required: [
    "type",
    "cx",
    "cy",
    "r",
    "start_angle",
    "end_angle",
    "tone",
    "label",
    "label_x",
    "label_y",
  ],
  ...noExtra,
};

const figureBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["figure"] },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    elements: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        oneOf: [
          figureLine,
          figurePoint,
          figureCircle,
          figurePolygon,
          figureArc,
        ],
      },
    },
  },
  required: ["type", "caption", "elements"],
  ...noExtra,
};

const learningResourceBlock: JsonSchema = {
  oneOf: [tableBlock, signTableBlock, variationTableBlock, graphBlock, figureBlock],
};

const exerciseRefBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["exercise"] },
    exercise_index: { type: "integer", minimum: 1, maximum: 8 },
  },
  required: ["type", "exercise_index"],
  ...noExtra,
};

const simpleStepBlock: JsonSchema = {
  oneOf: [paragraphBlock, displayMathBlock, listBlock, calloutBlock],
};

const stepsBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["steps"] },
    steps: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          title: richText,
          blocks: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: simpleStepBlock,
          },
        },
        required: ["title", "blocks"],
        ...noExtra,
      },
    },
  },
  required: ["type", "steps"],
  ...noExtra,
};

const headingBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["heading"] },
    level: { type: "integer", enum: [3, 4] },
    content: richText,
  },
  required: ["type", "level", "content"],
  ...noExtra,
};

const courseBlock: JsonSchema = {
  oneOf: [
    headingBlock,
    paragraphBlock,
    displayMathBlock,
    listBlock,
    calloutBlock,
    tableBlock,
    signTableBlock,
    variationTableBlock,
    graphBlock,
    figureBlock,
    exerciseRefBlock,
    stepsBlock,
  ],
};

const courseExercise: JsonSchema = {
  type: "object",
  properties: {
    question: richText,
    answer: richText,
    hint: richText,
    explanation: richText,
  },
  required: ["question", "answer", "hint", "explanation"],
  ...noExtra,
};


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
      required_sections: {
        type: "array",
        minItems: 3,
        maxItems: 7,
        items: { type: "string", minLength: 3 },
      },
      exercise_skills: {
        type: "array",
        minItems: 3,
        maxItems: 4,
        items: { type: "string", minLength: 3 },
      },
      forbidden_concepts: {
        type: "array",
        minItems: 0,
        maxItems: 12,
        items: { type: "string", minLength: 2 },
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
      "required_sections",
      "exercise_skills",
      "forbidden_concepts",
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



export function courseBlueprintAuditSchema(): JsonSchemaContract {
  return {
    name: "educalcul_course_blueprint_audit",
    description:
      "Audit indépendant du plan global. Le relecteur signale les défauts mais ne réécrit pas le plan.",
    schema: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["ok", "revise"] },
        issues: {
          type: "array",
          minItems: 0,
          maxItems: 20,
          items: {
            type: "object",
            properties: {
              code: { type: "string", minLength: 1, maxLength: 60 },
              location: { type: "string", minLength: 1, maxLength: 120 },
              message: { type: "string", minLength: 1, maxLength: 500 },
              suggestion: { type: "string", minLength: 1, maxLength: 500 },
            },
            required: ["code", "location", "message", "suggestion"],
            ...noExtra,
          },
        },
      },
      required: ["verdict", "issues"],
      ...noExtra,
    },
  };
}

export function courseOutlineSchema(chapterCount: number): JsonSchemaContract {
  return {
    name: "educalcul_course_outline",
    description: "Plan exact d'un cours Educalcul.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 },
        chapters: {
          type: "array",
          minItems: chapterCount,
          maxItems: chapterCount,
          items: {
            type: "object",
            properties: {
              title: { type: "string", minLength: 1 },
              scope: { type: "string", minLength: 1 },
            },
            required: ["title", "scope"],
            ...noExtra,
          },
        },
      },
      required: ["title", "description", "chapters"],
      ...noExtra,
    },
  };
}

export function courseLessonPlanSchema(lessonCount: number): JsonSchemaContract {
  return {
    name: "educalcul_course_lesson_plan",
    description: "Plan exact des leçons d'un chapitre Educalcul.",
    schema: {
      type: "object",
      properties: {
        lessons: {
          type: "array",
          minItems: lessonCount,
          maxItems: lessonCount,
          items: {
            type: "object",
            properties: {
              title: { type: "string", minLength: 1 },
              scope: { type: "string", minLength: 1 },
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
            },
            required: ["title", "scope", "visual_focus"],
            ...noExtra,
          },
        },
      },
      required: ["lessons"],
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

const genericExerciseQuestion: JsonSchema = {
  type: "object",
  properties: {
    prompt: richText,
    content: optionalRichText,
    answer: richText,
    explanation: richText,
    points: { type: "integer", minimum: 1, maximum: 20 },
    options: {
      type: "array",
      minItems: 0,
      maxItems: 8,
      items: richText,
    },
    correct_option_indexes: {
      type: "array",
      minItems: 0,
      maxItems: 8,
      items: { type: "integer", minimum: 0, maximum: 7 },
    },
    accepted_answers: {
      type: "array",
      minItems: 0,
      maxItems: 5,
      items: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: richText,
      },
    },
    pairs: {
      type: "array",
      minItems: 0,
      maxItems: 10,
      items: {
        type: "object",
        properties: { left: richText, right: richText },
        required: ["left", "right"],
        ...noExtra,
      },
    },
    items: {
      type: "array",
      minItems: 0,
      maxItems: 12,
      items: richText,
    },
    resources: {
      type: "array",
      minItems: 0,
      maxItems: 2,
      items: learningResourceBlock,
    },
  },
  required: [
    "prompt",
    "content",
    "answer",
    "explanation",
    "points",
    "options",
    "correct_option_indexes",
    "accepted_answers",
    "pairs",
    "items",
    "resources",
  ],
  ...noExtra,
};

export function exerciseDraftSchema(questionCount: number): JsonSchemaContract {
  return {
    name: "educalcul_exercise_draft",
    description: "Exercice Educalcul structuré, commun à tous les types de questions.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 },
        introduction: {
          type: "array",
          minItems: 0,
          maxItems: 8,
          items: richText,
        },
        questions: {
          type: "array",
          minItems: questionCount,
          maxItems: questionCount,
          items: genericExerciseQuestion,
        },
      },
      required: ["title", "description", "introduction", "questions"],
      ...noExtra,
    },
  };
}

const quizQuestion: JsonSchema = {
  type: "object",
  properties: {
    text: richText,
    options: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: richText,
    },
    correct_option_index: { type: "integer", minimum: 0, maximum: 3 },
    explanation: richText,
    points: { type: "integer", minimum: 1, maximum: 20 },
    resources: {
      type: "array",
      minItems: 0,
      maxItems: 1,
      items: learningResourceBlock,
    },
  },
  required: ["text", "options", "correct_option_index", "explanation", "points", "resources"],
  ...noExtra,
};

export function quizDraftSchema(questionCount: number): JsonSchemaContract {
  return {
    name: "educalcul_quiz_draft",
    description: "Quiz Educalcul QCM structuré.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 },
        time_limit: { type: "integer", minimum: 1, maximum: 180 },
        max_attempts: { type: "integer", minimum: 1, maximum: 20 },
        questions: {
          type: "array",
          minItems: questionCount,
          maxItems: questionCount,
          items: quizQuestion,
        },
      },
      required: ["title", "description", "time_limit", "max_attempts", "questions"],
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
