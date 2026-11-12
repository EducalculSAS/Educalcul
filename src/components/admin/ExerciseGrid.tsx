"use client";
/* eslint-disable @next/next/no-img-element -- extrait d'un composant qui affiche des images à adresse libre */
import FolderEmblem from "@/components/child/FolderEmblem";
import Emblem3D from "@/components/Emblem3D";
import PageLoader from "@/components/PageLoader";
import { FOLDER_COLORS } from "@/components/admin/folderStyle";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { ArrowLeft, ArrowRight, Edit, Trash2, ArrowUp, ArrowDown, BookOpen, Eye, Copy, Download } from "lucide-react";
import { formatDateFr } from "@/lib/formatDate";
import { openPreviewLoadingWindow } from "@/lib/openPreviewWindow";
import { exportAsJSON } from "@/lib/jsonIO";
import { type Exercise, type ExerciseFolder } from "@/components/admin/AdminExercisesClient";

type ExerciseGridProps = {
  loading: boolean;
  filteredFolders: ExerciseFolder[];
  handleFolderDragStart: (e: React.DragEvent, folderId: number) => void;
  handleDragOver: (e: React.DragEvent, folderId: number) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, targetFolderId: number) => Promise<void>;
  setCurrentFolderId: React.Dispatch<React.SetStateAction<number | null>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  dragOverFolderId: number | null;
  canReorderFolders: boolean;
  folders: ExerciseFolder[];
  moveFolder: (folderId: number, direction: -1 | 1) => Promise<void>;
  setEditingFolder: React.Dispatch<React.SetStateAction<ExerciseFolder | null>>;
  setFolderFormData: React.Dispatch<React.SetStateAction<{ name: string; status: 'published' | 'draft' | 'archived'; color: string; grade_level: string; icon: string; }>>;
  setIsFolderModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleDeleteFolder: (folder: ExerciseFolder) => Promise<void>;
  currentFolderId: number | null;
  subfolderCounts: Map<number, number>;
  filteredExercises: Exercise[];
  handleDragStart: (e: React.DragEvent, exerciseId: string) => void;
  setDraggedExerciseId: React.Dispatch<React.SetStateAction<string | null>>;
  getStatusBadge: (status: string) => React.JSX.Element;
  canReorder: boolean;
  moveItem: (itemId: string, direction: -1 | 1) => Promise<void>;
  getDifficultyBadge: (level: string | null) => React.JSX.Element | null;
  getFullExercise: (exercise: Exercise) => Promise<Exercise>;
  handlePreview: (exercise: Exercise, win?: Window | null) => Promise<void>;
  openEditModal: (exercise: Exercise) => void;
  duplicateExercise: (exercise: Exercise) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
};

