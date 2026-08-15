import Link from "next/link";
import { redirect } from "next/navigation";
import { Sigma, Calculator, PuzzleIcon, TrendingUp, Languages, Code2, ArrowRight, Lock } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";

const GAMES = [
  { href: "/child/minigames/mathador", icon: Sigma, label: "Mathador", desc: "5 nombres, une cible, trouve le compte juste.", color: "bg-indigo-100 text-indigo-600", available: true },
  { href: "/child/minigames/calcul-mental", icon: Calculator, label: "Calcul mental", desc: "Réponds vite, réponds juste, contre la montre.", color: "bg-yellow-100 text-[var(--greek-gold)]", available: true },
  { href: null, icon: PuzzleIcon, label: "Énigmes", desc: "Bientôt disponible", color: "bg-gray-100 text-gray-400", available: false },
  { href: null, icon: TrendingUp, label: "Suites", desc: "Bientôt disponible", color: "bg-gray-100 text-gray-400", available: false },
  { href: null, icon: Languages, label: "Maths en langues", desc: "Bientôt disponible", color: "bg-gray-100 text-gray-400", available: false },
  { href: null, icon: Code2, label: "Scratch & Python", desc: "Bientôt disponible", color: "bg-gray-100 text-gray-400", available: false },
];

export default async function MinigamesPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12 pt-24">
      <div className="container mx-auto max-w-6xl px-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-[var(--greek-blue)] mb-2">
          Mini-jeux
        </h1>
        <p className="text-[var(--text-muted)] mb-8">Joue, grimpe au classement, débloque des récompenses.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {GAMES.map(({ href, icon: Icon, label, desc, color, available }) => {
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
                {available && (
                  <div className="flex items-center text-[var(--greek-blue)] font-bold text-sm">
                    Jouer <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                )}
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
