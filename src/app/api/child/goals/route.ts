import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { getChildPrefs } from "@/lib/studentStats";
import { setUserData } from "@/lib/userData";
import { sanitizeErrorMessage } from "@/lib/safeError";

/** L'élève règle son objectif du jour (activités terminées par jour). */
export async function PATCH(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "child") return NextResponse.json({ error: "Réservé aux élèves." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const goal = Math.round(Number(body.dailyGoal));
    if (!Number.isFinite(goal) || goal < 1 || goal > 8) return NextResponse.json({ error: "Objectif invalide (1 à 8)." }, { status: 400 });
    const prefs = await getChildPrefs(me.id);
    await setUserData(me.id, "prefs", { ...prefs, dailyGoal: goal });
    return NextResponse.json({ success: true, dailyGoal: goal });
  } catch (error) {
    return NextResponse.json({ error: sanitizeErrorMessage(error instanceof Error ? error.message : "Erreur interne") }, { status: 500 });
  }
}
