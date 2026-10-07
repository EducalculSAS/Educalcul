import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { getSrs } from "@/lib/srs";
import { loadSources } from "@/lib/reviewSession";

/**
 * Parcours recommandé d'un élève : à partir du test de départ, de ses erreurs récentes (carnet), de ce que Calia a repéré
 * comme fragile et de l'ordre du programme, quelques cours à faire dans cet ordre, avec la raison de chacun.
 */

export interface PathStep {
  courseId: string;
  title: string;
  chapter: string | null;
  reason: string;
  /** Cours d'un niveau précédent (remise à niveau). */
  catchUp?: boolean;
}

interface CourseRow {
  id: string;
  title: string;
  chapter_name: string | null;
  theme_order: number | null;
  chapter_order: number | null;
  lesson_order: number | null;
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const STOP = new Set(["les", "des", "une", "dans", "pour", "avec", "sur", "que", "qui", "est", "sont", "aux", "par", "plus", "comprehension", "enonce"]);
const tokens = (s: string) => normalize(s).split(" ").filter((t) => t.length >= 4 && !STOP.has(t));

/** Un cours correspond à une notion si l'un de ses mots significatifs figure dans le titre ou le chapitre. */
function matches(notion: string, course: CourseRow): boolean {
  const hay = normalize(`${course.title} ${course.chapter_name ?? ""}`);
  return tokens(notion).some((t) => hay.includes(t.replace(/s$/, "")));
}

export function previousLevel(level: string | null | undefined): string | null {
  if (!level) return null;
  if (level.startsWith("terminale")) return "1ere-generale-maths";
  if (level.startsWith("1ere")) return "2nde";
  const i = SCHOOL_LEVELS.findIndex((l) => l.value === level);
  return i > 0 ? SCHOOL_LEVELS[i - 1].value : null;
}

const byOrder = (a: CourseRow, b: CourseRow) =>
  (a.theme_order ?? 999) - (b.theme_order ?? 999) || (a.chapter_order ?? 999) - (b.chapter_order ?? 999) || (a.lesson_order ?? 999) - (b.lesson_order ?? 999) || a.title.localeCompare(b.title);

async function publishedCourses(level: string): Promise<CourseRow[]> {
  const { data } = await supabaseAdmin
    .from("courses")
    .select("id, title, chapter_name, theme_order, chapter_order, lesson_order")
    .eq("status", "published")
    .eq("level", level)
    .limit(800);
  return ((data ?? []) as CourseRow[]).sort(byOrder);
}

export async function learningPath(child: { id: number; authId?: string; gradeLevel: string | null; placementScore: number | null }, size = 4): Promise<PathStep[]> {
  if (!child.gradeLevel) return [];
  const courses = await publishedCourses(child.gradeLevel);
  if (!courses.length) return [];

  const [{ data: progress }, { data: profile }, srs] = await Promise.all([
    supabaseAdmin.from("user_course_progress").select("course_id, status").eq("user_id", child.id).in("course_id", courses.map((c) => c.id)),
    supabaseAdmin.from("calia_student_profile").select("weak_notions").eq("user_id", child.id).maybeSingle(),
    getSrs(child.id),
  ]);
  const done = new Set((progress ?? []).filter((p) => p.status === "completed").map((p) => String(p.course_id)));
  const started = new Set((progress ?? []).map((p) => String(p.course_id)));

  const steps: PathStep[] = [];
  const used = new Set<string>();
  const add = (c: CourseRow, reason: string, catchUp = false) => {
    if (used.has(String(c.id)) || steps.length >= size) return;
    used.add(String(c.id));
    steps.push({ courseId: String(c.id), title: c.title, chapter: c.chapter_name, reason, catchUp });
  };

  // 1. Cours des questions ratées récemment : le plus utile pour progresser.
  const missed = Object.values(srs.items).sort((a, b) => b.last.localeCompare(a.last)).slice(0, 25);
  if (missed.length) {
    const sources = await loadSources(missed);
    const counts = new Map<string, number>();
    for (const s of sources.values()) if (s.courseId) counts.set(String(s.courseId), (counts.get(String(s.courseId)) ?? 0) + 1);
    const byId = new Map(courses.map((c) => [String(c.id), c]));
    for (const [courseId] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      const c = byId.get(courseId);
      if (c) add(c, `Tu as raté ${counts.get(courseId)} question${(counts.get(courseId) ?? 0) > 1 ? "s" : ""} liée${(counts.get(courseId) ?? 0) > 1 ? "s" : ""} à ce cours`);
    }
  }

  // 2. Notions fragiles repérées par le test de départ et par Calia.
  const weak = ((profile?.weak_notions ?? []) as { notion?: string }[]).map((w) => w.notion).filter((n): n is string => !!n);
  for (const notion of weak.slice(0, 5)) {
    const c = courses.find((x) => !done.has(String(x.id)) && matches(notion, x));
    if (c) add(c, `Pour consolider « ${notion} »`);
  }

  // 3. Remise à niveau si le test de départ est faible : un cours du niveau précédent, le plus avancé non fait.
  if (child.placementScore !== null && child.placementScore < 40) {
    const prev = previousLevel(child.gradeLevel);
    if (prev) {
      const prevCourses = await publishedCourses(prev);
      const { data: prevProgress } = prevCourses.length
        ? await supabaseAdmin.from("user_course_progress").select("course_id, status").eq("user_id", child.id).in("course_id", prevCourses.map((c) => c.id))
        : { data: [] as { course_id: string; status: string }[] };
      const prevDone = new Set((prevProgress ?? []).filter((p) => p.status === "completed").map((p) => String(p.course_id)));
      const first = prevCourses.find((c) => !prevDone.has(String(c.id)));
      if (first) add(first, "Pour reprendre les bases (ton test de départ montre quelques trous)", true);
    }
  }

  // 4. Ensuite : le programme, dans l'ordre, en reprenant les cours commencés.
  const unfinished = courses.filter((c) => !done.has(String(c.id)));
  for (const c of unfinished.filter((c) => started.has(String(c.id)))) add(c, "Tu l'as commencé : termine-le");
  for (const c of unfinished) add(c, done.size === 0 && steps.length === 0 ? "Pour bien démarrer le programme" : "Prochain chapitre du programme");

  return steps;
}
