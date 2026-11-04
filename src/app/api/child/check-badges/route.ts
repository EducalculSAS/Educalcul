import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser, canActOnAuthId } from "@/lib/apiAuth";
import { notify } from "@/lib/notify";
import { loadActivityCounts, toMissionStats } from "@/lib/cosmetics/stats";
import { evaluateAllMissions, missionsToAward } from "@/lib/cosmetics/missions";

/** Attribue les badges et les missions (contours / couleurs de nom) que l'élève vient d'accomplir. Appelée à chaque visite de « Mes trophées ». */
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { authId } = await req.json();
    if (!authId) return NextResponse.json({ error: "Missing authId" }, { status: 400 });
    if (!(await canActOnAuthId(me, authId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: user } = await supabaseAdmin.from("users").select("id, login_count, login_streak").eq("auth_id", authId).single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const userId = user.id;

    // ── Badges ──────────────────────────────────────────────────────────────
    const [{ data: allBadges }, { data: earned }, counts] = await Promise.all([
      supabaseAdmin.from("badges").select("id, requirement_type, requirement_value, name, description").eq("is_active", true),
      supabaseAdmin.from("user_badges").select("badge_id").eq("user_id", userId),
      loadActivityCounts(userId),
    ]);
    const earnedIds = new Set((earned || []).map((e) => e.badge_id));

    const badgeStats: Record<string, number> = {
      exercise_count: counts.exoCount,
      exercise_correct: counts.correctCount,
      quiz_count: counts.quizCount,
      quiz_perfect: counts.perfectQuizzes,
      course_count: counts.courseCount,
      login_streak: user.login_streak ?? 0,
      login_count: user.login_count ?? 0,
    };

    const toAward = (allBadges || []).filter((b) => !earnedIds.has(b.id) && (badgeStats[b.requirement_type] ?? 0) >= b.requirement_value);
    if (toAward.length > 0) {
      await supabaseAdmin.from("user_badges").insert(toAward.map((b) => ({ user_id: userId, badge_id: b.id })));
      for (const b of toAward) {
        await notify({ userId: authId, type: "badge", title: `Nouveau badge : ${b.name}`, body: b.description || undefined, link: "/child/badges" });
      }
    }

    // ── Missions : contours et couleurs gagnés pour toujours ────────────────
    const missionStats = toMissionStats(counts, user, earnedIds.size + toAward.length);
    const { data: ownedCosmetics } = await supabaseAdmin.from("user_cosmetics").select("cosmetic_key").eq("user_id", userId);
    const ownedIds = new Set((ownedCosmetics || []).map((c) => c.cosmetic_key));
    const newMissions = missionsToAward(missionStats, ownedIds);
    if (newMissions.length > 0) {
      await supabaseAdmin.from("user_cosmetics").insert(newMissions.map((m) => ({ user_id: userId, cosmetic_key: m.id })));
      for (const m of newMissions) {
        await notify({ userId: authId, type: "badge", title: `Mission accomplie : ${m.title}`, body: "Un nouveau contour est disponible dans Mes trophées.", link: "/child/badges" });
      }
    }
    const progress = Object.fromEntries(
      evaluateAllMissions(missionStats).map((p) => [
        p.mission.id,
        { label: p.mission.title, met: p.requirements.filter((r) => r.done).length, total: p.requirements.length, unlocked: p.completed || ownedIds.has(p.mission.id) },
      ]),
    );

    return NextResponse.json({ awarded: toAward.length, newCosmetics: newMissions.map((m) => m.id), progress });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
