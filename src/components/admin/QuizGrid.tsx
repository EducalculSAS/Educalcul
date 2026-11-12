"use client";
/* eslint-disable @next/next/no-img-element -- extrait d'un composant qui affiche des images à adresse libre */
import FolderEmblem from "@/components/child/FolderEmblem";
import Emblem3D from "@/components/Emblem3D";
import PageLoader from "@/components/PageLoader";
import { FOLDER_COLORS } from "@/components/admin/folderStyle";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { ArrowLeft, ArrowRight, Edit, Trash2, ArrowUp, ArrowDown, BookOpen, Clock, Eye, Download } from "lucide-react";
import { formatDateFr } from "@/lib/formatDate";
import { openPreviewLoadingWindow } from "@/lib/openPreviewWindow";
import { exportAsJSON } from "@/lib/jsonIO";
import { type Quiz, type QuizFolder } from "@/components/admin/AdminQuizzesClient";

type QuizGridProps = {
  loading: boolean;
  filteredFolders: QuizFolder[];
  handleFolderDragStart: (e: React.DragEvent, folderId: number) => void;
  handleDragOver: (e: React.DragEvent, folderId: number) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, targetFolderId: number) => Promise<void>;
  setCurrentFolderId: React.Dispatch<React.SetStateAction<number | null>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  dragOverFolderId: number | null;
  canReorderFolders: boolean;
  folders: QuizFolder[];
  moveFolder: (folderId: number, direction: -1 | 1) => Promise<void>;
  setEditingFolder: React.Dispatch<React.SetStateAction<QuizFolder | null>>;
  setFolderFormData: React.Dispatch<React.SetStateAction<{ name: string; status: 'published' | 'draft' | 'archived'; color: string; grade_level: string; icon: string; }>>;
  setIsFolderModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleDeleteFolder: (folder: QuizFolder) => Promise<void>;
  currentFolderId: number | null;
  subfolderCounts: Map<number, number>;
  filteredQuizzes: Quiz[];
  handleDragStart: (e: React.DragEvent, quizId: string) => void;
  setDraggedQuizId: React.Dispatch<React.SetStateAction<string | null>>;
  draggedQuizId: string | null;
  getStatusBadge: (status: string) => React.JSX.Element;
  canReorder: boolean;
  moveItem: (itemId: string, direction: -1 | 1) => Promise<void>;
  getFullQuiz: (quiz: Quiz) => Promise<Quiz>;
  handlePreview: (quiz: Quiz, win?: Window | null) => Promise<void>;
  handleOpenModal: (quiz?: Quiz | null) => void;
  handleDelete: (id: string) => Promise<void>;
};

