import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * Série de JOURS CONSÉCUTIFS où l'enfant a terminé une partie d'un jeu —
 * calculée à partir des jours joués, renvoyés par la base (fonction SQL
 * minigame_played_days : jours distincts sur 400 jours). Avant, on lisait les
 * dernières PARTIES (400 ou 2000, plafonnées à 1000) : un élève qui joue
 * beaucoup voyait sa série tronquée. Distinct du `login_streak` de `users`.
 */
function streakFrom(days: string[] | undefined): number {
  if (!days?.length) return 0;
  const played = new Set(days);
  const cursor = new Date();
  // La série tient même si l'enfant n'a pas encore joué aujourd'hui : elle ne
  // se casse que s'il manque un jour PASSÉ.
  if (!played.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (played.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

async function playedDays(userId: number, gameTypes: string[]): Promise<Record<string, string[]>> {
  const { data, error } = await supabaseAdmin.rpc("minigame_played_days", { p_user: userId, p_games: gameTypes });
  if (error) throw error;
  return (data ?? {}) as Record<string, string[]>;
}

/** Version groupée : un seul aller-retour pour plusieurs jeux. */
export async function getStreaksForGames(userId: number, gameTypes: string[]): Promise<Record<string, number>> {
  const days = await playedDays(userId, gameTypes);
  return Object.fromEntries(gameTypes.map((g) => [g, streakFrom(days[g])]));
}
