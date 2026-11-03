"use client";
 
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import { FOLDER_COLORS, FOLDER_ICONS } from "@/components/admin/folderStyle";
import { SCHOOL_LEVELS } from "@/lib/constants";
import GlassButton from "@/components/ui/GlassButton";
import { type ExerciseFolder } from "@/components/admin/AdminExercisesClient";

type ExerciseFolderModalProps = {
  editingFolder: ExerciseFolder | null;
  setIsFolderModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingFolder: React.Dispatch<React.SetStateAction<ExerciseFolder | null>>;
  setFolderFormData: React.Dispatch<React.SetStateAction<{ name: string; status: 'published' | 'draft' | 'archived'; color: string; grade_level: string; icon: string; }>>;
  handleSaveFolder: (e: React.FormEvent) => Promise<void>;
  folderFormData: { name: string; status: 'published' | 'draft' | 'archived'; color: string; grade_level: string; icon: string; };
};

export default function ExerciseFolderModal(props: ExerciseFolderModalProps) {
  const { editingFolder, setIsFolderModalOpen, setEditingFolder, setFolderFormData, handleSaveFolder, folderFormData } = props;
  return (
    <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 modal-overlay">
    <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[rgba(197,161,72,0.25)] flex justify-between items-center bg-gray-50">
        <h3 className="text-lg font-bold text-gray-800">
          {editingFolder ? "Modifier le dossier" : "Nouveau Dossier"}
        </h3>
        <GlassCloseButton
          onClick={() => {
            setIsFolderModalOpen(false);
            setEditingFolder(null);
            setFolderFormData({
              name: "",
              status: "draft",
              color: FOLDER_COLORS[0],
              grade_level: "6eme",
              icon: "",
            });
          }}
        />
      </div>
      <form onSubmit={handleSaveFolder} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom du dossier
          </label>
          <input
            type="text"
            required
            autoFocus
            value={folderFormData.name}
            onChange={(e) =>
              setFolderFormData({
                ...folderFormData,
                name: e.target.value,
              })
            }
            className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
            placeholder="Ex: Mathématiques"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Statut
          </label>
          <select
            value={folderFormData.status}
            onChange={(e) =>
              setFolderFormData({
                ...folderFormData,
                status: e.target.value as "published" | "draft" | "archived",
              })
            }
            className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
          >
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
            <option value="archived">Archivé</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Niveau scolaire</label>
          <select
            value={folderFormData.grade_level}
            onChange={(e) => setFolderFormData({ ...folderFormData, grade_level: e.target.value })}
            className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
          >
            {SCHOOL_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Pré-sélectionne ce niveau lors de la génération IA dans ce dossier.</p>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Couleur du dossier
          </label>
          <div className="flex flex-wrap gap-2">
            {FOLDER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() =>
                  setFolderFormData({ ...folderFormData, color })
                }
                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                  folderFormData.color === color
                    ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                    : ""
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Icône du dossier
          </label>
          <div className="flex flex-wrap gap-2">
            {FOLDER_ICONS.map(({ name, Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() =>
                  setFolderFormData({ ...folderFormData, icon: name })
                }
                className={`w-9 h-9 rounded-full flex items-center justify-center bg-gray-50 transition-transform hover:scale-110 ${
                  (folderFormData.icon || "folder") === name
                    ? "ring-2 ring-[var(--greek-blue)] scale-110"
                    : ""
                }`}
              >
                <Icon size={18} style={{ color: folderFormData.color }} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <GlassButton
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsFolderModalOpen(false);
              setEditingFolder(null);
              setFolderFormData({
                name: "",
                status: "draft",
                color: FOLDER_COLORS[0],
                grade_level: "6eme",
                icon: "",
              });
            }}
          >
            Annuler
          </GlassButton>
          <GlassButton
            size="sm"
            variant="navy"
            disabled={!folderFormData.name.trim()}
            type="submit"
          >
            {editingFolder ? "Sauvegarder" : "Créer"}
          </GlassButton>
        </div>
      </form>
    </div>
  </div>
  );
}
