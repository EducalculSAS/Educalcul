import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { learningPath } from "@/lib/learningPath";
import { addDays, daysBetween, parisDay } from "@/lib/studentStats";

/**
 * Préparation d'un examen (brevet, bac, gros contrôle) : décompte, puis parcours « 4 semaines avant » construit à partir
 * du programme de l'élève, de ses points faibles et des sujets d'entraînement publiés (exercices rangés dans la
 * catégorie « examen »). Le plan peut être ajouté d'un clic au calendrier.
 */

export interface ExamInfo {
  key: "dnb" | "bac" | "generic";
  label: string;
  suggestedDate: string | null;
  note: string;
}

export function examInfo(level: string | null | undefined, today = parisDay()): ExamInfo {
  const year = Number(today.slice(0, 4));
  const next = (month: string, day: string) => (`${year}-${month}-${day}` > today ? `${year}-${month}-${day}` : `${year + 1}-${month}-${day}`);
  if (level === "3eme") return { key: "dnb", label: "Brevet (DNB)", suggestedDate: next("06", "25"), note: "Date indicative (fin juin) : vérifie le calendrier officiel de ton collège." };
  if (level?.startsWith("terminale")) return { key: "bac", label: "Bac : épreuve de mathématiques", suggestedDate: next("03", "16"), note: "Date indicative (épreuves de spécialité en mars) : vérifie la convocation officielle." };
  return { key: "generic", label: "Examen ou gros contrôle", suggestedDate: null, note: "Choisis la date de ton prochain gros contrôle ou examen." };
}

export interface PlanSession {
  title: string;
  href: string;
  kind: "course" | "exercise" | "review" | "rest";
  /** Jour de la semaine du plan (0 à 6). */
  day: number;
}

export interface PlanWeek {
  index: number;
  title: string;
  goal: string;
  start: string;
  end: string;
  sessions: PlanSession[];
}

export interface ExamPlan {
  weeks: PlanWeek[];
  /** Début des 4 dernières semaines (J-28). */
  startFinal: string;
  daysLeft: number;
  /** Semaine en cours (0 à 3), ou null si le parcours final n'a pas commencé / est terminé. */
  current: number | null;
  /** Examen passé. */
  past: boolean;
}

const DAYS = [0, 2, 4, 5];

interface Pick {
  id: string | number;
  title: string;
}

export async function buildExamPlan(child: { id: number; gradeLevel: string | null; placementScore: number | null }, examDate: string, today = parisDay()): Promise<ExamPlan> {
  const daysLeft = daysBetween(today, examDate);
  const startFinal = addDays(examDate, -28);

  const [path, exercisesRes, doneRes] = await Promise.all([
    learningPath({ id: child.id, gradeLevel: child.gradeLevel, placementScore: child.placementScore }, 8),
    child.gradeLevel
      ? supabaseAdmin.from("exercises").select("id, title, category, difficulty_level").eq("status", "published").eq("level", child.gradeLevel).limit(200)
      : Promise.resolve({ data: [] as { id: string; title: string; category: string | null; difficulty_level: string | null }[] }),
    supabaseAdmin.from("user_course_progress").select("course_id, courses(title)").eq("user_id", child.id).eq("status", "completed").limit(50),
  ]);

  const exercises = ((exercisesRes.data ?? []) as { id: string; title: string; category: string | null; difficulty_level: string | null }[]);
  const rank = (e: { category: string | null; difficulty_level: string | null }) => (e.category === "examen" ? 0 : ["difficile", "hard", "avance"].includes(String(e.difficulty_level)) ? 1 : 2);
  const exercisePicks: Pick[] = [...exercises].sort((a, b) => rank(a) - rank(b)).map((e) => ({ id: e.id, title: e.title }));
  const done = ((doneRes.data ?? []) as unknown as { course_id: string | number; courses: { title: string } | { title: string }[] | null }[]).map((d) => ({
    id: d.course_id,
    title: Array.isArray(d.courses) ? d.courses[0]?.title : d.courses?.title,
  })).filter((d): d is Pick => !!d.title);

  const weak = path.filter((s) => !/prochain chapitre|bien démarrer/i.test(s.reason));
  const program = path.filter((s) => /prochain chapitre|bien démarrer|commencé/i.test(s.reason));
  const course = (s: { courseId: string; title: string }, prefix: string, day: number): PlanSession => ({ title: `${prefix} : ${s.title}`, href: `/child/cours/${s.courseId}`, kind: "course", day });
  const exo = (e: Pick, day: number): PlanSession => ({ title: `Sujet d'entraînement : ${e.title}`, href: `/child/exercises/${e.id}`, kind: "exercise", day });
  const review = (day: number): PlanSession => ({ title: "Séance « à revoir »", href: "/child/revisions", kind: "review", day });

  const fill = (items: PlanSession[]): PlanSession[] => items.slice(0, 4).map((s, i) => ({ ...s, day: DAYS[i] ?? s.day }));
  const weeksDef: { title: string; goal: string; sessions: PlanSession[] }[] = [
    {
      title: "Faire le point",
      goal: "Repérer et combler les trous avant de tout reprendre.",
      sessions: fill([review(0), ...(weak.length ? weak : path).slice(0, 3).map((s, i) => course(s, "Reprendre", i + 1))]),
    },
    {
      title: "Reprendre le programme",
      goal: "Parcourir les chapitres qui tombent le plus souvent.",
      sessions: fill([...(program.length ? program : path).slice(0, 3).map((s, i) => course(s, "Chapitre", i)), review(5)]),
    },
    {
      title: "S'entraîner en conditions",
      goal: "Des sujets complets, chronomètre en main.",
      sessions: fill([...exercisePicks.slice(0, 3).map((e, i) => exo(e, i)), review(5)]),
    },
    {
      title: "Dernière ligne droite",
      goal: "Réviser l'essentiel, rester calme, bien dormir la veille.",
      sessions: [
        ...[review(0), ...exercisePicks.slice(3, 5).map((e, i) => exo(e, i + 1))].slice(0, 3),
        ...done.slice(0, 1).map((d) => ({ title: `Relire : ${d.title}`, href: `/child/cours/${d.id}`, kind: "course" as const, day: 4 })),
        { title: "Veille de l'examen : repos, pas de nouvelle notion", href: "/child/dashboard", kind: "rest" as const, day: 6 },
      ],
    },
  ];

  const weeks: PlanWeek[] = weeksDef.map((w, i) => {
    const start = addDays(startFinal, i * 7);
    return { index: i, title: w.title, goal: w.goal, start, end: addDays(start, 6), sessions: w.sessions };
  });

  const past = daysLeft < 0;
  const current = past || today < startFinal ? null : Math.min(3, Math.floor(daysBetween(startFinal, today) / 7));
  return { weeks, startFinal, daysLeft, current, past };
}
