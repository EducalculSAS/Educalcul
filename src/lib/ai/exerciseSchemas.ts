import { noExtra, JsonSchema, richText, tableBlock, signTableBlock, variationTableBlock, graphBlock, figureBlock, optionalRichText } from "./blockSchemas";
export type JsonSchemaContract = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
};


export const learningResourceBlock: JsonSchema = {
  oneOf: [tableBlock, signTableBlock, variationTableBlock, graphBlock, figureBlock],
};


export const genericExerciseQuestion: JsonSchema = {
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


export const quizQuestion: JsonSchema = {
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
