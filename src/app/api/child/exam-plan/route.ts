import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getChildPrefs, parisDay, addDays } from "@/lib/studentStats";
import { buildExamPlan, examInfo } from "@/lib/examPlan";
import { sanitizeErrorMessage } from "@/lib/safeError";

const REASON = "Plan examen";

/** Ajoute le parcours « 4 semaines avant » au calendrier de l'élève (remplace le plan précédent). */
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "child") return NextResponse.json({ error: "Réservé aux élèves." }, { status: 403 });

    const prefs = await getChildPrefs(me.id);
    if (!prefs.examDate) return NextResponse.json({ error: "Choisis d'abord la date de ton examen." }, { status: 400 });
    const { data: user } = await supabaseAdmin.from("users").select("grade_level, onboarding_quiz_score").eq("id", me.id).maybeSingle();
    const plan = await buildExamPlan({ id: me.id, gradeLevel: user?.grade_level ?? null, placementScore: user?.onboarding_quiz_score ?? null }, prefs.examDate);
    if (plan.past) return NextResponse.json({ error: "Cette date est passée." }, { status: 400 });

    const today = parisDay();
    const info = examInfo(user?.grade_level);
    const rows: Record<string, unknown>[] = [];
    const base = { owner_id: me.id, created_by: me.id, created_by_role: "child", all_day: true, start_time: null, end_time: null, end_date: null, visible_to_child: true, source: "ai", reason: REASON };
    for (const week of plan.weeks) {
      for (const s of week.sessions) {
        const date = addDays(week.start, s.day);
        if (date < today || date >= prefs.examDate) continue;
        const courseMatch = /\/child\/cours\/(\d+)$/.exec(s.href);
        rows.push({ ...base, title: s.title.slice(0, 120), description: `${info.label} · semaine ${week.index + 1} : ${week.title}. Lien : ${s.href}`, event_type: s.kind === "rest" ? "event" : "revision", start_date: date, course_id: courseMatch ? Number(courseMatch[1]) : null });
      }
    }
    rows.push({ ...base, title: info.label.slice(0, 120), description: "Le grand jour.", event_type: "controle", start_date: prefs.examDate, course_id: null });

    const courseIds = [...new Set(rows.map((r) => r.course_id).filter(Boolean))] as number[];
    if (courseIds.length) {
      const { data: known } = await supabaseAdmin.from("courses").select("id").in("id", courseIds);
      const ok = new Set((known ?? []).map((c) => c.id));
      rows.forEach((r) => { if (r.course_id && !ok.has(r.course_id as number)) r.course_id = null; });
    }

    await supabaseAdmin.from("calendar_events").delete().eq("owner_id", me.id).eq("source", "ai").like("reason", `${REASON}%`);
    const { error } = await supabaseAdmin.from("calendar_events").insert(rows);
    if (error) throw error;
    return NextResponse.json({ success: true, added: rows.length });
  } catch (error) {
    return NextResponse.json({ error: sanitizeErrorMessage(error instanceof Error ? error.message : "Erreur interne") }, { status: 500 });
  }
}
