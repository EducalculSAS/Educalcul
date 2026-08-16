import { supabaseAdmin } from "@/lib/supabaseClient";

/** Streak de JOURS CONSÉCUTIFS où l'enfant a complété une partie de ce jeu —
 * calculé à la volée à partir de minigame_sessions (même logique que le
 * classement, pas de colonne dénormalisée à maintenir en synchro). Distinct
 * du `login_streak` existant sur `users` (connexion quotidienne, pas liée
 * aux mini-jeux). */
export async function getStreak(userId: number, gameType: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("minigame_sessions")
    .select("created_at")
    .eq("user_id", userId)
    .eq("game_type", gameType)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(400); // large fenêtre : largement assez pour n'importe quel streak réaliste

  if (!data || data.length === 0) return 0;

  const playedDates = new Set(data.map((r) => new Date(r.created_at).toISOString().slice(0, 10)));

  const cursor = new Date();
  let streak = 0;
  // Le streak "compte" même si l'enfant n'a pas encore joué aujourd'hui —
  // il se casse seulement s'il manque un jour PASSÉ, pas le jour courant.
  if (!playedDates.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (playedDates.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Version batch — un aller-retour DB pour plusieurs jeux à la fois (évite
 * N requêtes séquentielles sur la page catalogue). */
export async function getStreaksForGames(userId: number, gameTypes: string[]): Promise<Record<string, number>> {
  const { data } = await supabaseAdmin
    .from("minigame_sessions")
    .select("game_type, created_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("game_type", gameTypes)
    .order("created_at", { ascending: false })
    .limit(2000);

  const datesByGame = new Map<string, Set<string>>();
  for (const row of data || []) {
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    if (!datesByGame.has(row.game_type)) datesByGame.set(row.game_type, new Set());
    datesByGame.get(row.game_type)!.add(day);
  }

  const result: Record<string, number> = {};
  for (const gameType of gameTypes) {
    const playedDates = datesByGame.get(gameType);
    if (!playedDates || playedDates.size === 0) {
      result[gameType] = 0;
      continue;
    }
    const cursor = new Date();
    if (!playedDates.has(cursor.toISOString().slice(0, 10))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    let streak = 0;
    while (playedDates.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    result[gameType] = streak;
  }
  return result;
}
