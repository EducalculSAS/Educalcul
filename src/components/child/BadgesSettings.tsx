"use client";

import PageHero from "@/components/PageHero";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Trophy, Lock, CheckCircle, Star, Loader2 } from "lucide-react";
import BadgeEmblem, { badgeTiers } from "@/components/BadgeEmblem";
import CosmeticsShowcase from "@/components/child/CosmeticsShowcase";
import { normalizeBorder, normalizeColor } from "@/lib/cosmetics/catalog";
import type { CosmeticCard } from "@/lib/cosmetics/view";
import GlassButton from "@/components/ui/GlassButton";

interface BadgeRow { id: number; name: string; icon: string; color: string; description: string; requirement_type?: string | null; requirement_value?: number | null }
interface UserInfo {
  id: number; first_name: string; avatar?: string; equipped_border?: string; name_color?: string; role?: string;
  featured_badges?: number[] | null;
}

/** Toute la personnalisation (contours, couleurs, badges affichés) : ce sont
 * des mutations + un état d'édition local (sélection avant sauvegarde),
 * isolées en client island. Les données initiales (badges, obtenus,
 * déblocages) arrivent déjà chargées du serveur. */
export default function BadgesSettings({
  user: initialUser, badges, earnedIds, borders, colors,
}: {
  user: UserInfo;
  badges: BadgeRow[];
  earnedIds: number[];
  borders: CosmeticCard[];
  colors: CosmeticCard[];
}) {
  const [user, setUser] = useState(initialUser);
  const [equipping, setEquipping] = useState(false);
  const [featuredBadges, setFeaturedBadges] = useState<(number | null)[]>(() => {
    const fb = initialUser.featured_badges;
    return fb?.length ? [...fb, null, null, null].slice(0, 3) : [null, null, null];
  });
  const [savingFeatured, setSavingFeatured] = useState(false);
  const earnedSet = new Set(earnedIds);

  // Vérifie/attribue les nouveaux badges à chaque visite (mutation ; lecture
  // seule des badges/déblocages déjà obtenus lors du chargement serveur).
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch("/api/child/check-badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authId: session.user.id }),
      });
    })();
  }, []);

  const toggleFeatured = (badgeId: number) => {
    setFeaturedBadges((prev) => {
      if (prev.includes(badgeId)) return prev.map((b) => (b === badgeId ? null : b));
      const empty = prev.findIndex((b) => b === null);
      if (empty === -1) return prev;
      const next = [...prev];
      next[empty] = badgeId;
      return next;
    });
  };

  const saveFeatured = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setSavingFeatured(true);
    await fetch("/api/child/featured-badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authId: session.user.id, badgeIds: featuredBadges }),
    });
    setSavingFeatured(false);
  };

  const equip = async (border?: string, color?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setEquipping(true);
    const body: { authId: string; equipped_border?: string; name_color?: string } = { authId: session.user.id };
    if (border !== undefined) body.equipped_border = border;
    if (color !== undefined) body.name_color = color;
    await fetch("/api/child/equip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setUser((u) => ({ ...u, ...(border !== undefined ? { equipped_border: border } : {}), ...(color !== undefined ? { name_color: color } : {}) }));
    setEquipping(false);
  };

  const earned = badges.filter((b) => earnedSet.has(b.id));
  const tiers = useMemo(() => badgeTiers(badges), [badges]);

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      {/* Hero */}
      <PageHero
        back={{ href: "/child/dashboard", label: "Tableau de bord" }}
        icon={Trophy}
        title="Mes trophées"
        badge={`${earned.length} / ${badges.length} débloqués`}
        subtitle="Tes badges, tes contours et tes titres : débloque-les en progressant."
      />

      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <CosmeticsShowcase
          borders={borders}
          colors={colors}
          avatar={user.avatar}
          firstName={user.first_name || "?"}
          equippedBorder={normalizeBorder(user.equipped_border)}
          equippedColor={normalizeColor(user.name_color)}
          busy={equipping}
          onEquip={equip}
          isAdmin={user.role === "admin"}
        />

        {/* Badges mis en avant */}
        <section className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-[var(--greek-gold)]" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Badges affichés sur mon profil</h2>
            </div>
            <GlassButton onClick={saveFeatured} variant="navy" size="sm" disabled={savingFeatured}>
              {savingFeatured ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Sauvegarder
            </GlassButton>
          </div>
          <p className="text-sm text-gray-500 mb-5">Choisis jusqu&apos;à 3 badges obtenus (clique dessus plus bas) : ils s&apos;affichent à côté de ton nom dans le forum.</p>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[0, 1, 2].map((slot) => {
              const bid = featuredBadges[slot];
              const badge = badges.find((b) => b.id === bid);
              return (
                <div key={slot} className={`h-28 rounded-2xl border-2 border-dashed flex items-center justify-center transition-colors
                  ${badge ? "border-[var(--greek-blue)] bg-blue-50/60" : "border-[rgba(197,161,72,0.3)] bg-[var(--greek-cream)]/40"}`}>
                  {badge ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <BadgeEmblem badge={{ icon: badge.icon, requirement_type: badge.requirement_type, tier: tiers[badge.id] ?? 0 }} size={56} />
                      <span className="text-xs font-bold text-gray-700 truncate max-w-[90px]">{badge.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 font-semibold">Emplacement {slot + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Tous les badges */}
        <section className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]">
          <div className="flex items-center gap-3 mb-1">
            <Trophy className="w-5 h-5 text-[var(--greek-gold)]" />
            <h2 className="text-xl font-bold text-[var(--greek-blue)]">Tous les badges</h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">{earned.length} obtenu{earned.length > 1 ? "s" : ""} sur {badges.length}. Chaque catégorie a sa forme, chaque palier son métal.</p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {badges.map((badge) => {
              const isEarned = earnedSet.has(badge.id);
              const featured = featuredBadges.includes(badge.id);
              return (
                <li key={badge.id}>
                  <button
                    type="button"
                    onClick={() => isEarned && toggleFeatured(badge.id)}
                    disabled={!isEarned}
                    aria-pressed={featured}
                    className={`relative h-full w-full flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 text-center transition-[border-color,box-shadow] duration-200
                      ${featured ? "border-[var(--greek-blue)] bg-blue-50/70" : "border-[rgba(197,161,72,0.25)] bg-white"} ${isEarned ? "cursor-pointer hover:border-[var(--greek-gold)] hover:shadow-sm" : "cursor-default"}`}
                  >
                    <BadgeEmblem badge={{ icon: badge.icon, requirement_type: badge.requirement_type, tier: tiers[badge.id] ?? 0 }} size={72} locked={!isEarned} />
                    <span className="text-sm font-bold text-gray-800">{badge.name}</span>
                    <span className="text-xs text-gray-500 line-clamp-2">{badge.description}</span>
                    <span className={`text-xs font-semibold ${isEarned ? "text-green-700" : "text-gray-400"}`}>{isEarned ? (featured ? "Affiché sur mon profil" : "Obtenu") : "À débloquer"}</span>
                    {!isEarned && <Lock className="absolute top-2 right-2 w-4 h-4 text-gray-400" />}
                    {featured && <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-[var(--greek-blue)]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
