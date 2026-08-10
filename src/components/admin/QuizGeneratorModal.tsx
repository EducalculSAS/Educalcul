"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  X,
  Link as LinkIcon,
  BrainCircuit,
} from "lucide-react";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { supabase } from "@/lib/supabaseClient";
import { useSmoothPercent } from "./useSmoothPercent";
import type { AIGenerateProgress } from "./ExerciseGeneratorModal";
import GlassButton from "@/components/ui/GlassButton";

export interface QuizGenParams {
  linkedCourseId: string | null;
  linkedCourseTitle: string | null;
  subject: string;
  level: string;
  questionCount: number;
  difficulty: "easy" | "medium" | "hard";
  instructions: string;
}

interface QuizGeneratorModalProps {
  onGenerate: (params: QuizGenParams) => void;
  onClose: () => void;
  progress?: AIGenerateProgress | null;
  /** Niveau scolaire du dossier courant (pré-sélection). */
  defaultLevel?: string;
}

export default function QuizGeneratorModal({
  onGenerate,
  onClose,
  progress,
  defaultLevel,
}: QuizGeneratorModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const smoothPct = useSmoothPercent(progress?.current ?? 0, progress?.total ?? 0, isGenerating);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [params, setParams] = useState<QuizGenParams>({
    linkedCourseId: null,
    linkedCourseTitle: null,
    subject: "",
    level: defaultLevel || "6eme",
    questionCount: 7,
    difficulty: "medium",
    instructions: "",
  });
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title")
        .eq("status", "published")
        .order("title");
      if (data) setCourses(data as any);
    })();
  }, []);

  const handleCourseChange = (id: string) => {
    if (!id) {
      setParams((p) => ({ ...p, linkedCourseId: null, linkedCourseTitle: null }));
    } else {
      const c = courses.find((c) => c.id === id);
      setParams((p) => ({
        ...p,
        linkedCourseId: id,
        linkedCourseTitle: c?.title || null,
        subject: p.subject || c?.title || "",
      }));
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!params.subject.trim()) {
      setFieldError("Veuillez entrer un sujet.");
      return;
    }
    setFieldError(null);
    setIsGenerating(true);
    onGenerate(params);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1060] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-[rgba(197,161,72,0.25)]">
        {/* Navy hero header */}
        <div className="px-8 py-6 bg-gradient-to-r from-[var(--greek-blue)] to-blue-900 text-white flex justify-between items-center flex-shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pattern-grid-lg pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[var(--greek-gold)]/20 border border-[var(--greek-gold)]/40 flex items-center justify-center">
              <BrainCircuit className="text-[var(--greek-gold)]" size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold font-[family-name:var(--font-display)]">
                Générer un quiz avec l'IA
              </h2>
              <p className="text-xs text-white/70 mt-0.5">
                QCM adapté au niveau de l'élève
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="group p-2 transition-colors text-white/70 hover:text-white relative z-10"
          >
            <X size={22} className="transition-transform group-hover:scale-125" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isGenerating ? (
            <div className="p-12 flex flex-col items-center justify-center min-h-[400px] bg-gray-50">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-[var(--greek-blue)] opacity-20 blur-xl rounded-full animate-pulse" />
                <BrainCircuit size={64} className="text-[var(--greek-blue)] relative z-10 animate-bounce" />
              </div>
              <h4 className="text-xl font-bold text-gray-800 mb-2 font-[family-name:var(--font-display)]">
                Création en cours...
              </h4>
              <p className="text-gray-500 text-center max-w-md mb-6">
                {progress?.message || "Notre IA pédagogique compose ton quiz avec soin."}
              </p>

              {progress && progress.total > 0 && (
                <div className="w-full max-w-md">
                  <div className="flex justify-between text-xs font-bold text-[var(--greek-blue)] mb-1.5">
                    <span>Progression</span>
                    <span>{Math.round(smoothPct)}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(3, smoothPct)}%`,
                        background: "linear-gradient(to right, var(--greek-blue), var(--greek-gold))",
                      }}
                    />
                  </div>

                  {progress.chapters.length > 0 && (
                    <ul className="mt-5 space-y-1.5 text-left">
                      {progress.chapters.map((title, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs flex-shrink-0">
                            ✓
                          </span>
                          <span className="truncate">{title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-8 flex gap-2">
                <span className="w-3 h-3 rounded-full bg-[var(--greek-gold)] animate-ping" style={{ animationDelay: "0ms" }} />
                <span className="w-3 h-3 rounded-full bg-[var(--greek-gold)] animate-ping" style={{ animationDelay: "150ms" }} />
                <span className="w-3 h-3 rounded-full bg-[var(--greek-gold)] animate-ping" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <label className="text-sm font-semibold text-[var(--greek-blue)] mb-1.5 flex items-center gap-2">
                  <LinkIcon size={14} />
                  Lier à un cours publié
                </label>
                <select
                  value={params.linkedCourseId || ""}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                >
                  <option value="">Aucun cours lié</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">
                  Sujet
                </label>
                <input
                  type="text"
                  required
                  value={params.subject}
                  onChange={(e) =>
                    setParams({ ...params, subject: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                  placeholder="Ex: Théorème de Pythagore"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">
                  Niveau scolaire
                </label>
                <select
                  value={params.level}
                  onChange={(e) =>
                    setParams({ ...params, level: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                >
                  {SCHOOL_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">
                  Difficulté
                </label>
                <div className="flex gap-2">
                  {[
                    { v: "easy", l: "Facile" },
                    { v: "medium", l: "Moyen" },
                    { v: "hard", l: "Difficile" },
                  ].map((d) => (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() =>
                        setParams({
                          ...params,
                          difficulty: d.v as "easy" | "medium" | "hard",
                        })
                      }
                      style={{
                        background:
                          params.difficulty === d.v
                            ? "var(--greek-blue)"
                            : "#fff",
                        color:
                          params.difficulty === d.v
                            ? "#fff"
                            : "var(--greek-blue)",
                        borderColor:
                          params.difficulty === d.v
                            ? "var(--greek-blue)"
                            : "rgba(197,161,72,0.25)",
                      }}
                      className="flex-1 py-2.5 text-sm font-bold rounded-xl border-2 transition-all"
                    >
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">
                  Nombre de questions : {params.questionCount}
                </label>
                <input
                  type="range"
                  min={3}
                  max={15}
                  value={params.questionCount}
                  onChange={(e) =>
                    setParams({
                      ...params,
                      questionCount: parseInt(e.target.value),
                    })
                  }
                  aria-label={`Nombre de questions : ${params.questionCount}`}
                  className="w-full accent-[var(--greek-blue)]"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>3</span>
                  <span>15</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">
                  Instructions supplémentaires (optionnel)
                </label>
                <textarea
                  rows={3}
                  value={params.instructions}
                  onChange={(e) =>
                    setParams({ ...params, instructions: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white resize-none"
                  placeholder="Ex: Inclure des pièges classiques, axé sur la mémorisation..."
                />
              </div>

              {fieldError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {fieldError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <GlassButton size="sm" variant="ghost" onClick={onClose}>
                  Annuler
                </GlassButton>
                <GlassButton size="sm" variant="navy" onClick={() => handleSubmit()} className="gap-2">
                  <Sparkles size={16} />
                  Générer
                </GlassButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
