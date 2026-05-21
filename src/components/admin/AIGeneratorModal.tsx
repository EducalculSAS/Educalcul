"use client";

import { useState } from "react";
import { Sparkles, XCircle, Loader2, BookOpen, BrainCircuit, Target, Settings2, FileText } from "lucide-react";
import { SCHOOL_LEVELS } from "@/lib/constants";

interface AIGeneratorModalProps {
  type: "course" | "exercise" | "quiz";
  onGenerate: (params: {
    topic: string;
    level: string;
    count: number;
    difficulty: string;
    instructions: string;
  }) => void;
  onClose: () => void;
}

export default function AIGeneratorModal({ type, onGenerate, onClose }: AIGeneratorModalProps) {
  const [params, setParams] = useState({
    topic: "",
    level: "6eme",
    count: type === "course" ? 2 : 5,
    difficulty: "medium",
    instructions: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.topic.trim()) {
      alert("Veuillez entrer un sujet.");
      return;
    }
    if (params.count < 1 || params.count > 50) {
      alert("Le nombre doit être compris entre 1 et 50.");
      return;
    }
    
    setIsGenerating(true);
    onGenerate(params);
    // Note: The parent component should handle setting isGenerating to false and closing the modal
    // typically by passing down a completely fresh instance or handling state externally. 
    // If onGenerate is async, we could await it here, but usually it's handled by parent.
  };

  const getTitle = () => {
    switch (type) {
      case "course": return "Générateur de Cours IA";
      case "exercise": return "Générateur d'Exercices IA";
      case "quiz": return "Générateur de Quiz IA";
    }
  };

  const getCountLabel = () => {
    switch (type) {
      case "course": return "Nombre de chapitres";
      case "exercise": return "Nombre d'approches/questions";
      case "quiz": return "Nombre de questions";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-[var(--greek-gold)]/15 bg-gradient-to-r from-[var(--greek-blue)] to-blue-800 text-white flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Sparkles className="text-amber-300" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold font-[family-name:var(--font-display)] tracking-wide">
                {getTitle()}
              </h3>
              <p className="text-blue-100 text-sm opacity-90">
                Créez du contenu pédagogique sur mesure en quelques secondes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full relative z-10"
          >
            <XCircle size={24} />
          </button>
        </div>

        {/* Loading Overlay */}
        {isGenerating ? (
          <div className="p-12 flex flex-col items-center justify-center min-h-[400px] bg-gray-50">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-[var(--greek-blue)] opacity-20 blur-xl rounded-full animate-pulse"></div>
              <BrainCircuit size={64} className="text-[var(--greek-blue)] relative z-10 animate-bounce" />
            </div>
            <h4 className="text-xl font-bold text-gray-800 mb-2">Création en cours...</h4>
            <p className="text-gray-500 text-center max-w-md">
              Notre IA pédagogique est en train de concevoir le contenu parfait pour vos élèves. Cela peut prendre quelques instants.
            </p>
            <div className="mt-8 flex gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--greek-gold)] animate-ping" style={{ animationDelay: "0ms" }}></span>
              <span className="w-3 h-3 rounded-full bg-[var(--greek-gold)] animate-ping" style={{ animationDelay: "150ms" }}></span>
              <span className="w-3 h-3 rounded-full bg-[var(--greek-gold)] animate-ping" style={{ animationDelay: "300ms" }}></span>
            </div>
          </div>
        ) : (
          /* Form Content */
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            
            {/* Subject Input */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <BookOpen size={16} className="text-[var(--greek-blue)]" />
                Sujet de la leçon
              </label>
              <input
                type="text"
                required
                value={params.topic}
                onChange={(e) => setParams({ ...params, topic: e.target.value })}
                placeholder="Ex: Les fractions, Le théorème de Pythagore, Les volcans..."
                className="w-full px-5 py-3 border border-[var(--greek-gold)]/25 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/50 focus:border-[var(--greek-blue)] transition-all font-medium text-gray-800 placeholder:font-normal placeholder:text-gray-400"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Level Input */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <Target size={16} className="text-[var(--greek-blue)]" />
                  Niveau scolaire
                </label>
                <div className="relative">
                  <select
                    value={params.level}
                    onChange={(e) => setParams({ ...params, level: e.target.value })}
                    className="w-full px-5 py-3 border border-[var(--greek-gold)]/25 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/50 focus:border-[var(--greek-blue)] transition-all appearance-none font-medium text-gray-800"
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
              </div>

              {/* Count Input */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <Settings2 size={16} className="text-[var(--greek-blue)]" />
                  {getCountLabel()}
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={params.count}
                  onChange={(e) => setParams({ ...params, count: parseInt(e.target.value) || 1 })}
                  className="w-full px-5 py-3 border border-[var(--greek-gold)]/25 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/50 focus:border-[var(--greek-blue)] transition-all font-medium text-gray-800"
                />
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <Target size={16} className="text-[var(--greek-blue)]" />
                Niveau de difficulté
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "easy", label: "Facile", color: "green" },
                  { id: "medium", label: "Moyen", color: "blue" },
                  { id: "hard", label: "Difficile", color: "red" }
                ].map((diff) => (
                  <button
                    key={diff.id}
                    type="button"
                    onClick={() => setParams({ ...params, difficulty: diff.id })}
                    className={`
                      py-3 px-4 rounded-xl border-2 font-semibold transition-all flex items-center justify-center
                      ${params.difficulty === diff.id 
                        ? `border-${diff.color}-500 bg-${diff.color}-50 text-${diff.color}-700 shadow-sm` 
                        : "border-[var(--greek-gold)]/15 bg-white text-gray-500 hover:border-[var(--greek-gold)]/25 hover:bg-gray-50"}
                    `}
                  >
                    {diff.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Instructions */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <FileText size={16} className="text-[var(--greek-blue)]" />
                Instructions supplémentaires <span className="text-gray-400 font-normal">(Optionnel)</span>
              </label>
              <textarea
                value={params.instructions}
                onChange={(e) => setParams({ ...params, instructions: e.target.value })}
                rows={3}
                placeholder="Ex: Insister sur des exemples pratiques dans la vie quotidienne, adopter un ton ludique et encourageant..."
                className="w-full px-5 py-3 border border-[var(--greek-gold)]/25 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/50 focus:border-[var(--greek-blue)] transition-all text-gray-800 resize-none"
              />
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t border-[var(--greek-gold)]/15">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 hover:text-gray-900 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-8 py-3 font-semibold bg-gradient-to-r from-[var(--greek-gold)] to-yellow-600 text-white rounded-xl hover:shadow-lg hover:shadow-yellow-600/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
              >
                <Sparkles size={18} />
                Générer le contenu
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
