import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { checkMinigamesAccess } from "@/lib/checkSubscription";
import { gradeLevelToMinigameCode } from "@/lib/minigames/levels";

/** Démarre une partie de calcul mental : prend une fiche publiée pour le
 * niveau de l'enfant (la plus récente), crée une session. Les réponses ne
 * sont jamais renvoyées au client — seuls les énoncés le sont. */
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const config = RATE_LIMITS["minigames:play"];
    const rl = await rateLimitWithBackoff(`minigames:play:${me.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de parties lancées, réessaie dans un instant." }, { status: 429 });
    }

    const access = await checkMinigamesAccess(me.authId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, grade_level")
      .eq("auth_id", me.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const gradeLevel = user.grade_level || "6eme";
    const levelCode = gradeLevelToMinigameCode(gradeLevel);
    if (!levelCode) return NextResponse.json({ error: "Niveau non pris en charge pour ce mini-jeu." }, { status: 400 });

    const { data: sheet } = await supabaseAdmin
      .from("minigame_generations")
      .select("id, result_json")
      .eq("game_type", "calcul_mental")
      .eq("status", "published")
      .contains("params", { levelCode })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sheet) {
      return NextResponse.json({ error: "Aucune fiche de calcul mental disponible pour ton niveau pour l'instant." }, { status: 404 });
    }

    const questions = (sheet.result_json?.questions || []) as { prompt: string; answer: number }[];
    if (questions.length === 0) {
      return NextResponse.json({ error: "Fiche vide." }, { status: 404 });
    }

    const { data: session, error } = await supabaseAdmin
      .from("minigame_sessions")
      .insert({
        user_id: user.id,
        game_type: "calcul_mental",
        grade_level: gradeLevel,
        content_json: { generationId: sheet.id, questionCount: questions.length },
        status: "in_progress",
      })
      .select("id")
      .single();

    if (error || !session) {
      return NextResponse.json({ error: sanitizeErrorMessage(error?.message || "Impossible de démarrer la partie.") }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: session.id,
      questions: questions.map((q, i) => ({ index: i, prompt: q.prompt })),
      remaining: access.remaining,
    });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
