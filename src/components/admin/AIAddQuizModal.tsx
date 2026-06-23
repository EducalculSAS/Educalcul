"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Plus } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { useSmoothPercent } from "./useSmoothPercent";
import type { Question } from "./QuizBuilder";

/**
 * "Ajouter du contenu avec l'IA" pour un quiz : crée une nouvelle question et
 * demande où l'insérer dans la liste.
 */
export default function AIAddQuizModal({
  level,
  questions,
  onAddQuestion,
  onClose,
}: {
  level?: string;
  questions: Question[];
  onAddQuestion: (question: Question, position: string) => void;
  onClose: () => void;
}) {
  const [position, setPosition] = useState<string>("end");
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const smoothPct = useSmoothPercent(done ? 1 : 0, 1, loading || done, 9000);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const handleApply = async () => {
    if (!instruction.trim() || loading) return;
    setLoading(true);
    setDone(false);
    setError("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/admin/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "add_question", instruction, content: {}, level }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de génération");
      if (!data.item) throw new Error("Réponse IA invalide");

      setDone(true);
      await new Promise((r) => setTimeout(r, 350));

      const q: Question = {
        ...data.item,
        id: crypto.randomUUID(),
        text: data.item.text || "",
        type: data.item.type || "single_choice",
        points: data.item.points || 1,
      };
      onAddQuestion(q, position);
      onClose();
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e.message || "Erreur de génération");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleClose = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setLoading(false);
    }
    onClose();
  };

  const selectCls =
    "w-full text-sm border border-[rgba(197,161,72,0.25)] rounded-lg text-gray-700 focus:ring-blue-500 focus:border-blue-500 px-2.5 py-2";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1060] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-lg">Ajouter une question avec l'IA</h3>
          </div>
          <button onClick={handleClose} className="group text-white/80 hover:text-white transition-colors">
            <X size={20} className="transition-transform group-hover:scale-125" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <PageLoader className="h-24 mb-2" />
              <p className="text-sm font-semibold text-gray-700 mb-1">
                {done ? "Terminé !" : "Création de la question..."}
              </p>
              <p className="text-xs text-gray-400 mb-4">{elapsed}s écoulées · {Math.round(smoothPct)}%</p>
              <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(3, smoothPct)}%`, background: "linear-gradient(to right, var(--greek-blue), var(--greek-gold))" }}
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Position</label>
                <select value={position} onChange={(e) => setPosition(e.target.value)} className={selectCls}>
                  <option value="start">Au début</option>
                  <option value="end">À la fin</option>
                  {questions.map((q, i) => (
                    <option key={q.id} value={q.id}>{`Après la question ${i + 1}${q.text ? ` — ${q.text.slice(0, 40)}` : ""}`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Question à créer</label>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Ex : Une question à choix unique sur la table de multiplication de 7..."
                  className="w-full min-h-[90px] border border-[rgba(197,161,72,0.25)] rounded-xl text-sm p-3 focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                  disabled={loading}
                  autoFocus
                />
              </div>
            </>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        {!loading && (
          <div className="p-4 border-t border-[rgba(197,161,72,0.25)] flex justify-end gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={!instruction.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--greek-blue)] text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              <Plus size={16} />
              Créer et insérer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
