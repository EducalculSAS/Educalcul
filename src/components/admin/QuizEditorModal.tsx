"use client";
/* eslint-disable @next/next/no-img-element -- extrait d'un composant qui affiche des images à adresse libre */
import { BrainCircuit, XCircle, ImageIcon, Eye, Loader2 } from "lucide-react";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import CourseSelect from "@/components/admin/CourseSelect";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { getLevelLabel, SCHOOL_LEVELS } from "@/lib/constants";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import QuizBuilder from "@/components/admin/QuizBuilder";
import GlassButton from "@/components/ui/GlassButton";
import { openPreviewLoadingWindow } from "@/lib/openPreviewWindow";
import { type Loose } from "@/types/loose";
import { type Quiz, type Course, type QuizFolder } from "@/components/admin/AdminQuizzesClient";

import { type Question } from "@/components/admin/QuizBuilder";

type QuizEditorModalProps = {
  editingQuiz: Quiz | null;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  formData: { title: string; description: string; course_id: string; folder_id: string | number; time_limit_minutes: number; min_score_percent: number; difficulty_level: string; type: string; level: string; grading_type: string; max_attempts: number; status: string; thumbnail_filename: string; content_json: Question[]; };
  setFormData: React.Dispatch<React.SetStateAction<{ title: string; description: string; course_id: string; folder_id: string | number; time_limit_minutes: number; min_score_percent: number; difficulty_level: string; type: string; level: string; grading_type: string; max_attempts: number; status: string; thumbnail_filename: string; content_json: Question[]; }>>;
  courses: Course[];
  folders: QuizFolder[];
  uploading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  currentFolderLevel: string | null;
  quizEstimatedTime: number;
  setQuizEstimatedTime: React.Dispatch<React.SetStateAction<number>>;
  handlePreview: (quiz: Quiz, win?: Window | null) => Promise<void>;
  isSubmitting: boolean;
};

