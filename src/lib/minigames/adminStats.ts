import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { selectAllPages } from "@/lib/selectAllPages";
import { sheetDay } from "@/lib/minigames/hub";

export interface AdminMinigamesToday {
  /** Parties lancées aujourd'hui, par jeu. */
  plays: Record<string, number>;
  /** Parties terminées aujourd'hui, par jeu. */
  completed: Record<string, number>;
  players: number;
  /** Fiches du jour prêtes, par jeu (une par palier attendu). */
  sheetsReady: Record<string, number>;
  /** Les 7 derniers jours, du plus ancien à aujourd'hui. */
  last7: { day: string; plays: number }[];
}

/** Fréquentation du jour et des 7 derniers jours, et fiches prêtes : la vue d'ensemble de l'admin des mini-jeux. */
export async function loadAdminMinigamesToday(): Promise<AdminMinigamesToday> {
  const day = sheetDay();
  const since = new Date(Date.now() - 6 * 86400000);
  since.setUTCHours(0, 0, 0, 0);

  const [recent, { data: sheets }] = await Promise.all([
    selectAllPages<{ game_type: string; status: string; user_id: number; created_at: string }>((from, to) =>
      supabaseAdmin.from("minigame_sessions").select("game_type, status, user_id, created_at").gte("created_at", since.toISOString()).order("id").range(from, to),
    ),
    supabaseAdmin.from("minigame_daily_sheets").select("game_type, palier_code").eq("for_date", day).eq("tier", "free").eq("is_archived", false),
  ]);

  const today: AdminMinigamesToday = { plays: {}, completed: {}, players: 0, sheetsReady: {}, last7: [] };
  const players = new Set<number>();
  const byDay = new Map<string, number>();
  for (const r of recent) {
    const d = String(r.created_at).slice(0, 10);
    byDay.set(d, (byDay.get(d) || 0) + 1);
    if (d !== day) continue;
    players.add(r.user_id);
    today.plays[r.game_type] = (today.plays[r.game_type] || 0) + 1;
    if (r.status === "completed") today.completed[r.game_type] = (today.completed[r.game_type] || 0) + 1;
  }
  today.players = players.size;
  for (const s of sheets || []) today.sheetsReady[s.game_type] = (today.sheetsReady[s.game_type] || 0) + 1;
  today.last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10);
    return { day: d, plays: byDay.get(d) || 0 };
  });
  return today;
}
