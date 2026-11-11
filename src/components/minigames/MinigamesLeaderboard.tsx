"use client";

import { COLOR_BY_KEY } from "@/lib/cosmetics/catalog";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import Emblem3D from "@/components/Emblem3D";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { GAMES, formatDuration, type GameKey } from "@/lib/minigames/catalog";

interface Entry {
  rank: number;
  userId: number;
  firstName: string;
  avatar: string | null;
  equippedBorder: string | null;
  nameColor: string | null;
  total: number;
  bestDurationSeconds: number | null;
  totalDurationSeconds: number | null;
  isMe: boolean;
}

/** Pastille de rang : or, argent, bronze pour le podium. */
const MEDAL: Record<number, { bg: string; fg: string }> = {
  1: { bg: "linear-gradient(180deg,#f8e3a0,#dcb650)", fg: "#5c4510" },
  2: { bg: "linear-gradient(180deg,#f1f3f6,#b9c0cb)", fg: "#3b4252" },
  3: { bg: "linear-gradient(180deg,#f0c9a0,#c98a52)", fg: "#5a3413" },
};

/**
 * Classement d'un jeu, entre élèves du même niveau. Avec `selectable`, un sélecteur permet de passer d'un jeu à
 * l'autre (catalogue) ; sinon le classement est celui du jeu donné (écran de fin de partie).
 */
export default function MinigamesLeaderboard({ gameType, selectable = false }: { gameType: GameKey; selectable?: boolean }) {
  const [game, setGame] = useState<GameKey>(gameType);
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ leaderboard: Entry[]; me: { total: number; rank: number | null } } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/child/minigames/leaderboard?gameType=${game}&period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [game, period]);

  return (
    <section className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]">
      <div className="flex items-center gap-3 mb-1">
        <Emblem3D kind="trophy" size={28} float={false} />
        <h2 className="text-xl font-bold text-[var(--greek-blue)]">Classement</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">Entre élèves de ton niveau. Les points de toutes tes parties s&apos;additionnent.</p>

      <div className="flex flex-col gap-3 mb-4">
        {selectable && (
          <GlassSegmentedControl size="sm" options={GAMES.map((g) => ({ id: g.gameType, label: g.short }))} value={game} onChange={(v) => setGame(v as GameKey)} />
        )}
        <GlassSegmentedControl
          size="sm"
          options={[{ id: "week", label: "7 derniers jours" }, { id: "all", label: "Depuis toujours" }]}
          value={period}
          onChange={(v) => setPeriod(v as typeof period)}
        />
      </div>

      {loading ? (
        <PageLoader className="h-32" />
      ) : !data || data.leaderboard.length === 0 ? (
        <div className="text-center py-6">
          <Emblem3D kind="flag" size={72} />
          <p className="text-sm text-gray-600 mt-2">Personne n&apos;a encore joué sur cette période. Prends la première place !</p>
        </div>
      ) : (
        <ol className="space-y-1.5">
          {data.leaderboard.map((e) => {
            const medal = MEDAL[e.rank];
            const color = e.nameColor && e.nameColor !== "default" ? COLOR_BY_KEY[e.nameColor]?.cls : undefined;
            const time = formatDuration(e.bestDurationSeconds);
            return (
              <li key={e.userId} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${e.isMe ? "bg-[rgba(197,161,72,0.14)] ring-1 ring-[var(--greek-gold)]" : ""}`}>
                <span
                  className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold tabular-nums"
                  style={medal ? { background: medal.bg, color: medal.fg, boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)" } : { color: "var(--greek-blue)" }}
                >
                  {e.rank}
                </span>
                <AvatarWithBorder avatar={e.avatar} equippedBorder={e.equippedBorder} name={e.firstName} size="sm" label="" />
                <span className={`flex-1 min-w-0 truncate font-semibold text-sm ${color || "text-[var(--greek-blue)]"}`}>
                  {e.firstName}{e.isMe ? " (toi)" : ""}
                </span>
                {time && (
                  <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500 shrink-0" title="Meilleur temps">
                    <Clock className="w-3 h-3" /> {time}
                  </span>
                )}
                <span className="font-bold text-sm tabular-nums text-[var(--greek-bronze)] shrink-0">{e.total} pt{e.total > 1 ? "s" : ""}</span>
              </li>
            );
          })}
        </ol>
      )}

      {!loading && data?.me.rank && data.me.rank > data.leaderboard.length && (
        <p className="mt-3 pt-3 border-t border-[rgba(197,161,72,0.2)] text-sm text-center text-gray-600">
          Ta place : <strong className="text-[var(--greek-blue)]">{data.me.rank}<sup>e</sup></strong> avec {data.me.total} pt{data.me.total > 1 ? "s" : ""}
        </p>
      )}
    </section>
  );
}