export default function QuizGrid(props: QuizGridProps) {
  const { loading, filteredFolders, handleFolderDragStart, handleDragOver, handleDragLeave, handleDrop, setCurrentFolderId, setSearchQuery, dragOverFolderId, canReorderFolders, folders, moveFolder, setEditingFolder, setFolderFormData, setIsFolderModalOpen, handleDeleteFolder, currentFolderId, subfolderCounts, filteredQuizzes, handleDragStart, setDraggedQuizId, draggedQuizId, getStatusBadge, canReorder, moveItem, getFullQuiz, handlePreview, handleOpenModal, handleDelete } = props;
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
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setCurrentFolderId(folder.id);
                setSearchQuery("");
              }
            }}
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
                size="sm"
                color="navy"
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
                aria-label="Modifier le dossier"
              />
              {!folder.is_system && (
                <GlassIconButton
                  icon={Trash2}
                  size="sm"
                  color="red"
                  onClick={() => {
                    handleDeleteFolder(folder);
                  }}
                  aria-label="Supprimer le dossier"
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
              if (itemCount > 0) parts.push(`${itemCount} quiz`);
              return (
                <p className="text-xs text-gray-400 mt-1">{parts.join(" · ")}</p>
              );
            })()}
          </div>
          );
        })}
  
        {filteredQuizzes.map((quiz) => (
          <div
            key={quiz.id}
            draggable
            onDragStart={(e) => handleDragStart(e, quiz.id)}
            onDragEnd={() => setDraggedQuizId(null)}
            className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-shadow group cursor-move ${
              draggedQuizId === quiz.id
                ? "border-[var(--greek-blue)] opacity-50 border-2 border-dashed"
                : "border-[rgba(197,161,72,0.25)] hover:shadow-md"
            }`}
          >
            <div className="relative h-40 bg-gray-100">
              {quiz.thumbnail_filename ? (
                <img
                  src={`/uploads/quiz_thumbnails/${quiz.thumbnail_filename}`}
                  alt={quiz.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes("http")) {
                      // prevent infinite loop
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <Emblem3D kind="quiz" size={64} float={false} />
                </div>
              )}
              <div className="absolute top-2 right-2">
                {getStatusBadge(quiz.status)}
              </div>
              {canReorder && filteredQuizzes.length > 1 && (
                <div className="absolute top-2 left-2 flex gap-1">
                  <GlassIconButton
                    icon={ArrowUp}
                    size="sm"
                    color="navy"
                    disabled={filteredQuizzes[0]?.id === quiz.id}
                    onClick={() => void moveItem(quiz.id, -1)}
                    aria-label={`Avancer « ${quiz.title} » dans l'ordre du dossier`}
                  />
                  <GlassIconButton
                    icon={ArrowDown}
                    size="sm"
                    color="navy"
                    disabled={filteredQuizzes[filteredQuizzes.length - 1]?.id === quiz.id}
                    onClick={() => void moveItem(quiz.id, 1)}
                    aria-label={`Reculer « ${quiz.title} » dans l'ordre du dossier`}
                  />
                </div>
              )}
            </div>
  
            <div className="p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <span className="flex items-center gap-1">
                  <BookOpen size={12} />
                  {quiz.courses?.title || "Sans cours"}
                </span>
                {quiz.time_limit_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {quiz.time_limit_minutes} min
                  </span>
                )}
              </div>
  
              <h3
                className="font-semibold text-gray-900 mb-1 line-clamp-1"
                title={quiz.title}
              >
                {quiz.title}
              </h3>
              <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                {quiz.description || "Aucune description"}
              </p>
  
              <div className="flex justify-between items-center pt-2 border-t border-[rgba(197,161,72,0.25)]">
                <span className="text-xs text-gray-400">
                  {formatDateFr(quiz.created_at)}
                </span>
                <div className="flex gap-1">
                  <GlassIconButton
                    icon={Eye}
                    size="sm"
                    color="navy"
                    onClick={() => {
                      const win = openPreviewLoadingWindow();
                      void (async () => {
                        const full = await getFullQuiz(quiz);
                        await handlePreview(full, win);
                      })();
                    }}
                    aria-label="Prévisualiser le quiz"
                  />
                  <GlassIconButton
                    icon={Edit}
                    size="sm"
                    color="navy"
                    onClick={async () => handleOpenModal(await getFullQuiz(quiz))}
                    aria-label="Modifier le quiz"
                  />
                  <GlassIconButton
                    icon={Download}
                    size="sm"
                    color="gold"
                    onClick={async () => {
                      const full = await getFullQuiz(quiz);
                      exportAsJSON(full, "quiz", full.title);
                    }}
                    aria-label="Exporter le quiz en JSON"
                  />
                  <GlassIconButton
                    icon={Trash2}
                    size="sm"
                    color="red"
                    onClick={() => handleDelete(quiz.id)}
                    aria-label="Supprimer le quiz"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
  
        {!loading && filteredQuizzes.length === 0 && filteredFolders.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            Aucun contenu dans ce dossier
          </div>
        )}
      </>
    )}
  </div>
  );
}
