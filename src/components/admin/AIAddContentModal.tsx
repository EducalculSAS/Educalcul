"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Plus } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import PageLoader from "@/components/PageLoader";
import { useSmoothPercent } from "./useSmoothPercent";
import type { Chapter, Lesson } from "./CourseBuilder";

/**
 * Modale "Ajouter du contenu avec l'IA" : demande QUOI créer (chapitre ou
 * leçon) et surtout OÙ l'insérer, puis génère et place le nouvel élément.
 */
export default function AIAddContentModal({
  level,
  chapters,
  courseTitle,
  onAddChapter,
  onAddLesson,
  onClose,
}: {
  level?: string;
  chapters: Chapter[];
  courseTitle?: string;
  onAddChapter: (chapter: Chapter, position: string) => void;
  onAddLesson: (lesson: Lesson, chapterId: string, position: string) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"chapter" | "lesson">(chapters.length === 0 ? "chapter" : "lesson");
  const [targetChapterId, setTargetChapterId] = useState<string>(chapters[0]?.id || "");
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

  // Quand on change de cible/type, on remet la position à "fin".
  useEffect(() => {
    setPosition("end");
  }, [kind, targetChapterId]);

  const targetChapter = chapters.find((c) => c.id === targetChapterId);
  const lessonsOfTarget = targetChapter?.lessons || [];

  const handleApply = async () => {
    if (!instruction.trim() || loading) return;
    if (kind === "lesson" && !targetChapterId) {
      setError("Choisis le chapitre où ajouter la leçon.");
      return;
    }
    setLoading(true);
    setDone(false);
    setError("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const type = kind === "chapter" ? "add_chapter" : "add_lesson";
      const ctx =
        kind === "chapter"
          ? { courseTitle }
          : { courseTitle, chapterTitle: targetChapter?.title };

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

      if (kind === "chapter") {
        // Ids uniques côté client pour éviter toute collision.
        const ch: Chapter = {
          ...data.item,
          id: crypto.randomUUID(),
          title: data.item.title || "Nouveau chapitre",
          lessons: (data.item.lessons || []).map((l: any) => ({
            ...l,
            id: crypto.randomUUID(),
            type: l.type || "text",
            duration: l.duration || 5,
          })),
        };
        onAddChapter(ch, position);
      } else {
        const ls: Lesson = {
          ...data.item,
          id: crypto.randomUUID(),
          title: data.item.title || "Nouvelle leçon",
          type: data.item.type || "text",
          content: data.item.content || "",
          duration: data.item.duration || 5,
        };
        onAddLesson(ls, targetChapterId, position);
      }
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1060] p-4 backdrop-blur-sm modal-overlay">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-[var(--greek-blue)] to-blue-600 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-lg">Ajouter du contenu avec l'IA</h3>
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
                {done ? "Terminé !" : kind === "chapter" ? "Création du chapitre..." : "Création de la leçon..."}
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
              {/* Quoi créer */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Que veux-tu ajouter ?
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setKind("lesson")}
                    disabled={chapters.length === 0}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 ${
                      kind === "lesson"
                        ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]"
                        : "bg-white text-gray-600 border-[rgba(197,161,72,0.3)] hover:bg-gray-50"
                    }`}
                  >
                    Une leçon
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind("chapter")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      kind === "chapter"
                        ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]"
                        : "bg-white text-gray-600 border-[rgba(197,161,72,0.3)] hover:bg-gray-50"
                    }`}
                  >
                    Un chapitre
                  </button>
                </div>
              </div>

              {/* Où l'insérer */}
              {kind === "lesson" && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Dans quel chapitre ?
                  </label>
                  <select value={targetChapterId} onChange={(e) => setTargetChapterId(e.target.value)} className={selectCls}>
                    {chapters.map((c, i) => (
                      <option key={c.id} value={c.id}>
                        {`Ch. ${i + 1}${c.title ? ` : ${c.title}` : ""}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Position
                </label>
                <select value={position} onChange={(e) => setPosition(e.target.value)} className={selectCls}>
                  <option value="start">Au début</option>
                  <option value="end">À la fin</option>
                  {kind === "chapter"
                    ? chapters.map((c, i) => (
                        <option key={c.id} value={c.id}>
                          {`Après le chapitre ${i + 1}${c.title ? ` : ${c.title}` : ""}`}
                        </option>
                      ))
                    : lessonsOfTarget.map((l, i) => (
                        <option key={l.id} value={l.id}>
                          {`Après la leçon ${i + 1}${l.title ? ` : ${l.title}` : ""}`}
                        </option>
                      ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Contenu à créer
                </label>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder={
                    kind === "chapter"
                      ? "Ex : Un chapitre sur les fractions : définition, simplification, addition..."
                      : "Ex : Une leçon sur l'addition de fractions de même dénominateur, avec exemples."
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
