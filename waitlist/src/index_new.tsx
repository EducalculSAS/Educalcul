import React, { useState, useEffect } from "react";
import { Gift, Users, Trophy, Zap, ArrowRight, Star } from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import WaitlistForm from "./components/WaitlistForm";
import UserDashboard from "./components/UserDashboard";
import Leaderboard from "./components/Leaderboard";
import { getCurrentUser } from "./lib/waitlist";
import "./index.css";
import type { View } from "./components/Navbar";

type ViewType = View;

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>("landing");

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user.email);
    }
  }, []);

  const handleSignup = (email: string) => {
    setCurrentUser(email);
    setView("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("educalcul_waitlist");
    setCurrentUser(null);
    setView("landing");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar currentView={view} onViewChange={setView} />

      <main className="flex-grow pt-[64px]">
        {/* Landing View */}
        {view === "landing" && (
          <div>
            {/* Hero Section */}
            <section className="bg-[var(--greek-cream)] py-16 text-center relative z-10">
              <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-white/95 rounded-[15px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-[rgba(197,161,72,0.25)] p-8 my-8 backdrop-blur-sm">
                    <div className="flex justify-center mb-4">
                      <span className="text-6xl">📚</span>
                    </div>
                    <h1 className="font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-4xl md:text-5xl lg:text-6xl mb-4">
                      Rejoignez Educalcul
                    </h1>
                    <p className="text-[var(--greek-blue)] text-xl mb-8 opacity-80">
                      Soyez parmi les premiers à révolutionner votre apprentissage des
                      mathématiques. Gagnez des récompenses en invitant vos amis!
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col items-center gap-6 mt-8">
                      <div className="max-w-md w-full">
                        <WaitlistForm onSuccess={handleSignup} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Benefits Section */}
            <section className="py-16 relative z-10">
              <div className="container mx-auto px-4">
                <h2 className="text-center mb-12 font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl md:text-4xl">
                  Pourquoi rejoindre la waitlist?
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                  {/* Benefit 1 */}
                  <div className="bg-white rounded-lg p-8 shadow-[0_2px_8px_rgba(169,113,66,0.15)] border border-[rgba(197,161,72,0.25)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-center">
                    <Zap className="w-12 h-12 text-[var(--greek-gold)] mx-auto mb-4" />
                    <h5 className="text-xl font-bold text-[var(--greek-blue)] mb-3">
                      Accès Anticipé
                    </h5>
                    <p className="text-gray-600">
                      Soyez le premier à découvrir toutes les fonctionnalités de
                      la plateforme avant tout le monde.
                    </p>
                  </div>

                  {/* Benefit 2 */}
                  <div className="bg-white rounded-lg p-8 shadow-[0_2px_8px_rgba(169,113,66,0.15)] border border-[rgba(197,161,72,0.25)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-center">
                    <Users className="w-12 h-12 text-[var(--greek-gold)] mx-auto mb-4" />
                    <h5 className="text-xl font-bold text-[var(--greek-blue)] mb-3">
                      Parrainez et Gagnez
                    </h5>
                    <p className="text-gray-600">
                      Chaque ami invité vous rapporte des récompenses exclusives
                      et des mois gratuits d'accès.
                    </p>
                  </div>

                  {/* Benefit 3 */}
                  <div className="bg-white rounded-lg p-8 shadow-[0_2px_8px_rgba(169,113,66,0.15)] border border-[rgba(197,161,72,0.25)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-center">
                    <Trophy className="w-12 h-12 text-[var(--greek-gold)] mx-auto mb-4" />
                    <h5 className="text-xl font-bold text-[var(--greek-blue)] mb-3">
                      Devenir Ambassadeur
                    </h5>
                    <p className="text-gray-600">
                      Montez en rang en parrainant, débloquez des statuts
                      exclusifs et des avantages spéciaux.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* How it works */}
            <section className="py-16 relative z-10">
              <div className="container mx-auto px-4">
                <h2 className="text-center mb-12 font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl md:text-4xl flex items-center justify-center gap-3">
                  <ArrowRight className="w-8 h-8 text-[var(--greek-gold)]" />
                  Comment ça fonctionne?
                </h2>
                <div className="max-w-3xl mx-auto space-y-6">
                  {[
                    {
                      step: 1,
                      title: "Inscrivez-vous",
                      desc: "Remplissez le formulaire avec votre email et nom",
                    },
                    {
                      step: 2,
                      title: "Recevez votre code",
                      desc: "Obtenez votre code de parrainage unique",
                    },
                    {
                      step: 3,
                      title: "Partagez",
                      desc: "Invitez vos amis avec votre code personnel",
                    },
                    {
                      step: 4,
                      title: "Débloquez des récompenses",
                      desc: "Gagnez des mois gratuits à chaque ami inscrit",
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-6">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-12 w-12 rounded-md bg-[var(--greek-gold)] text-white font-bold">
                          {item.step}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-[var(--greek-blue)]">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Rewards System */}
            <section className="py-16 relative z-10">
              <div className="container mx-auto px-4">
                <h2 className="text-center mb-12 font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl md:text-4xl flex items-center justify-center gap-3">
                  <Gift className="w-8 h-8 text-[var(--greek-gold)]" />
                  Système de Récompenses
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 max-w-6xl mx-auto">
                  {[
                    { emoji: "🌱", name: "Pionnier", referrals: 0, benefit: "1 mois" },
                    {
                      emoji: "🌟",
                      name: "Influenceur",
                      referrals: 1,
                      benefit: "1 mois",
                    },
                    {
                      emoji: "⭐",
                      name: "Ambassadeur",
                      referrals: 3,
                      benefit: "3 mois",
                    },
                    { emoji: "✨", name: "Légende", referrals: 5, benefit: "6 mois" },
                    {
                      emoji: "👑",
                      name: "Maître du Réseau",
                      referrals: 10,
                      benefit: "Accès Vie",
                    },
                  ].map((reward, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-lg p-6 shadow-[0_2px_8px_rgba(169,113,66,0.15)] border border-[rgba(197,161,72,0.25)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-center"
                    >
                      <div className="text-4xl mb-3">{reward.emoji}</div>
                      <h4 className="text-lg font-bold text-[var(--greek-blue)] mb-2">
                        {reward.name}
                      </h4>
                      <p className="text-sm text-gray-500 mb-2">
                        {reward.referrals}+ parrainages
                      </p>
                      <p className="text-[var(--greek-gold)] font-bold">
                        {reward.benefit}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Dashboard View */}
        {view === "dashboard" && currentUser && (
          <UserDashboard
            userEmail={currentUser}
            onLogout={handleLogout}
          />
        )}

        {/* Leaderboard View */}
        {view === "leaderboard" && <Leaderboard />}
      </main>

      <Footer />
    </div>
  );
}
