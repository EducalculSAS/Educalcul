import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { verifyMathadorSolution, type MathadorStep } from "@/lib/minigames/mathador";

/** Termine une partie de Mathador : rejoue et vérifie la séquence d'étapes
 * envoyée par le joueur contre le tirage réel stocké en base (jamais le score
 * envoyé par le client) — anti-triche. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const me = await getAuthenticatedUser(request);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId } = await params;
    const body = await request.json();
    const steps: MathadorStep[] = Array.isArray(body?.steps) ? body.steps : [];
    const durationSeconds = Number.isFinite(body?.durationSeconds) ? Math.max(0, Math.floor(body.durationSeconds)) : null;

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", me.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const { data: session } = await supabaseAdmin
      .from("minigame_sessions")
      .select("id, user_id, game_type, status, content_json")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session || session.game_type !== "mathador") {
      return NextResponse.json({ error: "Partie introuvable" }, { status: 404 });
    }
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "Cette partie est déjà terminée." }, { status: 400 });
    }

    const { numbers, target } = session.content_json as { numbers: number[]; target: number };
    const abandoned = steps.length === 0;
    const result = abandoned
      ? { valid: false, score: 0, reason: "Partie abandonnée." }
      : verifyMathadorSolution(numbers, target, steps);

    await supabaseAdmin
      .from("minigame_sessions")
      .update({
        answer_json: { steps, valid: result.valid, reason: result.reason },
        score: result.score,
        duration_seconds: durationSeconds,
        status: abandoned ? "abandoned" : "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    return NextResponse.json({ valid: result.valid, score: result.score, reason: result.reason });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
