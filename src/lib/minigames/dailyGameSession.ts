import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { checkMinigamesAccess, getUserFeatures } from "@/lib/checkSubscription";
import { gradeLevelToPalier } from "@/lib/minigames/levels";
import { getGameTypeConfig, type MinigameType } from "@/lib/minigames/gameTypes";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Normalise pour une comparaison texte tolérante : espaces, casse, accents. */
const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
function normalizeText(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(COMBINING_DIACRITICS, "");
}

/** Démarre la partie du jour pour un jeu "à paliers" donné : le contenu est
 * fixe (5 questions du palier de l'enfant, +5 bonus si premium) — pas une
 * génération à la demande. Une seule partie complétée par jour et par jeu :
 * le contenu du jour ne se rejoue pas pour gonfler le score (indépendant du
 * compteur global `minigames_daily_limit`, qui continue de s'appliquer en
 * plus). Logique partagée par calcul-mental/énigmes/suites/langues — seules
 * les routes fines par jeu diffèrent (src/app/api/child/minigames/*). */
export async function startDailyGameSession(gameType: MinigameType, req: Request): Promise<NextResponse> {
  try {
    const gameConfig = getGameTypeConfig(gameType);
    if (!gameConfig) return NextResponse.json({ error: "Jeu inconnu." }, { status: 400 });

    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rlConfig = RATE_LIMITS["minigames:play"];
    const rl = await rateLimitWithBackoff(`minigames:play:${me.id}`, rlConfig.maxAttempts, rlConfig.windowMs);
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
    const palierCode = gradeLevelToPalier(gradeLevel);
    if (!palierCode || !gameConfig.palierCodes.includes(palierCode)) {
      return NextResponse.json({ error: "Ce mini-jeu n'est pas encore disponible pour ton niveau." }, { status: 400 });
    }

    const today = todayStr();

    // Une seule partie par jour et par jeu — le contenu est le même pour
    // tout le monde du palier, pas question de le rejouer.
    const { data: alreadyPlayed } = await supabaseAdmin
      .from("minigame_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("game_type", gameType)
      .eq("status", "completed")
      .gte("created_at", `${today}T00:00:00.000Z`)
      .maybeSingle();
    if (alreadyPlayed) {
      return NextResponse.json({ error: "Tu as déjà fait ce mini-jeu aujourd'hui — reviens demain !" }, { status: 400 });
    }

    const features = await getUserFeatures(me.authId);
    const isPremium = features.minigames_daily_limit === -1 || features.minigames_daily_limit > 3;

    const tiers = isPremium ? ["free", "premium"] : ["free"];
    const { data: sheets } = await supabaseAdmin
      .from("minigame_daily_sheets")
      .select("id, tier, questions")
      .eq("game_type", gameType)
      .eq("palier_code", palierCode)
      .eq("for_date", today)
      .eq("is_archived", false)
      .in("tier", tiers);

    if (!sheets || sheets.length === 0) {
      return NextResponse.json({ error: "Le contenu du jour n'est pas encore prêt pour ton niveau." }, { status: 404 });
    }

    // Ordre stable (free d'abord) pour que les index renvoyés au client
    // correspondent toujours au même ordre de correction côté submit.
    const ordered = [...sheets].sort((a, b) => (a.tier === "free" ? -1 : 1) - (b.tier === "free" ? -1 : 1));
    const questions = ordered.flatMap((s) => (s.questions || []) as { prompt: string; answer: number | string }[]);
    const sheetIds = ordered.map((s) => s.id);

    if (questions.length === 0) {
      return NextResponse.json({ error: "Fiche vide." }, { status: 404 });
    }

    const { data: session, error } = await supabaseAdmin
      .from("minigame_sessions")
      .insert({
        user_id: user.id,
        game_type: gameType,
        grade_level: gradeLevel,
        content_json: { palierCode, forDate: today, sheetIds, questionCount: questions.length },
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
      answerType: gameConfig.answerType,
      isPremium,
      remaining: access.remaining,
    });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}

/** Termine une partie : compare les réponses envoyées aux bonnes réponses
 * stockées côté serveur (jamais transmises au client tant que la partie
 * n'est pas finie) et calcule le score réel. Comparaison numérique (tolérance
 * flottante) ou texte (normalisée : espaces/casse/accents) selon le jeu. */
export async function submitDailyGameSession(gameType: MinigameType, sessionId: string, request: Request): Promise<NextResponse> {
  try {
    const gameConfig = getGameTypeConfig(gameType);
    if (!gameConfig) return NextResponse.json({ error: "Jeu inconnu." }, { status: 400 });

    const me = await getAuthenticatedUser(request);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const answers: { index: number; value: number | string }[] = Array.isArray(body?.answers) ? body.answers : [];
    const durationSeconds = Number.isFinite(body?.durationSeconds) ? Math.max(0, Math.floor(body.durationSeconds)) : null;

    const { data: user } = await supabaseAdmin.from("users").select("id").eq("auth_id", me.authId).maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const { data: session } = await supabaseAdmin
      .from("minigame_sessions")
      .select("id, user_id, game_type, status, content_json")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session || session.game_type !== gameType) {
      return NextResponse.json({ error: "Partie introuvable" }, { status: 404 });
    }
    if (session.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "Cette partie est déjà terminée." }, { status: 400 });
    }

    const { sheetIds } = session.content_json as { sheetIds: string[] };
    const { data: sheetRows } = await supabaseAdmin
      .from("minigame_daily_sheets")
      .select("id, tier, questions")
      .in("id", sheetIds || []);

    // Même ordre stable qu'au démarrage (free d'abord) — les index envoyés
    // par le client doivent retomber sur les mêmes questions qu'à l'affichage.
    const ordered = (sheetRows || []).sort((a, b) => (a.tier === "free" ? -1 : 1) - (b.tier === "free" ? -1 : 1));
    const questions = ordered.flatMap((s) => (s.questions || []) as { prompt: string; answer: number | string }[]);

    let correct = 0;
    const detail = answers.map((a) => {
      const expected = questions[a.index]?.answer;
      let isCorrect = false;
      if (gameConfig.answerType === "number") {
        isCorrect = typeof expected === "number" && Number.isFinite(Number(a.value)) && Math.abs(expected - Number(a.value)) < 1e-9;
      } else {
        isCorrect = typeof expected === "string" && typeof a.value === "string" && normalizeText(expected) === normalizeText(a.value);
      }
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
