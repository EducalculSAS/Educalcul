"use client";

import { useKatexIn } from "@/lib/useKatexIn";
import { useState, useEffect, useRef } from "react";
import { useSessionFolderId } from "@/lib/useSessionFolderId";
import { BookOpen, Play, CheckCircle, ArrowLeft, Lock } from "lucide-react";
import Image from "next/image";
import { getFolderIcon } from "@/lib/folderIcons";
import GlassButton from "@/components/ui/GlassButton";
import { compareCourseOrder } from "@/lib/courseOrder";
import { isFolderInLevelScope } from "@/lib/childCatalog";
import LevelScopePicker from "@/components/child/LevelScopePicker";

interface FolderRow { id: number; parent_id: number | null; name: string; color?: string; icon?: string; grade_level?: string; display_order?: number }
interface CourseRow {
  id: string; folder_id: number | null; title: string; description?: string;
  thumbnail_url?: string; subject?: string; lesson_count?: number;
  chapter_order?: number | null; is_theme_summary?: boolean | null;
}
type CourseProgress = Record<string, { status: string; pct: number }>;

/** Navigation par dossiers + grille de cours. Données chargées côté serveur ;
 * reste un client island pour la navigation instantanée entre dossiers
 * (sessionStorage) et le rendu KaTeX des titres/descriptions (chargé depuis
 * un CDN au montage, comme avant). */
