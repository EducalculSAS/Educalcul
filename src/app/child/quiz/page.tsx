"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BookOpen, Play, CheckCircle, Clock, Trophy, Folder as FolderIcon, ChevronRight, Home, ArrowLeft } from "lucide-react";
import MathLoader from "@/components/MathLoader";
import Link from "next/link";

export default function ChildQuizPage() {
  const [loading, setLoading] = useState(true);
  const [allQuizzes, setAllQuizzes] = useState<any[]>([]);
  const [allFolders, setAllFolders] = useState<any[]>([]);
  
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

        // Fetch ALL Folders
        const folderUrl = `/api/child/folders?type=quiz${level ? `&level=${level}` : ""}&parent_id=all`;
        const folderRes = await fetch(folderUrl);
        if (folderRes.ok) {
          setAllFolders(await folderRes.json());
        }

        // Fetch ALL published quizzes
        const exRes = await fetch("/api/admin/quizzes?status=published");
        if (exRes.ok) {
          const allPublishedQuizzes = await exRes.json();
          let filtered = allPublishedQuizzes || [];
          if (level) {
            filtered = filtered.filter((q: any) => q.level?.toLowerCase() === level.toLowerCase());
          }
          setAllQuizzes(filtered);
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

  const currentQuizzes = allQuizzes.filter(q => q.folder_id === currentFolderId);
  const currentFolders = allFolders.filter(f => f.parent_id === currentFolderId);

  if (loading && allQuizzes.length === 0 && allFolders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <MathLoader />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-[var(--greek-blue)] mb-3 font-[family-name:var(--font-display)] drop-shadow-sm">
          <Trophy className="inline-block w-10 h-10 mr-3 mb-1 text-[var(--greek-gold)]" />
          Quiz & Défis
        </h1>
        <p className="text-gray-600 text-lg">
          Teste tes connaissances et gagne des trophées !
        </p>
      </div>

      <div className="space-y-8">
        {/* Back Button */}
        {currentFolderId !== null && (
          <button
            onClick={() => navigateToBreadcrumb(breadcrumbs.length - 2)}
            className="flex items-center gap-2 text-[var(--greek-blue)] bg-white px-5 py-2.5 rounded-xl border border-[var(--card-border-antique)] shadow-sm hover:bg-blue-50 hover:-translate-x-1 transition-all duration-300 w-fit font-bold"
          >
            <ArrowLeft size={20} />
            Retour
          </button>
        )}

        {currentFolders.length === 0 && currentQuizzes.length === 0 ? (
          <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[var(--greek-gold)]/20">
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
                className="group bg-white rounded-[20px] p-6 shadow-sm border border-[var(--card-border-antique)] transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 flex flex-col items-center justify-center text-center aspect-[4/3] animate-fade-bounce"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: `${folder.color || "#3b82f6"}15`,
                    color: folder.color || "#3b82f6",
                  }}
                >
                  <FolderIcon size={40} fill="currentColor" fillOpacity={0.2} />
                </div>
                <h3 className="font-bold text-[var(--greek-blue)] text-xl w-full px-2">
                  {folder.name}
                </h3>
              </div>
            ))}

            {/* Render Quizzes */}
            {currentQuizzes.map((quiz, index) => (
              <div
                key={quiz.id}
                className="group bg-white rounded-[20px] shadow-sm border border-[var(--card-border-antique)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full animate-fade-bounce"
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
                    <Trophy className="w-16 h-16 text-[var(--greek-gold)] drop-shadow-md transform group-hover:scale-110 transition-transform duration-300" />
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
                      Lancer le Quiz
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
