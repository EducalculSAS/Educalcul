"use client";

import { useState, useEffect } from "react";
import { useSessionFolderId } from "@/lib/useSessionFolderId";
import { supabase } from "@/lib/supabaseClient";
import { BookOpen, Play, CheckCircle, Clock, Trophy, Folder as FolderIcon, ChevronRight, Home, ArrowLeft, XCircle } from "lucide-react";
import AppAdminLoader from "@/components/AppAdminLoader";
import Link from "next/link";
import { getFolderIcon } from "@/lib/folderIcons";

export default function ChildQuizPage() {
  const [loading, setLoading] = useState(true);
  const [allQuizzes, setAllQuizzes] = useState<any[]>([]);
  const [allFolders, setAllFolders] = useState<any[]>([]);
  const [quizProgress, setQuizProgress] = useState<Record<string, { status: string; score: number; attempts: number }>>({});

  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("child_quiz_folder");
  const [levelFolderId, setLevelFolderId] = useState<number | null>(null);
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

        // Fetch ALL Folders
        const folderUrl = `/api/child/folders?type=quiz${level ? `&level=${level}` : ""}&parent_id=all`;
        const folderRes = await fetch(folderUrl);
        let foldersData: any[] = [];
        if (folderRes.ok) {
          foldersData = await folderRes.json();
          setAllFolders(foldersData);
        }
        const lvl = String(level || "").toLowerCase().trim();
        const lf = (foldersData || []).find(
          (f: any) => f.parent_id == null && lvl && (
            String(f.grade_level || "").toLowerCase().trim() === lvl ||
            String(f.name || "").toLowerCase().trim() === lvl
          )
        );
        setLevelFolderId(lf?.id ?? null);

        // Fetch ALL published quizzes (cloisonnement par dossier, pas de
        // refiltrage par niveau qui masquait des quiz dans les sous-dossiers).
        const exRes = await fetch("/api/admin/quizzes?status=published");
        if (exRes.ok) {
          const allPublishedQuizzes = await exRes.json();
          let filtered = allPublishedQuizzes || [];
          setAllQuizzes(filtered);

          // Load progress from DB (fallback to localStorage)
          const dbHistory: Record<string, any[]> = {};
          if (session?.user) {
            try {
              const actRes = await fetch(`/api/child/activities?userId=${session.user.id}`);
              if (actRes.ok) {
                const act = await actRes.json();
                (act.quizzes || []).forEach((a: any) => {
                  dbHistory[a.quiz_id] = a.attempts_history || [];
                });
              }
            } catch (e) {
              console.error("Failed to load quiz progress", e);
            }
          }

          const prog: Record<string, { status: string; score: number; attempts: number }> = {};
          for (const q of filtered) {
            const history = dbHistory[q.id];
            if (history && history.length > 0) {
              const everPassed = history.some((a: any) => a.passed === true);
              const best = history.reduce((max: number, a: any) => Math.max(max, a.score_percent ?? 0), 0);
              prog[q.id] = { status: everPassed ? "passed" : "failed", score: best, attempts: history.length };
              continue;
            }
            const status = localStorage.getItem(`qz-${q.id}-status`);
            const score = parseInt(localStorage.getItem(`qz-${q.id}-score`) || "0");
            if (status) prog[q.id] = { status, score, attempts: 0 };
          }
          setQuizProgress(prog);
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

  // Reconstruct breadcrumbs (on s'arrête au dossier de niveau, racine virtuelle).
  useEffect(() => {
    if (allFolders.length === 0 || currentFolderId === null) {
      setBreadcrumbs([]);
      return;
    }
    const path: { id: number; name: string }[] = [];
    let f = allFolders.find((x) => x.id === currentFolderId);
    while (f && f.id !== levelFolderId) {
      path.unshift({ id: f.id, name: f.name });
      f = f.parent_id ? allFolders.find((x) => x.id === f.parent_id) : undefined;
    }
    setBreadcrumbs(path);
  }, [allFolders, currentFolderId, levelFolderId]);

  const displayParentId = currentFolderId === null ? levelFolderId : currentFolderId;
  const currentQuizzes = allQuizzes.filter(q => (q.folder_id ?? null) === displayParentId);
  const currentFolders = allFolders.filter(f => f.parent_id === displayParentId);

  if (loading && allQuizzes.length === 0 && allFolders.length === 0) {
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
              <Trophy className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
              QUIZ & DÉFIS
            </h1>
            <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
              <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">DÉFI</span>
              <span>Teste tes connaissances et gagne des trophées !</span>
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

        {currentFolders.length === 0 && currentQuizzes.length === 0 ? (
          <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[rgba(197,161,72,0.25)]">
            <Trophy className="w-16 h-16 text-[var(--greek-blue)] opacity-20 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">
              Dossier vide
            </h3>
            <p className="text-gray-500">
              Reviens plus tard pour de nouveaux défis !
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

            {/* Render Quizzes */}
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
                  <div className="absolute inset-0 opacity-10 pattern-grid-lg"></div>
                  {quiz.thumbnail_filename ? (
                    <img
                      src={`/uploads/quiz_thumbnails/${quiz.thumbnail_filename}`}
                      alt={quiz.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <img src="/logo.png" alt="Educalcul" className="w-16 h-16 object-contain opacity-30" />
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
                      (quiz.difficulty_level === "easy" || quiz.difficulty_level === "facile")
                        ? "bg-green-100 text-green-700"
                        : (quiz.difficulty_level === "medium" || quiz.difficulty_level === "moyen")
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
                  <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 line-clamp-2">
                    {quiz.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-6 line-clamp-3 flex-grow">
                    {quiz.description || "Relève ce défi pour prouver tes compétences !"}
                  </p>

                  <div className="mt-auto">
                    <Link
                      href={`/child/quiz/${quiz.id}`}
                      className="w-full btn-primary-greek py-3 flex items-center justify-center gap-2 group-hover:bg-[var(--greek-gold)] group-hover:text-[var(--greek-blue)] transition-colors"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {isDone ? "Recommencer" : "Lancer le Quiz"}
                    </Link>
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


