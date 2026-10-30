"use client";

import { compareDisplayOrder } from "@/lib/contentOrder";
import { useState, useEffect } from "react";
import { useSessionFolderId } from "@/lib/useSessionFolderId";
import {
  Calculator, Play, ArrowLeft, Lock, CheckCircle, XCircle,
} from "lucide-react";
import Image from "next/image";
import { useSubscription } from "@/lib/useSubscription";
import { getFolderIcon } from "@/lib/folderIcons";
import { isDifficultyAllowed } from "@/lib/difficultyAccess";
import { DIFFICULTY_LABELS, normalizeDifficulty } from "@/lib/difficultyLevels";
import FolderLevelBadge from "@/components/ui/FolderLevelBadge";
import GlassButton from "@/components/ui/GlassButton";
import { isFolderInLevelScope } from "@/lib/childCatalog";
import LevelScopePicker from "@/components/child/LevelScopePicker";

interface FolderRow { id: number; parent_id: number | null; name: string; color?: string; icon?: string; grade_level?: string; display_order?: number | null }
interface ExerciseRow {
  id: string; folder_id: number | null; course_id?: string | number | null; title: string; description?: string; question?: string;
  difficulty_level?: string; thumbnail_url?: string; courses?: { title?: string };
}
type ExerciseProgress = Record<string, { status: string; score: number; attempts: number }>;

/** Navigation par dossiers + grille d'exercices : tout le jeu de données
 * (dossiers, exercices publiés, progression) arrive déjà chargé depuis le
 * serveur — plus de 3 aller-retours API au montage. Reste un client island
 * car la navigation entre dossiers doit rester instantanée (pas de rechargement
 * réseau à chaque clic) et persiste le dossier courant dans un cookie de
 * session (voir useSessionFolderId.ts).
 */
