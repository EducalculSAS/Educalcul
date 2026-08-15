import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";

/** Termine une partie de calcul mental : compare les réponses envoyées aux
 * bonnes réponses stockées côté serveur (jamais transmises au client tant
 * que la partie n'est pas finie) et calcule le score réel. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const me = await getAuthenticatedUser(request);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId } = await params;
    const body = await request.json();
    const answers: { index: number; value: number }[] = Array.isArray(body?.answers) ? body.answers : [];
    const durationSeconds = Number.isFinite(body?.durationSeconds) ? Math.max(0, Math.floor(body.durationSeconds)) : null;

    const { data: user } = await supabaseAdmin.from("users").select("id").eq("auth_id", me.authId).maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const { data: session } = await supabaseAdmin
      .from("minigame_sessions")
      .select("id, user_id, game_type, status, content_json")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session || session.game_type !== "calcul_mental") {
      return NextResponse.json({ error: "Partie introuvable" }, { status: 404 });
    }
    if (session.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "Cette partie est déjà terminée." }, { status: 400 });
    }

    const { generationId } = session.content_json as { generationId: string };
    const { data: sheet } = await supabaseAdmin
      .from("minigame_generations")
      .select("result_json")
      .eq("id", generationId)
      .maybeSingle();

    const questions = (sheet?.result_json?.questions || []) as { prompt: string; answer: number }[];
    let correct = 0;
    const detail = answers.map((a) => {
      const expected = questions[a.index]?.answer;
      const isCorrect = typeof expected === "number" && Math.abs(expected - Number(a.value)) < 1e-9;
      if (isCorrect) correct++;
      return { index: a.index, correct: isCorrect };
    });

    const maxScore = questions.length;

    await supabaseAdmin
      .from("minigame_sessions")
      .update({
        answer_json: { answers, detail },
        score: correct,
        max_score: maxScore,
        duration_seconds: durationSeconds,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    return NextResponse.json({ score: correct, maxScore, detail });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
