"use client";
/* eslint-disable @next/next/no-img-element -- extrait d'un composant qui affiche des images à adresse libre */
import { GraduationCap, XCircle, ImageIcon, Loader2 } from "lucide-react";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import CourseSelect from "@/components/admin/CourseSelect";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { getLevelLabel, SCHOOL_LEVELS } from "@/lib/constants";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import ExerciseBuilder from "@/components/admin/ExerciseBuilder";
import GlassButton from "@/components/ui/GlassButton";
import { type Exercise, type Course, type ExerciseFolder, type ExerciseFormData } from "@/components/admin/AdminExercisesClient";

const EXERCISE_TYPES = [
  { value: "standard", label: "Standard (Calcul/Réponse libre)" },
  { value: "qcm", label: "QCM" },
  { value: "fill_in_the_blank", label: "Texte à trous" },
  { value: "matching", label: "Association / Relier" },
  { value: "ordering", label: "Mise en ordre" },
  { value: "coding", label: "Code / Algo" },
];

type ExerciseEditorModalProps = {
  editingExercise: Exercise | null;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  formData: ExerciseFormData;
  setFormData: React.Dispatch<React.SetStateAction<ExerciseFormData>>;
  courses: Course[];
  folders: ExerciseFolder[];
  uploading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  currentFolderLevel: string | null;
  isSubmitting: boolean;
};

export default function ExerciseEditorModal(props: ExerciseEditorModalProps) {
  const { editingExercise, setIsModalOpen, handleSubmit, formData, setFormData, courses, folders, uploading, handleFileUpload, currentFolderLevel, isSubmitting } = props;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1060] p-4 modal-overlay">
    <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-8 py-5 border-b border-[rgba(197,161,72,0.25)] bg-gradient-to-r from-[var(--greek-blue)] to-blue-800 text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <GraduationCap size={24} className="text-[var(--greek-gold)]" />
          <h2 className="text-xl font-bold font-[family-name:var(--font-display)]">
            {editingExercise ? "Modifier l'exercice" : "Nouvel exercice"}
          </h2>
        </div>
        <GlassCloseButton variant="dark" onClick={() => setIsModalOpen(false)} />
      </div>
  
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          
          {/* Section 1: Informations générales */}
          <div className="p-6 border-b border-[rgba(197,161,72,0.25)]">
            <h3 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">1</span>
              Informations générales
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Titre de l&apos;exercice</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-gray-50 font-medium"
                  placeholder="Ex: Maths : Les fractions (CP)"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description / Énoncé</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] resize-none bg-gray-50"
                  placeholder="Description affichée sur la page d'accueil de l'exercice..."
                />
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Image miniature</label>
                  {formData.thumbnail_url && (
                    <div className="relative w-full h-20 bg-gray-100 rounded-lg overflow-hidden border border-[rgba(197,161,72,0.25)] mb-2">
                      <img src={formData.thumbnail_url} alt="Aperçu" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-exercise.png"; }} />
                      <div className="absolute top-1.5 right-1.5">
                        <GlassIconButton
                          icon={XCircle}
                          onClick={() => setFormData({ ...formData, thumbnail_url: "" })}
                          color="red"
                          size="sm"
                          aria-label="Supprimer l'image"
                        />
                      </div>
                    </div>
                  )}
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors text-sm font-medium w-full justify-center border border-dashed border-[rgba(197,161,72,0.25)]">
                    <ImageIcon size={16} />
                    {uploading ? "Upload en cours..." : "Choisir une image"}
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>
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
                {!editingExercise && currentFolderLevel ? (
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
                  onChange={(v) => setFormData({ ...formData, difficulty_level: v as "easy" | "medium" | "hard" })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Durée estimée</label>
                <div className="relative">
                  <input
                    type="number" min={1} max={600}
                    value={formData.estimated_time ?? ""}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setFormData({ ...formData, estimated_time: Number.isFinite(n) ? Math.min(600, Math.max(1, n)) : undefined });
                    }}
                    aria-label="Durée estimée en minutes"
                    className="w-full px-4 py-2.5 pr-14 border-2 border-[var(--greek-blue)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white font-semibold"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">min</span>
                </div>
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
                  onChange={(e) => setFormData({ ...formData, grading_type: e.target.value as "auto" | "ai" | "manual" })}
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
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type d&apos;exercice</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                >
                  {EXERCISE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Durée (minutes)</label>
                <input
                  type="number" min="0"
                  value={formData.time_limit}
                  onChange={(e) => setFormData({ ...formData, time_limit: parseInt(e.target.value) || 0 })}
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
  
          {/* Section 3: Contenu */}
          <div className="p-6">
            <h3 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">3</span>
              Contenu de l&apos;exercice
            </h3>
            <ExerciseBuilder
              initialContent={formData.content_json || []}
              level={formData.level}
              onChange={(content) => setFormData({ ...formData, content_json: content })}
              onMetadataChange={(metadata) => {
                setFormData((prev) => ({
                  ...prev,
                  title: metadata.title || prev.title,
                  description: metadata.description || prev.description,
                  difficulty_level: metadata.difficulty_level || prev.difficulty_level,
                  time_limit: metadata.time_limit || prev.time_limit,
                  time_limit_minutes: metadata.time_limit_minutes || prev.time_limit_minutes,
                  min_score_percent: metadata.min_score_percent || prev.min_score_percent,
                  max_attempts: metadata.max_attempts || prev.max_attempts,
                }));
              }}
            />
          </div>
        </div>
  
        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-[rgba(197,161,72,0.25)] bg-white flex-shrink-0">
          <GlassButton size="sm" variant="ghost" onClick={() => setIsModalOpen(false)}>
            Annuler
          </GlassButton>
          <GlassButton
            size="sm"
            variant="navy"
            disabled={isSubmitting}
            onClick={() => handleSubmit()}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingExercise ? "Mettre à jour" : "Créer l'exercice"}
          </GlassButton>
        </div>
      </form>
    </div>
  </div>
  );
}
