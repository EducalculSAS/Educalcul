"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  User,
  Trophy,
  Star,
  Shield,
  School,
  BookOpen,
  Mail,
  CheckCircle,
  AlertCircle,
  Trash2,
  Clock,
} from "lucide-react";
import MathLoader from "@/components/MathLoader";
import { avatarUrl } from "@/lib/avatarUrl";
import { getNameColor } from "@/lib/badgeStyles";
import AvatarWithBorder from "@/components/AvatarWithBorder";

export default function ChildProfilePage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showActivities, setShowActivities] = useState(false);
  const [activities, setActivities] = useState<{
    exercises: any[];
    quizzes: any[];
    courses: any[];
  }>({ exercises: [], quizzes: [], courses: [] });
  const [activeTab, setActiveTab] = useState<"exercises" | "quizzes" | "courses">("exercises");

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        // Redirect to login if not authenticated
        window.location.href = "/auth/connexion";
        return;
      }

      if (authUser) {
        const isGoogle = authUser.identities?.some(
          (id: any) => id.provider === "google"
        );
        setGoogleLinked(!!isGoogle);
      }

      const { data: userData, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", authUser.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user profile:", error);
      }

      if (userData) {
        setUser(userData);

        // Fetch activities
        try {
          const actRes = await fetch(`/api/child/activities?userId=${authUser.id}`);
          if (actRes.ok) {
            const actData = await actRes.json();
            setActivities(actData);
          }
        } catch (e) {
          console.error("Error fetching activities:", e);
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  const handleLinkGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la liaison avec Google.";
      setMessage({
        type: "error",
        text: errorMessage,
      });
    }
  };

  const handleUnlinkGoogle = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Non connecté");

      const identity = user.identities?.find((id: any) => id.provider === "google");

      if (!identity) {
        throw new Error("Aucun compte Google lié trouvé.");
      }

      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) throw error;

      setGoogleLinked(false);
      setMessage({
        type: "success",
        text: "Compte Google délié avec succès.",
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la dissociation du compte.";
      setMessage({
        type: "error",
        text: errorMessage,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <MathLoader />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">
            Profil introuvable
          </h2>
          <p className="text-gray-600 mb-4">
            Impossible de charger les informations du profil.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary-greek px-6 py-2"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <div className="bg-[var(--greek-blue)] text-white pt-20 pb-12 px-8 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
            <User className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
            MON PROFIL
          </h1>
          <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
            <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">HÉROS</span>
            <span>Voici tes informations de héros !</span>
          </p>
        </div>
      </div>
    <div className="container mx-auto px-4 pb-12 max-w-4xl">

      {message && (
        <div
          className={`p-4 mb-6 rounded-lg ${message.type === "success"
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800"
            } flex items-center justify-between shadow-sm border border-transparent`}
        >
          <div className="flex items-center">
            {message.type === "error" && (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
            {message.type === "success" && (
              <CheckCircle className="w-5 h-5 mr-2" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="font-bold">
            &times;
          </button>
        </div>
      )}

      <div className="bg-white rounded-[20px] shadow-lg border-2 border-[var(--greek-gold)]/30 overflow-hidden relative">
        {/* Header Background */}
        <div className="h-32 bg-[var(--greek-blue)] relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pattern-grid-lg"></div>
        </div>

        {/* Avatar avec décorations du contour équipé */}
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 pointer-events-none select-none">
          <AvatarWithBorder
            avatar={user.avatar}
            equippedBorder={user.equipped_border}
            name={user.first_name || "?"}
            size="xl"
            bgClass="transparent"
            circular
          />
        </div>

        <div className="pt-16 pb-8 px-8">
          <div className="text-center mb-8">
            <h2 className={`text-3xl font-bold mb-1 ${getNameColor(user.name_color || 'default').cls}`}>
              {user.first_name} {user.last_name}
            </h2>
            <p className="text-[var(--greek-gold)] font-bold text-lg flex items-center justify-center gap-2">
              <Shield className="w-5 h-5" />
              {user.child_username}
            </p>
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setShowActivities(!showActivities)}
                className="btn-primary-greek px-8 py-2.5 flex items-center gap-2 text-lg shadow-lg hover:scale-105 transition-transform"
              >
                <Trophy className="w-5 h-5 text-[var(--greek-gold)]" />
                {showActivities ? "Masquer mes exploits" : "Voir mes activités"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 rounded-xl p-6 border border-[var(--greek-gold)]/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-[var(--greek-blue)]">
                  <School className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--greek-blue)]">
                    Niveau
                  </h3>
                  <p className="text-gray-600 text-lg">
                    {user.grade_level || "Non défini"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-xl p-6 border border-[var(--greek-gold)]/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-[var(--greek-gold)]">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--greek-blue)]">
                    Trophées
                  </h3>
                  <p className="text-gray-600 text-lg">0 débloqués</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-6 border border-[var(--greek-gold)]/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--greek-blue)]">
                    Cours suivis
                  </h3>
                  <p className="text-gray-600 text-lg">0 chapitres</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-xl p-6 border border-[var(--greek-gold)]/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <Star className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--greek-blue)]">
                    Points
                  </h3>
                  <p className="text-gray-600 text-lg">0 XP</p>
                </div>
              </div>
            </div>
          </div>

          {/* Linked Accounts Section */}
          <div className="mt-8 pt-8 border-t border-[var(--card-border-antique)]">
            <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-4 flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              Connexion rapide
            </h3>

            <div className="flex items-center justify-between p-4 border border-[var(--greek-gold)]/20 rounded-xl bg-blue-50/50">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mr-4">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900">Google</p>
                  <p className="text-sm text-gray-500">
                    {googleLinked
                      ? "Ton compte est lié à Google"
                      : "Lie ton compte Google pour te connecter plus vite"}
                  </p>
                </div>
              </div>
              {googleLinked ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Lié
                  </span>
                  <button
                    onClick={handleUnlinkGoogle}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Délier le compte"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLinkGoogle}
                  className="px-4 py-2 bg-white border border-[var(--greek-gold)]/30 rounded-lg text-sm font-bold text-[var(--greek-blue)] hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Lier le compte
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activities Section */}
      {showActivities && (
        <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[var(--greek-blue)] mb-2">Historique des Exploits</h2>
            <div className="h-1 w-24 bg-[var(--greek-gold)] mx-auto rounded-full"></div>
          </div>

          <div className="bg-white rounded-[20px] shadow-xl border-2 border-[var(--greek-blue)]/10 overflow-hidden">
            <div className="flex border-b border-[var(--greek-gold)]/20 bg-gray-50/50">
              {(["exercises", "quizzes", "courses"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-4 text-lg font-bold transition-all ${
                    activeTab === tab
                      ? "text-[var(--greek-blue)] bg-white border-b-2 border-[var(--greek-blue)]"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab === "exercises" && "Exercices"}
                  {tab === "quizzes" && "Quiz"}
                  {tab === "courses" && "Cours"}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === "exercises" && (
                <div className="space-y-4">
                  {activities.exercises.length === 0 ? (
                    <EmptyActivities message="Aucun exercice terminé pour le moment. Lance-toi !" />
                  ) : (
                    activities.exercises.map((ex) => (
                      <div key={ex.id} className="flex items-center justify-between p-4 bg-blue-50/50 rounded-xl border border-[var(--greek-gold)]/20 hover:bg-blue-50 transition-colors">
                        <div>
                          <p className="font-bold text-[var(--greek-blue)] text-lg flex items-center gap-2">
                            {ex.exercises?.title || "Exercice"}
                            {ex.status === 'in_progress' ? (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-bold ml-2">En cours</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-bold ml-2">Terminé</span>
                            )}
                          </p>
                          <p className="text-gray-500 text-sm">{new Date(ex.completed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-[var(--greek-blue)]">{ex.score}/{ex.total_points}</p>
                          <p className="text-xs font-bold text-[var(--greek-gold)] uppercase tracking-wider">Score</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "quizzes" && (
                <div className="space-y-4">
                  {activities.quizzes.length === 0 ? (
                    <EmptyActivities message="Aucun quiz complété. Relève le défi !" />
                  ) : (
                    activities.quizzes.map((qz) => (
                      <div key={qz.id} className="p-5 bg-yellow-50/30 rounded-xl border border-yellow-100 hover:bg-yellow-50/50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-bold text-[var(--greek-blue)] text-xl flex items-center gap-2">
                            {qz.quizzes?.title || "Quiz"}
                            {qz.status === 'in_progress' ? (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-bold">En cours</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-bold">Terminé</span>
                            )}
                          </p>
                          <div className="px-3 py-1 bg-white border border-yellow-200 rounded-full flex items-center gap-1.5 shadow-sm">
                            <Clock className="w-4 h-4 text-[var(--greek-gold)]" />
                            <span className="font-bold text-[var(--greek-blue)]">{Math.floor(qz.time_spent_seconds / 60)}m {qz.time_spent_seconds % 60}s</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-gray-500 text-sm">{new Date(qz.completed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                          <div className="flex items-end gap-1">
                            <span className="text-3xl font-black text-[var(--greek-blue)]">{Math.round((qz.score / qz.total_points) * 100)}%</span>
                            <span className="text-gray-400 font-bold mb-1">({qz.score}/{qz.total_points})</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "courses" && (
                <div className="space-y-4">
                  {activities.courses.length === 0 ? (
                    <EmptyActivities message="Tu n'as pas encore suivi de cours. Apprendre, c'est grandir !" />
                  ) : (
                    activities.courses.map((co) => (
                      <div key={co.id} className="flex items-center justify-between p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                            <CheckCircle className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-[var(--greek-blue)] text-lg flex items-center gap-2">
                              {co.courses?.title || "Cours"}
                              {co.status === 'in_progress' ? (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-bold">En cours</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-bold">Terminé</span>
                              )}
                            </p>
                            <p className="text-purple-600 font-medium">Chapitre {co.chapter_index + 1} atteint</p>
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm italic">{new Date(co.completed_at).toLocaleDateString()}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

function EmptyActivities({ message }: { message: string }) {
  return (
    <div className="text-center py-12 px-6 border-2 border-dashed border-[var(--card-border-antique)] rounded-2xl">
      <Star className="w-12 h-12 text-gray-200 mx-auto mb-4" />
      <p className="text-gray-500 text-lg italic">{message}</p>
    </div>
  );
}
