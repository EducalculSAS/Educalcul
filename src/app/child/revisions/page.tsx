import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, BrainCircuit, CheckCircle2, Repeat, RotateCcw } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { dueItems, getSrs, SRS_INTERVALS, srsKey } from "@/lib/srs";
import { loadSources } from "@/lib/reviewSession";
import { daysBetween, parisDay } from "@/lib/studentStats";
import ReviewRunner from "@/components/child/ReviewRunner";

const snippet = (html: unknown) =>
  String(html ?? "")
    .replace(/<figure[\s\S]*?<\/figure>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

function whenLabel(due: string, today: string) {
  const n = daysBetween(today, due);
  if (n <= 0) return "À revoir aujourd'hui";
  if (n === 1) return "Demain";
  return `Dans ${n} jours`;
}

export default async function RevisionsPage() {
  const user = await getServerUser();
  if (!user) redirect("/auth/connexion");
  if (user.role !== "child") redirect("/dashboard");

  const state = await getSrs(user.id);
  const today = parisDay();
  const items = Object.values(state.items).sort((a, b) => a.due.localeCompare(b.due) || a.box - b.box);
  const due = dueItems(state, 1000, today).length;
  const sources = await loadSources(items.slice(0, 60));
  const rows = items
    .slice(0, 60)
    .map((i) => ({ item: i, source: sources.get(srsKey(i.kind, i.ref, i.block)) }))
    .filter((r) => r.source);

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-10 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="container mx-auto max-w-4xl relative z-10">
          <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-display)] font-bold mb-2 flex items-center gap-3">
            <Repeat className="w-8 h-8 text-[var(--greek-gold)]" /> À revoir
          </h1>
          <p className="opacity-90 max-w-2xl">
            Tes erreurs reviennent automatiquement au bon moment : demain, puis dans 3, 7, 14 et 30 jours. Quand tu les réussis à chaque fois, elles quittent le carnet.
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "À revoir aujourd'hui", value: due, tone: "text-[var(--greek-bronze)]" },
            { label: "Dans le carnet", value: items.length, tone: "text-[var(--greek-blue)]" },
            { label: "Maîtrisées", value: state.mastered ?? 0, tone: "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-4 text-center">
              <div className={`text-3xl font-bold ${s.tone}`}>{s.value}</div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.25)] shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--greek-blue)]">Séance du jour</h2>
            <p className="text-sm text-gray-500">Huit questions au plus, courtes, corrigées tout de suite.</p>
          </div>
          <ReviewRunner dueCount={due} />
        </div>

        <div className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
          <h2 className="text-lg font-bold text-[var(--greek-blue)] mb-1 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-[var(--greek-gold)]" /> Mon cahier d&apos;erreurs
          </h2>
          {rows.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune erreur à retravailler : continue comme ça !</p>
              <Link href="/child/exercises" className="mt-3 inline-block text-sm text-[var(--greek-blue)] font-bold hover:underline">Faire un exercice</Link>
            </div>
          ) : (
            <ul className="divide-y divide-[rgba(197,161,72,0.2)]">
              {rows.map(({ item, source }) => (
                <li key={srsKey(item.kind, item.ref, item.block)} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
                      {item.kind === "quiz" ? <BrainCircuit className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                      {source!.title}
                    </p>
                    <p className="text-sm text-gray-800 mt-0.5 line-clamp-2">{snippet(source!.block.content) || "Question"}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="flex gap-1" aria-label={`Palier ${item.box + 1} sur ${SRS_INTERVALS.length}`}>
                        {SRS_INTERVALS.map((_, i) => (
                          <span key={i} className={`w-2 h-2 rounded-full ${i <= item.box ? "bg-[var(--greek-gold)]" : "bg-gray-200"}`} />
                        ))}
                      </span>
                      <span className={`text-xs font-semibold ${item.due <= today ? "text-[var(--greek-bronze)]" : "text-gray-500"}`}>{whenLabel(item.due, today)}</span>
                      {item.misses > 1 && <span className="text-xs text-gray-400">· ratée {item.misses} fois</span>}
                    </div>
                  </div>
                  {source!.courseId ? (
                    <Link href={`/child/cours/${source!.courseId}`} className="text-sm font-bold text-[var(--greek-blue)] hover:underline whitespace-nowrap">
                      Revoir le cours
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
