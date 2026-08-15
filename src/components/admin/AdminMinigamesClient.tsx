"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, CheckCircle2, Trash2, Ban, Eye, Sigma, Calculator } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLoaderDots from "@/components/AdminLoaderDots";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { CALCUL_MENTAL_RULES } from "@/lib/minigames/calculMentalRules";

type Generation = {
  id: string;
  game_type: string;
  status: string;
  progress?: { message?: string };
  params?: { levelCode?: string; questionCount?: number };
  error?: string | null;
  created_at: string;
};

type Stats = Record<string, { plays: number; completed: number; totalScore: number }>;

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  running: "En cours",
  done: "Prêt à publier",
  published: "Publié",
  error: "Échec",
  cancel_requested: "Annulation...",
  cancelled: "Annulé",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  running: "bg-blue-100 text-blue-700",
  done: "bg-amber-100 text-amber-700",
  published: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  cancel_requested: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const ACTIVE_STATUSES = new Set(["pending", "running", "cancel_requested"]);
const POLL_MS = 2500;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token || ""}` };
}

export default function AdminMinigamesClient({
  initialGenerations,
  stats,
}: {
  initialGenerations: Generation[];
  stats: Stats;
}) {
  const [generations, setGenerations] = useState<Generation[]>(initialGenerations);
  const [levelCode, setLevelCode] = useState(CALCUL_MENTAL_RULES[CALCUL_MENTAL_RULES.length - 1].code);
  const [launching, setLaunching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialGenerations[0]?.id || null);
  const [preview, setPreview] = useState<{ prompt: string; answer: number }[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generationsRef = useRef(generations);
  generationsRef.current = generations;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const refreshGenerations = async () => {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/ai/minigames", { headers });
    if (!res.ok) return;
    const data = await res.json();
    if (data.generations) setGenerations(data.generations);
  };

  const loadPreview = async (id: string) => {
    setPreviewLoading(true);
    const headers = await authHeaders();
    const res = await fetch(`/api/admin/ai/minigames/${id}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setPreview(data.result_json?.questions || null);
    }
    setPreviewLoading(false);
  };

  useEffect(() => {
    if (!selectedId) { setPreview(null); return; }
    loadPreview(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const tick = async () => {
      const active = generationsRef.current.some((g) => ACTIVE_STATUSES.has(g.status));
      if (!active) return;
      await refreshGenerations();
      const sel = selectedIdRef.current;
      if (sel && generationsRef.current.find((g) => g.id === sel && g.status === "done")) {
        loadPreview(sel);
      }
    };
    const interval = setInterval(tick, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const launch = async () => {
    setError(null);
    setLaunching(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/ai/minigames", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "calcul_mental", levelCode, questionCount: 15 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors du lancement de la génération.");
        return;
      }
      const optimistic: Generation = {
        id: data.generationId,
        game_type: "calcul_mental",
        status: "pending",
        progress: { message: "Démarrage..." },
        params: { levelCode, questionCount: 15 },
        created_at: new Date().toISOString(),
      };
      setGenerations((prev) => [optimistic, ...prev]);
      setSelectedId(data.generationId);
      refreshGenerations();
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setLaunching(false);
    }
  };

  const publish = async (id: string) => {
    const headers = await authHeaders();
    const res = await fetch(`/api/admin/ai/minigames/${id}`, { method: "PATCH", headers });
    if (res.ok) {
      setGenerations((prev) => prev.map((g) => (g.id === id ? { ...g, status: "published" } : g)));
    }
  };

  const cancel = async (id: string) => {
    const headers = await authHeaders();
    await fetch(`/api/admin/ai/minigames/${id}`, { method: "POST", headers });
    setGenerations((prev) => prev.map((g) => (g.id === id ? { ...g, status: "cancel_requested" } : g)));
  };

  const remove = async (id: string) => {
    const headers = await authHeaders();
    await fetch(`/api/admin/ai/minigames/${id}`, { method: "DELETE", headers });
    setGenerations((prev) => prev.filter((g) => g.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const selected = useMemo(() => generations.find((g) => g.id === selectedId) || null, [generations, selectedId]);

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r text-sm text-red-700">{error}</div>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[var(--greek-blue)]/10 flex items-center justify-center shrink-0">
              <Sigma className="w-5 h-5 text-[var(--greek-blue)]" />
            </div>
            <h3 className="font-bold text-[var(--greek-blue)]">Mathador</h3>
          </div>
          <p className="text-xs text-gray-500">Jeu procédural, aucune génération IA nécessaire — vérifié solvable à chaque tirage.</p>
          <div className="text-sm text-gray-600">
            {stats.mathador?.plays || 0} parties jouées · {stats.mathador?.completed || 0} terminées
          </div>
        </div>

        <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[var(--greek-blue)]/10 flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5 text-[var(--greek-blue)]" />
            </div>
            <h3 className="font-bold text-[var(--greek-blue)]">Calcul mental</h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={levelCode}
              onChange={(e) => setLevelCode(e.target.value)}
              className="flex-1 text-sm border rounded-lg px-2 py-1.5"
              style={{ borderColor: "rgba(15,30,58,0.15)" }}
            >
              {CALCUL_MENTAL_RULES.map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
            <GlassButton size="sm" variant="navy" disabled={launching} onClick={launch}>
              <Play className="w-4 h-4" /> Générer
            </GlassButton>
          </div>
          <div className="text-sm text-gray-600">
            {stats.calcul_mental?.plays || 0} parties jouées · {stats.calcul_mental?.completed || 0} terminées
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
            Fiches générées
          </div>
          <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-100">
            {generations.map((g) => {
              const isActive = ACTIVE_STATUSES.has(g.status);
              const level = CALCUL_MENTAL_RULES.find((r) => r.code === g.params?.levelCode);
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedId(g.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedId === g.id ? "bg-[var(--greek-blue)]/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--greek-blue)] truncate flex items-center gap-1.5">
                      {isActive && <AdminLoaderDots />}
                      {level?.label || g.params?.levelCode || "?"}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[g.status]}`}>
                      {STATUS_LABEL[g.status] || g.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1.5">
                    {new Date(g.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </button>
              );
            })}
            {generations.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Aucune fiche générée pour l&apos;instant.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-5 min-h-[300px]">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400 py-16">
              Sélectionne une fiche pour la relire.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-bold text-[var(--greek-blue)]">
                    {CALCUL_MENTAL_RULES.find((r) => r.code === selected.params?.levelCode)?.label || "Fiche"}
                  </h3>
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[selected.status]}`}>
                    {STATUS_LABEL[selected.status] || selected.status}
                  </span>
                  {selected.error && <p className="text-xs text-red-600 mt-1">{selected.error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {ACTIVE_STATUSES.has(selected.status) && (
                    <GlassButton size="sm" variant="ghost" onClick={() => cancel(selected.id)}>
                      <Ban className="w-3.5 h-3.5" /> Annuler
                    </GlassButton>
                  )}
                  {selected.status === "done" && (
                    <GlassButton size="sm" variant="gold" onClick={() => publish(selected.id)}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Publier
                    </GlassButton>
                  )}
                  {!ACTIVE_STATUSES.has(selected.status) && (
                    <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => remove(selected.id)} aria-label="Supprimer" />
                  )}
                </div>
              </div>

              {previewLoading ? (
                <div className="flex items-center justify-center py-12"><AdminLoaderDots /></div>
              ) : ACTIVE_STATUSES.has(selected.status) ? (
                <div className="text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                  {selected.progress?.message || "Génération en cours..."}
                </div>
              ) : preview && preview.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> {preview.length} questions
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {preview.map((q, i) => (
                      <div key={i} className="border rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2" style={{ borderColor: "rgba(15,30,58,0.1)" }}>
                        <span>{q.prompt}</span>
                        <span className="font-bold text-[var(--greek-gold)] shrink-0">{q.answer}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-400 py-8 text-center">Aucun contenu.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
