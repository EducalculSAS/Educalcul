import "server-only";
import { selectAllPages } from "@/lib/selectAllPages";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendInBatches } from "@/lib/emailCampaign";
import { weeklyReportEmail, type WeeklyChildStats } from "@/lib/emailTemplates";

const DAY = 24 * 60 * 60 * 1000;

interface Parent {
  id: number;
  email: string;
  first_name: string | null;
}

interface Child {
  id: number;
  parent_id: number;
  first_name: string | null;
  child_username: string | null;
}

const avg = (values: (number | null)[]) => {
  const v = values.filter((n): n is number => typeof n === "number");
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

/**
 * Rapport hebdomadaire envoyé aux parents qui l'ont activé (Profil > Notifications) :
 * pour chaque enfant, exercices et quiz terminés depuis 7 jours, score moyen,
 * temps passé sur les quiz, cours terminés et badges gagnés. Un parent dont
 * les enfants n'ont rien fait cette semaine ne reçoit rien (pas de courrier
 * à vide).
 */
export async function sendWeeklyReports(now = new Date(), opts: { onlyEmails?: string[] } = {}) {
  const sinceMs = now.getTime() - 7 * DAY;
  const since = new Date(sinceMs).toISOString();

  const parents = await selectAllPages<Parent>((from, to) => {
    let q = supabaseAdmin.from("users").select("id, email, first_name")
      .eq("role", "parent").eq("notif_weekly_reports", true).neq("status", "inactive");
    // Envoi de test limité à quelques adresses (jamais utilisé par la tâche planifiée).
    if (opts.onlyEmails?.length) q = q.in("email", opts.onlyEmails);
    return q.order("id").range(from, to);
  });
  if (!parents.length) return { parents: 0, sent: 0, failed: 0, skipped: 0 };

  const parentIds = parents.map((p) => p.id);
  const children = await selectAllPages<Child>((from, to) =>
    supabaseAdmin.from("users").select("id, parent_id, first_name, child_username")
      .eq("role", "child").in("parent_id", parentIds).order("id").range(from, to),
  );
  const childIds = children.map((c) => c.id);
  if (!childIds.length) return { parents: parents.length, sent: 0, failed: 0, skipped: parents.length };

  const [exos, quizzes, courses, badges] = await Promise.all([
    selectAllPages<{ user_id: number; score_percent: number | null; passed: boolean | null }>((from, to) =>
      supabaseAdmin.from("user_exercise_attempts").select("user_id, score_percent, passed")
        .in("user_id", childIds).eq("status", "completed").gte("completed_at", since).order("id").range(from, to)),
    selectAllPages<{ user_id: number; score_percent: number | null; time_spent_seconds: number | null }>((from, to) =>
      supabaseAdmin.from("user_quiz_attempts").select("user_id, score_percent, time_spent_seconds")
        .in("user_id", childIds).eq("status", "completed").gte("completed_at", since).order("id").range(from, to)),
    selectAllPages<{ user_id: number }>((from, to) =>
      supabaseAdmin.from("user_course_progress").select("user_id")
        .in("user_id", childIds).eq("status", "completed").gte("completed_at", since).order("id").range(from, to)),
    selectAllPages<{ user_id: number; badges: { name: string } | { name: string }[] | null }>((from, to) =>
      supabaseAdmin.from("user_badges").select("user_id, badges(name)")
        .in("user_id", childIds).gte("earned_at", since).order("id").range(from, to)),
  ]);

  const statsFor = (c: Child): WeeklyChildStats => {
    const e = exos.filter((x) => x.user_id === c.id);
    const q = quizzes.filter((x) => x.user_id === c.id);
    return {
      name: c.first_name || c.child_username || "Votre enfant",
      exercises: e.length,
      quizzes: q.length,
      averageScore: avg([...e, ...q].map((x) => x.score_percent)),
      minutes: Math.round(q.reduce((s, x) => s + (x.time_spent_seconds || 0), 0) / 60),
      courses: courses.filter((x) => x.user_id === c.id).length,
      badges: badges
        .filter((x) => x.user_id === c.id)
        .map((x) => (Array.isArray(x.badges) ? x.badges[0]?.name : x.badges?.name))
        .filter((n): n is string => !!n),
    };
  };

  const period = `du ${new Date(sinceMs).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" })} au ${now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" })}`;
  let skipped = 0;
  const result = await sendInBatches(parents, (p) => {
    const kids = children.filter((c) => c.parent_id === p.id).map(statsFor);
    const active = kids.filter((k) => k.exercises + k.quizzes + k.courses + k.badges.length > 0);
    if (!active.length) { skipped++; return null; }
    return weeklyReportEmail(p.first_name || "", active, period);
  });
  return { parents: parents.length, ...result, skipped };
}
