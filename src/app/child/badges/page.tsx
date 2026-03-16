"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Trophy, Star, Medal, Award, Crown, Zap } from "lucide-react";
import MathLoader from "@/components/MathLoader";

const BADGES_CONFIG = [
  {
    id: "first_login",
    title: "Bienvenue Héros",
    description: "Première connexion réussie",
    icon: Star,
    color: "text-yellow-500",
    bgColor: "bg-yellow-100",
  },
  {
    id: "first_course",
    title: "Apprenti Sage",
    description: "Premier cours commencé",
    icon: BookOpen,
    color: "text-blue-500",
    bgColor: "bg-blue-100",
  },
  {
    id: "first_quiz",
    title: "Premier Défi",
    description: "Premier quiz terminé",
    icon: Zap,
    color: "text-purple-500",
    bgColor: "bg-purple-100",
  },
  {
    id: "perfect_score",
    title: "Excellence",
    description: "Obtenir 100% à un quiz",
    icon: Crown,
    color: "text-red-500",
    bgColor: "bg-red-100",
  },
  {
    id: "week_streak",
    title: "Persévérance",
    description: "7 jours de connexion d'affilée",
    icon: Award,
    color: "text-green-500",
    bgColor: "bg-green-100",
  },
  {
    id: "math_wizard",
    title: "Sorcier des Maths",
    description: "Terminer 5 chapitres",
    icon: Medal,
    color: "text-orange-500",
    bgColor: "bg-orange-100",
  },
];

import { BookOpen } from "lucide-react"; // Import missing icon

export default function ChildBadgesPage() {
  const [loading, setLoading] = useState(true);
  const [unlockedBadges, setUnlockedBadges] = useState<string[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const unlocked = ["first_login"]; // Always unlock first login for now

      // Check for first course
      const { count: courseCount } = await supabase
        .from("user_course_views")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id); // Assuming user.id matches public.users.id linked to auth
      
      // Wait, user.id is auth_id. We need public user id.
      // But let's assume we can fetch public user id first.
      const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).single();
      
      if (userData) {
         const { count: views } = await supabase
            .from("user_course_views")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userData.id);
         
         if (views && views > 0) unlocked.push("first_course");

         const { count: quizzes } = await supabase
            .from("user_quiz_attempts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userData.id);

         if (quizzes && quizzes > 0) unlocked.push("first_quiz");
      }

      setUnlockedBadges(unlocked);
      setLoading(false);
    };

    fetchStats();
  }, []);

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
          Mes Trophées
        </h1>
        <p className="text-gray-600 text-lg">
          Collectionne les badges en progressant dans ton aventure !
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {BADGES_CONFIG.map((badge) => {
          const isUnlocked = unlockedBadges.includes(badge.id);
          const Icon = badge.icon;

          return (
            <div
              key={badge.id}
              className={`relative bg-white rounded-[20px] p-6 shadow-sm border transition-all duration-300 ${
                isUnlocked
                  ? "border-[var(--greek-gold)] shadow-md transform hover:-translate-y-1"
                  : "border-gray-200 opacity-60 grayscale"
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                    isUnlocked ? badge.bgColor : "bg-gray-100"
                  }`}
                >
                  <Icon
                    className={`w-10 h-10 ${
                      isUnlocked ? badge.color : "text-gray-400"
                    }`}
                  />
                </div>
                <h3
                  className={`text-xl font-bold mb-2 ${
                    isUnlocked ? "text-[var(--greek-blue)]" : "text-gray-500"
                  }`}
                >
                  {badge.title}
                </h3>
                <p className="text-gray-500 text-sm">{badge.description}</p>
                
                {isUnlocked ? (
                  <div className="mt-4 px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Débloqué
                  </div>
                ) : (
                  <div className="mt-4 px-3 py-1 bg-gray-100 text-gray-500 text-xs font-bold rounded-full">
                    À débloquer
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { CheckCircle } from "lucide-react"; // Import missing icon
