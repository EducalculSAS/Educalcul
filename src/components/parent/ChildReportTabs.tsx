"use client";

import { useState, type ReactNode } from "react";
import {
  Award, BookOpen, CheckCircle, TrendingUp, Activity, Brain, Sparkles,
  RotateCcw, Star, Lock, CalendarClock,
} from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";

interface ActivityItem {
  id: string;
  type: "Quiz" | "Exercice" | "Cours";
  title: string;
  date: string;
  score?: string;
  status?: "success" | "failure" | "completed";
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function parseBold(text: string): ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-bold text-[var(--greek-blue)]">{part}</strong> : part
  );
}

function renderAnalysis(text: string) {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) { elements.push(<div key={i} className="h-2" />); return; }

    if (line.startsWith("#")) {
      const content = line.replace(/^#+\s*/, "").replace(/\*\*/g, "");
      elements.push(
        <h3 key={i} className="text-sm font-bold text-[var(--greek-blue)] mt-6 mb-2 font-[family-name:var(--font-display)] flex items-center gap-2 uppercase tracking-wide">
          <span className="w-1 h-4 bg-[var(--greek-gold)] rounded-full inline-block flex-shrink-0" />
          {content}
        </h3>
      );
      return;
    }

    if (/^\*\*[^*]+\*\*\s*$/.test(line)) {
      const content = line.replace(/\*\*/g, "");
      elements.push(
        <h4 key={i} className="font-bold text-[var(--greek-blue)] mt-5 mb-1.5 text-sm flex items-center gap-2">
          <span className="w-4 h-[2px] bg-[var(--greek-gold)] inline-block flex-shrink-0 rounded-full" />
          {content}
        </h4>
      );
      return;
    }

    if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* ")) {
      const content = line.replace(/^[-•*]\s+/, "");
      elements.push(
        <div key={i} className="flex gap-2.5 mt-2 ml-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--greek-gold)] mt-[7px] flex-shrink-0" />
          <p className="text-sm text-gray-700 leading-relaxed">{parseBold(content)}</p>
        </div>
      );
      return;
    }

    elements.push(<p key={i} className="text-sm text-gray-700 leading-relaxed mt-1">{parseBold(line)}</p>);
  });

  return <>{elements}</>;
}

/** Onglets "Activité" (pur affichage, déjà chargé du serveur) / "Analyse IA"
 * (générée à la demande, mise en cache côté serveur — voir
 * /api/parent/child-analysis, 1x/jour) : seule partie interactive de
 * /parent/child/[id], isolée en client island. */
