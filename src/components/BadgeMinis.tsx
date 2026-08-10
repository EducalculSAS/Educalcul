"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Star, Zap, Trophy, BookOpen, CheckCircle, Crown, Flame } from "lucide-react";

const ICON_MAP: Record<string, any> = {
  pencil: Star, zap: Zap, flame: Flame, star: Star, crown: Crown,
  check: CheckCircle, trophy: Trophy, brain: Star, sparkles: Star,
  graduation: Star, book: BookOpen, map: Star, library: BookOpen,
  sword: Star, swords: Star, medal: Trophy, gem: Star, crystal: Star,
  divine: Crown, shield: CheckCircle, bullseye: Star, bookmark: BookOpen,
  scroll: BookOpen, owl: Star, universe: Crown,
};

const badgeCache: Record<number, any> = {};

export default function BadgeMinis({ badgeIds }: { badgeIds: number[] }) {
  const [badges, setBadges] = useState<any[]>([]);

  useEffect(() => {
    if (!badgeIds?.length) return;
    const ids = badgeIds.filter(Boolean);
    if (!ids.length) return;

    const cached = ids.map(id => badgeCache[id]).filter(Boolean);
    if (cached.length === ids.length) { setBadges(cached); return; }

    supabase.from("badges").select("id, name, icon, color").in("id", ids).then(({ data }) => {
      (data || []).forEach(b => { badgeCache[b.id] = b; });
      setBadges(ids.map(id => badgeCache[id]).filter(Boolean));
    });
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