export default function ExercisesCatalog({
  allFolders, allExercises, levelFolderId, rootFolderIds, initialProgress, filterCourseId,
}: {
  allFolders: FolderRow[];
  allExercises: ExerciseRow[];
  levelFolderId: number | null;
  /** Plusieurs niveaux visibles : un dossier racine par niveau (voir resolveLevelScope). */
  rootFolderIds?: number[] | null;
  initialProgress: ExerciseProgress;
  /** Quand présent, affiche uniquement les exercices de ce cours (venant du
   * bouton "Faire les exercices" en fin de cours) au lieu de la navigation
   * par dossiers. */
  filterCourseId?: string | number | null;
}) {
  const sub = useSubscription();
  const [exerciseProgress] = useState<ExerciseProgress>(initialProgress);
  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("child_exercises_folder");
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
  }, [allFolders, currentFolderId, levelFolderId, rootFolderIds, setCurrentFolderId]);

  const renderExerciseCard = (exercise: ExerciseRow, index: number, indexOffset: number) => {
    const difficulty = normalizeDifficulty(exercise.difficulty_level);
    const isLocked = !sub.loading && !isDifficultyAllowed(sub.features.access_level_exercises, difficulty);
    const prog = exerciseProgress[exercise.id];
    const isPassed = prog?.status === "passed";
    const isFailed = prog?.status === "failed";
    const isDone = isPassed || isFailed;
    return (
      <div
        key={exercise.id}
        className={`group bg-white rounded-[20px] shadow-sm border-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full animate-fade-bounce ${isLocked ? "opacity-75" : ""} ${isPassed ? "border-green-400" : isFailed ? "border-red-400" : "border-[rgba(197,161,72,0.25)]"}`}
        style={{ animationDelay: `${Math.min(indexOffset + index, 6) * 30}ms` }}
      >
        <div className="relative h-40 bg-[var(--greek-cream)] overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-20 pattern-grid-lg" />
          {exercise.thumbnail_url ? (
            <Image src={exercise.thumbnail_url} alt={exercise.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover group-hover:scale-110 transition-transform duration-500" />
          ) : (
            <Image src="/logo.png" alt="Educalcul" width={64} height={64} className="w-16 h-16 object-contain opacity-30" />
          )}
          {isDone && (
            <div className={`absolute top-4 left-4 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${isPassed ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
              {isPassed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {isPassed ? `Réussi ${prog.score}%` : `Échoué ${prog.score}%`}
              {prog.attempts > 0 && ` · ${prog.attempts} tentative${prog.attempts > 1 ? "s" : ""}`}
            </div>
          )}
          <div
            className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
              difficulty === "facile"
                ? "bg-green-100 text-green-700"
                : difficulty === "moyen"
                ? "bg-yellow-100 text-yellow-700"
                : difficulty === "avance"
                ? "bg-orange-100 text-orange-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {DIFFICULTY_LABELS[difficulty]}
          </div>
        </div>

        <div className="p-6 flex flex-col flex-grow">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--greek-gold)] uppercase tracking-wider">
              {exercise.courses?.title || "Mathématiques"}
            </span>
          </div>
          <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 line-clamp-2">{exercise.title}</h3>
          <p className="text-gray-600 text-sm mb-6 line-clamp-3 flex-grow">
            {exercise.description || exercise.question || "Entraîne-toi sur ce sujet !"}
          </p>
          <div className="mt-auto">
            {isLocked ? (
              <GlassButton href="/parent/subscription" variant="ghost" fullWidth size="sm">
                <Lock className="w-4 h-4" />
                Débloquer : Plan supérieur
              </GlassButton>
            ) : (
              <GlassButton
                href={`/child/exercises/${exercise.id}`}
                variant="navy" fullWidth size="sm"
              >
                <Play className="w-4 h-4 fill-current" />
                {isDone ? "Recommencer" : "Commencer"}
              </GlassButton>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (filterCourseId != null) {
    const courseExercises = allExercises.filter((ex) => String(ex.course_id ?? "") === String(filterCourseId)).sort(compareDisplayOrder);
    const courseTitle = courseExercises[0]?.courses?.title;
    return (
      <div className="space-y-8">
        <GlassButton href="/child/exercises" variant="outline" size="sm">
          <ArrowLeft size={20} />
          Tous les exercices
        </GlassButton>

        {courseExercises.length === 0 ? (
          <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[rgba(197,161,72,0.25)]">
            <Calculator className="w-16 h-16 text-[var(--greek-blue)] opacity-20 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">Pas encore d&apos;exercices</h3>
            <p className="text-gray-500">Ce cours n&apos;a pas encore d&apos;exercices associés.</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-[var(--greek-blue)]">
              Exercices {courseTitle ? ` : ${courseTitle}` : "de ce cours"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courseExercises.map((exercise, index) => renderExerciseCard(exercise, index, 0))}
            </div>
          </>
        )}
      </div>
    );
  }

  const displayParentId = currentFolderId === null ? (rootFolderIds ? activeRootId : levelFolderId) : currentFolderId;
  const currentFolders = allFolders.filter((f) => (displayParentId === null && rootFolderIds ? rootFolderIds.includes(f.id) : f.parent_id === displayParentId))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const currentExercises = allExercises.filter((ex) => (ex.folder_id ?? null) === displayParentId).sort(compareDisplayOrder);

  return (
    <div className="space-y-8">
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

      {currentFolders.length === 0 && currentExercises.length === 0 ? (
        <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[rgba(197,161,72,0.25)]">
          <Calculator className="w-16 h-16 text-[var(--greek-blue)] opacity-20 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">Dossier vide</h3>
          <p className="text-gray-500">Il n&apos;y a pas d&apos;exercices ici pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {currentFolders.map((folder, index) => (
            <div
              key={folder.id}
              onClick={() => navigateToFolder(folder.id, folder.name)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigateToFolder(folder.id, folder.name); } }}
              className="group bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 flex flex-col items-center justify-center text-center aspect-[4/3] animate-fade-bounce"
              style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${folder.color || "#3b82f6"}15`, color: folder.color || "#3b82f6" }}
              >
                {(() => { const I = getFolderIcon(folder.icon); return <I size={40} fill="currentColor" fillOpacity={0.2} aria-hidden="true" />; })()}
              </div>
              <h3 className="font-bold text-[var(--greek-blue)] text-xl w-full px-2">{folder.name}</h3>
              <FolderLevelBadge gradeLevel={folder.grade_level} color={folder.color} />
            </div>
          ))}

          {currentExercises.map((exercise, index) => renderExerciseCard(exercise, index, currentFolders.length))}
        </div>
      )}
    </div>
  );
}
