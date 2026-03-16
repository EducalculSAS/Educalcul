"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Calculator,
  Play,
  Star,
  Clock,
  Brain,
  AlertCircle,
} from "lucide-react";
import MathLoader from "@/components/MathLoader";
import Link from "next/link";

export default function ChildExercisesPage() {
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<any[]>([]);

  useEffect(() => {
    const fetchExercises = async () => {
      // Fetch all exercises with folders
      // Note: Assuming 'exercises' table exists. If not, we handle the error.
      const { data: exercisesData, error } = await supabase
        .from("exercises")
        .select(
          `
          id, 
          title, 
          description, 
          difficulty:difficulty_level, 
          points:points_reward, 
          courses(title),
          folder_id,
          exercise_folders (
            id,
            name,
            color
          )
        `
        )
        .eq("status", "published")
        .order("title");

      if (error) {
        if (error.code !== "PGRST116" && error.code !== "42P01") {
          // 42P01 is undefined_table
          console.error("Error fetching exercises:", error);
        }
        // If table doesn't exist or other error, we might want to show empty state or mock data?
        // For now, let's just set empty to be safe.
      } else {
        setExercises(exercisesData || []);
      }
      setLoading(false);
    };

    fetchExercises();
  }, []);

  // Group exercises by folder
  const groupedExercises = exercises.reduce((acc, exercise) => {
    const folderName = exercise.exercise_folders?.name || "Autres Exercices";
    const folderColor = exercise.exercise_folders?.color || "#6c757d";
    const folderId = exercise.exercise_folders?.id || "uncategorized";

    if (!acc[folderId]) {
      acc[folderId] = {
        name: folderName,
        color: folderColor,
        exercises: [],
      };
    }
    acc[folderId].exercises.push(exercise);
    return acc;
  }, {} as Record<string, { name: string; color: string; exercises: any[] }>);

  const sortedGroups = Object.values(groupedExercises).sort((a: any, b: any) => {
    if (a.name === "Autres Exercices") return 1;
    if (b.name === "Autres Exercices") return -1;
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
          <Brain className="inline-block w-10 h-10 mr-3 mb-1 text-[var(--greek-gold)]" />
          Exercices d'Entraînement
        </h1>
        <p className="text-gray-600 text-lg">
          Pratique et améliore tes compétences en mathématiques !
        </p>
      </div>

      <div className="space-y-12">
        {sortedGroups.length === 0 && exercises.length === 0 ? (
          <div className="text-center py-20 bg-[var(--greek-cream)] rounded-xl border border-[var(--greek-gold)]/20">
            <Calculator className="w-16 h-16 text-[var(--greek-blue)] opacity-20 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">
              Aucun exercice disponible
            </h3>
            <p className="text-gray-500">
              Reviens plus tard pour t'entraîner !
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
                  {group.exercises.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {group.exercises.map((exercise: any) => (
                  <div
                    key={exercise.id}
                    className="group bg-white rounded-[20px] shadow-sm border border-[var(--card-border-antique)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full"
                  >
                    <div className="relative h-40 bg-[var(--greek-cream)] overflow-hidden flex items-center justify-center">
                      <div className="absolute inset-0 opacity-20 pattern-grid-lg"></div>
                      <Calculator className="w-16 h-16 text-[var(--greek-blue)] opacity-80 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" />

                      <div
                        className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                          exercise.difficulty === "facile"
                            ? "bg-green-100 text-green-700"
                            : exercise.difficulty === "moyen"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {exercise.difficulty
                          ? exercise.difficulty.charAt(0).toUpperCase() +
                            exercise.difficulty.slice(1)
                          : "Normal"}
                      </div>
                    </div>

                    <div className="p-6 flex flex-col flex-grow">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--greek-gold)] uppercase tracking-wider">
                          {exercise.courses?.title || "Mathématiques"}
                        </span>
                        <div className="flex items-center text-[var(--greek-gold)] text-sm font-bold">
                          <Star className="w-3 h-3 fill-current mr-1" />
                          {exercise.points || 10} XP
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 line-clamp-2">
                        {exercise.title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-6 line-clamp-3 flex-grow">
                        {exercise.description || "Entraîne-toi sur ce sujet !"}
                      </p>

                      <div className="mt-auto">
                        <Link
                          href={`/child/exercises/${exercise.id}`}
                          className="w-full btn-primary-greek py-3 flex items-center justify-center gap-2 group-hover:bg-[var(--greek-gold)] group-hover:text-[var(--greek-blue)] transition-colors"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Commencer
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
