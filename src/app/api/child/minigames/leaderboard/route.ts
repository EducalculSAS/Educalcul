import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { gradeLevelToPalier, palierToGradeLevels } from "@/lib/minigames/levels";
import { isMinigameType } from "@/lib/minigames/gameTypes";

const PERIOD_SINCE: Record<string, () => string | null> = {
  week: () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  },
  all: () => null,
};


/** Classement agrégé sur minigame_sessions par la fonction SQL
 * minigame_leaderboard (index partiel sur les parties terminées).
 * Les jeux "à paliers" (calcul mental, énigmes, suites, langues) comparent
 * par PALIER (plusieurs grade_level partagent le même palier de difficulté)
 * — Mathador reste comparé par grade_level exact (pas de notion de palier). */
export async function GET(request: Request) {
  try {
    const me = await getAuthenticatedUser(request);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const gameType = url.searchParams.get("gameType") || "mathador";
    const period = PERIOD_SINCE[url.searchParams.get("period") || "all"] ? url.searchParams.get("period") || "all" : "all";
    const since = PERIOD_SINCE[period]();

    const { data: me_row } = await supabaseAdmin
      .from("users")
      .select("id, grade_level")
      .eq("auth_id", me.authId)
      .maybeSingle();
    if (!me_row) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const peerLevels = (() => {
      if (!isMinigameType(gameType)) return [me_row.grade_level];
      const palierCode = gradeLevelToPalier(me_row.grade_level);
      const levels = palierCode ? palierToGradeLevels(palierCode) : [me_row.grade_level];
      return levels.length ? levels : [me_row.grade_level];
    })().filter(Boolean) as string[];

    // Agrégat fait par la base (voir la fonction SQL minigame_leaderboard) :
    // avant, toutes les parties étaient téléchargées puis additionnées ici —
    // plafonnées à 1000 lignes, donc un classement faux dès qu'il y a du monde.
    const { data: rows, error } = await supabaseAdmin.rpc("minigame_leaderboard", {
      p_game_type: gameType,
      p_grade_levels: peerLevels,
      p_since: since,
      p_me: me_row.id,
      p_limit: 20,
    });
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    const all = (rows ?? []) as { user_id: number; total: number; best_duration: number | null; total_duration: number | null; rank: number }[];
    const ranked = all.filter((r) => Number(r.rank) <= 20);
    const mine = all.find((r) => r.user_id === me_row.id);

    const userIds = ranked.map((r) => r.user_id);
    const { data: users } = userIds.length
      ? await supabaseAdmin
          .from("users")
          .select("id, first_name, avatar, equipped_border, name_color")
          .in("id", userIds)
      : { data: [] };
    const usersById = new Map((users || []).map((u) => [u.id, u]));

    const leaderboard = ranked.map((r) => {
      const u = usersById.get(r.user_id);
      return {
        rank: Number(r.rank),
        userId: r.user_id,
        firstName: u?.first_name || "?",
        avatar: u?.avatar || null,
        equippedBorder: u?.equipped_border || null,
        nameColor: u?.name_color || null,
        total: Number(r.total),
        bestDurationSeconds: r.best_duration ?? null,
        totalDurationSeconds: r.total_duration != null ? Number(r.total_duration) : null,
        isMe: r.user_id === me_row.id,
      };
    });

    const myTotal = mine ? Number(mine.total) : 0;
    const myRank = mine ? Number(mine.rank) : null;

    return NextResponse.json({
      gameType,
      period,
      leaderboard,
      me: { total: myTotal, rank: myRank },
    });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
