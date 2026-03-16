"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  BookOpen,
  Play,
  CheckCircle,
  Clock,
  Trophy,
  AlertCircle,
} from "lucide-react";
import MathLoader from "@/components/MathLoader";
import Link from "next/link";

export default function ChildQuizPage() {
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<any[]>([]);

  useEffect(() => {
    const fetchQuizzes = async () => {
      // Fetch all quizzes with folders
      const { data: quizzesData, error } = await supabase
        .from("quizzes")
        .select(
          `
          id, 
          title, 
          description, 
          difficulty_level, 
          course_id, 
          courses(title),
          folder_id,
          quiz_folders (
            id,
            name,
            color
          )
        `
        )
        .eq("status", "published")
        .order("title");

      if (error) {
        if (error.code !== "PGRST116") {
          console.error("Error fetching quizzes:", error);
        }
      } else {
        setQuizzes(quizzesData || []);
      }
      setLoading(false);
    };

    fetchQuizzes();
  }, []);

  // Group quizzes by folder
  const groupedQuizzes = quizzes.reduce((acc, quiz) => {
    const folderName = quiz.quiz_folders?.name || "Autres Quiz";
    const folderColor = quiz.quiz_folders?.color || "#6c757d";
    const folderId = quiz.quiz_folders?.id || "uncategorized";

    if (!acc[folderId]) {
      acc[folderId] = {
        name: folderName,
        color: folderColor,
        quizzes: [],
      };
    }
    acc[folderId].quizzes.push(quiz);
    return acc;
  }, {} as Record<string, { name: string; color: string; quizzes: any[] }>);

  const sortedGroups = Object.values(groupedQuizzes).sort((a: any, b: any) => {
    if (a.name === "Autres Quiz") return 1;
    if (b.name === "Autres Quiz") return -1;
    return a.name.localeCompare(b.name);
  });

  if (loading) {
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

      <div className="space-y-12">
        {sortedGroups.length === 0 && quizzes.length === 0 ? (
          <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[var(--greek-gold)]/20">
            <Trophy className="w-16 h-16 text-[var(--greek-blue)] opacity-20 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">
              Aucun quiz disponible
            </h3>
            <p className="text-gray-500">
              Reviens plus tard pour de nouveaux défis !
            </p>
          </div>
        ) : (
          sortedGroups.map((group: any) => (
            <div key={group.name} className="space-y-6">
              <div className="flex items-center gap-3 border-b border-[var(--greek-gold)]/20 pb-2">
                <div
                  className="w-1.5 h-8 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                <h2 className="text-2xl font-bold text-[var(--greek-blue)]">
                  {group.name}
                </h2>
                <span className="text-sm font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {group.quizzes.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {group.quizzes.map((quiz: any) => (
                  <div
                    key={quiz.id}
                    className="group bg-white rounded-[20px] shadow-sm border border-[var(--card-border-antique)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full"
                  >
                    <div className="relative h-40 bg-[var(--greek-blue)]/10 overflow-hidden flex items-center justify-center">
                      <div className="absolute inset-0 opacity-10 pattern-grid-lg"></div>
                      <Trophy className="w-16 h-16 text-[var(--greek-gold)] drop-shadow-md transform group-hover:scale-110 transition-transform duration-300" />

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
                        {quiz.description ||
                          "Relève ce défi pour prouver tes compétences !"}
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
