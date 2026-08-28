"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Calculator,
  FileText,
  ArrowLeft,
  Link as LinkIcon,
  BrainCircuit,
} from "lucide-react";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { useSmoothPercent } from "./useSmoothPercent";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

export interface AIGenerateProgress {
  current: number;
  total: number;
  message: string;
  chapters: string[];
}

export type GenBlockType = "standard" | "qcm" | "fill_in_the_blank" | "matching" | "ordering" | "coding";

// Le type choisi ici détermine RÉELLEMENT le type de bloc généré par l'IA
// (avant, ce champ n'existait pas et l'IA produisait toujours des blocs
// "réponse libre" quel que soit le type d'exercice sélectionné).
export const BLOCK_TYPE_OPTIONS: { value: GenBlockType; label: string; description: string }[] = [
  { value: "standard", label: "Réponse libre", description: "Calcul ou réponse courte, corrigée par IA" },
  { value: "qcm", label: "QCM", description: "Choix parmi plusieurs options (une ou plusieurs bonnes réponses)" },
  { value: "fill_in_the_blank", label: "Texte à trous", description: "Compléter une phrase avec les mots manquants" },
  { value: "matching", label: "Association", description: "Relier des éléments entre eux" },
  { value: "ordering", label: "Mise en ordre", description: "Remettre des éléments dans le bon ordre" },
  { value: "coding", label: "Code / Algo", description: "Écrire un algorithme, corrigé par IA" },
];

export interface ExerciseGenParams {
  exerciseType: "simple" | "contextual";
  blockType: GenBlockType;
  linkedCourseId: string | null;
  linkedCourseTitle: string | null;
  subject: string;
  level: string;
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  subjectArea: string;
  instructions: string;
}

interface ExerciseGeneratorModalProps {
  onGenerate: (params: ExerciseGenParams) => void;
  onClose: () => void;
  progress?: AIGenerateProgress | null;
  /** Niveau scolaire du dossier courant (pré-sélection). */
  defaultLevel?: string;
}

const SUBJECT_AREAS = [
  "Algèbre",
  "Géométrie",
  "Statistiques",
  "Arithmétique",
  "Fonctions",
  "Probabilités",
  "Trigonométrie",
];

export default function ExerciseGeneratorModal({
  onGenerate,
  onClose,
  progress,
  defaultLevel,
}: ExerciseGeneratorModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const smoothPct = useSmoothPercent(progress?.current ?? 0, progress?.total ?? 0, isGenerating);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [params, setParams] = useState<ExerciseGenParams>({
    exerciseType: "simple",
    blockType: "standard",
    linkedCourseId: null,
    linkedCourseTitle: null,
    subject: "",
    level: defaultLevel || "6eme",
    difficulty: "medium",
    questionCount: 5,
    subjectArea: "Algèbre",
    instructions: "",
  });
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/courses?status=published");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setCourses(
          [...data]
            .map((c: any) => ({ id: c.id, title: c.title }))
            .sort((a, b) => a.title.localeCompare(b.title)) as any,
        );
      }
    })();
  }, []);

  const handleTypeSelect = (type: "simple" | "contextual") => {
    setParams((p) => ({ ...p, exerciseType: type }));
    setStep(2);
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1060] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-[rgba(197,161,72,0.25)]">
        {/* Navy hero header */}
        <div className="px-8 py-6 bg-gradient-to-r from-[var(--greek-blue)] to-blue-900 text-white flex justify-between items-center flex-shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pattern-grid-lg pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[var(--greek-gold)]/20 border border-[var(--greek-gold)]/40 flex items-center justify-center">
              <Sparkles className="text-[var(--greek-gold)]" size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold font-[family-name:var(--font-display)]">
                Générer un exercice avec l'IA
              </h2>
              <p className="text-xs text-white/70 mt-0.5">
                {step === 1
                  ? "Étape 1 : choisis le type d'exercice"
                  : "Étape 2 : configure les détails"}
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} variant="dark" />
        </div>

        {/* Body */}
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
                {progress?.message || "Notre IA pédagogique compose ton exercice avec soin."}
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
          ) : step === 1 ? (
            <div className="p-8 space-y-4">
              <p className="text-sm text-gray-600 mb-2">
                Quel type d'exercice veux-tu créer ?
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleTypeSelect("simple")}
                  className="p-6 rounded-2xl border-2 border-[rgba(197,161,72,0.25)] bg-white hover:border-[var(--greek-gold)] hover:shadow-lg transition-all text-left group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[var(--greek-blue)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--greek-blue)] transition-colors">
                    <Calculator
                      className="w-7 h-7 text-[var(--greek-blue)] group-hover:text-[var(--greek-gold)] transition-colors"
                    />
                  </div>
                  <h3 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] text-lg mb-1">
                    Exercice simple
                  </h3>
                  <p className="text-sm text-gray-500">
                    Calculs directs, questions courtes
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeSelect("contextual")}
                  className="p-6 rounded-2xl border-2 border-[rgba(197,161,72,0.25)] bg-white hover:border-[var(--greek-gold)] hover:shadow-lg transition-all text-left group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[var(--greek-blue)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--greek-blue)] transition-colors">
                    <FileText
                      className="w-7 h-7 text-[var(--greek-blue)] group-hover:text-[var(--greek-gold)] transition-colors"
                    />
                  </div>
                  <h3 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] text-lg mb-1">
                    Exercice contextuel
                  </h3>
                  <p className="text-sm text-gray-500">
                    Introduction, mise en situation, problème long
                  </p>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              {/* Linked course */}
              <div>
                <label className="text-sm font-semibold text-[var(--greek-blue)] mb-1.5 flex items-center gap-2">
                  <LinkIcon size={14} />
                  Lier à un cours publié
                </label>
                <select
                  value={params.linkedCourseId || ""}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white"
                >
                  <option value="">Aucun cours lié</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="exercise-gen-subject" className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">
                  Sujet / thème
                </label>
                <input
                  id="exercise-gen-subject"
                  type="text"
                  required
                  value={params.subject}
                  onChange={(e) =>
                    setParams({ ...params, subject: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white"
                  placeholder="Ex: Les équations du premier degré"
                />
              </div>

              {/* Type de question générée */}
              <div>
                <label className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">
                  Type de question
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BLOCK_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.description}
                      onClick={() => setParams({ ...params, blockType: opt.value })}
                      style={{
                        background: params.blockType === opt.value ? "var(--greek-blue)" : "#fff",
                        color: params.blockType === opt.value ? "#fff" : "var(--greek-blue)",
                        borderColor: params.blockType === opt.value ? "var(--greek-blue)" : "rgba(197,161,72,0.25)",
                      }}
                      className="px-3 py-2.5 text-xs font-bold rounded-xl border-2 transition-all text-left"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">
                    Domaine
                  </label>
                  <select
                    value={params.subjectArea}
                    onChange={(e) =>
                      setParams({ ...params, subjectArea: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                  >
                    {SUBJECT_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
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
                  max={10}
                  value={params.questionCount}
                  onChange={(e) =>
                    setParams({
                      ...params,
                      questionCount: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-[var(--greek-blue)]"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>3</span>
                  <span>10</span>
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
                  placeholder="Ex: Inclure des fractions, axé sur la résolution graphique..."
                />
              </div>

              {fieldError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {fieldError}
                </div>
              )}

              <div className="flex justify-between gap-3 pt-2">
                <GlassButton size="sm" variant="outline" onClick={() => setStep(1)} className="gap-2">
                  <ArrowLeft size={16} />
                  Retour
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
