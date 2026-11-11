import { z } from "zod";
import type { Question } from "@/components/admin/QuizBuilder";
import type { AttemptSummary } from "@/types/attempts";
import { isRecord } from "@/lib/validate";
import type { ExerciseViewerProps, RevealInfo } from "@/components/viewers/ExerciseViewer";
import type { QuizViewerProps } from "@/components/viewers/QuizViewer";
import type { AnswerMap } from "@/types/answers";

const id = z.union([z.string(), z.number()]);

/** Question de quiz stockée en JSON : seul l'identifiant est exigé, le reste est du contenu libre contrôlé par l'éditeur. */
export const questionSchema = z.custom<Question>((v) => isRecord(v) && (typeof v.id === "string" || typeof v.id === "number"), "question sans identifiant");

/** Résumé d'une tentative dans `attempts_history`. */
export const attemptSummarySchema: z.ZodType<AttemptSummary> = z.looseObject({
  score_percent: z.number().nullable().default(null),
  passed: z.boolean().nullable().default(null),
  pending: z.boolean().optional(),
  completed_at: z.string().default(""),
});

/** Entrée de `attempts_history` côté administration : résumé + détail éventuel. */
export const historyEntrySchema = z.looseObject({
  detail: z.looseObject({
    adminComments: z.record(z.string(), z.string()).optional(),
    adminEditedAnswers: z.record(z.string(), z.unknown()).optional(),
    results: z.record(z.string(), z.boolean()).optional(),
    manualVerdicts: z.record(z.string(), z.boolean()).optional(),
    questionResults: z.record(z.string(), z.boolean()).optional(),
  }).optional(),
  score: z.number().optional(),
  total_points: z.number().optional(),
  score_percent: z.number().optional(),
  passed: z.boolean().optional(),
  pending: z.boolean().optional(),
});

/** Indice d'un exercice : texte seul ou objet `{ text | hint }`. */
export const hintSchema = z.union([z.string(), z.looseObject({ text: z.string().optional(), hint: z.string().optional() })]);

export const courseRefSchema = z.looseObject({ title: z.string().optional(), subject: z.string().optional() });
export const badgeUnlockSchema = z.looseObject({
  unlocks_avatar_border: z.string().nullable().optional(),
  unlocks_name_animation: z.string().nullable().optional(),
});
export const idSchema = id;

/** Plan d'abonnement tel que l'attend la page d'abonnement (champs lus : tous ceux de l'interface). */
export const subscriptionPlanSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number(),
  billing_interval: z.string(),
  features: z.record(z.string(), z.union([z.boolean(), z.number(), z.string(), z.null()]).catch(null)).nullable().default(null),
  description: z.string().nullable().default(null),
  trial_days: z.number().default(0),
  promo_description: z.string().nullable().default(null),
  is_active: z.boolean().default(true),
  sort_order: z.number().default(0),
});

/** Badge d'un élève (relation `badge:badges(...)`). */
/* ---- Revue d'une copie (admin) : contenu et progression lus en base, jamais fiables à l'avance ---- */

const hasTitleAndContentList = (v: unknown) => isRecord(v) && typeof v.title === "string" && (v.content_json == null || Array.isArray(v.content_json));
export const exerciseItemSchema = z.custom<ExerciseViewerProps["exercise"]>(hasTitleAndContentList, "exercice illisible");
export const quizItemSchema = z.custom<QuizViewerProps["quiz"]>(hasTitleAndContentList, "quiz illisible");

type Opt<T extends z.ZodType> = z.ZodCatch<z.ZodOptional<T>>;
const opt = <T extends z.ZodType>(t: T): Opt<T> => t.optional().catch(undefined);
const stringMap = z.record(z.string(), z.string());

/** Progression d'un exercice (progress_json) : un champ de mauvais type est ignoré, pas propagé. */
export const exerciseProgressSchema = z.looseObject({
  answers: opt(z.custom<AnswerMap>(isRecord)),
  submittedBlocks: opt(z.array(z.string())),
  results: opt(z.record(z.string(), z.boolean())),
  aiFeedback: opt(stringMap),
  revealed: opt(z.custom<Record<string, RevealInfo>>(isRecord)),
  score: opt(z.number()),
  blockModes: opt(z.record(z.string(), z.enum(["text", "draw"]))),
  adminComments: opt(stringMap),
  adminEditedAnswers: opt(z.custom<AnswerMap>(isRecord)),
});

const quizAnswer = z.union([z.string(), z.array(z.string())]);
/** Progression d'un quiz (progress_json). */
export const quizProgressSchema = z.looseObject({
  answers: opt(z.record(z.string(), quizAnswer)),
  questionResults: opt(z.record(z.string(), z.boolean())),
  questionFeedbacks: opt(stringMap),
  revealed: opt(z.record(z.string(), z.looseObject({ correctAnswer: opt(quizAnswer), explanation: opt(z.string()) }))),
  score: opt(z.number()),
  adminComments: opt(stringMap),
  adminEditedAnswers: opt(z.record(z.string(), quizAnswer)),
});
