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


/** Classement agrégé sur minigame_sessions — pas de table dédiée, une requête
 * groupée sur l'index (game_type, grade_level, score desc) suffit au volume.
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

    let query = supabaseAdmin
      .from("minigame_sessions")
      .select("user_id, score, grade_level, duration_seconds")
      .eq("game_type", gameType)
      .eq("status", "completed");

    if (isMinigameType(gameType)) {
      const palierCode = gradeLevelToPalier(me_row.grade_level);
      const peerLevels = palierCode ? palierToGradeLevels(palierCode) : [me_row.grade_level];
      query = query.in("grade_level", peerLevels.length ? peerLevels : [me_row.grade_level]);
    } else {
      query = query.eq("grade_level", me_row.grade_level);
    }
    if (since) query = query.gte("created_at", since);

    const { data: sessions, error } = await query;
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    const totals = new Map<number, number>();
    const bestDurations = new Map<number, number>();
    const totalDurations = new Map<number, number>();
    for (const s of sessions || []) {
      totals.set(s.user_id, (totals.get(s.user_id) || 0) + (s.score || 0));
      if (typeof s.duration_seconds === "number") {
        const prevBest = bestDurations.get(s.user_id);
        if (prevBest === undefined || s.duration_seconds < prevBest) bestDurations.set(s.user_id, s.duration_seconds);
        totalDurations.set(s.user_id, (totalDurations.get(s.user_id) || 0) + s.duration_seconds);
      }
    }

    // Score décroissant d'abord, meilleur temps ("bestDurationSeconds") comme
    // départage à égalité — Infinity pour "pas de temps enregistré" les
    // classe systématiquement après ceux qui en ont un.
    const compareEntries = ([userIdA, totalA]: [number, number], [userIdB, totalB]: [number, number]) => {
      if (totalB !== totalA) return totalB - totalA;
      const timeA = bestDurations.get(userIdA) ?? Infinity;
      const timeB = bestDurations.get(userIdB) ?? Infinity;
      return timeA - timeB;
    };

    const ranked = [...totals.entries()].sort(compareEntries).slice(0, 20);

    const userIds = ranked.map(([id]) => id);
    const { data: users } = userIds.length
      ? await supabaseAdmin
          .from("users")
          .select("id, first_name, avatar, equipped_border, name_color")
          .in("id", userIds)
      : { data: [] };
    const usersById = new Map((users || []).map((u) => [u.id, u]));

    const leaderboard = ranked.map(([userId, total], i) => {
      const u = usersById.get(userId);
      return {
        rank: i + 1,
        userId,
        firstName: u?.first_name || "?",
        avatar: u?.avatar || null,
        equippedBorder: u?.equipped_border || null,
        nameColor: u?.name_color || null,
        total,
        bestDurationSeconds: bestDurations.get(userId) ?? null,
        totalDurationSeconds: totalDurations.get(userId) ?? null,
        isMe: userId === me_row.id,
      };
    });

    const myTotal = totals.get(me_row.id) || 0;
    const myRankIndex = [...totals.entries()].sort(compareEntries).findIndex(([id]) => id === me_row.id);

    return NextResponse.json({
      gameType,
      period,
      leaderboard,
      me: { total: myTotal, rank: myRankIndex >= 0 ? myRankIndex + 1 : null },
    });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
