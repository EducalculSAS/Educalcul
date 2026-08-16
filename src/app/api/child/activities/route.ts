import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser, canActOnAuthId } from "@/lib/apiAuth";


// GET: Fetch all activities for the current user
export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const authId = searchParams.get("userId"); // This is the auth.uid (UUID)

    if (!authId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }
    // Self, the child's parent, or admin only.
    if (!(await canActOnAuthId(me, authId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Must find the internal BIGINT ID to filter correctly if needed
    const { data: userRecord } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();

    if (!userRecord) {
      return NextResponse.json({ exercises: [], quizzes: [], courses: [] });
    }

    const internalId = userRecord.id;

    // These three history queries are independent (filtered only by
    // internalId), so run them in parallel instead of one after the other.
    const [
      { data: exercises, error: exError },
      { data: quizzes, error: qzError },
      { data: courses, error: coError },
    ] = await Promise.all([
      supabaseAdmin
        .from("user_exercise_attempts")
        .select("*, exercises(title)")
        .eq("user_id", internalId)
        .order("completed_at", { ascending: false }),
      supabaseAdmin
        .from("user_quiz_attempts")
        .select("*, quizzes(title)")
        .eq("user_id", internalId)
        .order("completed_at", { ascending: false }),
      supabaseAdmin
        .from("user_course_progress")
        .select("*, courses(title)")
        .eq("user_id", internalId)
        .order("completed_at", { ascending: false }),
    ]);

    if (exError || qzError || coError) {
      throw exError || qzError || coError;
    }

    return NextResponse.json({
      exercises: exercises || [],
      quizzes: quizzes || [],
      courses: courses || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

// POST: Save a new activity
export async function POST(req: Request) {
  try {
    // ✓ SÉCURITÉ : exiger une session valide et empêcher l'écriture de la
    // progression d'un autre utilisateur (IDOR). Cette route n'est PAS couverte
    // par le middleware (/api/child/*), elle doit donc s'authentifier elle-même.
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { type, userId, itemId, score, totalPoints, timeSpent, chapterIndex, status, scorePercent, passed, lessonsCompleted, lessonCount, lastLessonId, lastChapterIndex, lastLessonIndex } = body;

    if (!type || !userId || !itemId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!(await canActOnAuthId(me, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Resolve Auth UUID to internal BIGINT ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", userId)
      .maybeSingle();

    if (userError || !userData) {
      throw new Error(userError?.message || "User record not found to associate activity.");
    }

    const internalId = userData.id;

    // Défense en profondeur : la note détaillée par bloc est déjà corrigée
    // côté serveur (voir /api/child/exercises|quizzes/[id]/grade), mais rien
    // n'empêche un client d'appeler cette route directement avec un score
    // inventé. On borne le score au maximum réel de l'exercice/quiz et on
    // recalcule le pourcentage / la réussite à partir de ce score borné —
    // le client ne peut donc jamais déclarer plus que 100%, ni "réussi" avec
    // un score qui n'atteint pas le seuil.
    let safeScore = Math.max(0, Number(score) || 0);
    let safeScorePercent: number | null = null;
    let safePassed: boolean | null = null;

    if ((type === "exercise" || type === "quiz") && status === "completed") {
      const table = type === "exercise" ? "exercises" : "quizzes";
      const { data: item } = await supabaseAdmin
        .from(table)
        .select("content_json, min_score_percent")
        .eq("id", itemId)
        .maybeSingle();

      let maxPoints = 0;
      if (type === "exercise" && Array.isArray(item?.content_json)) {
        item.content_json.forEach((p: any) =>
          (p.blocks || []).forEach((b: any) => (maxPoints += b.points || 0))
        );
      } else if (type === "quiz" && Array.isArray(item?.content_json)) {
        item.content_json.forEach((q: any) => (maxPoints += q.points || 1));
      }

      if (maxPoints > 0) {
        safeScore = Math.min(safeScore, maxPoints);
        safeScorePercent = Math.round((safeScore / maxPoints) * 100);
      } else {
        // Pas de barème connu (contenu vide/legacy) : on ne peut pas borner
        // le score, on se limite à borner le pourcentage déclaré.
        safeScorePercent = Math.min(100, Math.max(0, Math.round(Number(scorePercent) || 0)));
      }
      const threshold = item?.min_score_percent || 0;
      safePassed = threshold > 0 ? safeScorePercent >= threshold : true;
    }

    let result;
    if (type === "exercise") {
      let attemptsHistory: any[] = [];
      if (status === "completed") {
        const { data: existing } = await supabaseAdmin
          .from("user_exercise_attempts")
          .select("attempts_history, progress_json")
          .eq("user_id", internalId)
          .eq("exercise_id", itemId)
          .maybeSingle();
        // La partie qui vient de se terminer est encore dans progress_json
        // (pas encore écrasée par cet upsert) — on capture son détail
        // question par question dans l'historique AVANT qu'il ne soit
        // remplacé, sinon cette tentative ne serait plus jamais consultable
        // en détail une fois la suivante jouée (seul un résumé de score
        // était gardé jusqu'ici, voir plan "revue admin des copies").
        const prevProgress = existing?.progress_json as { answers?: any; results?: any; revealed?: any; aiFeedback?: any } | undefined;
        attemptsHistory = [...(existing?.attempts_history || []), {
          score: safeScore,
          total_points: totalPoints || 0,
          score_percent: safeScorePercent,
          passed: safePassed,
          completed_at: new Date().toISOString(),
          detail: prevProgress ? {
            answers: prevProgress.answers || {},
            results: prevProgress.results || {},
            revealed: prevProgress.revealed || {},
            aiFeedback: prevProgress.aiFeedback || {},
          } : undefined,
        }];
      }
      result = await supabaseAdmin.from("user_exercise_attempts").upsert({
        user_id: internalId,
        exercise_id: itemId,
        score: safeScore,
        total_points: totalPoints || 0,
        status: status || 'in_progress',
        score_percent: safeScorePercent,
        passed: safePassed,
        completed_at: new Date().toISOString(),
        ...(status === "completed" ? { attempts_history: attemptsHistory } : {}),
      }, { onConflict: 'user_id, exercise_id' });
    } else if (type === "quiz") {
      let attemptsHistory: any[] = [];
      if (status === "completed") {
        const { data: existing } = await supabaseAdmin
          .from("user_quiz_attempts")
          .select("attempts_history, progress_json")
          .eq("user_id", internalId)
          .eq("quiz_id", itemId)
          .maybeSingle();
        const prevProgress = existing?.progress_json as { answers?: any; questionResults?: any; revealed?: any; questionFeedbacks?: any } | undefined;
        attemptsHistory = [...(existing?.attempts_history || []), {
          score: safeScore,
          total_points: totalPoints || 0,
          score_percent: safeScorePercent,
          passed: safePassed,
          completed_at: new Date().toISOString(),
          detail: prevProgress ? {
            answers: prevProgress.answers || {},
            questionResults: prevProgress.questionResults || {},
            revealed: prevProgress.revealed || {},
            questionFeedbacks: prevProgress.questionFeedbacks || {},
          } : undefined,
        }];
      }
      result = await supabaseAdmin.from("user_quiz_attempts").upsert({
        user_id: internalId,
        quiz_id: itemId,
        score: safeScore,
        total_points: totalPoints || 0,
        time_spent_seconds: timeSpent || 0,
        status: status || 'in_progress',
        score_percent: safeScorePercent,
        passed: safePassed,
        completed_at: new Date().toISOString(),
        ...(status === "completed" ? { attempts_history: attemptsHistory } : {}),
      }, { onConflict: 'user_id, quiz_id' });
    } else if (type === "course") {
      result = await supabaseAdmin.from("user_course_progress").upsert({
        user_id: internalId,
        course_id: itemId,
        chapter_index: chapterIndex || 0,
        status: status || 'in_progress',
        progress_json: {
          lessonsCompleted: lessonsCompleted || [],
          lessonCount: lessonCount || 0,
          lastLessonId: lastLessonId ?? null,
          lastChapterIndex: lastChapterIndex ?? 0,
          lastLessonIndex: lastLessonIndex ?? 0,
          timeSpent: timeSpent || 0,
        },
        completed_at: new Date().toISOString()
      }, { onConflict: 'user_id, course_id' });
    }

    if (result?.error) throw result.error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error saving activity:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
