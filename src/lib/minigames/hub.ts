import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getStreaksForGames } from "@/lib/minigames/streaks";
import { gradeLevelToPalier } from "@/lib/minigames/levels";
import { GAME_TYPES, isMinigameType } from "@/lib/minigames/gameTypes";
import { GAMES, type GameKey } from "@/lib/minigames/catalog";
import { correctSheet, type CorrectionLine, type GivenAnswer, type SheetQuestion } from "@/lib/minigames/correction";

/** Jour d'une fiche : en temps universel, comme au démarrage d'une partie (dailyGameSession). */
export function sheetDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export interface TodayPlay { score: number; maxScore: number | null; durationSeconds: number | null }

export interface HubGame {
  gameType: GameKey;
  /** Le jeu existe pour la classe de l'élève. */
  available: boolean;
  streak: number;
  /** Partie du jour terminée, sinon null. */
  today: TodayPlay | null;
}

export interface MinigamesHub {
  day: string;
  games: HubGame[];
  /** Jeux ouverts à l'élève et terminés aujourd'hui. */
  doneToday: number;
  availableCount: number;
  weekPoints: number;
  weekPlays: number;
  /** Les 7 derniers jours, du plus ancien à aujourd'hui : nombre de parties terminées. */
  last7: { day: string; plays: number }[];
  /** Plus longue série en cours, tous jeux confondus. */
  bestStreak: number;
}

export function isGameAvailable(gameType: GameKey, gradeLevel: string | null): boolean {
  if (!isMinigameType(gameType)) return true; // Mathador : toutes les classes
  const palier = gradeLevelToPalier(gradeLevel || "6eme");
  return !!palier && GAME_TYPES[gameType].palierCodes.includes(palier);
}

/** Tout ce que le catalogue des mini-jeux affiche pour un élève, en deux lectures. */
export async function loadMinigamesHub(userId: number, gradeLevel: string | null): Promise<MinigamesHub> {
  const day = sheetDay();
  const since = new Date(Date.now() - 6 * 86400000);
  since.setUTCHours(0, 0, 0, 0);
  const keys = GAMES.map((g) => g.gameType);

  const [streaks, { data: recent }] = await Promise.all([
    getStreaksForGames(userId, keys).catch(() => ({} as Record<string, number>)),
    supabaseAdmin
      .from("minigame_sessions")
      .select("game_type, score, max_score, duration_seconds, created_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const rows = recent || [];

  const todayByGame = new Map<string, TodayPlay>();
  const playsByDay = new Map<string, number>();
  let weekPoints = 0;
  for (const r of rows) {
    const d = String(r.created_at).slice(0, 10);
    playsByDay.set(d, (playsByDay.get(d) || 0) + 1);
    weekPoints += r.score || 0;
    if (d === day && !todayByGame.has(r.game_type)) {
      todayByGame.set(r.game_type, { score: r.score || 0, maxScore: r.max_score ?? null, durationSeconds: r.duration_seconds ?? null });
    }
  }

  const games: HubGame[] = GAMES.map((g) => ({
    gameType: g.gameType,
    available: isGameAvailable(g.gameType, gradeLevel),
    streak: streaks[g.gameType] || 0,
    today: todayByGame.get(g.gameType) ?? null,
  }));
  const open = games.filter((g) => g.available);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10);
    return { day: d, plays: playsByDay.get(d) || 0 };
  });

  return {
    day,
    games,
    doneToday: open.filter((g) => g.today).length,
    availableCount: open.length,
    weekPoints,
    weekPlays: rows.length,
    last7,
    bestStreak: Math.max(0, ...games.map((g) => g.streak)),
  };
}

export interface DailyResult { kind: "daily"; score: number; maxScore: number; durationSeconds: number | null; correction: CorrectionLine[] }
export interface MathadorResult {
  kind: "mathador";
  valid: boolean;
  score: number;
  maxScore: number | null;
  durationSeconds: number | null;
  reason?: string;
  target: number;
  numbers: number[];
  steps: { a: number; b: number; op: string; result: number }[];
}

/** Série du jeu et partie du jour déjà terminée (avec sa correction) : l'écran de jeu s'ouvre directement sur le résultat. */
export async function loadGameEntry(userId: number, gameType: GameKey): Promise<{ streak: number; available: boolean; result: DailyResult | MathadorResult | null }> {
  const day = sheetDay();
  const [streaks, { data: session }, { data: me }] = await Promise.all([
    getStreaksForGames(userId, [gameType]).catch(() => ({} as Record<string, number>)),
    supabaseAdmin
      .from("minigame_sessions")
      .select("score, max_score, duration_seconds, content_json, answer_json")
      .eq("user_id", userId)
      .eq("game_type", gameType)
      .eq("status", "completed")
      .gte("created_at", `${day}T00:00:00.000Z`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from("users").select("grade_level").eq("id", userId).maybeSingle(),
  ]);
  const streak = streaks[gameType] || 0;
  const available = isGameAvailable(gameType, me?.grade_level ?? null);
  if (!session) return { streak, available, result: null };

  if (gameType === "mathador") {
    const content = (session.content_json || {}) as { numbers?: number[]; target?: number; maxScore?: number };
    const answer = (session.answer_json || {}) as { steps?: MathadorResult["steps"]; valid?: boolean; reason?: string };
    return {
      streak,
      available,
      result: {
        kind: "mathador",
        valid: answer.valid === true,
        score: session.score || 0,
        maxScore: content.maxScore ?? session.max_score ?? null,
        durationSeconds: session.duration_seconds ?? null,
        reason: answer.reason,
        target: content.target ?? 0,
        numbers: content.numbers ?? [],
        steps: Array.isArray(answer.steps) ? answer.steps : [],
      },
    };
  }

  const content = (session.content_json || {}) as { sheetIds?: string[]; questionCount?: number };
  const answers = ((session.answer_json || {}) as { answers?: GivenAnswer[] }).answers || [];
  const { data: sheets } = content.sheetIds?.length
    ? await supabaseAdmin.from("minigame_daily_sheets").select("questions").in("id", content.sheetIds)
    : { data: [] as { questions: unknown }[] };
  const questions = ((sheets?.[0]?.questions || []) as SheetQuestion[]).slice(0, content.questionCount ?? undefined);
  const correction = correctSheet(questions, answers, GAME_TYPES[gameType].answerType);
  return {
    streak,
    available,
    result: { kind: "daily", score: session.score || 0, maxScore: session.max_score ?? questions.length, durationSeconds: session.duration_seconds ?? null, correction },
  };
}
