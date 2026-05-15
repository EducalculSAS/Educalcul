import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// ── Tier thresholds per category ────────────────────────────────────────────
// Returns the tier level (0 = nothing, 1 = first badge, 2 = second, etc.)
function exerciseTier(n: number) {
  if (n >= 2500) return 7;
  if (n >= 1000) return 6;
  if (n >= 500)  return 5;
  if (n >= 200)  return 4;
  if (n >= 75)   return 3;
  if (n >= 25)   return 2;
  if (n >= 1)    return 1;
  return 0;
}
function courseTier(n: number) {
  if (n >= 200) return 6;
  if (n >= 100) return 5;
  if (n >= 40)  return 4;
  if (n >= 15)  return 3;
  if (n >= 5)   return 2;
  if (n >= 1)   return 1;
  return 0;
}
function quizTier(n: number) {
  if (n >= 150) return 4;
  if (n >= 50)  return 3;
  if (n >= 15)  return 2;
  if (n >= 1)   return 1;
  return 0;
}
function quizPerfectTier(n: number) {
  if (n >= 40) return 4;
  if (n >= 15) return 3;
  if (n >= 5)  return 2;
  if (n >= 1)  return 1;
  return 0;
}
function loginStreakTier(n: number) {
  if (n >= 365) return 5;
  if (n >= 90)  return 4;
  if (n >= 30)  return 3;
  if (n >= 7)   return 2;
  if (n >= 1)   return 1;
  return 0;
}
function loginCountTier(n: number) {
  if (n >= 365) return 5;
  if (n >= 100) return 4;
  if (n >= 30)  return 3;
  if (n >= 7)   return 2;
  if (n >= 1)   return 1;
  return 0;
}

// ── Cross-category cosmetic requirements ─────────────────────────────────────
// Each cosmetic needs minimum tiers across categories
// progress = { exercises, courses, quiz } — each contributes 1/3
const COSMETIC_REQUIREMENTS: Record<string, {
  label: string;
  checks: (tiers: Record<string, number>) => { met: string[]; needed: string[] };
}> = {
  bronze: {
    label: "Bronze",
    checks: (t) => {
      const parts = [
        { name: "Exercices (palier 2)",  ok: t.exo >= 2 },
        { name: "Cours (palier 2)",       ok: t.cours >= 2 },
        { name: "Quiz (palier 2)",        ok: t.quiz >= 2 },
      ];
      return { met: parts.filter(p => p.ok).map(p => p.name), needed: parts.filter(p => !p.ok).map(p => p.name) };
    },
  },
  silver: {
    label: "Argent",
    checks: (t) => {
      const parts = [
        { name: "Exercices (palier 3)",  ok: t.exo >= 3 },
        { name: "Cours (palier 3)",       ok: t.cours >= 3 },
        { name: "Quiz (palier 3)",        ok: t.quiz >= 3 },
      ];
      return { met: parts.filter(p => p.ok).map(p => p.name), needed: parts.filter(p => !p.ok).map(p => p.name) };
    },
  },
  gold: {
    label: "Or",
    checks: (t) => {
      const parts = [
        { name: "Exercices (palier 4)",  ok: t.exo >= 4 },
        { name: "Cours (palier 4)",       ok: t.cours >= 4 },
        { name: "Quiz (palier 4)",        ok: t.quiz >= 4 },
      ];
      return { met: parts.filter(p => p.ok).map(p => p.name), needed: parts.filter(p => !p.ok).map(p => p.name) };
    },
  },
  diamond: {
    label: "Diamant",
    checks: (t) => {
      const parts = [
        { name: "Exercices (palier 5)",      ok: t.exo >= 5 },
        { name: "Cours (palier 5)",           ok: t.cours >= 5 },
        { name: "Quiz parfaits (palier 2)",   ok: t.quizPerfect >= 2 },
      ];
      return { met: parts.filter(p => p.ok).map(p => p.name), needed: parts.filter(p => !p.ok).map(p => p.name) };
    },
  },
  flamme: {
    label: "Flamme",
    checks: (t) => {
      const parts = [
        { name: "Streak (palier 3 - 30j)", ok: t.loginStreak >= 3 },
        { name: "Connexions (palier 3)",    ok: t.loginCount >= 3 },
      ];
      return { met: parts.filter(p => p.ok).map(p => p.name), needed: parts.filter(p => !p.ok).map(p => p.name) };
    },
  },
  elite_text: {
    label: "Couleur Elite",
    checks: (t) => {
      const parts = [
        { name: "Exercices (palier 6 - 1000)", ok: t.exo >= 6 },
        { name: "Cours (palier 5 - 100)",       ok: t.cours >= 5 },
        { name: "Quiz parfaits (palier 3 - 15)",ok: t.quizPerfect >= 3 },
        { name: "Connexions (palier 4 - 100)",  ok: t.loginCount >= 4 },
      ];
      return { met: parts.filter(p => p.ok).map(p => p.name), needed: parts.filter(p => !p.ok).map(p => p.name) };
    },
  },
  elite: {
    label: "Contour Elite",
    checks: (t) => {
      const parts = [
        { name: "Exercices (palier 7 - 2500)",  ok: t.exo >= 7 },
        { name: "Cours (palier 6 - 200)",        ok: t.cours >= 6 },
        { name: "Quiz parfaits (palier 4 - 40)", ok: t.quizPerfect >= 4 },
        { name: "Streak (palier 5 - 365j)",      ok: t.loginStreak >= 5 },
        { name: "Connexions (palier 5 - 365)",   ok: t.loginCount >= 5 },
      ];
      return { met: parts.filter(p => p.ok).map(p => p.name), needed: parts.filter(p => !p.ok).map(p => p.name) };
    },
  },
};

