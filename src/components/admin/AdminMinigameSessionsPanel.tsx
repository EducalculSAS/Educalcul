"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Sigma, Calculator, Clock, PuzzleIcon, TrendingUp, Languages } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLoaderDots from "@/components/AdminLoaderDots";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";

type Session = {
  id: string;
  user_id: number;
  game_type: string;
  childName: string;
  grade_level: string;
  content_json: any;
  answer_json: any;
  score: number;
  max_score: number | null;
  duration_seconds: number | null;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: "En cours",
  completed: "Terminée",
  abandoned: "Abandonnée",
};
const STATUS_COLOR: Record<string, string> = {
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  abandoned: "bg-gray-100 text-gray-500",
};

function formatDuration(seconds: number | null) {
  if (seconds === null || seconds === undefined) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token || ""}` };
}

type SessionGameType = "mathador" | "calcul_mental" | "enigmes" | "suites" | "langues";

export default function AdminMinigameSessionsPanel() {
  const [gameType, setGameType] = useState<SessionGameType>("mathador");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  // Basculer d'onglet (mathador <-> calcul_mental) ou paginer relance un fetch
  // avant que le précédent ait fini — sans garde, une réponse plus lente pour
  // un appel plus ancien peut arriver APRÈS celle du dernier appel et écraser
  // l'état avec des données obsolètes/mal étiquetées. Un compteur strictement
  // croissant est plus robuste qu'une comparaison de gameType : IMMUNE à tout
  // recoupement, même entre deux appels pour le même gameType (double-clic,
  // pagination qui chevauche un changement d'onglet, etc.) — seule la toute
  // dernière requête émise a le droit d'écrire dans l'état.
  const requestIdRef = useRef(0);

  const load = async (nextOffset: number, replace: boolean) => {
    const myRequestId = ++requestIdRef.current;
    const requestedGameType = gameType;
    setLoading(true);
    // Sur un changement d'onglet (replace=true), on vide IMMÉDIATEMENT les
    // lignes précédentes avant même de partir chercher les nouvelles : sinon
    // les anciennes lignes (ex. Mathador) restent affichées pendant tout le
    // temps de la requête, juste reformatées avec les colonnes du nouvel
    // onglet (ex. "? questions" au lieu de "12 · 4 · 3 → 40") puisque cette
    // mise en forme lit le `gameType` courant — d'où le flash de données
    // mal étiquetées avant que la vraie réponse (vide ou non) n'arrive.
    if (replace) setSessions([]);
    const headers = await authHeaders();
    const res = await fetch(`/api/admin/minigames/sessions?gameType=${requestedGameType}&offset=${nextOffset}`, { headers, cache: "no-store" });
    if (myRequestId !== requestIdRef.current) return; // réponse obsolète, ignorée
    if (res.ok) {
      const data = await res.json();
      setSessions((prev) => (replace ? data.sessions : [...prev, ...data.sessions]));
      setTotal(data.total);
      setOffset(nextOffset);
    }
    setLoading(false);
  };

  useEffect(() => {
    load(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameType]);

  const remove = async (id: string) => {
    const headers = await authHeaders();
    const res = await fetch(`/api/admin/minigames/sessions/${id}`, { method: "DELETE", headers });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setTotal((t) => t - 1);
    }
  };

  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <GlassSegmentedControl
          size="sm"
          options={[
            { id: "mathador", label: <span className="flex items-center gap-1.5"><Sigma className="w-3.5 h-3.5" /> Mathador</span> },
            { id: "calcul_mental", label: <span className="flex items-center gap-1.5"><Calculator className="w-3.5 h-3.5" /> Calcul mental</span> },
            { id: "enigmes", label: <span className="flex items-center gap-1.5"><PuzzleIcon className="w-3.5 h-3.5" /> Énigmes</span> },
            { id: "suites", label: <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Suites</span> },
            { id: "langues", label: <span className="flex items-center gap-1.5"><Languages className="w-3.5 h-3.5" /> Langues</span> },
          ]}
          value={gameType}
          onChange={(v) => setGameType(v as SessionGameType)}
        />
        <span className="text-xs text-gray-400">{total} partie(s)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100">
              <th className="px-4 py-2">Enfant</th>
              <th className="px-4 py-2">Niveau</th>
              <th className="px-4 py-2">Contenu</th>
              <th className="px-4 py-2">Score</th>
              <th className="px-4 py-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Temps</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sessions.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-[var(--greek-blue)]">{s.childName}</td>
                <td className="px-4 py-2 text-gray-500">{s.grade_level}</td>
                <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                  {/* Formaté selon le game_type RÉEL de la ligne, pas l'onglet
                      actif — une ligne mal étiquetée resterait lisible plutôt
                      que de mentir sous les colonnes du mauvais jeu. */}
                  {s.game_type === "mathador"
                    ? `${(s.content_json?.numbers || []).join(" · ")} → ${s.content_json?.target ?? "?"}`
                    : `palier ${s.content_json?.palierCode ?? "?"} · ${s.content_json?.questionCount ?? "?"} questions`}
                </td>
                <td className="px-4 py-2 font-bold text-[var(--greek-gold)]">
                  {s.score}{s.max_score ? ` / ${s.max_score}` : ""}
                </td>
                <td className="px-4 py-2 text-gray-500">{formatDuration(s.duration_seconds)}</td>
                <td className="px-4 py-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[s.status] || "bg-gray-100 text-gray-500"}`}>
                    {STATUS_LABEL[s.status] || s.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(s.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-2">
                  <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => remove(s.id)} aria-label="Supprimer" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && !loading && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">Aucune partie jouée pour l&apos;instant.</div>
        )}
        {loading && (
          <div className="flex justify-center py-6"><AdminLoaderDots /></div>
        )}
      </div>

      {!loading && sessions.length < total && (
        <div className="px-4 py-3 border-t border-gray-100 flex justify-center">
          <GlassButton size="sm" variant="ghost" onClick={() => load(offset + sessions.length, false)}>
            Charger plus
          </GlassButton>
        </div>
      )}
    </div>
  );
}
