import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { chatWithAI } from "@/lib/llm";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { canAccessOwner, isRealDate, cleanTime, resolveCalendarUser } from "@/lib/calendarServer";

/**
 * Plan de révision personnalisé — PROPOSÉ, pas inséré : l'utilisateur voit
 * chaque séance, sa raison, et choisit ce qu'il garde (voir POST
 * /api/calendar/events avec `events`).
 *
 * Il s'appuie sur ce que l'élève a réellement fait :
 *  - résultats par COURS (exercices + quiz rattachés au cours) : à consolider,
 *    en cours, maîtrisé mais pas revu depuis longtemps (révision espacée) ;
 *  - notions fragiles / maîtrisées retenues par Calia pendant ses séances ;
 *  - contrôles et devoirs déjà au calendrier (séances à J-4, J-2, J-1) ;
 *  - vacances scolaires et séances déjà prévues (pas de doublon) ;
 *  - jours et durée de travail habituels de l'élève ;
 *  - la suite logique du programme (cours du niveau dans l'ordre de lecture).
 * L'IA ne choisit que parmi des cours réels (identifiants vérifiés ensuite).
 */

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

interface CourseSignal {
  id: number;
  title: string;
  attempts: number;
  scoreSum: number;
  lastSeen: string | null;
  status: string | null;
}