export default function ChildReportTabs({
  childId, childFirstName, activities, stats, subjectStats, hasSub,
}: {
  childId: string;
  childFirstName: string;
  activities: ActivityItem[];
  stats: { totalActivities: number; quizzesTaken: number; exercisesDone: number; successRate: number; avgScore: number };
  subjectStats: { subject: string; correct: number; total: number }[];
  hasSub: boolean;
}) {
  const [tab, setTab] = useState<"activite" | "ia">("activite");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisStats, setAnalysisStats] = useState<any>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [canRegenerate, setCanRegenerate] = useState(true);

  const loadAnalysis = async (force = false) => {
    if (analysisLoading) return;
    setAnalysisLoading(true);
    try {
      const res = await fetch(`/api/parent/child-analysis?childId=${childId}${force ? "&force=1" : ""}`);
      const data = await res.json();
      setAnalysis(data.analysis);
      setAnalysisStats(data.stats);
      setGeneratedAt(data.generatedAt);
      // Déjà généré aujourd'hui (repris du cache serveur) → pas de nouvelle
      // génération avant demain, comme avant.
      setCanRegenerate(!(data.generatedAt && new Date(data.generatedAt).toDateString() === new Date().toDateString()));
    } catch {
      setAnalysis("Erreur lors de l'analyse. Vérifiez que l'IA est disponible.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const formattedGeneratedAt = generatedAt
    ? new Date(generatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      {/* Tabs */}
      <div className="w-fit mb-6">
        <GlassSegmentedControl
          options={[
            { id: "activite", label: "Activité" },
            {
              id: "ia",
              label: (
                <>
                  Analyse IA
                  {!hasSub && <Lock className="inline w-3 h-3 ml-1 mb-0.5 opacity-50" />}
                </>
              ),
            },
          ]}
          value={tab}
          onChange={(id) => {
            const key = id as "activite" | "ia";
            setTab(key);
            if (key === "ia" && !analysis && hasSub) loadAnalysis();
          }}
          size="sm"
        />
      </div>

      {tab === "activite" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[rgba(197,161,72,0.25)]">
              <h3 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                Historique d'activité ({activities.length})
              </h3>
            </div>
            <div className="divide-y divide-[var(--greek-gold)]/10 max-h-[600px] overflow-y-auto">
              {activities.length === 0 ? (
                <div className="p-8 text-center text-gray-400">Aucune activité enregistrée.</div>
              ) : activities.map((a) => (
                <div key={`${a.type}-${a.id}`} className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl shrink-0 ${a.type === "Quiz" ? "bg-purple-100 text-purple-600" : a.type === "Exercice" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>
                    {a.type === "Quiz" ? <Award className="w-4 h-4" /> : a.type === "Exercice" ? <BookOpen className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{a.title}</p>
                    <p className="text-xs text-gray-400">{a.type} · {formatDate(a.date)}</p>
                  </div>
                  {a.score && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${a.status === "success" ? "bg-green-100 text-green-700" : a.status === "failure" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                      {a.score}
                    </span>
                  )}
                  {a.status === "completed" && !a.score && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 shrink-0">Consulté</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <h3 className="font-bold text-[var(--greek-blue)] mb-4 font-[family-name:var(--font-display)] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--greek-gold)]" />
                Réussite par matière
              </h3>
              {subjectStats.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aucune donnée disponible</p>
              ) : subjectStats.map((s) => {
                const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                return (
                  <div key={s.subject} className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 truncate">{s.subject}</span>
                      <span className={`font-bold ml-2 ${pct >= 70 ? "text-green-600" : pct >= 40 ? "text-orange-600" : "text-red-600"}`}>{pct}%</span>
                    </div>
                    <div className="w-full bg-[var(--greek-gold)]/10 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-orange-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{s.correct}/{s.total} corrects</p>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <h3 className="font-bold text-[var(--greek-blue)] mb-4 font-[family-name:var(--font-display)] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[var(--greek-gold)]" />
                Résumé
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total activités</span><span className="font-bold text-gray-800">{stats.totalActivities}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Exercices réussis</span><span className="font-bold text-green-600">{Math.round(stats.exercisesDone * stats.successRate / 100)} / {stats.exercisesDone}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Quiz complétés</span><span className="font-bold text-gray-800">{stats.quizzesTaken}</span></div>
                {stats.avgScore > 0 && <div className="flex justify-between"><span className="text-gray-500">Score moyen quiz</span><span className={`font-bold ${stats.avgScore >= 70 ? "text-green-600" : stats.avgScore >= 50 ? "text-orange-500" : "text-red-500"}`}>{stats.avgScore}%</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "ia" && (
        <>
          {!hasSub ? (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-10 text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-[var(--greek-gold)]/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-[var(--greek-gold)]" />
              </div>
              <h3 className="font-bold text-[var(--greek-blue)] text-lg font-[family-name:var(--font-display)] mb-2">
                Fonctionnalité Premium
              </h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                L'analyse IA d'EpsiAI est disponible avec un abonnement actif. Passez à un plan supérieur pour obtenir des rapports personnalisés sur la progression de {childFirstName}.
              </p>
              <GlassButton href="/parent/subscription" variant="navy" size="sm">
                <Sparkles className="w-4 h-4" />
                Voir les abonnements
              </GlassButton>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[rgba(197,161,72,0.25)] bg-gradient-to-r from-[var(--greek-blue)]/5 to-transparent flex items-center justify-between">
                  <h3 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] flex items-center gap-2">
                    <Brain className="w-5 h-5 text-[var(--greek-gold)]" />
                    Analyse IA — {childFirstName}
                  </h3>
                  <div className="flex items-center gap-3">
                    {formattedGeneratedAt && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        {formattedGeneratedAt}
                      </span>
                    )}
                    <GlassButton
                      onClick={() => loadAnalysis(true)}
                      disabled={analysisLoading || !canRegenerate}
                      variant="ghost"
                      size="sm"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${analysisLoading ? "animate-spin" : ""}`} />
                      {!canRegenerate ? "Disponible demain" : "Régénérer"}
                    </GlassButton>
                  </div>
                </div>

                <div className="p-6">
                  {analysisLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--greek-gold)] flex items-center justify-center animate-pulse">
                        <Star className="w-6 h-6 text-[var(--greek-blue)] fill-current" />
                      </div>
                      <p className="text-gray-500 text-sm">EpsiAI analyse les données de {childFirstName}…</p>
                      <p className="text-gray-300 text-xs">Cela peut prendre quelques secondes</p>
                    </div>
                  ) : analysis ? (
                    <div className="leading-relaxed">{renderAnalysis(analysis)}</div>
                  ) : (
                    <div className="text-center py-12">
                      <Brain className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm mb-4">Lancez l'analyse pour obtenir des conseils personnalisés.</p>
                      <GlassButton onClick={() => loadAnalysis()} variant="navy" size="sm" className="mx-auto">
                        <Sparkles className="w-4 h-4" /> Analyser maintenant
                      </GlassButton>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                {analysisStats && (
                  <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
                    <h3 className="font-bold text-[var(--greek-blue)] mb-4 font-[family-name:var(--font-display)] text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[var(--greek-gold)]" />
                      Données analysées
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Exercices</span><span className="font-bold">{analysisStats.totalEx}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Taux de réussite</span><span className={`font-bold ${analysisStats.successRate >= 70 ? "text-green-600" : "text-orange-500"}`}>{analysisStats.successRate}%</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Quiz</span><span className="font-bold">{analysisStats.totalQuiz}</span></div>
                      {analysisStats.avgQuizScore !== null && <div className="flex justify-between"><span className="text-gray-500">Score moyen quiz</span><span className="font-bold">{analysisStats.avgQuizScore}%</span></div>}
                      <div className="flex justify-between"><span className="text-gray-500">Cours consultés</span><span className="font-bold">{analysisStats.totalCourses}</span></div>
                    </div>
                  </div>
                )}

                {!canRegenerate && (
                  <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 flex items-start gap-3">
                    <CalendarClock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      <strong>1 rapport par jour.</strong> Le prochain rapport sera disponible demain.
                    </p>
                  </div>
                )}

                <div className="bg-[var(--greek-blue)]/5 rounded-2xl border border-[var(--greek-blue)]/10 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-[var(--greek-gold)]" />
                    <span className="text-sm font-bold text-[var(--greek-blue)]">À propos de l'analyse</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    L'analyse est générée par EpsiAI, l'IA d'Educalcul. Elle est basée sur les 30 dernières activités de {childFirstName}.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
