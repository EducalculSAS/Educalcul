import PageHero from "@/components/PageHero";
import Emblem3D from "@/components/Emblem3D";
import { redirect } from "next/navigation";
import { BookOpen, BrainCircuit } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { dueItems, getSrs, SRS_INTERVALS, srsKey } from "@/lib/srs";
import { loadSources } from "@/lib/reviewSession";
import { daysBetween, parisDay } from "@/lib/studentStats";
import ReviewRunner from "@/components/child/ReviewRunner";
import GlassButton from "@/components/ui/GlassButton";

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

  const hasHistory = items.length > 0 || (state.mastered ?? 0) > 0;

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      <PageHero
        back={{ href: "/child/dashboard", label: "Tableau de bord" }}
        emblem="clock"
        title="À revoir"
        badge="Mémoire"
        subtitle="Tes erreurs reviennent au bon moment : demain, puis dans 3, 7, 14 et 30 jours. Quand tu les réussis à chaque fois, elles quittent le carnet."
        width="4xl"
      />

      <div className="container mx-auto max-w-4xl px-4 space-y-6">
        {/* Trois zéros n'apprennent rien : les compteurs et la séance n'apparaissent que si le carnet a servi. */}
        {hasHistory && (
          <>
        <div className="grid grid-cols-3 gap-4">
              {[
                { label: "À revoir aujourd'hui", value: due, tone: "text-[var(--greek-bronze)]" },
                { label: "Dans le carnet", value: items.length, tone: "text-[var(--greek-blue)]" },
                { label: "Maîtrisées", value: state.mastered ?? 0, tone: "text-green-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.25)] shadow-sm p-4 text-center">
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
          </>
        )}

        <div className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
          <h2 className="text-lg font-bold text-[var(--greek-blue)] mb-1 flex items-center gap-2">
            <Emblem3D kind="pencil" size={28} float={false} /> Mon cahier d&apos;erreurs
          </h2>
          {rows.length === 0 ? (
            <div className="text-center py-8">
              <Emblem3D kind="star" size={80} />
              <p className="text-sm text-gray-600 mt-2 mb-4">{hasHistory ? "Plus rien à retravailler : tout est maîtrisé." : "Ton carnet est vide. Quand tu te trompes dans un exercice ou un quiz, la question arrive ici pour être revue."}</p>
              <GlassButton href="/child/exercises" variant="outline" size="sm">Faire un exercice</GlassButton>
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
                    <GlassButton href={`/child/cours/${source!.courseId}`} variant="outline" size="sm" className="whitespace-nowrap">
                      Revoir le cours
                    </GlassButton>
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
