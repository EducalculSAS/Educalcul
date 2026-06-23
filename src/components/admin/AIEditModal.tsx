"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { useSmoothPercent } from "./useSmoothPercent";

export default function AIEditModal({
  type,
  level,
  content,
  onApply,
  onClose,
}: {
  type: "course" | "exercise" | "quiz";
  level?: string;
  content: unknown;
  onApply: (updated: any) => void;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const smoothPct = useSmoothPercent(done ? 1 : 0, 1, loading || done, 9000);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const abortRef = useRef<AbortController | null>(null);

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
        body: JSON.stringify({ type, instruction, content, level }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de modification");

      const existing = Array.isArray(content) ? content : [];
      const deletedIds = new Set<string>(data.deleted || []);

      // Champ contenant les sous-éléments (leçons d'un chapitre / blocs d'une page)
      const childKey = type === "course" ? "lessons" : type === "exercise" ? "blocks" : null;
      const parentLevel = type === "course" ? "chapter" : type === "exercise" ? "page" : null;
      const childLevel = type === "course" ? "lesson" : type === "exercise" ? "block" : null;

      let merged = existing
        .filter((it: any) => !deletedIds.has(it?.id))
        .map((it: any) =>
          childKey && Array.isArray(it?.[childKey])
            ? { ...it, [childKey]: it[childKey].filter((c: any) => !deletedIds.has(c?.id)) }
            : it
        );

      for (const item of data.items || []) {
        if (!item || typeof item !== "object") continue;
        const { after_id, parent_id, level, ...rest } = item;
        if (!rest.id) continue; // item invalide (sans id) : on l'ignore

        // Détecte un item "enfant" (leçon/bloc) même si l'IA n'a pas correctement
        // renseigné "level" : un item enfant n'a PAS de tableau childKey (ex: "lessons").
        const isChildItem =
          !!childKey &&
          (level === childLevel ||
            (level !== parentLevel && !Array.isArray((rest as any)[childKey])));

        // Item au niveau enfant (leçon/bloc) : on le place dans son parent sans toucher au reste.
        if (isChildItem) {
          const parent =
            merged.find((p: any) => p?.id === parent_id) ||
            merged.find((p: any) => Array.isArray(p?.[childKey!]) && p[childKey!].some((c: any) => c?.id === rest.id)) ||
            merged[0];
          if (!parent) continue;
          if (!Array.isArray(parent[childKey])) parent[childKey] = [];
          const cidx = parent[childKey].findIndex((c: any) => c?.id === rest.id);
          if (cidx >= 0) {
            // Fusion (et non remplacement) : si l'IA n'a renvoyé qu'une partie
            // des champs (ex: juste le titre), on conserve les champs existants
            // (content, blocks, exercises...) pour ne pas vider la leçon/le bloc.
            parent[childKey][cidx] = { ...parent[childKey][cidx], ...rest };
          } else if (after_id === null) {
            parent[childKey].unshift(rest);
          } else {
            const pos = parent[childKey].findIndex((c: any) => c?.id === after_id);
            if (pos >= 0) parent[childKey].splice(pos + 1, 0, rest);
            else parent[childKey].push(rest);
          }
          continue;
        }

        // Item au niveau parent (chapitre/page) ou quiz (question).
        const idx = merged.findIndex((it: any) => it?.id === rest.id);
        if (idx >= 0) {
          // Filet de sécurité : si l'IA a omis des sous-éléments existants
          // (leçons/blocs) sans les supprimer explicitement, on les ré-ajoute.
          if (childKey && Array.isArray(merged[idx]?.[childKey]) && Array.isArray(rest[childKey])) {
            const returnedIds = new Set(rest[childKey].map((c: any) => c?.id));
            const missing = merged[idx][childKey].filter((c: any) => !returnedIds.has(c?.id));
            if (missing.length > 0) {
              rest[childKey] = [...rest[childKey], ...missing];
            }
          }
          // Fusion (et non remplacement) pour préserver les champs non renvoyés
          // par l'IA (titre, lessons/blocks si absents...).
          merged[idx] = { ...merged[idx], ...rest };
        } else if (after_id === null) {
          merged.unshift(rest);
        } else {
          const pos = merged.findIndex((it: any) => it?.id === after_id);
          if (pos >= 0) merged.splice(pos + 1, 0, rest);
          else merged.push(rest);
        }
      }

      setDone(true);
      await new Promise((r) => setTimeout(r, 400));
      onApply(merged);
      onClose();
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e.message || "Erreur de modification");
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1060] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-[var(--greek-blue)] to-blue-600 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-lg">Modifier avec l'IA</h3>
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
                {done ? "Terminé !" : "Écriture du contenu modifié..."}
              </p>
              <p className="text-xs text-gray-400 mb-4">{elapsed}s écoulées · {Math.round(smoothPct)}%</p>
              <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(3, smoothPct)}%`,
                    background: "linear-gradient(to right, var(--greek-blue), var(--greek-gold))",
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                Décris ce que tu veux changer, ajouter ou supprimer — un petit détail (une phrase, une réponse,
                un tableau...) ou quelque chose de plus important (un chapitre/une page/des questions entières).
              </p>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={
                  type === "course"
                    ? "Ex : Dans le chapitre 1, enlève le paragraphe sur... / Ajoute un chapitre entre le 1 et le 2 sur..."
                    : type === "exercise"
                    ? "Ex : Corrige l'énoncé de la question 2 / Ajoute 2 questions sur..."
                    : "Ex : Change l'option B de la question 1 / Ajoute 3 questions sur..."
                }
                className="w-full min-h-[100px] border border-[rgba(197,161,72,0.25)] rounded-xl text-sm p-3 focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                disabled={loading}
                autoFocus
              />
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
              <Sparkles size={16} />
              Appliquer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
