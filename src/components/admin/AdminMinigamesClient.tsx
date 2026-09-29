"use client";

import { useState } from "react";
import { Sigma, Calculator, PuzzleIcon, TrendingUp, Languages } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import AdminMinigameSessionsPanel from "@/components/admin/AdminMinigameSessionsPanel";
import AdminDailySheetsPanel from "@/components/admin/AdminDailySheetsPanel";
import { listGameTypes, type MinigameType } from "@/lib/minigames/gameTypes";

type Stats = Record<string, { plays: number; completed: number; totalScore: number }>;

const GAME_ICONS: Record<MinigameType, typeof Calculator> = {
  calcul_mental: Calculator,
  enigmes: PuzzleIcon,
  suites: TrendingUp,
  langues: Languages,
};

export default function AdminMinigamesClient({ stats }: { stats: Stats }) {
  const [tab, setTab] = useState<"daily" | "sessions">("daily");
  const [dailyGameType, setDailyGameType] = useState<MinigameType>("calcul_mental");

  const cards = [
    { gameType: "mathador", label: "Mathador", icon: Sigma, desc: "Jeu procédural, aucune génération IA nécessaire, vérifié solvable à chaque tirage." },
    ...listGameTypes().map((g) => ({
      gameType: g.gameType,
      label: g.label,
      icon: GAME_ICONS[g.gameType],
      desc: `5 questions par jour et par palier (${g.palierCodes[g.palierCodes.length - 1]}→${g.palierCodes[0]}), générées automatiquement chaque nuit (+5 bonus premium).`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ gameType, label, icon: Icon, desc }) => (
          <div key={gameType} className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[var(--greek-blue)]/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[var(--greek-blue)]" />
              </div>
              <h3 className="font-bold text-[var(--greek-blue)]">{label}</h3>
            </div>
            <p className="text-xs text-gray-500">{desc}</p>
            <div className="text-sm text-gray-600">
              {stats[gameType]?.plays || 0} parties jouées · {stats[gameType]?.completed || 0} terminées
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {([["daily", "Contenu du jour"], ["sessions", "Parties jouées"]] as const).map(([key, label]) => (
          <GlassButton key={key} size="sm" variant={tab === key ? "navy" : "ghost"} onClick={() => setTab(key)}>
            {label}
          </GlassButton>
        ))}
      </div>

      {tab === "daily" && (
        <div className="space-y-4">
          <GlassSegmentedControl
            size="sm"
            options={listGameTypes().map((g) => {
              const Icon = GAME_ICONS[g.gameType];
              return { id: g.gameType, label: <span className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {g.label}</span> };
            })}
            value={dailyGameType}
            onChange={(v) => setDailyGameType(v as MinigameType)}
          />
          <AdminDailySheetsPanel gameType={dailyGameType} />
        </div>
      )}
      {tab === "sessions" && <AdminMinigameSessionsPanel />}
    </div>
  );
}
