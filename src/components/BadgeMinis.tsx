"use client";

import { useEffect, useState } from "react";
import BadgeEmblem from "@/components/BadgeEmblem";

/** Badge renvoyé par /api/badges. */
interface MiniBadge { id: number; name: string; icon: string; requirement_type?: string | null; tier?: number }
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
      {badges.map(b => (
        <span key={b.id} title={b.name} className="inline-flex">
          <BadgeEmblem badge={{ icon: b.icon, requirement_type: b.requirement_type, tier: b.tier ?? 0 }} size={20} />
          <span className="sr-only">{b.name}</span>
        </span>
      ))}
    </div>
  );
}
