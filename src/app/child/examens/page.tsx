import PageHero from "@/components/PageHero";
import Emblem3D from "@/components/Emblem3D";
import Link from "@/components/AppLink";
import { redirect } from "next/navigation";
import { BookOpen, Moon, PenTool, Repeat } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getChildPrefs, parisDay } from "@/lib/studentStats";
import { buildExamPlan, examInfo, type PlanSession } from "@/lib/examPlan";
import ExamControls from "@/components/child/ExamControls";

const ICON: Record<PlanSession["kind"], typeof BookOpen> = { course: BookOpen, exercise: PenTool, review: Repeat, rest: Moon };
const DAY_NAMES = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" });
const dayName = (iso: string) => DAY_NAMES[(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7];
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default async function ExamensPage() {
  const user = await getServerUser();
  if (!user) redirect("/auth/connexion");
  if (user.role !== "child") redirect("/dashboard");

  const [{ data: child }, prefs] = await Promise.all([
    supabaseAdmin.from("users").select("grade_level, onboarding_quiz_score").eq("id", user.id).maybeSingle(),
    getChildPrefs(user.id),
  ]);
  const today = parisDay();
  const info = examInfo(child?.grade_level, today);
  const examDate = prefs.examDate && prefs.examDate >= today ? prefs.examDate : null;
  const plan = examDate ? await buildExamPlan({ id: user.id, gradeLevel: child?.grade_level ?? null, placementScore: child?.onboarding_quiz_score ?? null }, examDate, today) : null;

  const { data: practice } = child?.grade_level
    ? await supabaseAdmin.from("exercises").select("id, title").eq("status", "published").eq("level", child.grade_level).eq("category", "examen").limit(12)
    : { data: [] as { id: string; title: string }[] };

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      <PageHero
        back={{ href: "/child/dashboard", label: "Tableau de bord" }}
        emblem="cap"
        title={info.label}
        badge="Préparation"
        subtitle="Un parcours en 4 semaines construit avec ton programme, tes erreurs et des sujets d'entraînement."
        width="4xl"
        actions={plan && !plan.past ? (
          <div className="bg-white/10 rounded-2xl px-6 py-4 text-center border border-[rgba(197,161,72,0.25)]">
            <div className="text-4xl font-bold text-[var(--greek-gold)]">J-{plan.daysLeft}</div>
            <div className="text-xs uppercase tracking-wider opacity-80">{fmt(examDate!)}</div>
          </div>
        ) : undefined}
      />

      <div className="container mx-auto max-w-4xl px-4 space-y-6">
        <div className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
          <ExamControls examDate={examDate} suggestedDate={info.suggestedDate} suggestedLabel={info.suggestedDate ? `${info.label.split(":")[0]} : ${fmt(info.suggestedDate)}` : ""} canSchedule={!!plan && !plan.past} />
          <p className="text-xs text-gray-400 mt-3">{info.note}</p>
        </div>

        {!plan && (
          <div className="bg-white rounded-[20px] border border-dashed border-[var(--greek-gold)] p-8 text-center text-gray-500">
            <div className="mb-2"><Emblem3D kind="calendar" size={72} /></div>
            Choisis la date de l&apos;examen pour voir ton parcours semaine par semaine.
          </div>
        )}

        {plan && plan.current === null && !plan.past && (
          <div className="rounded-[20px] bg-[var(--greek-gold)]/15 border border-[rgba(197,161,72,0.4)] p-5 text-sm text-[var(--greek-blue)]">
            Le parcours des 4 dernières semaines démarre le <strong>{fmt(plan.startFinal)}</strong>. D&apos;ici là, avance dans ton parcours et fais ta séance « à revoir » : tout compte.
          </div>
        )}

        {plan?.weeks.map((week) => (
          <section key={week.index} className={`bg-white rounded-[20px] border shadow-sm p-6 ${plan.current === week.index ? "border-[var(--greek-gold)] ring-2 ring-[var(--greek-gold)]/30" : "border-[rgba(197,161,72,0.25)]"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
              <h2 className="text-lg font-bold text-[var(--greek-blue)]">Semaine {week.index + 1} · {week.title}</h2>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{fmt(week.start)} → {fmt(week.end)}{plan.current === week.index ? " · en cours" : ""}</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">{week.goal}</p>
            <ul className="space-y-2">
              {week.sessions.length === 0 && <li className="text-sm text-gray-400">Séances à venir : le contenu de ton niveau est en cours de publication.</li>}
              {week.sessions.map((s, i) => {
                const Icon = ICON[s.kind];
                return (
                  <li key={i}>
                    <Link href={s.href} className="flex items-center gap-3 rounded-xl border border-[rgba(197,161,72,0.2)] bg-[var(--greek-cream)]/40 hover:bg-[var(--greek-cream)] px-4 py-3 transition-colors">
                      <span className="w-8 h-8 rounded-lg bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
                      <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{s.title}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{dayName(addDays(week.start, s.day))} {fmt(addDays(week.start, s.day))}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
          <h2 className="text-lg font-bold text-[var(--greek-blue)] mb-1">Sujets d&apos;entraînement</h2>
          <p className="text-sm text-gray-500 mb-4">Des exercices de la forme de l&apos;examen, corrigés pas à pas.</p>
          {(practice ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">Les sujets d&apos;entraînement de ton niveau arrivent bientôt. En attendant, les exercices les plus difficiles de ton niveau sont proposés dans le parcours.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-2">
              {(practice ?? []).map((e) => (
                <li key={e.id}>
                  <Link href={`/child/exercises/${e.id}`} className="block rounded-xl border border-[rgba(197,161,72,0.2)] px-4 py-3 text-sm font-medium text-gray-800 hover:bg-[var(--greek-cream)] truncate">{e.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