export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cfg = RATE_LIMITS["ai:tutor"];
    const rl = await rateLimitWithBackoff(`calendar:suggest:${me.authId}`, Math.min(cfg.maxAttempts, 10), cfg.windowMs);
    if (!rl.allowed) return NextResponse.json({ error: "Trop de plans demandés, réessaie dans un moment." }, { status: 429 });

    const requester = await resolveCalendarUser(me.authId);
    if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    // Un parent planifie pour un de ses enfants ; un élève pour lui-même.
    const studentId = requester.role === "child" ? requester.id : Number(body.childId);
    if (requester.role !== "child" && requester.role !== "parent") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!(await canAccessOwner(requester, studentId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const horizon = [7, 14, 28].includes(Number(body.horizonDays)) ? Number(body.horizonDays) : 14;
    const focus = typeof body.focus === "string" ? body.focus.trim().slice(0, 200) : "";

    const { data: student } = await supabaseAdmin
      .from("users")
      .select("id, first_name, grade_level, school_zone")
      .eq("id", studentId)
      .maybeSingle();
    if (!student) return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });

    const today = new Date().toISOString().slice(0, 10);
    const until = addDays(today, horizon);
    const since60 = new Date(Date.now() - 60 * 86400000).toISOString();
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const zone = student.school_zone || "C";

    const [
      { data: exAttempts }, { data: quizAttempts }, { data: progress }, { data: profile },
      { data: upcoming }, { data: holidays }, { data: sessions }, { data: levelCourses },
    ] = await Promise.all([
      supabaseAdmin.from("user_exercise_attempts")
        .select("score_percent, is_correct, attempted_at, completed_at, exercise:exercises(course_id, course:courses(id, title))")
        .eq("user_id", studentId).gte("created_at", since60).order("created_at", { ascending: false }).limit(400),
      supabaseAdmin.from("user_quiz_attempts")
        .select("score, total_questions, score_percent, completed_at, quiz:quizzes(course_id, course:courses(id, title))")
        .eq("user_id", studentId).gte("created_at", since60).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("user_course_progress")
        .select("status, completed_at, created_at, course:courses(id, title)")
        .eq("user_id", studentId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("calia_student_profile").select("weak_notions, mastered_notions").eq("user_id", studentId).maybeSingle(),
      supabaseAdmin.from("calendar_events")
        .select("title, event_type, start_date, end_date, source")
        .eq("owner_id", studentId).gte("start_date", today).lte("start_date", addDays(today, Math.max(horizon, 21)))
        .order("start_date").limit(200),
      supabaseAdmin.from("global_calendar_events")
        .select("title, start_date, end_date")
        .or(`zone.eq.all,zone.eq.${zone}`).lte("start_date", until).gte("end_date", today).limit(20),
      supabaseAdmin.from("user_sessions").select("duration_seconds, login_at").eq("user_id", studentId).gte("login_at", since30).limit(1000),
      student.grade_level
        ? supabaseAdmin.from("courses").select("id, title, chapter_order").eq("status", "published").eq("level", student.grade_level)
            .order("chapter_order", { ascending: true, nullsFirst: false }).limit(200)
        : Promise.resolve({ data: [] as { id: number; title: string; chapter_order: number | null }[] }),
    ]);

    // ── Signaux par cours ─────────────────────────────────────────
    const byCourse = new Map<number, CourseSignal>();
    const touch = (course: { id: number; title: string } | null, pct: number | null, when: string | null) => {
      if (!course?.id) return;
      const s = byCourse.get(course.id) ?? { id: course.id, title: course.title, attempts: 0, scoreSum: 0, lastSeen: null, status: null };
      if (pct !== null && Number.isFinite(pct)) { s.attempts++; s.scoreSum += pct; }
      if (when && (!s.lastSeen || when > s.lastSeen)) s.lastSeen = when.slice(0, 10);
      byCourse.set(course.id, s);
    };
    for (const a of exAttempts ?? []) {
      const ex = one(a.exercise as any);
      const pct = a.score_percent ?? (a.is_correct === true ? 100 : a.is_correct === false ? 0 : null);
      touch(one(ex?.course as any), pct, a.completed_at ?? a.attempted_at);
    }
    for (const q of quizAttempts ?? []) {
      const qz = one(q.quiz as any);
      const pct = q.score_percent ?? (q.total_questions ? Math.round(((q.score ?? 0) / q.total_questions) * 100) : null);
      touch(one(qz?.course as any), pct, q.completed_at);
    }
    for (const p of progress ?? []) {
      const c = one(p.course as any) as { id: number; title: string } | null;
      touch(c, null, p.completed_at ?? p.created_at);
      if (c?.id) byCourse.get(c.id)!.status = p.status ?? null;
    }

    const signals = [...byCourse.values()].map((s) => {
      const avg = s.attempts ? Math.round(s.scoreSum / s.attempts) : null;
      const idle = s.lastSeen ? daysBetween(s.lastSeen, today) : null;
      const label =
        avg !== null && avg < 60 ? "à consolider"
          : avg !== null && avg >= 85 && idle !== null && idle >= 21 ? "maîtrisé mais pas revu depuis longtemps"
          : s.status && s.status !== "completed" ? "en cours"
          : avg !== null && avg >= 85 ? "maîtrisé"
          : "travaillé";
      return { ...s, avg, idle, label };
    });
    const priority = [...signals].sort((a, b) => {
      const rank = (x: typeof a) => (x.label === "à consolider" ? 0 : x.label === "en cours" ? 1 : x.label.startsWith("maîtrisé mais") ? 2 : 3);
      return rank(a) - rank(b) || (a.avg ?? 100) - (b.avg ?? 100);
    }).slice(0, 15);

    // Suite du programme : premiers cours du niveau pas encore travaillés.
    const next = (levelCourses ?? []).filter((c) => !byCourse.has(c.id)).slice(0, 8);

    const candidates = new Map<number, string>();
    priority.forEach((s) => candidates.set(s.id, s.title));
    next.forEach((c) => candidates.set(c.id, c.title));

    // ── Habitudes ─────────────────────────────────────────────────
    const dayCount = new Array(7).fill(0);
    let totalMin = 0;
    for (const s of sessions ?? []) {
      if (!s.login_at) continue;
      dayCount[new Date(s.login_at).getDay()]++;
      totalMin += (s.duration_seconds ?? 0) / 60;
    }
    const activeDays = dayCount.map((n, i) => ({ n, d: DAY_NAMES[i] })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 4).map((x) => x.d);
    const sessionsCount = (sessions ?? []).length;
    const avgMin = sessionsCount ? Math.round(totalMin / sessionsCount) : null;

    const notions = (arr: unknown) =>
      (Array.isArray(arr) ? arr : []).map((n: any) => (typeof n === "string" ? n : n?.notion)).filter(Boolean).slice(-12);
    const weak = notions(profile?.weak_notions);
    const mastered = notions(profile?.mastered_notions);

    const tests = (upcoming ?? []).filter((e) => e.event_type === "controle" || e.event_type === "devoir");
    const plannedRevisions = (upcoming ?? []).filter((e) => e.event_type === "revision").map((e) => e.start_date);

    const systemPrompt = `Tu es le planificateur de révisions de MATHÉMATIQUES d'Educalcul (plateforme française, CP à Terminale).
Élève : ${student.first_name || "l'élève"}, niveau ${student.grade_level || "inconnu"}.
Tu construis un plan réaliste et motivant sur ${horizon} jours, du ${today} au ${until} inclus.

Règles STRICTES :
- Chaque séance est rattachée à UN cours de la liste fournie (champ course_id = un identifiant de la liste, rien d'autre).
- Avant chaque contrôle ou devoir annoncé, prévois des séances ciblées à J-4, J-2 et J-1 sur le ou les cours correspondants (déduis-les du titre).
- Priorité : cours « à consolider », puis « en cours », puis révision espacée des cours « maîtrisés mais pas revus », puis la suite du programme.
- Au plus UNE séance par jour, jamais un jour où une révision est déjà prévue. Pendant les vacances, séances plus légères et moins nombreuses.
- Privilégie les jours où l'élève travaille habituellement. Durée adaptée à l'âge : 10-20 min en primaire, 20-35 min au collège, 30-45 min au lycée.
- Titre court (« Fractions : consolider »). Description CONCRÈTE : quoi relire, quels exercices refaire, finir par le quiz du cours si pertinent.
- Raison en une phrase, qui cite une donnée réelle (score, date du contrôle, notion fragile).
- Tutoie l'élève si c'est un élève du primaire ou du collège, sinon tutoie aussi (ton bienveillant).
- Maths uniquement.
Réponds UNIQUEMENT par un JSON valide :
{"summary":"2 phrases : ce que le plan va permettre d'ici le ${until} (projection concrète)","sessions":[{"date":"YYYY-MM-DD","start_time":"HH:MM ou null","duration_min":25,"title":"...","description":"...","course_id":123,"reason":"..."}]}`;

    const lines: string[] = [];
    lines.push(`Aujourd'hui : ${today} (${DAY_NAMES[new Date().getDay()]}).`);
    if (focus) lines.push(`Demande particulière : ${focus}`);
    lines.push("", "Cours candidats (id — titre — état) :");
    for (const s of priority) {
      lines.push(`- ${s.id} — ${s.title} — ${s.label}${s.avg !== null ? `, ${s.avg}% de réussite sur ${s.attempts} essai(s)` : ""}${s.idle !== null ? `, dernière activité il y a ${s.idle} j` : ""}`);
    }
    for (const c of next) lines.push(`- ${c.id} — ${c.title} — pas encore commencé (suite du programme)`);
    if (candidates.size === 0) lines.push("(aucun cours disponible)");
    lines.push("", `Contrôles / devoirs à venir : ${tests.length ? tests.map((t) => `${t.start_date} « ${t.title} » (${t.event_type})`).join(" ; ") : "aucun annoncé"}`);
    lines.push(`Révisions déjà prévues les : ${plannedRevisions.length ? plannedRevisions.join(", ") : "aucune"}`);
    lines.push(`Vacances : ${(holidays ?? []).length ? (holidays ?? []).map((h) => `${h.title} du ${h.start_date} au ${h.end_date ?? h.start_date}`).join(" ; ") : "aucune sur la période"}`);
    lines.push(`Notions fragiles relevées par Calia : ${weak.length ? weak.join(", ") : "aucune"}`);
    lines.push(`Notions maîtrisées : ${mastered.length ? mastered.join(", ") : "aucune"}`);
    lines.push(`Habitudes (30 j) : ${sessionsCount} connexions${avgMin ? `, ${avgMin} min en moyenne` : ""}${activeDays.length ? `, surtout le ${activeDays.join(", ")}` : ""}.`);

    if (candidates.size === 0) {
      return NextResponse.json({ summary: "Pas encore assez de cours au niveau de l'élève pour construire un plan.", sessions: [] });
    }

    const ai = await chatWithAI([{ role: "user", content: lines.join("\n") }], systemPrompt, 0.4, 1800);
    let parsed: { summary?: string; sessions?: any[] };
    try {
      const m = ai.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : ai);
    } catch {
      return NextResponse.json({ error: "L'IA n'a pas renvoyé de plan exploitable, réessaie." }, { status: 502 });
    }

    // ── Validation stricte de la proposition ──────────────────────
    const taken = new Set(plannedRevisions);
    const sessionsOut: any[] = [];
    for (const s of Array.isArray(parsed.sessions) ? parsed.sessions : []) {
      const courseId = Number(s?.course_id);
      if (!isRealDate(s?.date) || s.date < today || s.date > until) continue;
      if (!candidates.has(courseId) || taken.has(s.date)) continue;
      taken.add(s.date);
      const duration = Math.min(60, Math.max(10, Math.round(Number(s.duration_min) || 25)));
      const start = cleanTime(s.start_time);
      let end: string | null = null;
      if (start) {
        const [h, mi] = start.split(":").map(Number);
        const t = h * 60 + mi + duration;
        end = t < 24 * 60 ? `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}` : null;
      }
      sessionsOut.push({
        start_date: s.date,
        start_time: start,
        end_time: end,
        duration_min: duration,
        title: String(s.title || `Révision : ${candidates.get(courseId)}`).slice(0, 120),
        description: String(s.description || "").slice(0, 1000),
        reason: String(s.reason || "").slice(0, 300),
        course_id: courseId,
        course_title: candidates.get(courseId),
        event_type: "revision",
      });
      if (sessionsOut.length >= horizon) break;
    }
    sessionsOut.sort((a, b) => a.start_date.localeCompare(b.start_date));

    return NextResponse.json({
      summary: String(parsed.summary || "").slice(0, 500),
      horizonDays: horizon,
      sessions: sessionsOut,
      basis: {
        coursesAnalyzed: signals.length,
        toConsolidate: signals.filter((s) => s.label === "à consolider").length,
        upcomingTests: tests.length,
        weakNotions: weak.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