export async function POST(req: Request) {
  try {
    const { authId } = await req.json();
    if (!authId) return NextResponse.json({ error: "Missing authId" }, { status: 400 });

    const { data: user } = await supabaseAdmin.from("users").select("id, login_count, login_streak").eq("auth_id", authId).single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const userId = user.id;

    // ── Individual badge checking ───────────────────────────────────────────
    const { data: allBadges } = await supabaseAdmin.from("badges").select("*").eq("is_active", true);
    const { data: earned } = await supabaseAdmin.from("user_badges").select("badge_id").eq("user_id", userId);
    const earnedIds = new Set((earned || []).map(e => e.badge_id));

    const [
      { count: exoCount }, { count: correctCount }, { count: quizCount },
      { count: courseCount }, { data: quizScores },
    ] = await Promise.all([
      supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("is_correct", true),
      supabaseAdmin.from("user_quiz_attempts").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabaseAdmin.from("user_course_progress").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabaseAdmin.from("user_quiz_attempts").select("score, total_questions").eq("user_id", userId),
    ]);

    const perfectQuizzes = (quizScores || []).filter(q => q.total_questions > 0 && q.score === q.total_questions).length;

    const stats: Record<string, number> = {
      exercise_count: exoCount ?? 0,
      exercise_correct: correctCount ?? 0,
      quiz_count: quizCount ?? 0,
      quiz_perfect: perfectQuizzes,
      course_count: courseCount ?? 0,
      login_streak: user.login_streak ?? 0,
      login_count: user.login_count ?? 0,
    };

    // Award individual badges
    const toAward = (allBadges || []).filter(b => !earnedIds.has(b.id) && (stats[b.requirement_type] ?? 0) >= b.requirement_value);
    if (toAward.length > 0) {
      await supabaseAdmin.from("user_badges").insert(toAward.map(b => ({ user_id: userId, badge_id: b.id })));
    }

    // ── Cross-category cosmetics check ─────────────────────────────────────
    const tiers = {
      exo: exerciseTier(exoCount ?? 0),
      cours: courseTier(courseCount ?? 0),
      quiz: quizTier(quizCount ?? 0),
      quizPerfect: quizPerfectTier(perfectQuizzes),
      loginStreak: loginStreakTier(user.login_streak ?? 0),
      loginCount: loginCountTier(user.login_count ?? 0),
    };

    const { data: ownedCosmetics } = await supabaseAdmin.from("user_cosmetics").select("cosmetic_key").eq("user_id", userId);
    const ownedKeys = new Set((ownedCosmetics || []).map(c => c.cosmetic_key));

    const newCosmetics: string[] = [];
    const cosmeticProgress: Record<string, any> = {};

    for (const [key, def] of Object.entries(COSMETIC_REQUIREMENTS)) {
      const { met, needed } = def.checks(tiers);
      const total = met.length + needed.length;
      cosmeticProgress[key] = {
        label: def.label,
        met: met.length,
        total,
        parts: { met, needed },
        unlocked: needed.length === 0,
      };
      if (needed.length === 0 && !ownedKeys.has(key)) {
        newCosmetics.push(key);
      }
    }

    if (newCosmetics.length > 0) {
      await supabaseAdmin.from("user_cosmetics").insert(newCosmetics.map(k => ({ user_id: userId, cosmetic_key: k })));
    }

    return NextResponse.json({ awarded: toAward.length, newCosmetics, progress: cosmeticProgress, tiers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
