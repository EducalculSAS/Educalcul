import { z } from "zod";
import type { Question } from "@/components/admin/QuizBuilder";
import type { AttemptSummary } from "@/types/attempts";
import { isRecord } from "@/lib/validate";

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
export const profileBadgeSchema = z.looseObject({
  id: z.number(), name: z.string(), icon: z.string(), color: z.string(), category: z.string().nullish(),
});
