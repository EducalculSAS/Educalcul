import Link from "@/components/AppLink";
import PageHero from "@/components/PageHero";
import { redirect } from "next/navigation";
import StreakFlame from "@/components/StreakFlame";
import { Sigma, Calculator, PuzzleIcon, TrendingUp, Languages, Code2, ArrowRight, Lock } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { getStreaksForGames } from "@/lib/minigames/streaks";

const GAMES = [
  { gameType: "mathador", href: "/child/minigames/mathador", icon: Sigma, label: "Mathador", desc: "5 nombres, une cible, trouve le compte juste.", color: "bg-indigo-100 text-indigo-600", available: true },
  { gameType: "calcul_mental", href: "/child/minigames/calcul-mental", icon: Calculator, label: "Calcul mental", desc: "Jusqu'à 5 questions par jour, réponds juste pour grimper au classement.", color: "bg-yellow-100 text-[var(--greek-gold)]", available: true },
  { gameType: "enigmes", href: "/child/minigames/enigmes", icon: PuzzleIcon, label: "Énigmes", desc: "Jusqu'à 5 énigmes de logique par jour, à toi de déduire.", color: "bg-purple-100 text-purple-600", available: true },
  { gameType: "suites", href: "/child/minigames/suites", icon: TrendingUp, label: "Suites", desc: "Trouve le prochain terme, du collège au lycée.", color: "bg-teal-100 text-teal-600", available: true },
  { gameType: "langues", href: "/child/minigames/langues", icon: Languages, label: "Maths en langues", desc: "Des maths de lycée, en anglais, allemand ou espagnol.", color: "bg-rose-100 text-rose-600", available: true },
  { gameType: "scratch_python", href: null, icon: Code2, label: "Scratch & Python", desc: "Bientôt disponible", color: "bg-gray-100 text-gray-400", available: false },
];

export default async function MinigamesPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  const streaks = await getStreaksForGames(authUser.id, GAMES.filter((g) => g.available).map((g) => g.gameType));

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <PageHero back={{ href: "/child/dashboard", label: "Tableau de bord" }} emblem="gamepad" title="Mini-jeux" badge="Joue" subtitle="Grimpe au classement et débloque des récompenses !" />
      <div className="container mx-auto max-w-6xl px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {GAMES.map(({ gameType, href, icon: Icon, label, desc, color, available }) => {
            const streak = streaks[gameType] || 0;
            const card = (
              <div
                className={`bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] h-full relative overflow-hidden ${
                  available ? "hover:shadow-xl hover:-translate-y-1 transition-all duration-300" : "opacity-60"
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${color}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2 flex items-center gap-2">
                  {label}
                  {!available && <Lock className="w-4 h-4 text-gray-400" />}
                </h3>
                <p className="text-gray-600 mb-4 text-sm">{desc}</p>
                <div className="flex items-center justify-between">
                  {available && (
                    <div className="flex items-center text-[var(--greek-blue)] font-bold text-sm">
                      Jouer <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  )}
                  {available && (
                    <StreakFlame lit={streak > 0} count={streak} size={44} />
                  )}
                </div>
              </div>
            );
            return href ? (
              <Link key={label} href={href} className="group">{card}</Link>
            ) : (
              <div key={label}>{card}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
