import type { Loose } from "@/types/loose";
import { PALIER_CODES, type PalierCode } from "@/lib/minigames/levels";
import { CALCUL_MENTAL_RULES, getCalculMentalRule, buildCalculMentalSystemPrompt } from "@/lib/minigames/calculMentalRules";
import { ENIGMES_RULES, getEnigmeRule, buildEnigmesSystemPrompt } from "@/lib/minigames/enigmesRules";
import { SUITES_RULES, getSuiteRule, buildSuitesSystemPrompt } from "@/lib/minigames/suitesRules";
import { LANGUES_RULES, getLangueRule, buildLanguesSystemPrompt, getRotatingLanguage, type MathLanguage } from "@/lib/minigames/languesRules";

export type MinigameType = "calcul_mental" | "enigmes" | "suites" | "langues";
export type AnswerType = "number" | "text";

interface DailyRule {
  code: PalierCode;
  label: string;
}

export interface GameTypeConfig {
  gameType: MinigameType;
  label: string;
  palierCodes: PalierCode[];
  answerType: AnswerType;
  getRule: (code: string) => DailyRule | null;
  buildSystemPrompt: (rule: Loose, avoidPrompts: string[], theme?: string, language?: MathLanguage) => string;
  /** Uniquement pour "langues" — une langue tournante par jour (déterministe). */
  getLanguageForDate?: (forDate: string) => MathLanguage;
  /** Une seule fiche de 5 questions est générée par jour/palier (plus de
   * fiche bonus séparée — ça évitait la déduplication entre deux tirages et
   * ça a fini par produire des doublons, voir Énigmes). Les élèves gratuits
   * ne répondent qu'aux `freeQuestionCount` premières questions ; le premium
   * a accès aux 5. */
  freeQuestionCount: number;
}

// Chaque jeu "à paliers" décrit ici — le cron, le générateur, les routes
// enfant et l'admin bouclent tous sur ce registre plutôt que de dupliquer
// leur logique par jeu. Plage de paliers volontairement différente par jeu
// (Suites/Langues ne concernent PAS le primaire, contrairement au calcul
// mental et aux énigmes).
export const GAME_TYPES: Record<MinigameType, GameTypeConfig> = {
  calcul_mental: {
    gameType: "calcul_mental",
    label: "Calcul mental",
    palierCodes: [...PALIER_CODES],
    answerType: "number",
    getRule: getCalculMentalRule,
    buildSystemPrompt: buildCalculMentalSystemPrompt,
    freeQuestionCount: 2,
  },
  enigmes: {
    gameType: "enigmes",
    label: "Énigmes",
    palierCodes: [...PALIER_CODES],
    answerType: "text",
    getRule: getEnigmeRule,
    buildSystemPrompt: buildEnigmesSystemPrompt,
    freeQuestionCount: 2,
  },
  suites: {
    gameType: "suites",
    label: "Suites",
    palierCodes: ["06", "05", "04", "03", "02", "01", "00"],
    answerType: "number",
    getRule: getSuiteRule,
    buildSystemPrompt: buildSuitesSystemPrompt,
    freeQuestionCount: 2,
  },
  langues: {
    gameType: "langues",
    label: "Maths en langues",
    palierCodes: ["01", "00"],
    answerType: "number",
    getRule: getLangueRule,
    buildSystemPrompt: buildLanguesSystemPrompt,
    getLanguageForDate: getRotatingLanguage,
    freeQuestionCount: 2,
  },
};

export function listGameTypes(): GameTypeConfig[] {
  return Object.values(GAME_TYPES);
}

export function getGameTypeConfig(gameType: string): GameTypeConfig | null {
  return GAME_TYPES[gameType as MinigameType] ?? null;
}

export function isMinigameType(value: string): value is MinigameType {
  return value in GAME_TYPES;
}

// Ré-export pratique pour l'admin (une seule liste de "toutes les règles"
// par jeu, indépendamment de la forme exacte de chaque module de règles).
export const RULES_BY_GAME_TYPE: Record<MinigameType, DailyRule[]> = {
  calcul_mental: CALCUL_MENTAL_RULES,
  enigmes: ENIGMES_RULES,
  suites: SUITES_RULES,
  langues: LANGUES_RULES,
};
