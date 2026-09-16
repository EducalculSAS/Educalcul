import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { mergeCaliaSessionSummary } from "@/lib/calia/studentProfile";

/** Questions du QCM de placement pour le niveau demande — servi au premier
 * onboarding d'un eleve (ChildOnboarding.tsx). Pas de correct_index expose au
 * client : la correction se fait cote serveur (voir POST plus bas). */
export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const gradeLevel = new URL(req.url).searchParams.get("gradeLevel");
    if (!gradeLevel) return NextResponse.json({ error: "gradeLevel requis" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("placement_quiz_questions")
      .select("id, question, options")
      .eq("grade_level", gradeLevel)
      .order("sort_order");
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    return NextResponse.json({ questions: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err?.message || "Erreur interne") }, { status: 500 });
  }
}

/** Corrige les reponses de l'eleve et enregistre son score (onboarding_quiz_score). */
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { answers } = await req.json();
    if (!Array.isArray(answers) || answers.some((a) => typeof a !== "object" || typeof a.id !== "number" || typeof a.answerIndex !== "number")) {
      return NextResponse.json({ error: "answers invalide" }, { status: 400 });
    }

    const ids = answers.map((a) => a.id);
    const { data: questions, error } = await supabaseAdmin
      .from("placement_quiz_questions")
      .select("id, correct_index, notion")
      .in("id", ids);
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    const byId = new Map((questions || []).map((q) => [q.id, q]));
    const total = answers.length;
    let correct = 0;
    const masteredNotions: string[] = [];
    const weakNotions: string[] = [];
    for (const a of answers) {
      const q = byId.get(a.id);
      if (!q) continue;
      if (q.correct_index === a.answerIndex) {
        correct++;
        if (q.notion) masteredNotions.push(q.notion);
      } else if (q.notion) {
        weakNotions.push(q.notion);
      }
    }
    const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

    await supabaseAdmin.from("users").update({ onboarding_quiz_score: scorePercent }).eq("id", me.id);

    // Amorce la memoire pedagogique de Calia des le premier jour : le QCM de
    // placement est le tout premier signal reel qu'on a sur cet eleve, avant
    // le moindre exercice fait sur la plateforme (voir studentProfile.ts).
    if (masteredNotions.length || weakNotions.length) {
      await mergeCaliaSessionSummary(me.id, {
        newMasteredNotions: masteredNotions,
        newWeakNotions: weakNotions,
        methodUsed: null,
        methodWorked: null,
        behaviorNotes: "",
        summary: `Test de placement initial : ${correct}/${total} bonnes reponses.`,
      }).catch(() => {});
    }

    return NextResponse.json({ scorePercent });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err?.message || "Erreur interne") }, { status: 500 });
  }
}
