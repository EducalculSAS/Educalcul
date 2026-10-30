"use client";

import { useState } from "react";
import { useSubjectAreas } from "@/lib/useSubjectAreas";
import { Sparkles, XCircle, BookOpen, BrainCircuit, Target, Settings2, FileText, Layers, GraduationCap, Clock, ListChecks, Sliders, Check } from "lucide-react";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { useSmoothPercent } from "./useSmoothPercent";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

export interface AIGenerateParams {
  topic: string;
  level: string;
  count: number;
  difficulty: string;
  instructions: string;
  lessonsPerChapter: number;
  contentStyle: "balanced" | "theory_heavy" | "practice_heavy";
  includeExercises: boolean;
  languageLevel: "simple" | "standard" | "academic";
  subjectArea: string;
  durationPerLesson: number;
}

export interface AIGenerateProgress {
  current: number;
  total: number;
  message: string;
  chapters: string[];
}

interface AIGeneratorModalProps {
  type: "course" | "exercise" | "quiz";
  onGenerate: (params: AIGenerateParams) => void;
  onClose: () => void;
  progress?: AIGenerateProgress | null;
  /** Niveau scolaire du dossier courant (pré-sélection). */
  defaultLevel?: string;
}

// Carte d'un groupe de champs. DÉFINIE AU NIVEAU MODULE (pas dans le composant) :
// sinon elle est recréée à chaque frappe → React remonte le sous-arbre → perte
// du focus et retour en haut du formulaire.
function Card({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-[var(--greek-gold)]/40 transition-colors">
      <label className="flex items-center gap-2 text-xs font-bold text-[var(--greek-blue)] uppercase tracking-wider mb-3">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}


const DURATIONS = [20, 30, 45, 60];

export default function AIGeneratorModal({ type, onGenerate, onClose, progress, defaultLevel }: AIGeneratorModalProps) {
  const { areas: subjectAreas } = useSubjectAreas();
  const [params, setParams] = useState<AIGenerateParams>({
    topic: "",
    level: defaultLevel || "6eme",
    count: type === "course" ? 2 : 5,
    difficulty: "medium",
    instructions: "",
    lessonsPerChapter: 3,
    contentStyle: "balanced",
    includeExercises: true,
    languageLevel: "standard",
    subjectArea: "Algèbre",
    durationPerLesson: 30,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const smoothPct = useSmoothPercent(progress?.current ?? 0, progress?.total ?? 0, isGenerating);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!params.topic.trim()) {
      setFieldError("Veuillez entrer un sujet.");
      return;
    }
    if (params.count < 1 || params.count > 50) {
      setFieldError("Le nombre doit être compris entre 1 et 50.");
      return;
    }
    if (params.lessonsPerChapter < 2 || params.lessonsPerChapter > 4) {
      setFieldError("Le nombre de leçons par chapitre doit être entre 2 et 4.");
      return;
    }
    setFieldError(null);
    setIsGenerating(true);
    onGenerate(params);
  };

  const getTitle = () => {
    switch (type) {
      case "course":
        return "Générateur de Cours IA";
      case "exercise":
        return "Générateur d'Exercices IA";
      case "quiz":
        return "Générateur de Quiz IA";
    }
  };

  const getCountLabel = () => {
    switch (type) {
      case "course":
        return "Nombre de chapitres";
      case "exercise":
        return "Nombre d'approches/questions";
      case "quiz":
        return "Nombre de questions";
    }
  };

  const navy = "var(--greek-blue)";
  const gold = "var(--greek-gold)";

  const difficultyOptions = [
    { id: "easy", label: "Facile", color: "#10b981" },
    { id: "medium", label: "Moyen", color: "#3b82f6" },
    { id: "hard", label: "Difficile", color: "#ef4444" },
  ];

  const contentStyleOptions: { id: AIGenerateParams["contentStyle"]; label: string; desc: string }[] = [
    { id: "balanced", label: "Équilibré", desc: "Théorie + pratique" },
    { id: "theory_heavy", label: "Théorique", desc: "Cours magistral" },
    { id: "practice_heavy", label: "Pratique", desc: "Exemples & exos" },
  ];

  const languageLevelOptions: { id: AIGenerateParams["languageLevel"]; label: string }[] = [
    { id: "simple", label: "Simple" },
    { id: "standard", label: "Standard" },
    { id: "academic", label: "Académique" },
  ];

  return (
    <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 modal-overlay">
      <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200">
        {/* Header */}
        <div
          className="px-8 py-6 text-white flex justify-between items-center relative overflow-hidden flex-shrink-0"
          style={{
            background:
              "linear-gradient(to right, var(--greek-blue), #1e3a8a)",
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
              <Sparkles className="text-[var(--greek-gold)]" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold font-[family-name:var(--font-display)] tracking-wide">
                {getTitle()}
              </h3>
              <p className="text-blue-100 text-sm opacity-90">
                Configurez chaque détail du contenu pédagogique
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} variant="dark" />
        </div>

        {/* Loading Overlay */}
        {isGenerating ? (
          <div className="p-12 flex flex-col items-center justify-center min-h-[400px] bg-gray-50 flex-1">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-[var(--greek-blue)] opacity-20 blur-xl rounded-full animate-pulse" />
              <BrainCircuit size={64} className="text-[var(--greek-blue)] relative z-10 animate-bounce" />
            </div>
            <h4 className="text-xl font-bold text-gray-800 mb-2 font-[family-name:var(--font-display)]">
              Création en cours...
            </h4>
            <p className="text-gray-500 text-center max-w-md mb-6">
              {progress?.message || "Notre IA pédagogique compose votre cours avec soin. Cela peut prendre quelques minutes."}
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
                          <Check className="w-3 h-3" aria-hidden="true" />
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
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-6 md:p-8 space-y-6">
              {fieldError && (
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border"
                  style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}
                >
                  <XCircle size={16} style={{ color: "#dc2626" }} className="shrink-0" />
                  {fieldError}
                </div>
              )}

              {/* Topic — full width */}
              <Card icon={<BookOpen size={14} />} label="Sujet de la leçon">
                <input
                  type="text"
                  required
                  value={params.topic}
                  onChange={(e) => setParams({ ...params, topic: e.target.value })}
                  placeholder="Ex: Les fractions, Le théorème de Pythagore..."
                  className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/30 focus:border-[var(--greek-blue)] transition-all font-medium text-gray-800 placeholder:text-gray-400"
                  autoFocus
                  aria-label="Sujet de la leçon"
                />
              </Card>

              {/* 2-column grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Level */}
                <Card icon={<GraduationCap size={14} />} label="Niveau scolaire">
                  <div className="relative">
                    <select
                      value={params.level}
                      onChange={(e) => setParams({ ...params, level: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/30 transition-all appearance-none font-medium text-gray-800"
                      aria-label="Niveau scolaire"
                    >
                      {SCHOOL_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      ▼
                    </div>
                  </div>
                </Card>

                {/* Subject area */}
                <Card icon={<Layers size={14} />} label="Domaine mathématique">
                  <div className="relative">
                    <select
                      value={params.subjectArea}
                      onChange={(e) => setParams({ ...params, subjectArea: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/30 transition-all appearance-none font-medium text-gray-800"
                      aria-label="Domaine mathématique"
                    >
                      {subjectAreas.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      ▼
                    </div>
                  </div>
                </Card>

                {/* Count (chapters) */}
                <Card icon={<Settings2 size={14} />} label={getCountLabel()}>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={params.count}
                    onChange={(e) =>
                      setParams({ ...params, count: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/30 transition-all font-medium text-gray-800"
                    aria-label={getCountLabel()}
                  />
                </Card>

                {/* Lessons per chapter */}
                <Card icon={<ListChecks size={14} />} label="Leçons par chapitre">
                  <input
                    type="number"
                    min={2}
                    max={4}
                    required
                    value={params.lessonsPerChapter}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        lessonsPerChapter: parseInt(e.target.value) || 3,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/30 transition-all font-medium text-gray-800"
                    aria-label="Nombre de leçons par chapitre"
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5">Entre 2 et 4 leçons</p>
                </Card>

                {/* Duration per lesson */}
                <Card icon={<Clock size={14} />} label="Durée par leçon">
                  <div className="grid grid-cols-4 gap-1.5">
                    {DURATIONS.map((d) => {
                      const active = params.durationPerLesson === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setParams({ ...params, durationPerLesson: d })}
                          className="py-2 text-xs font-bold rounded-lg border-2 transition-all"
                          style={{
                            background: active ? navy : "#fff",
                            color: active ? "#fff" : "#6b7280",
                            borderColor: active ? navy : "#e5e7eb",
                          }}
                        >
                          {d}min
                        </button>
                      );
                    })}
                  </div>
                </Card>

                {/* Language level */}
                <Card icon={<Sliders size={14} />} label="Niveau de langue">
                  <div className="grid grid-cols-3 gap-1.5">
                    {languageLevelOptions.map((opt) => {
                      const active = params.languageLevel === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setParams({ ...params, languageLevel: opt.id })
                          }
                          className="py-2 text-xs font-bold rounded-lg border-2 transition-all"
                          style={{
                            background: active ? navy : "#fff",
                            color: active ? "#fff" : "#6b7280",
                            borderColor: active ? navy : "#e5e7eb",
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Difficulty (full width) */}
              <Card icon={<Target size={14} />} label="Niveau de difficulté">
                <div className="grid grid-cols-3 gap-2">
                  {difficultyOptions.map((diff) => {
                    const active = params.difficulty === diff.id;
                    return (
                      <button
                        key={diff.id}
                        type="button"
                        onClick={() => setParams({ ...params, difficulty: diff.id })}
                        className="py-2.5 px-4 rounded-xl border-2 font-semibold transition-all text-sm"
                        style={{
                          background: active ? `${diff.color}15` : "#fff",
                          color: active ? diff.color : "#9ca3af",
                          borderColor: active ? diff.color : "#e5e7eb",
                          boxShadow: active ? `0 1px 2px ${diff.color}20` : "none",
                        }}
                      >
                        {diff.label}
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* Content style (full width) */}
              <Card icon={<BrainCircuit size={14} />} label="Style de contenu">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {contentStyleOptions.map((opt) => {
                    const active = params.contentStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setParams({ ...params, contentStyle: opt.id })}
                        className="py-3 px-4 rounded-xl border-2 transition-all text-left"
                        style={{
                          background: active ? `${gold}15` : "#fff",
                          borderColor: active ? gold : "#e5e7eb",
                        }}
                      >
                        <div
                          className="font-bold text-sm"
                          style={{ color: active ? "var(--greek-blue)" : "#6b7280" }}
                        >
                          {opt.label}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {opt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* Include exercises toggle */}
              <Card icon={<ListChecks size={14} />} label="Mini-exercices interactifs">
                <button
                  type="button"
                  onClick={() =>
                    setParams({ ...params, includeExercises: !params.includeExercises })
                  }
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all"
                  style={{
                    background: params.includeExercises ? `${gold}15` : "#f9fafb",
                    borderColor: params.includeExercises ? gold : "#e5e7eb",
                  }}
                >
                  <span
                    className="font-medium text-sm"
                    style={{
                      color: params.includeExercises ? "var(--greek-blue)" : "#6b7280",
                    }}
                  >
                    Inclure 2-3 mini-exercices par leçon
                  </span>
                  <div
                    className="w-12 h-6 rounded-full relative transition-colors"
                    style={{
                      background: params.includeExercises ? gold : "#d1d5db",
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                      style={{
                        left: params.includeExercises ? "26px" : "2px",
                      }}
                    />
                  </div>
                </button>
              </Card>

              {/* Additional Instructions */}
              <Card icon={<FileText size={14} />} label="Instructions supplémentaires (optionnel)">
                <textarea
                  value={params.instructions}
                  onChange={(e) => setParams({ ...params, instructions: e.target.value })}
                  rows={3}
                  placeholder="Ex: Insister sur des exemples concrets, adopter un ton ludique..."
                  className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/30 focus:border-[var(--greek-blue)] transition-all text-gray-800 resize-none"
                  aria-label="Instructions supplémentaires"
                />
              </Card>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 md:px-8 py-5 border-t border-gray-200 bg-gray-50 sticky bottom-0">
              <GlassButton size="sm" variant="ghost" onClick={onClose}>
                Annuler
              </GlassButton>
              <GlassButton size="sm" variant="navy" onClick={() => handleSubmit()} className="gap-2">
                <Sparkles size={18} />
                Générer le contenu
              </GlassButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
