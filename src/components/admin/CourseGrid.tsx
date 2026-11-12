"use client";
/* eslint-disable @next/next/no-img-element -- extrait d'un composant qui affiche des images à adresse libre */
import FolderEmblem from "@/components/child/FolderEmblem";
import Emblem3D from "@/components/Emblem3D";
import PageLoader from "@/components/PageLoader";
import { ArrowLeft, ArrowRight, Edit, Trash2, ArrowUp, ArrowDown, Eye, Download } from "lucide-react";
import { COURSE_FOLDER_COLORS as FOLDER_COLORS } from "@/components/admin/folderStyle";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { formatDateFr } from "@/lib/formatDate";
import { openPreviewLoadingWindow } from "@/lib/openPreviewWindow";
import { exportAsJSON } from "@/lib/jsonIO";
import { type Course, type Folder } from "@/components/admin/AdminCoursesClient";

type CourseGridProps = {
  gridRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
  filteredFolders: Folder[];
  filteredCourses: Course[];
  setIsFolderModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleFolderDragStart: (e: React.DragEvent, folderId: number) => void;
  handleDragOver: (e: React.DragEvent, folderId: number) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, targetFolderId: number) => Promise<void>;
  setCurrentFolderId: React.Dispatch<React.SetStateAction<number | null>>;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  dragOverFolderId: number | null;
  canReorderFolders: boolean;
  folders: Folder[];
  moveFolder: (folderId: number, direction: -1 | 1) => Promise<void>;
  setEditingFolder: React.Dispatch<React.SetStateAction<Folder | null>>;
  setFolderFormData: React.Dispatch<React.SetStateAction<{ name: string; status: 'published' | 'draft' | 'archived'; color: string; grade_level: string; icon: string; }>>;
  handleDeleteFolder: (folder: Folder) => Promise<void>;
  currentFolderId: number | null;
  subfolderCounts: Map<number, number>;
  handleDragStart: (e: React.DragEvent, courseId: string) => void;
  setDraggedCourseId: React.Dispatch<React.SetStateAction<string | null>>;
  draggedCourseId: string | null;
  getStatusBadge: (status: string) => React.JSX.Element;
  canReorder: boolean;
  moveCourse: (courseId: string, direction: -1 | 1) => Promise<void>;
  getFullCourse: (course: Course) => Promise<Course>;
  handlePreview: (course: Course, win?: Window | null) => Promise<void>;
  handleOpenModal: (mode: 'create' | 'edit', course?: Course) => void;
  handleDelete: (course: Course) => Promise<void>;
};

