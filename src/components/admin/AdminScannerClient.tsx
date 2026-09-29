"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Palette,
  ShieldAlert,
  Gauge,
  Accessibility,
  Search,
  Code2,
  Play,
  Download,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Ban,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import LoaderDots from "@/components/LoaderDots";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";

const ICONS: Record<string, any> = { Palette, ShieldAlert, Gauge, Accessibility, Search, Code2 };

// Miroir de src/lib/scanner/categories.ts (pas d'import direct : ce fichier
// est côté client, categories.ts référence fs/path côté serveur).
const CATEGORIES = [
  { key: "style", label: "Cohérence de style", description: "Couleurs en dur, wording incohérent, structure de titres, espacements entre pages.", icon: "Palette" },
  { key: "security", label: "Sécurité", description: "Auth manquante, IDOR, erreurs brutes exposées, absence de rate limiting, secrets en dur.", icon: "ShieldAlert" },
  { key: "performance", label: "Performance", description: "Pages sans cache, requêtes séquentielles, <img> brut, sélections trop larges.", icon: "Gauge" },
  { key: "accessibility", label: "Accessibilité", description: "Images sans alt, champs sans label, contrastes suspects, navigation clavier.", icon: "Accessibility" },
  { key: "seo", label: "SEO", description: "Metadata manquants ou dupliqués, titres de page en double.", icon: "Search" },
  { key: "quality", label: "Qualité du code", description: "Code mort, duplication, fonctions trop complexes, gestion d'erreurs manquante, 'any' abusif.", icon: "Code2" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  running: "En cours",
  completed: "Terminé",
  failed: "Échec",
  cancel_requested: "Annulation...",
  cancelled: "Annulé",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  running: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancel_requested: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];
const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critique",
  high: "Élevée",
  medium: "Moyenne",
  low: "Faible",
  info: "Info",
};
const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
  info: "bg-gray-100 text-gray-600 border-gray-200",
};

type Run = {
  id: string;
  category: string;
  status: string;
  progress?: { current?: number; total?: number; message?: string };
  findings_count?: number;
  error?: string | null;
  created_at: string;
  updated_at?: string;
};

type Finding = {
  id: string;
  severity: string;
  file_path: string;
  title: string;
  description: string;
  suggested_fix: string | null;
  status: string;
  created_at: string;
};

