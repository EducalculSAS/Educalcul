import { NextResponse, after } from "next/server";
import type { Page } from "@/components/admin/ExerciseBuilder";
import type { Question } from "@/components/admin/QuizBuilder";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { blockMaxPoints } from "@/lib/exerciseScoring";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser, canActOnAuthId } from "@/lib/apiAuth";
import { passThreshold } from "@/lib/scorePercent";
import { afterActivity } from "@/lib/parentAlerts";
import { serverScore, clearGrades } from "@/lib/gradedAnswers";


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
        .order("completed_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("user_quiz_attempts")
        .select("*, quizzes(title)")
        .eq("user_id", internalId)
        .order("completed_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("user_course_progress")
        .select("*, courses(title)")
        .eq("user_id", internalId)
        .order("completed_at", { ascending: false })
        .limit(200),
    ]);

    if (exError || qzError || coError) {
      throw exError || qzError || coError;
    }

    return NextResponse.json({
      exercises: exercises || [],
      quizzes: quizzes || [],
      courses: courses || [],
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
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
    const { type, userId, itemId, score, totalPoints, timeSpent, chapterIndex, status, scorePercent, lessonsCompleted, lessonCount, lastLessonId, lastChapterIndex, lastLessonIndex } = body;

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
    let exerciseMaxAttempts: number | null = null;
    let quizMaxAttempts: number | null = null;
    let manualGrading = false;
    let gradedFromServer = false;

    if ((type === "exercise" || type === "quiz") && status === "completed") {
      const table = type === "exercise" ? "exercises" : "quizzes";
      const { data: item } = await supabaseAdmin
        .from(table)
        .select(type === "exercise" ? "content_json, min_score_percent, max_attempts, grading_type, time_limit_minutes" : "content_json, min_score_percent, max_attempts, time_limit_minutes")
        .eq("id", itemId)
        .maybeSingle<{ content_json: unknown; min_score_percent: number | null; max_attempts?: number | null; grading_type?: string | null; time_limit_minutes?: number | null }>();
      if (type === "quiz") quizMaxAttempts = Number(item?.max_attempts) > 0 ? Number(item?.max_attempts) : null;
      if (type === "exercise") {
        exerciseMaxAttempts = Number(item?.max_attempts) > 0 ? Number(item?.max_attempts) : null;
        manualGrading = item?.grading_type === "manual";
      }

      let maxPoints = 0;
      if (type === "exercise" && Array.isArray(item?.content_json)) {
        (item.content_json as Page[]).forEach((p) =>
          (p.blocks || []).forEach((b) => (maxPoints += blockMaxPoints(b)))
        );
      } else if (type === "quiz" && Array.isArray(item?.content_json)) {
        (item.content_json as Question[]).forEach((q) => (maxPoints += q.points || 1));
      }

      // L'élève qui joue pour lui-même ne déclare plus sa note : elle vient des verdicts enregistrés par la correction.
      // (Parent et admin, qui peuvent agir pour un élève, gardent la note bornée du client.)
      const fromServer = me.role === "child" && me.id === internalId && !manualGrading && maxPoints > 0;
      if (fromServer) {
        const ids = new Set<string>();
        if (type === "exercise") (item?.content_json as Page[] | undefined)?.forEach((p) => (p.blocks || []).forEach((b) => b?.id && ids.add(String(b.id))));
        else (item?.content_json as Question[] | undefined)?.forEach((q) => q?.id !== undefined && ids.add(String(q.id)));
        // Temps limité : seuls les verdicts rendus pendant la tentative (début enregistré au premier envoi « en cours »,
        // plus 90 s de marge réseau) comptent ; une réponse corrigée après la fin du temps ne rapporte rien.
        const window: { since?: Date; until?: Date } = {};
        const limitMin = Number(item?.time_limit_minutes) > 0 ? Number(item?.time_limit_minutes) : 0;
        if (limitMin > 0) {
          const { data: cur } = await supabaseAdmin
            .from(type === "exercise" ? "user_exercise_attempts" : "user_quiz_attempts")
            .select("attempt_started_at")
            .eq("user_id", internalId)
            .eq(type === "exercise" ? "exercise_id" : "quiz_id", itemId)
            .maybeSingle();
          if (cur?.attempt_started_at) {
            const started = new Date(cur.attempt_started_at);
            window.since = started;
            window.until = new Date(started.getTime() + limitMin * 60_000 + 90_000);
          }
        }
        safeScore = await serverScore(internalId, type, itemId, ids, maxPoints, window);
        gradedFromServer = true;
      }

      if (maxPoints > 0) {
        safeScore = Math.min(safeScore, maxPoints);
        safeScorePercent = Math.round((safeScore / maxPoints) * 100);
      } else {
        // Pas de barème connu (contenu vide/legacy) : on ne peut pas borner
        // le score, on se limite à borner le pourcentage déclaré.
        safeScorePercent = Math.min(100, Math.max(0, Math.round(Number(scorePercent) || 0)));
      }
      safePassed = safeScorePercent >= passThreshold(item?.min_score_percent);
      // Correction manuelle : ni note ni réussite tant que l'enseignant n'a pas corrigé (voir la revue des copies).
      if (manualGrading) {
        safeScore = 0;
        safeScorePercent = null;
        safePassed = null;
      }
    }

    // Début de la tentative chronométrée : posé au premier envoi « en cours », conservé si la page est rechargée,
    // repris à zéro si l'ancienne tentative a été abandonnée (plus de 30 minutes après la fin du temps).
    let attemptStartedAt: string | null = null;
    if (me.role === "child" && me.id === internalId && (type === "exercise" || type === "quiz") && status === "in_progress") {
      const { data: it } = await supabaseAdmin.from(type === "exercise" ? "exercises" : "quizzes").select("time_limit_minutes").eq("id", itemId).maybeSingle();
      const limitMin = Number(it?.time_limit_minutes) > 0 ? Number(it?.time_limit_minutes) : 0;
      if (limitMin > 0) {
        const { data: cur } = await supabaseAdmin
          .from(type === "exercise" ? "user_exercise_attempts" : "user_quiz_attempts")
          .select("attempt_started_at")
          .eq("user_id", internalId)
          .eq(type === "exercise" ? "exercise_id" : "quiz_id", itemId)
          .maybeSingle();
        const prev = cur?.attempt_started_at ? new Date(cur.attempt_started_at).getTime() : null;
        const stale = prev !== null && Date.now() - prev > limitMin * 60_000 + 30 * 60_000;
        attemptStartedAt = prev !== null && !stale ? cur!.attempt_started_at : new Date().toISOString();
      }
    }

    let result;
    // Un cours qui passe à « terminé » pour la première fois : le parent en est prévenu (voir parentAlerts).
    let courseCompletedTitle: string | null = null;
    if (type === "course" && status === "completed") {
      const [{ data: before }, { data: course }] = await Promise.all([
        supabaseAdmin.from("user_course_progress").select("status").eq("user_id", internalId).eq("course_id", itemId).maybeSingle(),
        supabaseAdmin.from("courses").select("title").eq("id", itemId).maybeSingle(),
      ]);
      if (before?.status !== "completed") courseCompletedTitle = course?.title || "Cours";
    }
    if (type === "exercise") {
      let attemptsHistory: unknown[] = [];
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
        // La limite d'essais de l'exercice est aussi tenue ici (pas seulement en masquant le bouton) : un essai de plus
        // que le maximum n'est jamais enregistré, même si le client est contourné.
        if (exerciseMaxAttempts && (existing?.attempts_history?.length ?? 0) >= exerciseMaxAttempts) {
          return NextResponse.json({ error: "Tentatives épuisées pour cet exercice.", code: "attempts_exhausted" }, { status: 409 });
        }
        const prevProgress = existing?.progress_json as { answers?: unknown; results?: unknown; revealed?: unknown; aiFeedback?: unknown } | undefined;
        attemptsHistory = [...(existing?.attempts_history || []), {
          score: safeScore,
          total_points: totalPoints || 0,
          score_percent: safeScorePercent,
          passed: safePassed,
          ...(manualGrading ? { pending: true } : {}),
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
        ...(status === "completed" ? { attempts_history: attemptsHistory, attempt_started_at: null } : {}),
        ...(attemptStartedAt ? { attempt_started_at: attemptStartedAt } : {}),
      }, { onConflict: 'user_id, exercise_id' });
    } else if (type === "quiz") {
      let attemptsHistory: unknown[] = [];
      if (status === "completed") {
        const { data: existing } = await supabaseAdmin
          .from("user_quiz_attempts")
          .select("attempts_history, progress_json")
          .eq("user_id", internalId)
          .eq("quiz_id", itemId)
          .maybeSingle();
        // Même règle que pour les exercices : un essai de plus que le maximum n'est jamais enregistré, même si le client est contourné.
        if (quizMaxAttempts && (existing?.attempts_history?.length ?? 0) >= quizMaxAttempts) {
          return NextResponse.json({ error: "Tentatives épuisées pour ce quiz.", code: "attempts_exhausted" }, { status: 409 });
        }
        const prevProgress = existing?.progress_json as { answers?: unknown; questionResults?: unknown; revealed?: unknown; questionFeedbacks?: unknown } | undefined;
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
        ...(status === "completed" ? { attempts_history: attemptsHistory, attempt_started_at: null } : {}),
        ...(attemptStartedAt ? { attempt_started_at: attemptStartedAt } : {}),
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

    // Tentative terminée : les verdicts sont consommés, la suivante (« refaire ») repart de zéro.
    if (gradedFromServer) await clearGrades(internalId, type, itemId);

    // Objectif du jour, série, alertes des parents : calculés après la réponse, sans faire attendre l'élève.
    if (status === "completed" || type === "course") {
      after(() => afterActivity(internalId, courseCompletedTitle ? { courseCompleted: { title: courseCompletedTitle } } : {}).catch((e) => console.error("[afterActivity]", e instanceof Error ? e.message : e)));
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error saving activity:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
