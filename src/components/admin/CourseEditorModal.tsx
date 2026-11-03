"use client";
/* eslint-disable @next/next/no-img-element -- extrait d'un composant qui affiche des images à adresse libre */
import { BookOpen, XCircle, Image as ImageIcon, Loader2 } from "lucide-react";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import { getLevelLabel, SCHOOL_LEVELS } from "@/lib/constants";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import GlassIconButton from "@/components/ui/GlassIconButton";
import CourseBuilder, { type Chapter } from "@/components/admin/CourseBuilder";
import GlassButton from "@/components/ui/GlassButton";

type CourseEditorModalProps = {
  modalMode: 'create' | 'edit';
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  formData: { title: string; description: string; subject: string; level: string; status: string; thumbnail_url: string; folder_id: number | null; content_json: Chapter[]; };
  setFormData: React.Dispatch<React.SetStateAction<{ title: string; description: string; subject: string; level: string; status: string; thumbnail_url: string; folder_id: number | null; content_json: Chapter[]; }>>;
  setIsAreasEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  subjectAreas: string[];
  currentFolderLevel: string | null;
  estimatedTime: number;
  setEstimatedTime: React.Dispatch<React.SetStateAction<number>>;
  uploading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isSubmitting: boolean;
};

export default function CourseEditorModal(props: CourseEditorModalProps) {
  const { modalMode, setIsModalOpen, handleSubmit, formData, setFormData, setIsAreasEditorOpen, subjectAreas, currentFolderLevel, estimatedTime, setEstimatedTime, uploading, handleFileUpload, isSubmitting } = props;
  return (
    <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 modal-overlay">
    <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-8 py-4 sm:py-5 border-b border-[rgba(197,161,72,0.25)] bg-gradient-to-r from-[var(--greek-blue)] to-blue-800 text-white flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen size={22} className="text-[var(--greek-gold)]" />
          <h3 className="text-lg font-bold font-[family-name:var(--font-display)]">
            {modalMode === "create"
              ? "Ajouter un cours"
              : "Modifier le cours"}
          </h3>
        </div>
        <GlassCloseButton variant="dark" onClick={() => setIsModalOpen(false)} />
      </div>
  
      <form
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto">
          {/* Section 1: Informations */}
          <div className="p-4 sm:p-6 border-b border-[rgba(197,161,72,0.25)]">
            <h4 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">
                1
              </span>
              Informations générales
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Titre du cours
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-gray-50 font-medium"
                  placeholder="Ex: Les fractions (CM1)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center justify-between text-sm font-semibold text-gray-700 mb-1.5">
                    Domaine
                    <button type="button" onClick={() => setIsAreasEditorOpen(true)} className="text-xs font-semibold text-[var(--greek-blue)] hover:underline">
                      Modifier la liste
                    </button>
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        subject: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-gray-50"
                  >
                    {(subjectAreas.includes(formData.subject) || !formData.subject ? subjectAreas : [...subjectAreas, formData.subject]).map((area) => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Niveau scolaire
                  </label>
                  {modalMode === "create" && currentFolderLevel ? (
                    <div className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl bg-blue-50 font-semibold text-[var(--greek-blue)]">
                      {getLevelLabel(currentFolderLevel)}
                    </div>
                  ) : (
                    <select
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          level: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white font-semibold"
                    >
                      {SCHOOL_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Durée estimée
                  </label>
                  <select
                    value={estimatedTime}
                    onChange={(e) =>
                      setEstimatedTime(parseInt(e.target.value))
                    }
                    className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white font-semibold"
                  >
                    {[5, 10, 15, 20, 30, 45, 60, 90].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      description: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-gray-50 resize-none"
                  placeholder="Description courte du cours..."
                />
              </div>
            </div>
          </div>
  
          {/* Section 2: Paramètres */}
          <div className="p-4 sm:p-6 border-b border-[rgba(197,161,72,0.25)] bg-gray-50/50">
            <h4 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">
                2
              </span>
              Paramètres de publication
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Statut
                </label>
                <GlassSegmentedControl
                  size="sm"
                  options={[
                    { id: "draft", label: "Brouillon" },
                    { id: "published", label: "Publié" },
                    { id: "archived", label: "Archivé" },
                  ]}
                  value={formData.status}
                  onChange={(v) =>
                    setFormData({
                      ...formData,
                      status: v as "draft" | "published" | "archived",
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Image de couverture
                </label>
                <div className="flex items-center gap-3">
                  {formData.thumbnail_url && (
                    <div className="relative w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-[rgba(197,161,72,0.25)] flex-shrink-0">
                      <img
                        src={formData.thumbnail_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <GlassIconButton
                        icon={XCircle}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            thumbnail_url: "",
                          }))
                        }
                        color="red"
                        size="sm"
                        aria-label="Retirer l'image"
                        className="absolute top-0.5 right-0.5"
                      />
                    </div>
                  )}
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors text-sm font-medium flex-1 justify-center border border-dashed border-[rgba(197,161,72,0.25)]">
                    <ImageIcon size={16} />
                    {uploading ? "Upload..." : "Choisir"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
  
          {/* Section 3: Contenu */}
          <div className="p-4 sm:p-6">
            <h4 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">
                3
              </span>
              Contenu du cours
            </h4>
            <CourseBuilder
              initialContent={formData.content_json}
              onChange={(chapters) =>
                setFormData({ ...formData, content_json: chapters })
              }
              level={formData.level}
            />
          </div>
        </div>
  
        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-[rgba(197,161,72,0.25)] bg-white flex-shrink-0">
          <GlassButton size="sm" variant="ghost" onClick={() => setIsModalOpen(false)}>
            Annuler
          </GlassButton>
          <GlassButton
            size="sm"
            variant="navy"
            disabled={isSubmitting}
            onClick={() => handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent)}
          >
            {isSubmitting && (
              <Loader2 className="animate-spin" size={16} />
            )}
            {modalMode === "create" ? "Créer le cours" : "Sauvegarder"}
          </GlassButton>
        </div>
      </form>
    </div>
  </div>
  );
}
