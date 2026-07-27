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

const richText: JsonSchema = {
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

const signTableBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["sign_table"] },
    expression: richText,
    entries: {
      type: "array",
      minItems: 2,
      maxItems: 9,
      items: {
        type: "object",
        properties: {
          domain: richText,
          sign: {
            type: "string",
            enum: ["negative", "zero", "positive", "undefined"],
          },
        },
        required: ["domain", "sign"],
        ...noExtra,
      },
    },
  },
  required: ["type", "expression", "entries"],
  ...noExtra,
};

const variationTableBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["variation_table"] },
    function: richText,
    intervals: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          domain: richText,
          direction: {
            type: "string",
            enum: ["increasing", "decreasing", "constant"],
          },
          start_value: richText,
          end_value: richText,
        },
        required: ["domain", "direction", "start_value", "end_value"],
        ...noExtra,
      },
    },
  },
  required: ["type", "function", "intervals"],
  ...noExtra,
};

const graphVector: JsonSchema = {
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    from_x: { type: "number" },
    from_y: { type: "number" },
    label: { type: "string", minLength: 1, maxLength: 12 },
  },
  required: ["x", "y", "from_x", "from_y", "label"],
  ...noExtra,
};

const geometryDiagramBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["geometry_diagram"] },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    points: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 8 },
          x: { type: "number", minimum: 8, maximum: 192 },
          y: { type: "number", minimum: 8, maximum: 152 },
          label_dx: { type: "number", minimum: -30, maximum: 30 },
          label_dy: { type: "number", minimum: -30, maximum: 30 },
        },
        required: ["name", "x", "y", "label_dx", "label_dy"],
        ...noExtra,
      },
    },
    segments: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          from: { type: "string", minLength: 1, maxLength: 8 },
          to: { type: "string", minLength: 1, maxLength: 8 },
          dashed: { type: "boolean" },
          arrow: { type: "boolean" },
        },
        required: ["from", "to", "dashed", "arrow"],
        ...noExtra,
      },
    },
    circles: {
      type: "array",
      minItems: 0,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          center: { type: "string", minLength: 1, maxLength: 8 },
          radius: { type: "number", minimum: 4, maximum: 75 },
        },
        required: ["center", "radius"],
        ...noExtra,
      },
    },
    polygons: {
      type: "array",
      minItems: 0,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          points: {
            type: "array",
            minItems: 3,
            maxItems: 8,
            items: { type: "string", minLength: 1, maxLength: 8 },
          },
          filled: { type: "boolean" },
        },
        required: ["points", "filled"],
        ...noExtra,
      },
    },
  },
  required: ["type", "caption", "points", "segments", "circles", "polygons"],
  ...noExtra,
};

const fractionModelBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["fraction_model"] },
    shape: { type: "string", enum: ["bar", "circle"] },
    numerator: { type: "integer", minimum: 0, maximum: 20 },
    denominator: { type: "integer", minimum: 1, maximum: 20 },
    caption: { type: "string", minLength: 1, maxLength: 300 },
  },
  required: ["type", "shape", "numerator", "denominator", "caption"],
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
    vectors: {
      type: "array",
      minItems: 0,
      maxItems: 4,
      items: graphVector,
    },
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
  },
  required: ["type", "expression", "xmin", "xmax", "caption", "vectors", "parameter"],
  ...noExtra,
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

const interactiveVectorsBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["interactive_vectors"] },
    u_label: { type: "string", minLength: 1, maxLength: 10 },
    v_label: { type: "string", minLength: 1, maxLength: 10 },
    show_projection: { type: "boolean" },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    ox: { type: "number", minimum: 0, maximum: 300 },
    oy: { type: "number", minimum: 0, maximum: 200 },
    ux: { type: "number", minimum: 0, maximum: 300 },
    uy: { type: "number", minimum: 0, maximum: 200 },
    vx: { type: "number", minimum: 0, maximum: 300 },
    vy: { type: "number", minimum: 0, maximum: 200 },
  },
  required: [
    "type",
    "u_label",
    "v_label",
    "show_projection",
    "caption",
    "ox",
    "oy",
    "ux",
    "uy",
    "vx",
    "vy",
  ],
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
    geometryDiagramBlock,
    fractionModelBlock,
    exerciseRefBlock,
    stepsBlock,
    interactiveVectorsBlock,
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

const baseExerciseProperties: Record<string, JsonSchema> = {
  prompt: richText,
  explanation: richText,
  points: { type: "integer", minimum: 1, maximum: 20 },
};

function exerciseQuestionSchema(blockType: string): JsonSchema {
  const base = {
    type: "object",
    properties: { ...baseExerciseProperties },
    required: ["prompt", "explanation", "points"],
    ...noExtra,
  } as JsonSchema & {
    properties: Record<string, JsonSchema>;
    required: string[];
  };

  switch (blockType) {
    case "qcm":
      base.properties.options = {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: richText,
      };
      base.properties.correct_option_indexes = {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: { type: "integer", minimum: 0, maximum: 3 },
      };
      base.required.push("options", "correct_option_indexes");
      break;
    case "true_false":
      base.properties.correct_option_indexes = {
        type: "array",
        minItems: 1,
        maxItems: 1,
        items: { type: "integer", minimum: 0, maximum: 1 },
      };
      base.required.push("correct_option_indexes");
      break;
    case "fill_in_the_blank":
      base.properties.content = richText;
      base.properties.accepted_answers = {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: richText,
        },
      };
      base.required.push("content", "accepted_answers");
      break;
    case "matching":
      base.properties.pairs = {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          properties: { left: richText, right: richText },
          required: ["left", "right"],
          ...noExtra,
        },
      };
      base.required.push("pairs");
      break;
    case "ordering":
      base.properties.items = {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: richText,
      };
      base.required.push("items");
      break;
    case "coding":
    case "standard":
    default:
      base.properties.answer = richText;
      base.required.push("answer");
      break;
  }
  return base;
}

export function exerciseDraftSchema(
  questionCount: number,
  blockType = "standard",
): JsonSchemaContract {
  return {
    name: `educalcul_exercise_${blockType}`,
    description: `Exercice Educalcul structuré de type ${blockType}.`,
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
          items: exerciseQuestionSchema(blockType),
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
  },
  required: ["text", "options", "correct_option_index", "explanation", "points"],
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
