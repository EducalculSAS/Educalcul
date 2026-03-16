"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  BookOpen,
  BrainCircuit,
  PenTool,
  Award,
  Star,
  Trophy,
  ArrowRight,
  Play,
} from "lucide-react";
import MathLoader from "@/components/MathLoader";

export default function ChildDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [gradeLevel, setGradeLevel] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth/connexion");
        return;
      }

      // Fetch user info
      const { data: userData, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user:", error);
        return;
      }

      if (!userData) {
        console.warn("User profile not found");
        return;
      }

      if (userData.role !== "child") {
        router.push("/dashboard"); // Redirect to generic dashboard or parent
        return;
      }

      setUser(userData);
      setGradeLevel(userData.grade_level);
      setLoading(false);
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--greek-cream)]">
        <MathLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      {/* Header Section */}
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>

        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-2">
                Bonjour, {user?.first_name} !
              </h1>
              <p className="text-xl opacity-90 flex items-center gap-2">
                <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-3 py-1 rounded-full">
                  {gradeLevel || "Niveau non défini"}
                </span>
                <span>Prêt à apprendre aujourd'hui ?</span>
              </p>
            </div>

            <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
              <div className="text-center px-4 border-r border-white/20">
                <div className="text-2xl font-bold text-[var(--greek-gold)]">
                  0
                </div>
                <div className="text-xs uppercase tracking-wider opacity-80">
                  Badges
                </div>
              </div>
              <div className="text-center px-4">
                <div className="text-2xl font-bold text-[var(--greek-gold)]">
                  0%
                </div>
                <div className="text-xs uppercase tracking-wider opacity-80">
                  Progression
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4">
        {/* Main Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Cours */}
          <Link href="/child/cours" className="group">
            <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[var(--card-border-antique)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BookOpen className="w-24 h-24 text-[var(--greek-blue)]" />
              </div>
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 text-[var(--greek-blue)] group-hover:scale-110 transition-transform duration-300">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">
                Mes Cours
              </h3>
              <p className="text-gray-600 mb-4">
                Découvre de nouvelles leçons et révise tes connaissances.
              </p>
              <div className="flex items-center text-[var(--greek-blue)] font-bold group-hover:gap-2 transition-all">
                Commencer <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            </div>
          </Link>

          {/* Exercices */}
          <Link href="/child/exercises" className="group">
            <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[var(--card-border-antique)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <PenTool className="w-24 h-24 text-[var(--greek-bronze)]" />
              </div>
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mb-4 text-[var(--greek-bronze)] group-hover:scale-110 transition-transform duration-300">
                <PenTool className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">
                Exercices
              </h3>
              <p className="text-gray-600 mb-4">
                Entraîne-toi avec des exercices interactifs amusants.
              </p>
              <div className="flex items-center text-[var(--greek-bronze)] font-bold group-hover:gap-2 transition-all">
                S'entraîner <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            </div>
          </Link>

          {/* Quiz */}
          <Link href="/child/quiz" className="group">
            <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[var(--card-border-antique)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BrainCircuit className="w-24 h-24 text-[var(--greek-gold)]" />
              </div>
              <div className="w-14 h-14 bg-yellow-100 rounded-2xl flex items-center justify-center mb-4 text-[var(--greek-gold)] group-hover:scale-110 transition-transform duration-300">
                <BrainCircuit className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">
                Quiz
              </h3>
              <p className="text-gray-600 mb-4">
                Teste tes connaissances et gagne des points !
              </p>
              <div className="flex items-center text-[var(--greek-gold)] font-bold group-hover:gap-2 transition-all">
                Jouer <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            </div>
          </Link>
        </div>

        {/* Continue Learning / Recommendations */}
        <div className="bg-white rounded-[20px] p-8 shadow-md border border-[var(--greek-gold)] mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Star className="w-6 h-6 text-[var(--greek-gold)] fill-current" />
            <h2 className="text-2xl font-bold text-[var(--greek-blue)]">
              À faire ensuite
            </h2>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-[var(--greek-blue)] rounded-full flex items-center justify-center text-white shrink-0">
                <Play className="w-8 h-8 ml-1" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-800">
                  Découverte des Nombres
                </h4>
                <p className="text-gray-500">Chapitre 1 - Leçon 1</p>
              </div>
            </div>
            <button className="btn-primary-greek px-8 py-3 whitespace-nowrap">
              Commencer
            </button>
          </div>
        </div>

        {/* Badges Preview */}
        <div className="bg-white rounded-[20px] p-8 shadow-sm border border-[var(--card-border-antique)]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-[var(--greek-bronze)]" />
              <h2 className="text-2xl font-bold text-[var(--greek-blue)]">
                Mes Trophées
              </h2>
            </div>
            <Link
              href="/child/badges"
              className="text-[var(--greek-blue)] font-bold hover:underline"
            >
              Voir tout
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-4 text-center opacity-60"
              >
                <div className="w-12 h-12 bg-gray-200 rounded-full mb-2"></div>
                <span className="text-xs text-gray-400 font-bold">
                  À débloquer
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
