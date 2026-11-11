import type { EmblemKind } from "@/components/Emblem3D";

export type GameKey = "mathador" | "calcul_mental" | "enigmes" | "suites" | "langues";

export interface GameInfo {
  gameType: GameKey;
  /** Segment d'URL : /child/minigames/<slug>. */
  slug: string;
  label: string;
  /** Libellé court (onglets du classement). */
  short: string;
  emblem: EmblemKind;
  pitch: string;
  rules: string[];
  /** Unité du score dans les phrases (« 4 bonnes réponses », « 9 points »). */
  unit: "answers" | "points";
}

/** Tout ce qui décrit un mini-jeu à l'écran : une seule source pour le catalogue, l'écran de jeu, le classement et l'admin. */
export const GAMES: GameInfo[] = [
  {
    gameType: "mathador", slug: "mathador", label: "Mathador", short: "Mathador", emblem: "target", unit: "points",
    pitch: "Cinq nombres, une cible : trouve le compte juste.",
    rules: [
      "Choisis un nombre, une opération, puis un second nombre.",
      "Le résultat remplace les deux nombres : continue jusqu'à tomber sur la cible.",
      "Addition et multiplication : 1 point. Soustraction : 2 points. Division : 3 points.",
      "Les quatre opérations dans la même solution, c'est le coup Mathador : 13 points.",
    ],
  },
  {
    gameType: "calcul_mental", slug: "calcul-mental", label: "Calcul mental", short: "Calcul", emblem: "calculator", unit: "answers",
    pitch: "Des calculs à faire de tête, adaptés à ta classe.",
    rules: [
      "Une question à la fois : écris le résultat et valide.",
      "Pas de brouillon ni de calculatrice, tout se passe dans ta tête.",
      "Tu peux passer une question, elle ne rapporte rien.",
      "La correction complète s'affiche à la fin.",
    ],
  },
  {
    gameType: "enigmes", slug: "enigmes", label: "Énigmes", short: "Énigmes", emblem: "puzzle", unit: "answers",
    pitch: "Des énigmes de logique : à toi de déduire.",
    rules: [
      "Lis bien l'énoncé : chaque mot compte.",
      "Réponds par un mot ou un nombre. Majuscules et accents ne changent rien.",
      "Tu peux passer une énigme, elle ne rapporte rien.",
      "La correction complète s'affiche à la fin.",
    ],
  },
  {
    gameType: "suites", slug: "suites", label: "Suites", short: "Suites", emblem: "stairs", unit: "answers",
    pitch: "Trouve la règle, puis le terme suivant.",
    rules: [
      "Observe les premiers termes et cherche comment on passe de l'un au suivant.",
      "Écris le terme demandé et valide.",
      "Tu peux passer une suite, elle ne rapporte rien.",
      "La correction complète s'affiche à la fin.",
    ],
  },
  {
    gameType: "langues", slug: "langues", label: "Maths en langues", short: "Langues", emblem: "globe", unit: "answers",
    pitch: "Des maths en anglais, en allemand ou en espagnol.",
    rules: [
      "L'énoncé est dans une langue étrangère, qui change chaque jour.",
      "La réponse est toujours un nombre.",
      "Tu peux passer une question, elle ne rapporte rien.",
      "La correction complète s'affiche à la fin.",
    ],
  },
];

export const GAME_BY_KEY: Record<GameKey, GameInfo> = Object.fromEntries(GAMES.map((g) => [g.gameType, g])) as Record<GameKey, GameInfo>;

/** Jeu annoncé mais pas encore jouable. */
export const UPCOMING_GAME = { label: "Scratch et Python", emblem: "blocks" as EmblemKind, pitch: "Des défis de programmation. Bientôt disponible." };

/** « 1 min 12 s », « 48 s ». */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`;
}

/** Chronomètre : « 1:07 ». */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function scoreLabel(game: GameInfo, score: number, max?: number | null): string {
  if (game.unit === "points") return `${score} point${score > 1 ? "s" : ""}`;
  return max ? `${score} / ${max}` : `${score} bonne${score > 1 ? "s" : ""} réponse${score > 1 ? "s" : ""}`;
}

/** Résultat à partager : une ligne de carrés (vert = juste, gris = raté) comme les jeux quotidiens, sans rien dévoiler de la fiche. */
export function shareText(game: GameInfo, opts: { date: string; score: number; max?: number | null; marks?: boolean[]; durationSeconds?: number | null; streak?: number }): string {
  const [y, m, d] = opts.date.split("-");
  const lines = [`Educalcul · ${game.label} du ${d}/${m}/${y}`];
  if (opts.marks?.length) lines.push(opts.marks.map((ok) => (ok ? "🟩" : "⬜")).join(""));
  const time = formatDuration(opts.durationSeconds);
  lines.push(`${scoreLabel(game, opts.score, opts.max)}${time ? ` en ${time}` : ""}${opts.streak && opts.streak > 1 ? ` · série de ${opts.streak} jours` : ""}`);
  return lines.join("\n");
}

/** Secondes avant la prochaine fiche (minuit UTC : le jour d'une fiche est compté en temps universel, comme côté serveur). */
export function secondsToNextSheet(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(0, Math.round((next - now.getTime()) / 1000));
}

/** « 5 h 12 min », « 48 min ». */
export function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return m > 0 ? `${m} min` : "moins d'une minute";
}
