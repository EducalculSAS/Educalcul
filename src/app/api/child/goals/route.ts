import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { getChildPrefs, parisDay } from "@/lib/studentStats";
import { setUserData } from "@/lib/userData";
import { isRealDate } from "@/lib/calendarServer";
import { sanitizeErrorMessage } from "@/lib/safeError";

/** L'élève règle son objectif du jour (activités terminées par jour) et la date de son examen. */
export async function PATCH(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "child") return NextResponse.json({ error: "Réservé aux élèves." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const prefs = await getChildPrefs(me.id);
    const next = { ...prefs };

    if (body.dailyGoal !== undefined) {
      const goal = Math.round(Number(body.dailyGoal));
      if (!Number.isFinite(goal) || goal < 1 || goal > 8) return NextResponse.json({ error: "Objectif invalide (1 à 8)." }, { status: 400 });
      next.dailyGoal = goal;
    }
    if (body.examDate !== undefined) {
      if (body.examDate === null || body.examDate === "") next.examDate = null;
      else if (isRealDate(body.examDate) && (body.examDate as string) >= parisDay()) next.examDate = body.examDate as string;
      else return NextResponse.json({ error: "Date invalide ou déjà passée." }, { status: 400 });
    }
    await setUserData(me.id, "prefs", next);
    return NextResponse.json({ success: true, dailyGoal: next.dailyGoal, examDate: next.examDate });
  } catch (error) {
    return NextResponse.json({ error: sanitizeErrorMessage(error instanceof Error ? error.message : "Erreur interne") }, { status: 500 });
  }
}
