"use client";

import { useState } from "react";
import { Sparkles, Loader2, X } from "lucide-react";

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

  const key = type === "course" ? "chapters" : type === "exercise" ? "pages" : "questions";

  const handleApply = async () => {
    if (!instruction.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, instruction, content, level }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de modification");
      onApply(data[key]);
      onClose();
    } catch (e: any) {
      setError(e.message || "Erreur de modification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1060] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-[var(--greek-blue)] to-blue-600 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-lg">Modifier avec l'IA</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3">
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
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="p-4 border-t border-[rgba(197,161,72,0.25)] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border border-[rgba(197,161,72,0.3)] text-gray-600 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={loading || !instruction.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--greek-blue)] text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? "Application en cours..." : "Appliquer"}
          </button>
        </div>
      </div>
    </div>
  );
}
