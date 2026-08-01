"use client";

import { useState, useEffect } from "react";
import { useSessionFolderId } from "@/lib/useSessionFolderId";
import {
  Calculator, Play, ArrowLeft, Lock, CheckCircle, XCircle,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSubscription } from "@/lib/useSubscription";
import { getFolderIcon } from "@/lib/folderIcons";

interface FolderRow { id: number; parent_id: number | null; name: string; color?: string; icon?: string; grade_level?: string }
interface ExerciseRow {
  id: string; folder_id: number | null; title: string; description?: string; question?: string;
  difficulty_level?: string; thumbnail_url?: string; courses?: { title?: string };
}
type ExerciseProgress = Record<string, { status: string; score: number; attempts: number }>;

/** Navigation par dossiers + grille d'exercices : tout le jeu de données
 * (dossiers, exercices publiés, progression) arrive déjà chargé depuis le
 * serveur — plus de 3 aller-retours API au montage. Reste un client island
 * car la navigation entre dossiers doit rester instantanée (pas de rechargement
 * réseau à chaque clic) et persiste le dossier courant en sessionStorage.
 */
export default function ExercisesCatalog({
  allFolders, allExercises, levelFolderId, initialProgress,
}: {
  allFolders: FolderRow[];
  allExercises: ExerciseRow[];
  levelFolderId: number | null;
  initialProgress: ExerciseProgress;
}) {
  const sub = useSubscription();
  const [exerciseProgress, setExerciseProgress] = useState<ExerciseProgress>(initialProgress);
  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("child_exercises_folder");
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: number; name: string }[]>([]);

  // Repli localStorage pour un exercice sans historique DB (ancien
  // comportement conservé pour ne rien casser côté progression déjà stockée
  // localement chez des utilisateurs existants).
  useEffect(() => {
    setExerciseProgress((prev) => {
      const next = { ...prev };
      for (const ex of allExercises) {
        if (next[ex.id]) continue;
        const status = localStorage.getItem(`ex-${ex.id}-status`);
        const score = parseInt(localStorage.getItem(`ex-${ex.id}-score`) || "0");
        if (status) next[ex.id] = { status, score, attempts: 0 };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const currentFolders = allFolders.filter((f) => f.parent_id === displayParentId);
  const currentExercises = allExercises.filter((ex) => (ex.folder_id ?? null) === displayParentId);

  return (
    <div className="space-y-8">
      {currentFolderId !== null && (
        <button
          onClick={() => navigateToBreadcrumb(breadcrumbs.length - 2)}
          className="flex items-center gap-2 text-[var(--greek-blue)] bg-white px-5 py-2.5 rounded-xl border border-[rgba(197,161,72,0.25)] shadow-sm hover:bg-blue-50 hover:-translate-x-1 transition-all duration-300 w-fit font-bold"
        >
          <ArrowLeft size={20} />
          Retour
        </button>
      )}

      {currentFolders.length === 0 && currentExercises.length === 0 ? (
        <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[rgba(197,161,72,0.25)]">
          <Calculator className="w-16 h-16 text-[var(--greek-blue)] opacity-20 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">Dossier vide</h3>
          <p className="text-gray-500">Il n'y a pas d'exercices ici pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {currentFolders.map((folder, index) => (
            <div
              key={folder.id}
              onClick={() => navigateToFolder(folder.id, folder.name)}
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

          {currentExercises.map((exercise, index) => {
            const accessLevel = sub.features.access_level_exercises;
            const diff = exercise.difficulty_level;
            const isLocked = !sub.loading && (
              (accessLevel === "basic" && diff !== "easy" && diff !== "facile" && diff !== null) ||
              (accessLevel === "intermediate" && (diff === "hard" || diff === "difficile"))
            );
            const prog = exerciseProgress[exercise.id];
            const isPassed = prog?.status === "passed";
            const isFailed = prog?.status === "failed";
            const isDone = isPassed || isFailed;
            return (
              <div
                key={exercise.id}
                className={`group bg-white rounded-[20px] shadow-sm border-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full animate-fade-bounce ${isLocked ? "opacity-75" : ""} ${isPassed ? "border-green-400" : isFailed ? "border-red-400" : "border-[rgba(197,161,72,0.25)]"}`}
                style={{ animationDelay: `${(currentFolders.length + index) * 40}ms` }}
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
                      exercise.difficulty_level === "facile" || exercise.difficulty_level === "easy"
                        ? "bg-green-100 text-green-700"
                        : exercise.difficulty_level === "moyen" || exercise.difficulty_level === "medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {exercise.difficulty_level === "easy" ? "Facile" : exercise.difficulty_level === "medium" ? "Moyen" : exercise.difficulty_level === "hard" ? "Difficile" : exercise.difficulty_level || "Normal"}
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
                      <Link href="/parent/subscription" className="w-full bg-gray-100 text-gray-500 border border-[rgba(197,161,72,0.25)] py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold hover:bg-gray-200 transition-colors">
                        <Lock className="w-4 h-4" />
                        Débloquer — Plan supérieur
                      </Link>
                    ) : (
                      <Link
                        href={`/child/exercises/${exercise.id}`}
                        className="w-full btn-primary-greek py-3 flex items-center justify-center gap-2 group-hover:bg-[var(--greek-gold)] group-hover:text-[var(--greek-blue)] transition-colors"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        {isDone ? "Recommencer" : "Commencer"}
                      </Link>
                    )}
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
