"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { Star, Zap, Trophy, BookOpen, CheckCircle, Crown } from "lucide-react";
import StreakFlame from "@/components/StreakFlame";

const ICON_MAP: Record<string, ComponentType<{ className?: string; style?: React.CSSProperties; "aria-hidden"?: boolean | "true" | "false" }>> = {
  pencil: Star, zap: Zap, flame: StreakFlame, star: Star, crown: Crown,
  check: CheckCircle, trophy: Trophy, brain: Star, sparkles: Star,
  graduation: Star, book: BookOpen, map: Star, library: BookOpen,
  sword: Star, swords: Star, medal: Trophy, gem: Star, crystal: Star,
  divine: Crown, shield: CheckCircle, bullseye: Star, bookmark: BookOpen,
  scroll: BookOpen, owl: Star, universe: Crown,
};

/** Badge renvoyé par /api/badges. */
interface MiniBadge { id: number; name: string; icon: string; color?: string }
const badgeCache: Record<number, MiniBadge> = {};

export default function BadgeMinis({ badgeIds }: { badgeIds: number[] }) {
  const [badges, setBadges] = useState<MiniBadge[]>([]);

  useEffect(() => {
    if (!badgeIds?.length) return;
    const ids = badgeIds.filter(Boolean);
    if (!ids.length) return;

    const cached = ids.map(id => badgeCache[id]).filter(Boolean);
    if (cached.length === ids.length) { setBadges(cached); return; }

    fetch(`/api/badges?ids=${ids.join(",")}`)
      .then(r => (r.ok ? r.json() : []))
      .then((data: MiniBadge[]) => {
        (data || []).forEach(b => { badgeCache[b.id] = b; });
        setBadges(ids.map(id => badgeCache[id]).filter(Boolean));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- la liste est comparée par son contenu (JSON), pas par référence
  }, [JSON.stringify(badgeIds)]);

  if (!badges.length) return null;

  return (
    <div className="flex items-center gap-1 mt-0.5">
      {badges.map(b => {
        const Icon = ICON_MAP[b.icon] || Star;
        return (
          <div key={b.id} title={b.name}
            className="w-4 h-4 rounded flex items-center justify-center"
            style={{ backgroundColor: b.color + "25" }}>
            <Icon className="w-2.5 h-2.5" aria-hidden="true" style={{ color: b.color }} />
            <span className="sr-only">{b.name}</span>
          </div>
        );
      })}
    </div>
  );
}
