import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { checkMinigamesAccess } from "@/lib/checkSubscription";
import { generateMathadorPuzzle } from "@/lib/minigames/mathador";
import { gradeLevelToMinigameCode } from "@/lib/minigames/levels";

/** Démarre une partie de Mathador : vérifie la limite quotidienne, tire un
 * tirage garanti solvable, crée la session en base. La cible max atteignable
 * n'est PAS renvoyée au client (seulement numbers/target) — seul le nombre de
 * points marqués par le joueur compte, calculé côté serveur à la soumission. */
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
    const puzzle = generateMathadorPuzzle();

    const { data: session, error } = await supabaseAdmin
      .from("minigame_sessions")
      .insert({
        user_id: user.id,
        game_type: "mathador",
        grade_level: gradeLevel,
        content_json: { numbers: puzzle.numbers, target: puzzle.target, maxScore: puzzle.maxScore },
        status: "in_progress",
      })
      .select("id")
      .single();

    if (error || !session) {
      return NextResponse.json({ error: sanitizeErrorMessage(error?.message || "Impossible de démarrer la partie.") }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: session.id,
      numbers: puzzle.numbers,
      target: puzzle.target,
      levelCode: gradeLevelToMinigameCode(gradeLevel),
      remaining: access.remaining,
    });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
