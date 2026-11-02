"use client";

import type { Loose } from "@/types/loose";
import { useState, useEffect, useRef } from "react";
import { Sparkles, Plus } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import PageLoader from "@/components/PageLoader";
import { useSmoothPercent } from "./useSmoothPercent";
import type { Page, Block } from "./ExerciseBuilder";
import { errMessage } from "@/lib/safeError";

/**
 * "Ajouter du contenu avec l'IA" pour un exercice : crée une nouvelle PAGE
 * (avec ses blocs) ou un nouveau BLOC dans une page, et demande où l'insérer.
 */
export default function AIAddExerciseModal({
  level,
  pages,
  onAddPage,
  onAddBlock,
  onClose,
}: {
  level?: string;
  pages: Page[];
  onAddPage: (page: Page, position: string) => void;
  onAddBlock: (block: Block, pageId: string, position: string) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"page" | "block">(pages.length === 0 ? "page" : "block");
  const [targetPageId, setTargetPageId] = useState<string>(pages[0]?.id || "");
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

  useEffect(() => {
    setPosition("end");
  }, [kind, targetPageId]);

  const targetPage = pages.find((p) => p.id === targetPageId);
  const blocksOfTarget = targetPage?.blocks || [];

  const handleApply = async () => {
    if (!instruction.trim() || loading) return;
    if (kind === "block" && !targetPageId) {
      setError("Choisis la page où ajouter le bloc.");
      return;
    }
    setLoading(true);
    setDone(false);
    setError("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const type = kind === "page" ? "add_page" : "add_block";
      const ctx = kind === "page" ? {} : { pageTitle: targetPage?.title };
      const res = await fetch("/api/admin/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, instruction, content: ctx, level }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de génération");
      if (!data.item) throw new Error("Réponse IA invalide");

      setDone(true);
      await new Promise((r) => setTimeout(r, 350));

      if (kind === "page") {
        const pg: Page = {
          ...data.item,
          id: crypto.randomUUID(),
          title: data.item.title || "Nouvelle page",
          blocks: (data.item.blocks || []).map((b: Loose) => ({ ...b, id: crypto.randomUUID() })),
        };
        onAddPage(pg, position);
      } else {
        const bl: Block = { ...data.item, id: crypto.randomUUID(), title: data.item.title || "Nouveau bloc" };
        onAddBlock(bl, targetPageId, position);
      }
      onClose();
    } catch (e: unknown) {
      if ((e instanceof Error ? e.name : "") === "AbortError") return;
      setError(errMessage(e) || "Erreur de génération");
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
    "w-full text-sm border border-[rgba(197,161,72,0.25)] rounded-lg text-gray-700 focus:ring-[var(--greek-blue)] focus:border-[var(--greek-blue)] px-2.5 py-2";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1060] p-4 backdrop-blur-sm modal-overlay">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-[var(--greek-blue)] to-blue-600 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-lg">Ajouter du contenu avec l&apos;IA</h3>
          </div>
          <GlassCloseButton onClick={handleClose} variant="dark" />
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <PageLoader className="h-24 mb-2" />
              <p className="text-sm font-semibold text-gray-700 mb-1">
                {done ? "Terminé !" : kind === "page" ? "Création de la page..." : "Création du bloc..."}
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
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Que veux-tu ajouter ?
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setKind("block")}
                    disabled={pages.length === 0}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 ${
                      kind === "block" ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]" : "bg-white text-gray-600 border-[rgba(197,161,72,0.3)] hover:bg-gray-50"
                    }`}
                  >
                    Un bloc / une question
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind("page")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      kind === "page" ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]" : "bg-white text-gray-600 border-[rgba(197,161,72,0.3)] hover:bg-gray-50"
                    }`}
                  >
                    Une page
                  </button>
                </div>
              </div>

              {kind === "block" && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Dans quelle page ?
                  </label>
                  <select value={targetPageId} onChange={(e) => setTargetPageId(e.target.value)} className={selectCls}>
                    {pages.map((p, i) => (
                      <option key={p.id} value={p.id}>{`Page ${i + 1}${p.title ? ` : ${p.title}` : ""}`}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Position</label>
                <select value={position} onChange={(e) => setPosition(e.target.value)} className={selectCls}>
                  <option value="start">Au début</option>
                  <option value="end">À la fin</option>
                  {kind === "page"
                    ? pages.map((p, i) => (
                        <option key={p.id} value={p.id}>{`Après la page ${i + 1}${p.title ? ` : ${p.title}` : ""}`}</option>
                      ))
                    : blocksOfTarget.map((b, i) => (
                        <option key={b.id} value={b.id}>{`Après le bloc ${i + 1}${b.title ? ` : ${b.title}` : ""}`}</option>
                      ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Contenu à créer</label>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder={
                    kind === "page"
                      ? "Ex : Une page avec 3 questions sur l'addition de fractions..."
                      : "Ex : Une question à choix unique sur le calcul de 3/4 + 1/4..."
                  }
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
            <GlassButton
              size="sm"
              variant="navy"
              onClick={handleApply}
              disabled={!instruction.trim()}
              className="gap-2"
            >
              <Plus size={16} />
              Créer et insérer
            </GlassButton>
          </div>
        )}
      </div>
    </div>
  );
}
