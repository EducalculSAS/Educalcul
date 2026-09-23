"use client";

import { useEffect, useState } from "react";
import { Trophy, Clock } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import type { MinigameType } from "@/lib/minigames/gameTypes";

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

function formatDuration(seconds: number | null) {
  if (seconds === null || seconds === undefined) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const NAME_COLOR_CLS: Record<string, string> = {
  bronze: "name-bronze-animated",
  silver: "name-silver-animated",
  gold: "name-gold-animated",
  diamond: "name-diamond-animated",
  premium: "name-purple-animated",
  famille: "name-teal-animated",
  pro: "name-pro-animated",
  flame: "name-flame",
  elite: "name-elite",
  admin: "name-admin-animated",
};

export default function MinigamesLeaderboard({ gameType }: { gameType: "mathador" | MinigameType }) {
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ leaderboard: Entry[]; me: { total: number; rank: number | null } } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/child/minigames/leaderboard?gameType=${gameType}&period=${period}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gameType, period]);

  return (
    <div className="rounded-2xl border p-5 bg-white" style={{ borderColor: "rgba(15,30,58,0.1)" }}>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--greek-blue)] mb-3">
          <Trophy className="w-5 h-5" style={{ color: "var(--greek-gold)" }} />
          Classement
        </h2>
        <div className="flex justify-center">
          <GlassSegmentedControl
            size="sm"
            options={[
              { id: "week", label: "Cette semaine" },
              { id: "all", label: "Tout temps" },
            ]}
            value={period}
            onChange={(v) => setPeriod(v as typeof period)}
          />
        </div>
      </div>

      {loading ? (
        <PageLoader className="h-32" />
      ) : !data || data.leaderboard.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-6">Aucune partie jouée pour l'instant. Sois le premier !</p>
      ) : (
        <ul className="space-y-2">
          {data.leaderboard.map((e) => (
            <li
              key={e.userId}
              className="flex items-center gap-3 rounded-xl px-3 py-2"
              style={{ background: e.isMe ? "rgba(212,175,55,0.12)" : "transparent" }}
            >
              <span className="w-6 text-center font-bold text-[var(--greek-blue)]">{e.rank}</span>
              <AvatarWithBorder avatar={e.avatar} equippedBorder={e.equippedBorder} name={e.firstName} size="sm" />
              <span className={`flex-1 font-medium ${e.nameColor ? NAME_COLOR_CLS[e.nameColor] || "" : ""}`} style={{ color: !e.nameColor || !NAME_COLOR_CLS[e.nameColor] ? "var(--greek-blue)" : undefined }}>
                {e.firstName}{e.isMe ? " (toi)" : ""}
              </span>
              {formatDuration(e.bestDurationSeconds) && (
                <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] shrink-0">
                  <Clock className="w-3 h-3" /> {formatDuration(e.bestDurationSeconds)}
                </span>
              )}
              <span className="font-bold" style={{ color: "var(--greek-gold)" }}>{e.total} pts</span>
            </li>
          ))}
        </ul>
      )}

      {data?.me.rank && data.me.rank > data.leaderboard.length && (
        <p className="mt-3 pt-3 border-t text-sm text-center text-[var(--text-muted)]" style={{ borderColor: "rgba(15,30,58,0.1)" }}>
          Ta position : <span className="font-bold text-[var(--greek-blue)]">#{data.me.rank}</span> avec {data.me.total} pts
        </p>
      )}
    </div>
  );
}
