"use client";

import FolderEmblem from "@/components/child/FolderEmblem";
import { compareDisplayOrder } from "@/lib/contentOrder";
import Emblem3D from "@/components/Emblem3D";
import { useState, useEffect } from "react";
import { useSessionFolderId } from "@/lib/useSessionFolderId";
import { Play, CheckCircle, XCircle, ArrowLeft, Lock } from "lucide-react";
import Image from "next/image";
import { useSubscription } from "@/lib/useSubscription";
import { isDifficultyAllowed } from "@/lib/difficultyAccess";
import { DIFFICULTY_LABELS, normalizeDifficulty } from "@/lib/difficultyLevels";
import GlassButton from "@/components/ui/GlassButton";
import { isFolderInLevelScope } from "@/lib/childCatalog";
import FolderLevelBadge from "@/components/ui/FolderLevelBadge";
import LevelScopePicker from "@/components/child/LevelScopePicker";

interface FolderRow { id: number; parent_id: number | null; name: string; color?: string; icon?: string; grade_level?: string; display_order?: number | null }
interface QuizRow {
  id: string; folder_id: number | null; course_id?: string | number | null; title: string; description?: string;
  thumbnail_filename?: string; difficulty_level?: string; courses?: { title?: string };
}
type QuizProgress = Record<string, { status: string; score: number; attempts: number }>;

/** Navigation par dossiers + grille de quiz : même recette que
 * ExercisesCatalog/CoursesCatalog (données prêtes côté serveur, navigation
 * de dossiers en client island pour rester instantanée). */
export default function QuizCatalog({
  allFolders, allQuizzes, levelFolderId, rootFolderIds, initialProgress, filterCourseId,
}: {
  allFolders: FolderRow[];
  allQuizzes: QuizRow[];
  levelFolderId: number | null;
  /** Plusieurs niveaux visibles : un dossier racine par niveau (voir resolveLevelScope). */
  rootFolderIds?: number[] | null;
  initialProgress: QuizProgress;
  /** Quand présent, affiche uniquement les quiz de ce cours (venant du
   * bouton "Tenter le quiz" en fin de cours) au lieu de la navigation par
   * dossiers. */
  filterCourseId?: string | number | null;
}) {
  const sub = useSubscription();
  const [quizProgress] = useState<QuizProgress>(initialProgress);
  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("child_quiz_folder");
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

  const renderQuizCard = (quiz: QuizRow, index: number, indexOffset: number) => {
    const difficulty = normalizeDifficulty(quiz.difficulty_level);
    const isLocked = !sub.loading && !isDifficultyAllowed(sub.features.access_level_exercises, difficulty);
    const prog = quizProgress[quiz.id];
    const isPassed = prog?.status === "passed";
    const isFailed = prog?.status === "failed";
    const isDone = isPassed || isFailed;
    return (
      <div
        key={quiz.id}
        className={`group bg-white rounded-[20px] shadow-sm border-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full animate-fade-bounce ${isLocked ? "opacity-75" : ""} ${isPassed ? "border-green-400" : isFailed ? "border-red-400" : "border-[rgba(197,161,72,0.25)]"}`}
        style={{ animationDelay: `${Math.min(indexOffset + index, 6) * 30}ms` }}
      >
        <div className="relative h-40 bg-[var(--greek-blue)]/10 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-10 pattern-grid-lg" />
          {quiz.thumbnail_filename ? (
            <Image src={`/uploads/quiz_thumbnails/${quiz.thumbnail_filename}`} alt={quiz.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover group-hover:scale-110 transition-transform duration-500" />
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
          <div className="mb-2">
            <span className="text-xs font-bold text-[var(--greek-gold)] uppercase tracking-wider">
              {quiz.courses?.title || "Général"}
            </span>
          </div>
          <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 line-clamp-2">{quiz.title}</h3>
          <p className="text-gray-600 text-sm mb-6 line-clamp-3 flex-grow">
            {quiz.description || "Relève ce défi pour prouver tes compétences !"}
          </p>
          <div className="mt-auto">
            {isLocked ? (
              <p className="flex items-center justify-center gap-2 rounded-full border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/60 px-4 py-2 text-xs font-semibold text-gray-500 text-center">
                <Lock className="w-4 h-4 shrink-0" />
                Dans une autre formule. Demande à tes parents !
              </p>
            ) : (
              <GlassButton
                href={`/child/quiz/${quiz.id}`}
                variant="navy" fullWidth size="sm"
              >
                <Play className="w-4 h-4 fill-current" />
                {isDone ? "Recommencer" : "Lancer le Quiz"}
              </GlassButton>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (filterCourseId != null) {
    const courseQuizzes = allQuizzes.filter((q) => String(q.course_id ?? "") === String(filterCourseId)).sort(compareDisplayOrder);
    const courseTitle = courseQuizzes[0]?.courses?.title;
    return (
      <div className="space-y-8">
        <GlassButton href="/child/quiz" variant="outline" size="sm">
          <ArrowLeft size={20} />
          Tous les quiz
        </GlassButton>

        {courseQuizzes.length === 0 ? (
          <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[rgba(197,161,72,0.25)]">
            <div className="mb-4"><Emblem3D kind="trophy" size={88} /></div>
            <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">Pas encore de quiz</h3>
            <p className="text-gray-500">Ce cours n&apos;a pas encore de quiz associé.</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-[var(--greek-blue)]">
              Quiz {courseTitle ? ` : ${courseTitle}` : "de ce cours"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courseQuizzes.map((quiz, index) => renderQuizCard(quiz, index, 0))}
            </div>
          </>
        )}
      </div>
    );
  }

  const displayParentId = currentFolderId === null ? (rootFolderIds ? activeRootId : levelFolderId) : currentFolderId;
  const currentQuizzes = allQuizzes.filter((q) => (q.folder_id ?? null) === displayParentId).sort(compareDisplayOrder);
  const currentFolders = allFolders.filter((f) => (displayParentId === null && rootFolderIds ? rootFolderIds.includes(f.id) : f.parent_id === displayParentId))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

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

      {currentFolders.length === 0 && currentQuizzes.length === 0 ? (
        <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[rgba(197,161,72,0.25)]">
          <div className="mb-4"><Emblem3D kind="trophy" size={88} /></div>
          <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">Dossier vide</h3>
          <p className="text-gray-500">Reviens plus tard pour de nouveaux défis !</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {currentFolders.map((folder, index) => (
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
              className="group bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 flex flex-col items-center justify-center text-center animate-fade-bounce"
              style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
            >
              <FolderEmblem icon={folder.icon} color={folder.color} />
              <h3 className="font-bold text-[var(--greek-blue)] text-xl w-full px-2">{folder.name}</h3>
              <FolderLevelBadge gradeLevel={folder.grade_level} color={folder.color} />
            </div>
          ))}

          {currentQuizzes.map((quiz, index) => renderQuizCard(quiz, index, currentFolders.length))}
        </div>
      )}
    </div>
  );
}
