"use client";

import { useState, useEffect } from "react";
import { useSessionFolderId } from "@/lib/useSessionFolderId";
import { Trophy, Play, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { getFolderIcon } from "@/lib/folderIcons";
import GlassButton from "@/components/ui/GlassButton";

interface FolderRow { id: number; parent_id: number | null; name: string; color?: string; icon?: string; grade_level?: string }
interface QuizRow {
  id: string; folder_id: number | null; title: string; description?: string;
  thumbnail_filename?: string; difficulty_level?: string; courses?: { title?: string };
}
type QuizProgress = Record<string, { status: string; score: number; attempts: number }>;

/** Navigation par dossiers + grille de quiz : même recette que
 * ExercisesCatalog/CoursesCatalog (données prêtes côté serveur, navigation
 * de dossiers en client island pour rester instantanée). */
export default function QuizCatalog({
  allFolders, allQuizzes, levelFolderId, initialProgress,
}: {
  allFolders: FolderRow[];
  allQuizzes: QuizRow[];
  levelFolderId: number | null;
  initialProgress: QuizProgress;
}) {
  const [quizProgress] = useState<QuizProgress>(initialProgress);
  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("child_quiz_folder");
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: number; name: string }[]>([]);

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
  }, [allFolders, currentFolderId, levelFolderId]);

  const displayParentId = currentFolderId === null ? levelFolderId : currentFolderId;
  const currentQuizzes = allQuizzes.filter((q) => (q.folder_id ?? null) === displayParentId);
  const currentFolders = allFolders.filter((f) => f.parent_id === displayParentId);

  return (
    <div className="space-y-8">
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
          <Trophy className="w-16 h-16 text-[var(--greek-blue)] opacity-20 mx-auto mb-4" />
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
              className="group bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 flex flex-col items-center justify-center text-center aspect-[4/3] animate-fade-bounce"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${folder.color || "#3b82f6"}15`, color: folder.color || "#3b82f6" }}
              >
                {(() => { const I = getFolderIcon(folder.icon); return <I size={40} fill="currentColor" fillOpacity={0.2} />; })()}
              </div>
              <h3 className="font-bold text-[var(--greek-blue)] text-xl w-full px-2">{folder.name}</h3>
            </div>
          ))}

          {currentQuizzes.map((quiz, index) => {
            const prog = quizProgress[quiz.id];
            const isPassed = prog?.status === "passed";
            const isFailed = prog?.status === "failed";
            const isDone = isPassed || isFailed;
            return (
              <div
                key={quiz.id}
                className={`group bg-white rounded-[20px] shadow-sm border-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full animate-fade-bounce ${isPassed ? "border-green-400" : isFailed ? "border-red-400" : "border-[rgba(197,161,72,0.25)]"}`}
                style={{ animationDelay: `${(currentFolders.length + index) * 40}ms` }}
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
                      quiz.difficulty_level === "easy" || quiz.difficulty_level === "facile"
                        ? "bg-green-100 text-green-700"
                        : quiz.difficulty_level === "medium" || quiz.difficulty_level === "moyen"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {quiz.difficulty_level
                      ? (quiz.difficulty_level === "easy" ? "Facile" :
                         quiz.difficulty_level === "medium" ? "Moyen" :
                         quiz.difficulty_level === "hard" ? "Difficile" :
                         quiz.difficulty_level === "expert" ? "Expert" :
                         quiz.difficulty_level)
                      : "Normal"}
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
                    <GlassButton
                      href={`/child/quiz/${quiz.id}`}
                      variant="navy" fullWidth size="sm"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {isDone ? "Recommencer" : "Lancer le Quiz"}
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