export default function ExerciseGrid(props: ExerciseGridProps) {
  const { loading, filteredFolders, handleFolderDragStart, handleDragOver, handleDragLeave, handleDrop, setCurrentFolderId, setSearchQuery, dragOverFolderId, canReorderFolders, folders, moveFolder, setEditingFolder, setFolderFormData, setIsFolderModalOpen, handleDeleteFolder, currentFolderId, subfolderCounts, filteredExercises, handleDragStart, setDraggedExerciseId, getStatusBadge, canReorder, moveItem, getDifficultyBadge, getFullExercise, handlePreview, openEditModal, duplicateExercise, handleDelete } = props;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {/* Indicateur seulement si l'attente dure (appear-late : 400 ms) ; les
        sous-dossiers, déjà connus, restent affichés pendant ce temps. */}
    {loading && (
      <div className="col-span-full appear-late order-last">
        <PageLoader className="h-24" />
      </div>
    )}
    {(
      <>
        {/* Folders */}
        {filteredFolders.map((folder) => {
          return (
          <div
            key={`folder-${folder.id}`}
            draggable
            onDragStart={(e) => handleFolderDragStart(e, folder.id)}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder.id)}
            onClick={() => { setCurrentFolderId(folder.id); setSearchQuery(""); }}
            className={`bg-white rounded-2xl p-6 shadow-sm border transition-all group cursor-pointer relative overflow-hidden flex flex-col items-center justify-center text-center aspect-[4/3]
              ${
                dragOverFolderId === folder.id
                  ? "border-[var(--greek-blue)] ring-2 ring-[var(--greek-blue)]/20 bg-blue-50"
                  : "border-[rgba(197,161,72,0.25)] hover:shadow-lg hover:-translate-y-1"
              }`}
          >
            <div
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {canReorderFolders && folders.length > 1 && (
                <>
                  <GlassIconButton
                    icon={ArrowLeft}
                    size="sm"
                    color="navy"
                    disabled={folders[0]?.id === folder.id}
                    onClick={() => void moveFolder(folder.id, -1)}
                    aria-label={`Avancer « ${folder.name} » dans l'ordre`}
                  />
                  <GlassIconButton
                    icon={ArrowRight}
                    size="sm"
                    color="navy"
                    disabled={folders[folders.length - 1]?.id === folder.id}
                    onClick={() => void moveFolder(folder.id, 1)}
                    aria-label={`Reculer « ${folder.name} » dans l'ordre`}
                  />
                </>
              )}
              <GlassIconButton
                icon={Edit}
                onClick={() => {
                  setEditingFolder(folder);
                  setFolderFormData({
                    name: folder.name,
                    status: folder.status,
                    color: folder.color || FOLDER_COLORS[0],
                    grade_level: folder.grade_level || "6eme",
                    icon: folder.icon || "",
                  });
                  setIsFolderModalOpen(true);
                }}
                color="navy"
                size="sm"
                aria-label="Modifier"
              />
              {!folder.is_system && (
                <GlassIconButton
                  icon={Trash2}
                  onClick={() => {
                    handleDeleteFolder(folder);
                  }}
                  color="red"
                  size="sm"
                  aria-label="Supprimer"
                />
              )}
            </div>
  
            <FolderEmblem icon={folder.icon} color={folder.color} size={56} />
            <h3 className="font-bold text-gray-800 text-lg mb-1 truncate w-full px-2">
              {folder.name}
            </h3>
            {!folder.is_system && (
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                {folder.status === "published"
                  ? "Publié"
                  : folder.status === "archived"
                  ? "Archivé"
                  : "Brouillon"}
              </p>
            )}
            {(() => {
              const subCount = currentFolderId === null ? 0 : (subfolderCounts.get(folder.id) ?? 0);
              const itemCount = ((folder as { item_count?: number }).item_count ?? 0);
              if (subCount === 0 && itemCount === 0) return null;
              const parts = [];
              if (subCount > 0) parts.push(`${subCount} dossier${subCount > 1 ? "s" : ""}`);
              if (itemCount > 0) parts.push(`${itemCount} exercice${itemCount > 1 ? "s" : ""}`);
              return (
                <p className="text-xs text-gray-400 mt-1">{parts.join(" · ")}</p>
              );
            })()}
          </div>
          );
        })}
  
        {filteredExercises.map((exercise) => (
          <div
            key={exercise.id}
            draggable
            onDragStart={(e) => handleDragStart(e, exercise.id)}
            onDragEnd={() => setDraggedExerciseId(null)}
            className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden hover:shadow-md transition-shadow group cursor-move"
          >
            <div className="relative h-40 bg-gray-100">
              {exercise.thumbnail_url ? (
                <img
                  src={exercise.thumbnail_url}
                  alt={exercise.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "/placeholder-exercise.png"; // Fallback
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <Emblem3D kind="pencil" size={64} float={false} />
                </div>
              )}
              <div className="absolute top-2 right-2">
                {getStatusBadge(exercise.status)}
              </div>
              {canReorder && filteredExercises.length > 1 && (
                <div className="absolute top-2 left-2 flex gap-1">
                  <GlassIconButton
                    icon={ArrowUp}
                    size="sm"
                    color="navy"
                    disabled={filteredExercises[0]?.id === exercise.id}
                    onClick={() => void moveItem(exercise.id, -1)}
                    aria-label={`Avancer « ${exercise.title} » dans l'ordre du dossier`}
                  />
                  <GlassIconButton
                    icon={ArrowDown}
                    size="sm"
                    color="navy"
                    disabled={filteredExercises[filteredExercises.length - 1]?.id === exercise.id}
                    onClick={() => void moveItem(exercise.id, 1)}
                    aria-label={`Reculer « ${exercise.title} » dans l'ordre du dossier`}
                  />
                </div>
              )}
            </div>
  
            <div className="p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <span className="flex items-center gap-1">
                  <BookOpen size={12} />
                  {exercise.courses?.title || "Sans cours"}
                </span>
                {getDifficultyBadge(exercise.difficulty_level)}
              </div>
  
              <h3
                className="font-semibold text-gray-900 mb-1 line-clamp-1"
                title={exercise.title}
              >
                {exercise.title}
              </h3>
              <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                {exercise.question || "Aucune description"}
              </p>
  
              <div className="flex justify-between items-center pt-2 border-t border-[rgba(197,161,72,0.25)]">
                <span className="text-xs text-gray-400">
                  {formatDateFr(exercise.created_at)}
                </span>
                <div className="flex gap-1">
                  <GlassIconButton
                    icon={Eye}
                    onClick={() => {
                      const win = openPreviewLoadingWindow();
                      void (async () => {
                        const full = await getFullExercise(exercise);
                        await handlePreview(full, win);
                      })();
                    }}
                    color="gray"
                    size="sm"
                    aria-label="Prévisualiser"
                  />
                  <GlassIconButton
                    icon={Edit}
                    onClick={async () => openEditModal(await getFullExercise(exercise))}
                    color="navy"
                    size="sm"
                    aria-label="Modifier"
                  />
                  <GlassIconButton
                    icon={Copy}
                    onClick={() => void duplicateExercise(exercise)}
                    color="navy"
                    size="sm"
                    aria-label="Dupliquer l'exercice"
                  />
                  <GlassIconButton
                    icon={Download}
                    onClick={async () => {
                      const full = await getFullExercise(exercise);
                      exportAsJSON(full, "exercise", full.title);
                    }}
                    color="gold"
                    size="sm"
                    aria-label="Exporter JSON"
                  />
                  <GlassIconButton
                    icon={Trash2}
                    onClick={() => handleDelete(exercise.id)}
                    color="red"
                    size="sm"
                    aria-label="Supprimer"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
  
        {!loading && filteredExercises.length === 0 && filteredFolders.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            Aucun contenu dans ce dossier
          </div>
        )}
      </>
    )}
  </div>
  );
}
