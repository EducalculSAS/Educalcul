import { createLlmStartGate, DEFAULT_LLM_MIN_START_INTERVAL_MS, type GenerateStructured } from "@/lib/ai/runtime";
import { dailySheetQuestionsSchema } from "@/lib/ai/schemas";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getGameTypeConfig, type MinigameType } from "@/lib/minigames/gameTypes";
import type { PalierCode } from "@/lib/minigames/levels";

export const QUESTIONS_PER_SHEET = 5;
export type SheetTier = "free" | "premium";

interface RawQuestion {
  prompt: string;
  answer: number | string;
}

const MAX_DEDUPE_ATTEMPTS = 3;
const RECENT_DAYS_TO_AVOID = 10;
const MAX_AVOID_PROMPTS = 60;

function normalizePrompt(p: string): string {
  return p.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupeQuestions(questions: RawQuestion[]): { unique: RawQuestion[]; hadDuplicates: boolean } {
  const seen = new Set<string>();
  const unique: RawQuestion[] = [];
  for (const q of questions) {
    const key = normalizePrompt(q.prompt);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(q);
  }
  return { unique, hadDuplicates: unique.length !== questions.length };
}

/** Questions des derniers jours publiés pour ce jeu/palier (tous tiers
 * confondus) — injectées comme "à ne pas répéter", pour que la fenêtre
 * glissante ne reproduise pas ce que les enfants ont déjà vu récemment. */
async function getRecentQuestionsForPalier(gameType: MinigameType, palierCode: string, excludeId?: string): Promise<string[]> {
  const since = new Date();
  since.setDate(since.getDate() - RECENT_DAYS_TO_AVOID);

  const { data } = await supabaseAdmin
    .from("minigame_daily_sheets")
    .select("id, questions")
    .eq("game_type", gameType)
    .eq("palier_code", palierCode)
    .gte("for_date", since.toISOString().slice(0, 10))
    .order("for_date", { ascending: false });

  const prompts: string[] = [];
  for (const row of data || []) {
    if (row.id === excludeId) continue;
    const questions = (row.questions || []) as RawQuestion[];
    for (const q of questions) {
      if (q?.prompt) prompts.push(q.prompt);
      if (prompts.length >= MAX_AVOID_PROMPTS) break;
    }
    if (prompts.length >= MAX_AVOID_PROMPTS) break;
  }
  return prompts;
}

// Gate par défaut pour un appel isolé (ex. régénération manuelle d'un seul
// créneau depuis l'admin) — sans état partagé, un seul appel n'a rien à
// espacer. Le cron, lui, DOIT passer son propre gate partagé via `generate`
// (voir plus bas) : en créer un nouveau à chaque créneau annule tout
// espacement entre appels et déclenche le rate-limit Mistral en quelques
// secondes (vécu : 429 après ~2 appels lors du premier test du cron).
const defaultGate = () => createLlmStartGate(DEFAULT_LLM_MIN_START_INTERVAL_MS, () => Promise.resolve(false));

/** Génère (ou régénère) un pack de 5 questions pour un jeu/palier/jour/tier
 * donné et l'écrit directement en base (publié immédiatement — pas de
 * relecture admin obligatoire, le contenu quotidien doit être prêt sans
 * intervention). Anti-répétition : dédoublonnage intra-fiche + relance si
 * besoin, et évite les questions publiées récemment pour ce même palier. */
export async function generateDailySheet(
  gameType: MinigameType,
  palierCode: PalierCode,
  forDate: string, // YYYY-MM-DD
  tier: SheetTier,
  options: { excludeId?: string; theme?: string; generate?: GenerateStructured } = {},
): Promise<{ questions: RawQuestion[] } | { error: string }> {
  const config = getGameTypeConfig(gameType);
  if (!config) return { error: "Jeu inconnu." };
  if (!config.palierCodes.includes(palierCode)) return { error: "Palier hors plage pour ce jeu." };

  const rule = config.getRule(palierCode);
  if (!rule) return { error: "Palier inconnu." };

  const language = config.getLanguageForDate?.(forDate);
  const avoidPrompts = await getRecentQuestionsForPalier(gameType, palierCode, options.excludeId);
  const generate = options.generate ?? defaultGate();

  // L'IA reçoit déjà avoidPrompts comme consigne dans le prompt système, mais
  // rien ne garantissait jusqu'ici qu'elle l'ait vraiment respectée — c'est
  // ce qui a produit des énigmes bonus identiques aux énigmes gratuites du
  // même jour (même liste avoidPrompts reçue, ignorée par le modèle). On
  // vérifie donc ici, en code, que chaque question générée ne reprend pas
  // (une fois normalisée) une question de avoidPrompts — sinon on la rejette
  // et on relance, comme pour un doublon intra-fiche.
  const avoidSet = new Set(avoidPrompts.map(normalizePrompt));

  try {
    let questions: RawQuestion[] = [];
    for (let attempt = 1; attempt <= MAX_DEDUPE_ATTEMPTS; attempt++) {
      const result = await generate<{ questions: RawQuestion[] }>(
        `Génère exactement ${QUESTIONS_PER_SHEET} questions pour le niveau ${rule.label} (fiche du ${forDate}, palier ${tier === "premium" ? "bonus premium" : "standard"}).`,
        config.buildSystemPrompt(rule, avoidPrompts, options.theme, language),
        dailySheetQuestionsSchema(QUESTIONS_PER_SHEET, config.answerType),
        0.4,
      );

      const valid = (result.questions || []).filter((q) => {
        if (!q || typeof q.prompt !== "string" || !q.prompt.trim()) return false;
        if (avoidSet.has(normalizePrompt(q.prompt))) return false;
        return config.answerType === "number" ? Number.isFinite(q.answer) : typeof q.answer === "string" && q.answer.trim().length > 0;
      });
      const { unique } = dedupeQuestions(valid);
      // Garde la meilleure tentative si aucune n'atteint la cible (mieux
      // vaut publier 3-4 questions solides que 0 après épuisement des essais).
      if (unique.length > questions.length) questions = unique;
      if (unique.length >= QUESTIONS_PER_SHEET) break;
    }

    if (questions.length === 0) return { error: "Aucune question valide générée." };
    return { questions };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur de génération inconnue." };
  }
}

/** Écrit (ou remplace) la ligne minigame_daily_sheets pour (jeu, palier, date, tier). */
export async function generateAndUpsertDailySheet(
  gameType: MinigameType,
  palierCode: PalierCode,
  forDate: string,
  tier: SheetTier,
  options: { generate?: GenerateStructured } = {},
): Promise<{ error?: string }> {
  const config = getGameTypeConfig(gameType);
  if (!config) return { error: "Jeu inconnu." };

  const { data: existing } = await supabaseAdmin
    .from("minigame_daily_sheets")
    .select("id")
    .eq("game_type", gameType)
    .eq("palier_code", palierCode)
    .eq("for_date", forDate)
    .eq("tier", tier)
    .maybeSingle();

  const result = await generateDailySheet(gameType, palierCode, forDate, tier, { excludeId: existing?.id, generate: options.generate });
  if ("error" in result) return { error: result.error };

  const language = config.getLanguageForDate?.(forDate) ?? null;

  const { error } = await supabaseAdmin
    .from("minigame_daily_sheets")
    .upsert(
      {
        game_type: gameType,
        palier_code: palierCode,
        for_date: forDate,
        tier,
        language,
        questions: result.questions,
        status: "published",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "game_type,palier_code,for_date,tier" },
    );

  return error ? { error: error.message } : {};
}
