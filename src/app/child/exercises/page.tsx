"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Calculator,
  Play,
  Star,
  Brain,
  Folder as FolderIcon,
  ChevronRight,
  Home,
  ArrowLeft,
  Lock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import AppAdminLoader from "@/components/AppAdminLoader";
import Link from "next/link";
import { useSubscription } from "@/lib/useSubscription";
import { getFolderIcon } from "@/lib/folderIcons";

export default function ChildExercisesPage() {
  const sub = useSubscription();
  const [loading, setLoading] = useState(true);
  const [allExercises, setAllExercises] = useState<any[]>([]);
  const [allFolders, setAllFolders] = useState<any[]>([]);
  const [exerciseProgress, setExerciseProgress] = useState<Record<string, { status: string; score: number }>>({});

  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    const fetchEverything = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let level = null;
        if (session) {
          const { data: userData } = await supabase
            .from("users")
            .select("grade_level")
            .eq("auth_id", session.user.id)
            .maybeSingle();
          level = userData?.grade_level || null;
        }

        // Fetch ALL Folders for this level
        const folderUrl = `/api/child/folders?type=exercise${level ? `&level=${level}` : ""}&parent_id=all`;
        const folderRes = await fetch(folderUrl);
        if (folderRes.ok) {
          setAllFolders(await folderRes.json());
        }

        // Fetch ALL published exercises
        const exRes = await fetch("/api/admin/exercises?status=published");
        if (exRes.ok) {
          const allPublishedExercises = await exRes.json();
          let filtered = allPublishedExercises || [];
          if (level) {
            filtered = filtered.filter((ex: any) => ex.level?.toLowerCase() === level.toLowerCase());
          }
          setAllExercises(filtered);

          // Load progress from localStorage
          const prog: Record<string, { status: string; score: number }> = {};
          for (const ex of filtered) {
            const status = localStorage.getItem(`ex-${ex.id}-status`);
            const score = parseInt(localStorage.getItem(`ex-${ex.id}-score`) || "0");
            if (status) prog[ex.id] = { status, score };
          }
          setExerciseProgress(prog);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEverything();
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

  const currentFolders = allFolders.filter(f => f.parent_id === currentFolderId);
  const currentExercises = allExercises.filter(ex => (ex.folder_id ?? null) === currentFolderId);

  if (loading && allExercises.length === 0 && allFolders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AppAdminLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <div className="bg-[var(--greek-blue)] text-white pt-20 pb-12 px-8 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
              <Brain className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
              EXERCICES
            </h1>
            <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
              <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">ENTRAÎNEMENT</span>
              <span>Pratique et améliore tes compétences !</span>
            </p>
          </div>
        </div>
      </div>
    <div className="container mx-auto px-4 pb-12 max-w-6xl">

      <div className="space-y-8">
        {/* Back Button */}
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
            <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">
              Dossier vide
            </h3>
            <p className="text-gray-500">
              Il n'y a pas d'exercices ici pour le moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Render Folders */}
            {currentFolders.map((folder, index) => (
              <div
                key={folder.id}
                onClick={() => navigateToFolder(folder.id, folder.name)}
                className="group bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 flex flex-col items-center justify-center text-center aspect-[4/3] animate-fade-bounce"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: `${folder.color || "#3b82f6"}15`,
                    color: folder.color || "#3b82f6",
                  }}
                >
                  {(() => { const I = getFolderIcon(folder.icon); return <I size={40} fill="currentColor" fillOpacity={0.2} />; })()}
                </div>
                <h3 className="font-bold text-[var(--greek-blue)] text-xl w-full px-2">
                  {folder.name}
                </h3>
              </div>
            ))}

            {/* Render Exercises */}
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
                  <div className="absolute inset-0 opacity-20 pattern-grid-lg"></div>
                  {exercise.thumbnail_url ? (
                    <img src={exercise.thumbnail_url} alt={exercise.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <img src="/logo.png" alt="Educalcul" className="w-16 h-16 object-contain opacity-30" />
                  )}
                  {isDone && (
                    <div className={`absolute top-4 left-4 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${isPassed ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                      {isPassed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {isPassed ? `Réussi ${prog.score}%` : `Échoué ${prog.score}%`}
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
                    <div className="flex items-center text-[var(--greek-gold)] text-sm font-bold">
                      <Star className="w-3 h-3 fill-current mr-1" />
                      {exercise.points_reward || 10} XP
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 line-clamp-2">
                    {exercise.title}
                  </h3>
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
    </div>
    </div>
  );
}


