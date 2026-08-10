import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { chatWithAI } from "@/lib/llm";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

// POST: parent asks AI to suggest a math revision schedule for a child,
// based on ALL of the child's activity — exercises, quizzes, course
// progress, and time spent — not just exercise attempts.
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cfg = RATE_LIMITS["ai:tutor"];
    const rl = await rateLimitWithBackoff(`calendar:suggest:${me.authId}`, cfg.maxAttempts, cfg.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de suggestions demandées, réessaie plus tard." }, { status: 429 });
    }

    const body = await req.json();
    const { childId } = body;

    if (!childId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const requester = { id: me.id, role: me.role };
    if (requester.role !== "parent") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const childIdNum = Number(childId);
    const { data: child } = await supabaseAdmin
      .from("users")
      .select("id, first_name, grade_level")
      .eq("id", childIdNum)
      .eq("parent_id", requester.id)
      .maybeSingle();
    if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Ces 4 requêtes ne dépendent que de childIdNum : indépendantes entre
    // elles, on les lance en parallèle plutôt qu'en série.
    const [
      { data: exerciseAttempts },
      { data: quizAttempts },
      { data: courseProgress },
      { data: sessions },
    ] = await Promise.all([
      // ── Exercices (titre = sujet précis de maths, "subject" n'est pas renseigné) ──
      supabaseAdmin
        .from("user_exercise_attempts")
        .select("is_correct, attempted_at, exercise:exercises(title)")
        .eq("user_id", childIdNum)
        .order("attempted_at", { ascending: false })
        .limit(100),
      // ── Quiz : mêmes sujets, taux de réussite + temps passé par quiz ──
      supabaseAdmin
        .from("user_quiz_attempts")
        .select("score, total_questions, time_spent_seconds, completed_at, quiz:quizzes(title)")
        .eq("user_id", childIdNum)
        .order("completed_at", { ascending: false })
        .limit(50),
      // ── Cours consultés ──
      supabaseAdmin
        .from("user_course_progress")
        .select("created_at, course:courses(title)")
        .eq("user_id", childIdNum)
        .order("created_at", { ascending: false })
        .limit(20),
      // ── Temps passé sur la plateforme (30 derniers jours) ──
      supabaseAdmin
        .from("user_sessions")
        .select("duration_seconds, login_at")
        .eq("user_id", childIdNum)
        .gte("login_at", thirtyDaysAgo),
    ]);
    const totalSessionMinutes = Math.round(
      (sessions || []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 60
    );
    const quizMinutes = Math.round(
      (quizAttempts || []).reduce((sum, q) => sum + (q.time_spent_seconds || 0), 0) / 60
    );

    // ── Sujets faibles, à partir des titres d'exercices ET de quiz (ce sont
    // les seuls libellés fiables ici — "subject" n'est jamais renseigné) ──
    const subjectStats: Record<string, { correct: number; total: number }> = {};
    for (const a of exerciseAttempts || []) {
      const exercise = Array.isArray(a.exercise) ? a.exercise[0] : a.exercise;
      const subject = exercise?.title;
      if (!subject) continue;
      if (!subjectStats[subject]) subjectStats[subject] = { correct: 0, total: 0 };
      subjectStats[subject].total++;
      if (a.is_correct) subjectStats[subject].correct++;
    }
    for (const q of quizAttempts || []) {
      const quiz = Array.isArray(q.quiz) ? q.quiz[0] : q.quiz;
      const title = quiz?.title;
      if (!title || !q.total_questions) continue;
      if (!subjectStats[title]) subjectStats[title] = { correct: 0, total: 0 };
      subjectStats[title].total += q.total_questions;
      subjectStats[title].correct += q.score || 0;
    }

    const weakSubjects = Object.entries(subjectStats)
      .map(([subject, s]) => ({ subject, rate: s.correct / s.total, total: s.total }))
      .filter(s => s.total >= 3)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 5);

    const coursesSeen = Array.from(
      new Set((courseProgress || []).map((c: any) => (Array.isArray(c.course) ? c.course[0]?.title : c.course?.title)).filter(Boolean))
    ).slice(0, 8);

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `Tu es un assistant pédagogique spécialisé EXCLUSIVEMENT en MATHÉMATIQUES pour Educalcul, une plateforme française de maths du CP à la Terminale, niveau de l'élève : ${child.grade_level || "collège/lycée"}.
Ta seule mission : proposer un programme de RÉVISION DE MATHÉMATIQUES personnalisé. Tu ne dois JAMAIS proposer une séance sur une autre matière (français, histoire, SVT, langues...), même si les libellés fournis te semblent ambigus — ce sont TOUJOURS des sujets de mathématiques (titres d'exercices/quiz de la plateforme), reformule-les si besoin en un titre de révision de maths clair et court.
Réponds UNIQUEMENT avec un JSON valide, sans texte autour, au format :
{"events":[{"title":"...","description":"...","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD ou null"}]}
Propose entre 3 et 6 séances de révision de maths réparties sur les 2 prochaines semaines, à partir du ${today}, ciblant en priorité les sujets faibles fournis. Adapte l'intensité au temps déjà investi par l'élève (s'il passe déjà beaucoup de temps, propose des séances plus courtes et ciblées). Les titres doivent être courts (ex: "Révision : Fractions").`;

    const userPrompt = `Activité de l'élève sur la plateforme (30 derniers jours) :
- Temps de connexion total : ${totalSessionMinutes} min
- Temps passé sur les quiz : ${quizMinutes} min
- Exercices tentés : ${exerciseAttempts?.length || 0}
- Quiz passés : ${quizAttempts?.length || 0}
- Cours consultés : ${coursesSeen.length > 0 ? coursesSeen.join(", ") : "aucun"}

Sujets de maths où l'élève a le plus de difficultés (taux de réussite) :
${weakSubjects.length > 0 ? weakSubjects.map(s => `- ${s.subject} : ${Math.round(s.rate * 100)}% de réussite sur ${s.total} question(s)/exercice(s)`).join("\n") : "Aucune donnée précise disponible, propose un programme de révision de maths générale équilibré pour son niveau."}

Génère le programme de révision de mathématiques au format JSON demandé.`;

    const aiResponse = await chatWithAI(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      0.5,
      1000
    );

    let parsed: { events: { title: string; description?: string; start_date: string; end_date?: string | null }[] };
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
    } catch {
      return NextResponse.json({ error: "Réponse IA invalide" }, { status: 502 });
    }

    const toInsert = (parsed.events || []).map(e => ({
      owner_id: childIdNum,
      created_by: requester.id,
      created_by_role: "parent",
      title: e.title,
      description: e.description || null,
      event_type: "revision",
      start_date: e.start_date,
      end_date: e.end_date || null,
      all_day: true,
      visible_to_child: true,
    }));

    if (toInsert.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("calendar_events")
      .insert(toInsert)
      .select();
    if (error) throw error;

    return NextResponse.json({ events: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