export default function CoursesCatalog({
  allFolders, allCourses, levelFolderId, rootFolderIds, courseProgress,
}: {
  allFolders: FolderRow[];
  allCourses: CourseRow[];
  levelFolderId: number | null;
  /** Plusieurs niveaux visibles : un dossier racine par niveau (voir resolveLevelScope). */
  rootFolderIds?: number[] | null;
  courseProgress: CourseProgress;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("child_cours_folder");
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: number; name: string }[]>([]);
  const [selectedRootId, setSelectedRootId] = useState<number | null>(rootFolderIds?.[0] ?? null);
  const activeRootId = rootFolderIds?.includes(selectedRootId ?? -1) ? selectedRootId : rootFolderIds?.[0] ?? null;
  const rootFolderScopeKey = rootFolderIds?.join(",") ?? "";
  const hasMultipleRoots = (rootFolderIds?.length ?? 0) > 1;

  useEffect(() => {
    if (hasMultipleRoots) {
      setCurrentFolderId(null);
      setBreadcrumbs([]);
    }
  }, [rootFolderScopeKey, hasMultipleRoots, setCurrentFolderId]);

  useEffect(() => {
    if (currentFolderId !== null && !isFolderInLevelScope(allFolders, currentFolderId, { levelFolderId, rootFolderIds: rootFolderIds ?? null })) {
      setCurrentFolderId(null);
      return;
    }
    if (allFolders.length === 0 || currentFolderId === null) {
      setBreadcrumbs([]);
      return;
    }
    const path: { id: number; name: string }[] = [];
    let f = allFolders.find((x) => x.id === currentFolderId);
    while (f && f.id !== levelFolderId) {
      path.unshift({ id: f.id, name: f.name });
      const parentId = f.parent_id;
      f = parentId ? allFolders.find((x) => x.id === parentId) : undefined;
    }
    setBreadcrumbs(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFolders, currentFolderId, levelFolderId, rootFolderIds, setCurrentFolderId]);

  const displayParentId = currentFolderId === null ? (rootFolderIds ? activeRootId : levelFolderId) : currentFolderId;
  // Ordre pédagogique réglé par l'admin (chapter_order, initialisé depuis le
  // programme : thème puis chapitre). Un cours sans ordre va en FIN de liste
  // — `?? 0` le plaçait en tête — et les ex æquo se départagent par titre.
  const currentCourses = allCourses
    .filter((c) => (c.folder_id ?? null) === displayParentId)
    .sort(compareCourseOrder);
  const currentFolders = allFolders
    .filter((f) => (displayParentId === null && rootFolderIds ? rootFolderIds.includes(f.id) : f.parent_id === displayParentId))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  // Formules rendues en place, sans masquer la page (avant : opacité 0 puis 1,
  // la page « clignotait » à chaque mise à jour).
  useKatexIn(gridRef, [displayParentId, allCourses]);

  const navigateToFolder = (folderId: number, folderName: string) => {
    setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
    setCurrentFolderId(folderId);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setBreadcrumbs([]);
      setCurrentFolderId(null);
    } else {
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
      setCurrentFolderId(breadcrumbs[index].id);
    }
  };

  return (
    <div className="space-y-8" ref={gridRef}>
      {rootFolderIds && activeRootId !== null && (
        <LevelScopePicker
          folders={allFolders}
          rootFolderIds={rootFolderIds}
          value={activeRootId}
          onChange={(rootId) => {
            setSelectedRootId(rootId);
            setCurrentFolderId(null);
            setBreadcrumbs([]);
          }}
        />
      )}
      {currentFolderId !== null && (
        <GlassButton
          onClick={() => navigateToBreadcrumb(breadcrumbs.length - 2)}
          variant="outline" size="sm"
        >
          <ArrowLeft size={20} />
          Retour
        </GlassButton>
      )}

      {currentFolders.length === 0 && currentCourses.length === 0 ? (
        <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[rgba(197,161,72,0.25)]">
          <BookOpen className="w-16 h-16 text-[var(--greek-blue)] opacity-20 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">Dossier vide</h3>
          <p className="text-gray-500">Reviens plus tard pour découvrir de nouveaux contenus !</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {currentFolders.map((folder, index) => {
            const FolderCardIcon = getFolderIcon(folder.icon);
            return (
              <div
                key={folder.id}
                onClick={() => navigateToFolder(folder.id, folder.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigateToFolder(folder.id, folder.name);
                  }
                }}
                className="group bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 flex flex-col items-center justify-center text-center aspect-[4/3] animate-fade-bounce"
                style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
              >
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${folder.color || "#3b82f6"}15`, color: folder.color || "#3b82f6" }}
                >
                  <FolderCardIcon size={40} fill="currentColor" fillOpacity={0.2} />
                </div>
                <h3 className="font-bold text-[var(--greek-blue)] text-xl w-full px-2">{folder.name}</h3>
              </div>
            );
          })}

          {currentCourses.map((course, index) => {
            const prog = courseProgress[course.id];
            const isCompleted = prog?.status === "completed" || (prog?.pct ?? 0) >= 100;
            const isInProgress = !isCompleted && prog && prog.pct > 0;
            const totalL = course.lesson_count ?? 0;
            const donePct = prog?.pct ?? 0;

            // Chaque cours d'un thème doit être lu dans l'ordre : le premier
            // est toujours accessible, les suivants se débloquent seulement
            // une fois le cours précédent terminé (checklist comprise, voir
            // le blocage déjà en place dans CourseViewer). "Terminé" est déjà
            // strictement défini par l'avancée jusqu'à la dernière leçon.
            const previousCourse = index > 0 ? currentCourses[index - 1] : null;
            const previousProg = previousCourse ? courseProgress[previousCourse.id] : null;
            const previousCompleted = previousProg?.status === "completed" || (previousProg?.pct ?? 0) >= 100;
            const isLocked = index > 0 && !previousCompleted;

            return (
              <div
                key={course.id}
                className={`group bg-white rounded-[20px] shadow-sm border-2 transition-all duration-300 overflow-hidden flex flex-col h-full animate-fade-bounce ${isLocked ? "opacity-60" : "hover:shadow-xl hover:-translate-y-1"} ${isCompleted ? "border-green-400" : "border-[rgba(197,161,72,0.25)]"}`}
                style={{ animationDelay: `${Math.min(currentFolders.length + index, 6) * 30}ms` }}
              >
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  {course.thumbnail_url ? (
                    <Image src={course.thumbnail_url} alt={course.title} fill sizes="(max-width: 768px) 100vw, 33vw" className={`object-cover transition-transform duration-500 ${isLocked ? "grayscale" : "group-hover:scale-110"}`} />
                  ) : (
                    <Image src="/logo.png" alt="Vignette par défaut du cours" width={80} height={80} className="w-20 h-20 object-contain opacity-30 m-auto" />
                  )}
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-[var(--greek-blue)] shadow-sm">
                    {course.subject || "Mathématiques"}
                  </div>
                  {isCompleted && (
                    <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Terminé
                    </div>
                  )}
                  {isLocked && (
                    <div className="absolute inset-0 bg-[var(--greek-blue)]/50 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-[var(--greek-blue)]" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 line-clamp-2">{course.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow">
                    {isLocked ? "Termine le cours précédent pour débloquer celui-ci." : (course.description || "Découvre ce chapitre passionnant !")}
                  </p>

                  {isInProgress && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{donePct}% complété</span>
                        {totalL > 0 && <span>{Math.round((donePct * totalL) / 100)}/{totalL} leçons</span>}
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--greek-gold)] rounded-full transition-all" style={{ width: `${donePct}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="mt-auto">
                    <GlassButton
                      href={isLocked ? undefined : `/child/cours/${course.id}`}
                      variant={isLocked ? "outline" : "navy"} fullWidth size="sm"
                      disabled={isLocked}
                    >
                      {isLocked ? (
                        <>
                          <Lock className="w-4 h-4" />
                          Verrouillé
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          {isCompleted ? "Revoir" : isInProgress ? "Reprendre" : "Commencer"}
                        </>
                      )}
                    </GlassButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