export default function CourseGrid(props: CourseGridProps) {
  const { gridRef, loading, filteredFolders, filteredCourses, setIsFolderModalOpen, handleFolderDragStart, handleDragOver, handleDragLeave, handleDrop, setCurrentFolderId, setSearchTerm, dragOverFolderId, canReorderFolders, folders, moveFolder, setEditingFolder, setFolderFormData, handleDeleteFolder, currentFolderId, subfolderCounts, handleDragStart, setDraggedCourseId, draggedCourseId, getStatusBadge, canReorder, moveCourse, getFullCourse, handlePreview, handleOpenModal, handleDelete } = props;
  return (
    <div
    ref={gridRef}
    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
  >
    {/* Loading State */}
    {/* Indicateur seulement si l'attente dure (appear-late : 400 ms) —
        un dossier qui s'ouvre vite ne doit rien faire clignoter. */}
    {loading && (
      <div className="col-span-full appear-late order-last">
        <PageLoader className="h-24" />
      </div>
    )}
  
    {/* Empty State */}
    {!loading &&
      filteredFolders.length === 0 &&
      filteredCourses.length === 0 && (
        <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-[rgba(197,161,72,0.25)] border-dashed">
          <div className="flex flex-col items-center justify-center">
            <Emblem3D kind="folder" size={72} className="mb-3" />
            <p>Ce dossier est vide</p>
            <button
              onClick={() => setIsFolderModalOpen(true)}
              className="mt-4 text-[var(--greek-blue)] font-medium hover:underline"
            >
              Créer un dossier
            </button>
          </div>
        </div>
      )}
  
    {/* Folders List — déjà connus, affichés même pendant le chargement */}
    {filteredFolders.map((folder) => {
        return (
          <div
            key={`folder-${folder.id}`}
            draggable
            onDragStart={(e) => handleFolderDragStart(e, folder.id)}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder.id)}
            onClick={() => {
              setCurrentFolderId(folder.id);
              setSearchTerm("");
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
                color="navy"
                size="sm"
                aria-label="Modifier"
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
              />
              {!folder.is_system && (
                <GlassIconButton
                  icon={Trash2}
                  color="red"
                  size="sm"
                  aria-label="Supprimer"
                  onClick={() => handleDeleteFolder(folder)}
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
              const subCount =
                currentFolderId === null
                  ? 0
                  : (subfolderCounts.get(folder.id) ?? 0);
              const itemCount = ((folder as { item_count?: number }).item_count ?? 0);
              if (subCount === 0 && itemCount === 0) return null;
              const parts = [];
              if (subCount > 0)
                parts.push(`${subCount} dossier${subCount > 1 ? "s" : ""}`);
              if (itemCount > 0) parts.push(`${itemCount} cours`);
              return (
                <p className="text-xs text-gray-400 mt-1">
                  {parts.join(" · ")}
                </p>
              );
            })()}
          </div>
        );
      })}
  
    {/* Courses List */}
    {!loading &&
      filteredCourses.map((course) => (
        <div
          key={`course-${course.id}`}
          draggable
          onDragStart={(e) => handleDragStart(e, course.id)}
          onDragEnd={() => setDraggedCourseId(null)}
          className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-shadow group flex flex-col h-full cursor-move ${
            draggedCourseId === course.id
              ? "border-[var(--greek-blue)] opacity-50 border-2 border-dashed"
              : "border-[rgba(197,161,72,0.25)] hover:shadow-md"
          }`}
        >
          <div className="relative h-40 bg-gray-100 flex-shrink-0">
            {course.thumbnail_url ? (
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[var(--greek-blue)]/5">
                <img
                  src="/logo.png"
                  alt="Educalcul"
                  className="w-12 h-12 object-contain opacity-20"
                />
              </div>
            )}
            <div className="absolute top-2 right-2">
              {getStatusBadge(course.status)}
            </div>
            {canReorder && filteredCourses.length > 1 && (
              <div className="absolute top-2 left-2 flex gap-1">
                <GlassIconButton
                  icon={ArrowUp}
                  size="sm"
                  color="navy"
                  disabled={filteredCourses[0]?.id === course.id}
                  onClick={() => void moveCourse(course.id, -1)}
                  aria-label={`Avancer « ${course.title} » dans l'ordre du dossier`}
                />
                <GlassIconButton
                  icon={ArrowDown}
                  size="sm"
                  color="navy"
                  disabled={filteredCourses[filteredCourses.length - 1]?.id === course.id}
                  onClick={() => void moveCourse(course.id, 1)}
                  aria-label={`Reculer « ${course.title} » dans l'ordre du dossier`}
                />
              </div>
            )}
          </div>
  
          <div className="p-4 flex-1 flex flex-col">
            <div className="mb-2">
              <span className="text-xs font-bold text-[var(--greek-gold)] uppercase tracking-wide">
                {course.subject || "Algèbre"}
              </span>
            </div>
            <h3
              className="font-bold text-lg text-[var(--greek-blue)] mb-2 line-clamp-1"
              title={course.title}
            >
              {course.title}
            </h3>
            <p className="text-gray-500 text-sm line-clamp-2 mb-4 flex-1">
              {course.description || "Aucune description"}
            </p>
  
            <div className="flex items-center justify-between pt-4 border-t border-[rgba(197,161,72,0.25)] mt-auto">
              <span className="text-xs text-gray-400">
                {formatDateFr(course.created_at)}
              </span>
              <div className="flex items-center gap-1">
                <GlassIconButton
                  icon={Eye}
                  onClick={() => {
                    // Ouverture synchrone AVANT tout await : voir handlePreview.
                    const win = openPreviewLoadingWindow();
                    void (async () => {
                      const full = await getFullCourse(course);
                      await handlePreview(full, win);
                    })();
                  }}
                  color="navy"
                  size="sm"
                  aria-label="Prévisualiser"
                />
                <GlassIconButton
                  icon={Edit}
                  onClick={async () => handleOpenModal("edit", await getFullCourse(course))}
                  color="navy"
                  size="sm"
                  aria-label="Modifier"
                />
                <GlassIconButton
                  icon={Download}
                  onClick={async () => {
                    const full = await getFullCourse(course);
                    exportAsJSON(full, "course", full.title);
                  }}
                  color="gold"
                  size="sm"
                  aria-label="Exporter JSON"
                />
                <GlassIconButton
                  icon={Trash2}
                  onClick={() => handleDelete(course)}
                  color="red"
                  size="sm"
                  aria-label="Supprimer"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
  </div>
  );
}