const ACTIVE_STATUSES = new Set(["pending", "running", "cancel_requested"]);
const POLL_MS = 2000;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token || ""}` };
}

/** Barre de progression animée — largeur en transition CSS fluide, jamais de saut brut. */
function ProgressBar({ current, total, className = "h-1.5" }: { current: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 8;
  return (
    <div className={`w-full bg-black/10 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-current rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function AdminScannerClient({ initialRuns }: { initialRuns: Run[] }) {
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const [launchingSet, setLaunchingSet] = useState<Set<string>>(new Set());
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialRuns[0]?.id || null);
  const [findingsByRun, setFindingsByRun] = useState<Record<string, Finding[]>>({});
  const [findingsLoadingIds, setFindingsLoadingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Refs miroir pour que la boucle de polling (intervalle stable, créé une
  // seule fois) lise toujours l'état le plus frais sans avoir à se
  // recréer à chaque changement — sinon le polling saccade/rate des ticks.
  const runsRef = useRef(runs);
  runsRef.current = runs;
  const selectedRunIdRef = useRef(selectedRunId);
  selectedRunIdRef.current = selectedRunId;

  const refreshRuns = async () => {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/scanner/runs", { headers });
    if (!res.ok) return;
    const data = await res.json();
    if (data.runs) setRuns(data.runs);
  };

  const loadFindings = async (runId: string, { silent = false } = {}) => {
    if (!silent) setFindingsLoadingIds((prev) => new Set(prev).add(runId));
    const headers = await authHeaders();
    const res = await fetch(`/api/admin/scanner/runs/${runId}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setFindingsByRun((prev) => ({ ...prev, [runId]: data.findings || [] }));
    }
    setFindingsLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(runId);
      return next;
    });
  };

  // Sélection d'un run : si on l'a déjà en cache, on l'affiche instantanément
  // (pas de spinner) et on rafraîchit en silence derrière — sinon, un seul
  // chargement visible.
  useEffect(() => {
    if (!selectedRunId) return;
    const hasCache = selectedRunId in findingsByRun;
    loadFindings(selectedRunId, { silent: hasCache });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId]);

  // Polling unique et stable : ne se recrée jamais, lit l'état via les refs.
  // Tant qu'au moins un scan est actif, on rafraîchit la liste + les
  // findings du run actif affiché, toutes les 2s, sans à-coups.
  useEffect(() => {
    const tick = async () => {
      const active = runsRef.current.some((r) => ACTIVE_STATUSES.has(r.status));
      if (!active) return;
      await refreshRuns();
      const sel = selectedRunIdRef.current;
      if (sel && runsRef.current.find((r) => r.id === sel && ACTIVE_STATUSES.has(r.status))) {
        loadFindings(sel, { silent: true });
      }
    };
    const interval = setInterval(tick, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const launch = async (category: string) => {
    setError(null);
    setLaunchingSet((prev) => new Set(prev).add(category));
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/scanner/run", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors du lancement du scan.");
        return;
      }
      // Optimiste : on insère tout de suite un run "pending" localement,
      // pas d'attente d'un aller-retour réseau pour voir l'animation démarrer.
      const optimisticRun: Run = {
        id: data.runId,
        category,
        status: "pending",
        progress: { current: 0, total: 0, message: "Démarrage..." },
        findings_count: 0,
        created_at: new Date().toISOString(),
      };
      setRuns((prev) => [optimisticRun, ...prev.filter((r) => r.id !== data.runId)]);
      setFindingsByRun((prev) => ({ ...prev, [data.runId]: [] }));
      setSelectedRunId(data.runId);
      refreshRuns();
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setLaunchingSet((prev) => {
        const next = new Set(prev);
        next.delete(category);
        return next;
      });
    }
  };

  const cancelRun = async (runId: string) => {
    const headers = await authHeaders();
    await fetch(`/api/admin/scanner/runs/${runId}`, { method: "POST", headers });
    setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, status: "cancel_requested" } : r)));
    refreshRuns();
  };

  const deleteRun = async (runId: string) => {
    const headers = await authHeaders();
    await fetch(`/api/admin/scanner/runs/${runId}`, { method: "DELETE", headers });
    if (selectedRunId === runId) setSelectedRunId(null);
    setRuns((prev) => prev.filter((r) => r.id !== runId));
  };

  const setFindingStatus = async (runId: string, findingId: string, status: string) => {
    const headers = await authHeaders();
    await fetch(`/api/admin/scanner/findings/${findingId}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setFindingsByRun((prev) => ({
      ...prev,
      [runId]: (prev[runId] || []).map((f) => (f.id === findingId ? { ...f, status } : f)),
    }));
  };

  const exportRun = async (runId: string, category: string) => {
    const headers = await authHeaders();
    const res = await fetch(`/api/admin/scanner/runs/${runId}/export`, { headers });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scanner-${category}-${runId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedRun = useMemo(() => runs.find((r) => r.id === selectedRunId) || null, [runs, selectedRunId]);
  const findings = (selectedRunId && findingsByRun[selectedRunId]) || [];
  const findingsLoading = selectedRunId ? findingsLoadingIds.has(selectedRunId) && findings.length === 0 : false;

  const activeByCategory = useMemo(() => {
    const m: Record<string, Run> = {};
    for (const r of runs) if (ACTIVE_STATUSES.has(r.status)) m[r.category] = r;
    return m;
  }, [runs]);

  const groupedFindings = useMemo(() => {
    const openFindings = findings.filter((f) => f.status !== "ignored");
    const m: Record<string, Finding[]> = {};
    for (const f of openFindings) {
      if (!m[f.severity]) m[f.severity] = [];
      m[f.severity].push(f);
    }
    return m;
  }, [findings]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r text-sm text-red-700">{error}</div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = ICONS[cat.icon];
          const active = activeByCategory[cat.key];
          const isLaunching = launchingSet.has(cat.key);
          const current = active?.progress?.current ?? 0;
          const total = active?.progress?.total ?? 0;
          return (
            <div
              key={cat.key}
              className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-5 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[var(--greek-blue)]/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[var(--greek-blue)]" />
                </div>
                <h3 className="font-bold text-[var(--greek-blue)]">{cat.label}</h3>
              </div>
              <p className="text-xs text-gray-500 flex-1">{cat.description}</p>
              {/* Emplacement à hauteur FIXE : le bouton et la barre de progression
                  prennent la même place. Sinon, lancer un scan agrandissait la carte
                  et tous les boutons voisins sautaient sous le curseur. */}
              <div className="h-[52px] flex items-center">
              {active ? (
                <button
                  onClick={() => setSelectedRunId(active.id)}
                  className="w-full flex flex-col gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <span className="flex items-center justify-center gap-2">
                    {total ? `${current}/${total} lots` : STATUS_LABEL[active.status]}
                  </span>
                  <ProgressBar current={current} total={total} />
                </button>
              ) : (
                <GlassButton size="sm" variant="navy" disabled={isLaunching} onClick={() => launch(cat.key)}>
                  <Play className="w-4 h-4" />
                  Lancer le scan
                </GlassButton>
              )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
            Historique
          </div>
          <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-100">
            {runs.map((r) => {
              const cat = CATEGORIES.find((c) => c.key === r.category);
              const isActive = ACTIVE_STATUSES.has(r.status);
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRunId(r.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedRunId === r.id ? "bg-[var(--greek-blue)]/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--greek-blue)] truncate flex items-center gap-1.5">
                      {isActive && <LoaderDots />}
                      {cat?.label || r.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[r.status]}`}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </div>
                  {isActive && (r.progress?.total ?? 0) > 0 && (
                    <div className="mt-1.5 text-blue-500">
                      <ProgressBar current={r.progress?.current ?? 0} total={r.progress?.total ?? 0} className="h-1" />
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1.5">
                    {new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    {typeof r.findings_count === "number" && r.status === "completed" && (
                      <span className="ml-2">· {r.findings_count} problème(s)</span>
                    )}
                  </div>
                </button>
              );
            })}
            {runs.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Aucun scan lancé pour l&apos;instant.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-5 min-h-[300px]">
          {!selectedRun ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400 py-16">
              Sélectionne un scan dans l&apos;historique pour voir le détail.
            </div>
          ) : (
            <div className="space-y-4 transition-opacity duration-300">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <h3 className="font-bold text-[var(--greek-blue)]">
                    {CATEGORIES.find((c) => c.key === selectedRun.category)?.label || selectedRun.category}
                  </h3>
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[selectedRun.status]}`}>
                    {STATUS_LABEL[selectedRun.status] || selectedRun.status}
                  </span>
                  {selectedRun.progress?.message && ACTIVE_STATUSES.has(selectedRun.status) && (
                    <p className="text-xs text-gray-500 mt-1.5">{selectedRun.progress.message}</p>
                  )}
                  {selectedRun.error && <p className={`text-xs mt-1 ${selectedRun.status === "failed" ? "text-red-600" : "text-amber-600"}`}>{selectedRun.error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {ACTIVE_STATUSES.has(selectedRun.status) && (
                    <GlassButton size="sm" variant="ghost" onClick={() => cancelRun(selectedRun.id)}>
                      <Ban className="w-3.5 h-3.5" /> Annuler
                    </GlassButton>
                  )}
                  {!ACTIVE_STATUSES.has(selectedRun.status) && findings.length > 0 && (
                    <GlassButton size="sm" variant="outline" onClick={() => exportRun(selectedRun.id, selectedRun.category)}>
                      <Download className="w-3.5 h-3.5" /> Exporter en .txt
                    </GlassButton>
                  )}
                  {!ACTIVE_STATUSES.has(selectedRun.status) && (
                    <GlassIconButton
                      icon={Trash2}
                      color="red"
                      size="sm"
                      onClick={() => deleteRun(selectedRun.id)}
                      aria-label="Supprimer"
                    />
                  )}
                </div>
              </div>

              {findingsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoaderDots />
                </div>
              ) : findings.length === 0 ? (
                ACTIVE_STATUSES.has(selectedRun.status) ? (
                  <div className="text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                    Analyse en cours, les problèmes trouvés s&apos;afficheront ici au fur et à mesure...
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4" /> {selectedRun.error ? "Aucun problème dans les lots analysés." : "Aucun problème détecté."}
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  {SEVERITY_ORDER.filter((s) => groupedFindings[s]?.length).map((severity) => (
                    <div key={severity}>
                      <div className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {SEVERITY_LABEL[severity]} ({groupedFindings[severity].length})
                      </div>
                      <div className="space-y-2">
                        {groupedFindings[severity].map((f) => (
                          <div key={f.id} className={`border rounded-xl p-3 ${SEVERITY_COLOR[f.severity]}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-mono text-[11px] opacity-70">{f.file_path}</div>
                                <div className="font-bold text-sm mt-0.5">{f.title}</div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {f.status === "resolved" ? (
                                  <GlassIconButton
                                    icon={RotateCcw}
                                    color="navy"
                                    size="sm"
                                    onClick={() => setFindingStatus(selectedRun.id, f.id, "open")}
                                    aria-label="Rouvrir"
                                  />
                                ) : (
                                  <GlassIconButton
                                    icon={CheckCircle2}
                                    color="green"
                                    size="sm"
                                    onClick={() => setFindingStatus(selectedRun.id, f.id, "resolved")}
                                    aria-label="Marquer résolu"
                                  />
                                )}
                                <GlassIconButton
                                  icon={XCircle}
                                  color="gray"
                                  size="sm"
                                  onClick={() => setFindingStatus(selectedRun.id, f.id, "ignored")}
                                  aria-label="Ignorer"
                                />
                              </div>
                            </div>
                            <p className="text-sm mt-1.5 opacity-90">{f.description}</p>
                            {f.suggested_fix && (
                              <p className="text-xs mt-1.5 opacity-70">→ {f.suggested_fix}</p>
                            )}
                            {f.status === "resolved" && (
                              <div className="text-[10px] font-bold mt-1.5 opacity-60">RÉSOLU</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