export default function QuizEditorModal(props: QuizEditorModalProps) {
  const { editingQuiz, setIsModalOpen, handleSubmit, formData, setFormData, courses, folders, uploading, handleFileUpload, currentFolderLevel, quizEstimatedTime, setQuizEstimatedTime, handlePreview, isSubmitting } = props;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1060] p-4 modal-overlay">
    <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 border-b border-[rgba(197,161,72,0.25)] bg-gradient-to-r from-[var(--greek-blue)] to-blue-800 text-white flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <BrainCircuit size={22} className="text-[var(--greek-gold)]" />
          <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">
            {editingQuiz ? "Modifier le quiz" : "Nouveau quiz"}
          </h2>
        </div>
        <GlassCloseButton variant="dark" onClick={() => setIsModalOpen(false)} />
      </div>
  
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {/* Section 1: Informations */}
          <div className="p-6 border-b border-[rgba(197,161,72,0.25)]">
            <h3 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">1</span>
              Informations générales
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Titre du quiz</label>
                <input
                  type="text" required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-gray-50 font-medium"
                  placeholder="Ex: Les équations du second degré"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cours associé</label>
                  <CourseSelect value={formData.course_id} onChange={(id) => setFormData({ ...formData, course_id: id })} courses={courses} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Dossier</label>
                  <select
                    value={formData.folder_id}
                    onChange={(e) => setFormData({ ...formData, folder_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-gray-50"
                  >
                    <option value="">Racine</option>
                    {folders.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-gray-50 resize-none"
                  placeholder="Description du quiz..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Image miniature</label>
                {formData.thumbnail_filename ? (
                  <div className="relative w-full h-20 bg-gray-100 rounded-lg overflow-hidden border border-[rgba(197,161,72,0.25)] mb-2">
                    <img
                      src={`/uploads/quiz_thumbnails/${formData.thumbnail_filename}`}
                      alt="Aperçu"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 right-1.5">
                      <GlassIconButton
                        icon={XCircle}
                        size="sm"
                        color="red"
                        onClick={() => setFormData({ ...formData, thumbnail_filename: "" })}
                        aria-label="Supprimer l'image"
                      />
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors text-sm font-medium border border-dashed border-[rgba(197,161,72,0.25)]">
                    <ImageIcon size={16} />
                    {uploading ? "Upload..." : "Choisir une image"}
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </div>
  
          {/* Section 2: Paramètres pédagogiques */}
          <div className="p-6 border-b border-[rgba(197,161,72,0.25)] bg-gray-50/50">
            <h3 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">2</span>
              Paramètres pédagogiques
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Niveau scolaire</label>
                {!editingQuiz && currentFolderLevel ? (
                  <div className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl bg-blue-50 font-semibold text-[var(--greek-blue)]">
                    {getLevelLabel(currentFolderLevel)}
                  </div>
                ) : (
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white font-semibold"
                >
                  {SCHOOL_LEVELS.map((level) => (<option key={level.value} value={level.value}>{level.label}</option>))}
                </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Difficulté</label>
                <GlassSegmentedControl
                  size="sm"
                  options={[
                    { id: "easy", label: "Facile" },
                    { id: "medium", label: "Moyen" },
                    { id: "hard", label: "Difficile" },
                  ]}
                  value={formData.difficulty_level}
                  onChange={(v) => setFormData({ ...formData, difficulty_level: v })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Durée estimée</label>
                <select
                  value={quizEstimatedTime}
                  onChange={(e) => setQuizEstimatedTime(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white font-semibold"
                >
                  {[5, 10, 15, 20, 30, 45, 60, 90].map((m) => (<option key={m} value={m}>{m} min</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Statut</label>
                <GlassSegmentedControl
                  size="sm"
                  options={[
                    { id: "draft", label: "Brouillon" },
                    { id: "published", label: "Publié" },
                    { id: "archived", label: "Archivé" },
                  ]}
                  value={formData.status}
                  onChange={(v) => setFormData({ ...formData, status: v as "draft" | "published" | "archived" })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Correction</label>
                <select
                  value={formData.grading_type}
                  onChange={(e) => setFormData({ ...formData, grading_type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                >
                  <option value="auto">Automatique</option>
                  <option value="ai">IA</option>
                  <option value="manual">Manuelle</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                >
                  <option value="standard">Standard</option>
                  <option value="speed">Vitesse</option>
                  <option value="practice">Entraînement</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Durée (minutes)</label>
                <input
                  type="number" min="0"
                  value={formData.time_limit_minutes}
                  onChange={(e) => setFormData({ ...formData, time_limit_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                  placeholder="0 = illimité"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Score minimum requis (%)</label>
                <input
                  type="number" min="0" max="100"
                  inputMode="numeric"
                  value={formData.min_score_percent || ""}
                  onChange={(e) => setFormData({ ...formData, min_score_percent: Math.min(100, parseInt(e.target.value) || 0) })}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                  placeholder="0 = pas de minimum"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Essais max</label>
                <input
                  type="number" min="0"
                  value={formData.max_attempts}
                  onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                  placeholder="0 = illimité"
                />
              </div>
            </div>
          </div>
  
          {/* Section 3: Questions */}
          <div className="p-6">
            <h3 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">3</span>
              Questions du quiz
            </h3>
            <QuizBuilder
              initialQuestions={formData.content_json || []}
              level={formData.level}
              onChange={(questions) => setFormData({ ...formData, content_json: questions })}
              onMetadataChange={(metadata) => {
                setFormData((prev) => ({
                  ...prev,
                  title: metadata.title || prev.title,
                  description: metadata.description || prev.description,
                  time_limit_minutes: metadata.time_limit || prev.time_limit_minutes,
                }));
              }}
            />
          </div>
        </div>
  
        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-[rgba(197,161,72,0.25)] bg-white flex-shrink-0">
          <GlassButton
            size="sm"
            variant="outline"
            className="mr-auto"
            onClick={() => {
              const win = openPreviewLoadingWindow();
              void handlePreview({
                id: editingQuiz?.id || "",
                title: formData.title,
                description: formData.description,
                course_id: formData.course_id,
                folder_id: typeof formData.folder_id === "number" ? formData.folder_id : null,
                time_limit_minutes: formData.time_limit_minutes,
                min_score_percent: formData.min_score_percent,
                status: formData.status as Loose,
                type: formData.type,
                difficulty_level: formData.difficulty_level,
                level: formData.level,
                max_attempts: formData.max_attempts,
                grading_type: formData.grading_type,
                thumbnail_filename: formData.thumbnail_filename,
                content_json: formData.content_json,
                created_at: new Date().toISOString()
              }, win);
            }}
          >
            <Eye className="w-4 h-4" />
            Prévisualiser
          </GlassButton>
          <GlassButton size="sm" variant="ghost" onClick={() => setIsModalOpen(false)}>
            Annuler
          </GlassButton>
          <GlassButton
            size="sm"
            variant="navy"
            disabled={isSubmitting}
            onClick={() => handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent)}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingQuiz ? "Mettre à jour" : "Créer le quiz"}
          </GlassButton>
        </div>
      </form>
    </div>
  </div>
  );
}
