import { NextResponse } from "next/server";
import { canActOnInternalId, getAuthenticatedUser } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { parisDay, studentSummary } from "@/lib/studentStats";
import { getChildPrefs, setChildPrefs, type ChildPrefs } from "@/lib/studentStore";
import { isRealDate } from "@/lib/calendarServer";
import { sanitizeErrorMessage } from "@/lib/safeError";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

async function authorize(req: Request, childId: number) {
  const me = await getAuthenticatedUser(req);
  if (!me) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (me.role !== "parent" && me.role !== "admin") return { error: NextResponse.json({ error: "Réservé aux parents." }, { status: 403 }) };
  if (!(await canActOnInternalId(me, childId))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const { data: child } = await supabaseAdmin.from("users").select("id, role").eq("id", childId).maybeSingle();
  if (!child || child.role !== "child") return { error: NextResponse.json({ error: "Enfant introuvable." }, { status: 404 }) };
  return { me };
}

/** Objectifs et règles d'un enfant, pour son parent. */
export async function GET(req: Request) {
  try {
    const childId = Number(new URL(req.url).searchParams.get("childId"));
    const auth = await authorize(req, childId);
    if (auth.error) return auth.error;
    const [prefs, summary] = await Promise.all([getChildPrefs(childId), studentSummary(childId)]);
    return NextResponse.json({ prefs, summary });
  } catch (error) {
    return NextResponse.json({ error: sanitizeErrorMessage(error instanceof Error ? error.message : "Erreur interne") }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const childId = Number(body.childId);
    const auth = await authorize(req, childId);
    if (auth.error) return auth.error;

    const prefs = await getChildPrefs(childId);
    const next: ChildPrefs = { ...prefs, quiet: { ...prefs.quiet } };

    if (body.dailyGoal !== undefined) {
      const g = Math.round(Number(body.dailyGoal));
      if (!Number.isFinite(g) || g < 1 || g > 8) return NextResponse.json({ error: "Objectif du jour : 1 à 8 activités." }, { status: 400 });
      next.dailyGoal = g;
    }
    if (body.weeklyTarget !== undefined) {
      if (body.weeklyTarget === null || body.weeklyTarget === "") next.weeklyTarget = null;
      else {
        const w = Math.round(Number(body.weeklyTarget));
        if (!Number.isFinite(w) || w < 1 || w > 60) return NextResponse.json({ error: "Cible de la semaine : 1 à 60 activités." }, { status: 400 });
        next.weeklyTarget = w;
      }
    }
    if (body.quiet !== undefined) {
      const q = body.quiet as { enabled?: unknown; start?: unknown; end?: unknown };
      if (typeof q.start === "string" && typeof q.end === "string" && (!TIME.test(q.start) || !TIME.test(q.end))) return NextResponse.json({ error: "Heures invalides (HH:MM)." }, { status: 400 });
      next.quiet = {
        enabled: q.enabled === true,
        start: typeof q.start === "string" ? q.start : prefs.quiet.start,
        end: typeof q.end === "string" ? q.end : prefs.quiet.end,
      };
      if (!next.quiet.enabled) next.quietOverrideUntil = null;
    }
    if (body.liftQuietMinutes !== undefined) {
      const minutes = Math.min(240, Math.max(0, Math.round(Number(body.liftQuietMinutes)) || 0));
      next.quietOverrideUntil = minutes > 0 ? new Date(Date.now() + minutes * 60_000).toISOString() : null;
    }
    if (body.examDate !== undefined) {
      if (body.examDate === null || body.examDate === "") next.examDate = null;
      else if (isRealDate(body.examDate) && (body.examDate as string) >= parisDay()) next.examDate = body.examDate as string;
      else return NextResponse.json({ error: "Date d'examen invalide ou passée." }, { status: 400 });
    }

    await setChildPrefs(childId, next);
    return NextResponse.json({ success: true, prefs: next });
  } catch (error) {
    return NextResponse.json({ error: sanitizeErrorMessage(error instanceof Error ? error.message : "Erreur interne") }, { status: 500 });
  }
}
