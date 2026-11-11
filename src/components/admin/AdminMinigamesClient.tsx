"use client";

import { useState } from "react";
import Emblem3D from "@/components/Emblem3D";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import AdminMinigameSessionsPanel from "@/components/admin/AdminMinigameSessionsPanel";
import AdminDailySheetsPanel from "@/components/admin/AdminDailySheetsPanel";
import { GAME_TYPES, isMinigameType, listGameTypes, type MinigameType } from "@/lib/minigames/gameTypes";
import { GAMES } from "@/lib/minigames/catalog";
import type { AdminMinigamesToday } from "@/lib/minigames/adminStats";

type Stats = Record<string, { plays: number; completed: number; totalScore: number }>;

const CARD = "bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)]";

function Kpi({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="text-2xl font-bold text-[var(--greek-blue)] tabular-nums">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

export default function AdminMinigamesClient({ stats, today }: { stats: Stats; today: AdminMinigamesToday }) {
  const [tab, setTab] = useState<"daily" | "sessions">("daily");
  const [dailyGameType, setDailyGameType] = useState<MinigameType>("calcul_mental");

  const playsToday = Object.values(today.plays).reduce((a, b) => a + b, 0);
  const completedToday = Object.values(today.completed).reduce((a, b) => a + b, 0);
  const expectedSheets = listGameTypes().reduce((n, g) => n + g.palierCodes.length, 0);
  const readySheets = Object.values(today.sheetsReady).reduce((a, b) => a + b, 0);
  const peak = Math.max(1, ...today.last7.map((d) => d.plays));

  return (
    <div className="space-y-6">
      {/* Le jour en un coup d'œil */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi value={today.players} label="Joueurs aujourd'hui" />
        <Kpi value={playsToday} label="Parties aujourd'hui" hint={`${completedToday} terminée${completedToday > 1 ? "s" : ""}`} />
        <Kpi value={`${readySheets} / ${expectedSheets}`} label="Fiches du jour prêtes" hint={readySheets < expectedSheets ? "Des paliers attendent leur fiche : voir « Contenu du jour »." : "Tous les paliers sont servis."} />
        <div className={`${CARD} p-5`}>
          <div className="flex items-end gap-1.5 h-10" aria-label="Parties des 7 derniers jours">
            {today.last7.map((d) => (
              <span key={d.day} className="flex-1 rounded-t bg-[var(--greek-gold)]" style={{ height: `${Math.max(6, Math.round((d.plays / peak) * 100))}%`, opacity: d.plays ? 1 : 0.25 }} title={`${d.day} : ${d.plays} partie${d.plays > 1 ? "s" : ""}`} />
            ))}
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-2">Parties sur 7 jours</div>
        </div>
      </div>

      {/* Chaque jeu */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAMES.map((g) => {
          const s = stats[g.gameType] || { plays: 0, completed: 0, totalScore: 0 };
          const rate = s.plays > 0 ? Math.round((s.completed / s.plays) * 100) : null;
          const avg = s.completed > 0 ? (s.totalScore / s.completed).toFixed(1).replace(".", ",") : null;
          const daily = isMinigameType(g.gameType) ? GAME_TYPES[g.gameType] : null;
          const ready = today.sheetsReady[g.gameType] || 0;
          return (
            <div key={g.gameType} className={`${CARD} p-5 flex flex-col gap-3`}>
              <div className="flex items-center gap-3">
                <Emblem3D kind={g.emblem} size={48} float={false} />
                <div className="min-w-0">
                  <h3 className="font-bold text-[var(--greek-blue)] truncate">{g.label}</h3>
                  <p className="text-xs text-gray-500">
                    {daily ? `Fiche de 5 questions par jour et par palier, générée chaque nuit (paliers ${daily.palierCodes[daily.palierCodes.length - 1]} à ${daily.palierCodes[0]}).` : "Tirage calculé à chaque partie, toujours soluble. Aucune génération par IA."}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  [today.plays[g.gameType] || 0, "aujourd'hui"],
                  [s.plays, "au total"],
                  [rate === null ? "–" : `${rate} %`, "terminées"],
                ].map(([v, l]) => (
                  <div key={l as string} className="rounded-xl bg-[var(--greek-cream)]/50 px-2 py-2">
                    <dd className="font-bold text-[var(--greek-blue)] tabular-nums">{v}</dd>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{l}</dt>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-gray-500 flex items-center justify-between gap-2">
                <span>Score moyen : <strong className="text-[var(--greek-blue)]">{avg ?? "–"}</strong></span>
                {daily && (
                  <span className={ready >= daily.palierCodes.length ? "text-green-700 font-semibold" : "text-amber-700 font-semibold"}>
                    {ready} / {daily.palierCodes.length} fiches prêtes
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      <GlassSegmentedControl
        options={[{ id: "daily", label: "Contenu du jour" }, { id: "sessions", label: "Parties jouées" }]}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />

      {tab === "daily" && (
        <div className="space-y-4">
          <GlassSegmentedControl
            size="sm"
            options={listGameTypes().map((g) => ({ id: g.gameType, label: g.label }))}
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
