import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { chatWithAI } from "@/lib/llm";
import { getAuthenticatedUser, canActOnInternalId } from "@/lib/apiAuth";

export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const childId = searchParams.get("childId");
    if (!childId) return NextResponse.json({ error: "Missing childId" }, { status: 400 });

    // The caller must own this child (or be admin).
    if (!(await canActOnInternalId(me, Number(childId)))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch child profile
    const { data: child } = await supabaseAdmin
      .from("users")
      .select("first_name, grade_level")
      .eq("id", childId)
      .single();

    // Fetch exercises (last 30)
    const { data: exercises } = await supabaseAdmin
      .from("user_exercise_attempts")
      .select("is_correct, attempted_at, exercises(title, difficulty_level, type)")
      .eq("user_id", childId)
      .order("attempted_at", { ascending: false })
      .limit(30);

    // Fetch quizzes (last 20)
    const { data: quizzes } = await supabaseAdmin
      .from("user_quiz_attempts")
      .select("score, total_questions, completed_at, quizzes(title)")
      .eq("user_id", childId)
      .order("completed_at", { ascending: false })
      .limit(20);

    // Fetch course progress (last 10)
    const { data: courseProgress } = await supabaseAdmin
      .from("user_course_progress")
      .select("created_at, courses(title, subject)")
      .eq("user_id", childId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Compute stats
    const totalEx = exercises?.length || 0;
    const correctEx = exercises?.filter(e => e.is_correct).length || 0;
    const successRate = totalEx > 0 ? Math.round((correctEx / totalEx) * 100) : 0;

    const avgQuizScore = quizzes && quizzes.length > 0
      ? Math.round(quizzes.reduce((a, q) => a + (q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0), 0) / quizzes.length)
      : null;

    // Build data summary for AI
    const exSummary = exercises?.slice(0, 15).map(e => ({
      titre: (e.exercises as any)?.title || "?",
      difficulte: (e.exercises as any)?.difficulty_level,
      correct: e.is_correct,
      date: new Date(e.attempted_at).toLocaleDateString("fr-FR"),
    })) || [];

    const quizSummary = quizzes?.slice(0, 10).map(q => ({
      titre: (q.quizzes as any)?.title || "?",
      score: `${q.score}/${q.total_questions}`,
      date: new Date(q.completed_at).toLocaleDateString("fr-FR"),
    })) || [];

    const courseSummary = courseProgress?.slice(0, 8).map((c: any) => ({
      cours: Array.isArray(c.courses) ? c.courses[0]?.title : c.courses?.title || "?",
      matiere: Array.isArray(c.courses) ? c.courses[0]?.subject : c.courses?.subject || "?",
    })) || [];

    const prompt = `Tu es un assistant pédagogique expert. Voici les données de progression de ${child?.first_name || "l'enfant"} (${child?.grade_level || "niveau non défini"}).

EXERCICES (${totalEx} au total, ${correctEx} corrects = ${successRate}% de réussite) :
${JSON.stringify(exSummary, null, 2)}

QUIZ (${quizzes?.length || 0} quiz${avgQuizScore !== null ? `, score moyen ${avgQuizScore}%` : ""}) :
${JSON.stringify(quizSummary, null, 2)}

COURS CONSULTÉS :
${JSON.stringify(courseSummary, null, 2)}

Analyse ces données et produis un rapport structuré en français avec ces sections :
1. **Résumé général** (2-3 phrases sur l'activité globale)
2. **Points forts** (ce que l'enfant maîtrise bien, basé sur les données)
3. **Points à améliorer** (difficultés identifiées)
4. **Conseils pour les parents** (actions concrètes à faire à la maison)
5. **Objectifs suggérés** (2-3 objectifs pour les prochaines semaines)

Sois précis, bienveillant et basé uniquement sur les données réelles. Si les données sont insuffisantes dis-le clairement. Réponds en français, de façon concise (max 400 mots total).`;

    const analysis = await chatWithAI(
      [{ role: "user", content: prompt }],
      "Tu es un assistant pédagogique expert qui analyse la progression d'élèves et donne des conseils aux parents.",
      0.4,
      600
    );

    return NextResponse.json({
      analysis,
      stats: { totalEx, correctEx, successRate, avgQuizScore, totalQuiz: quizzes?.length || 0, totalCourses: courseProgress?.length || 0 },
    });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
