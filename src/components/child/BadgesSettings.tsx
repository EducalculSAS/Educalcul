"use client";

import PageHero from "@/components/PageHero";
import { useState, useEffect, type ComponentType, type CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Trophy, Lock, CheckCircle, Star, Zap, BookOpen, Crown, Target, Brain, Sparkles, Pencil, Map, Loader2 } from "lucide-react";
import StreakFlame from "@/components/StreakFlame";
import { getNameColor } from "@/lib/badgeStyles";
import CosmeticsShowcase from "@/components/child/CosmeticsShowcase";
import { normalizeBorder, normalizeColor } from "@/lib/cosmetics/catalog";
import type { CosmeticCard } from "@/lib/cosmetics/view";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import GlassButton from "@/components/ui/GlassButton";

const ICON_MAP: Record<string, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  pencil: Pencil, zap: Zap, flame: StreakFlame, star: Star, crown: Crown,
  check: CheckCircle, target: Target, brain: Brain, trophy: Trophy,
  sparkles: Sparkles, graduation: Star, book: BookOpen, map: Map, library: BookOpen,
};

interface BadgeRow { id: number; name: string; icon: string; color: string; description: string }
interface UserInfo {
  id: number; first_name: string; avatar?: string; equipped_border?: string; name_color?: string;
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
  const nameColor = getNameColor(user.name_color || "default");

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      {/* Hero */}
      <PageHero
        back={{ href: "/child/dashboard", label: "Tableau de bord" }}
        icon={Trophy}
        title="Mes trophées"
        badge={`${earned.length} / ${badges.length} débloqués`}
        subtitle="Débloque des badges pour personnaliser ton profil."
        actions={
          <div className="hidden md:flex flex-col items-center gap-2">
            <AvatarWithBorder avatar={user.avatar} equippedBorder={user.equipped_border} name={user.first_name || "?"} size="xl" />
            <span className={`text-sm font-bold ${nameColor.cls}`}>{user.first_name}</span>
            <span className="text-white/50 text-xs">Aperçu dans le forum</span>
          </div>
        }
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
        />

        {/* Badges mis en avant */}
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-[var(--greek-gold)]" />
              Badges affichés sur mon profil
            </h2>
            <GlassButton onClick={saveFeatured} variant="navy" size="sm" disabled={savingFeatured}>
              {savingFeatured ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Sauvegarder
            </GlassButton>
          </div>
          <p className="text-xs text-gray-500 mb-4">Sélectionne jusqu&apos;à 3 badges à afficher sur ton profil dans le forum.</p>
          <div className="flex gap-4 mb-4">
            {[0, 1, 2].map((slot) => {
              const bid = featuredBadges[slot];
              const badge = badges.find((b) => b.id === bid);
              const Icon = bid && badge ? (ICON_MAP[badge.icon] || Star) : null;
              return (
                <div key={slot} className={`flex-1 h-20 rounded-2xl border-2 border-dashed flex items-center justify-center transition-all
                  ${bid ? "border-[var(--greek-blue)] bg-blue-50" : "border-[rgba(197,161,72,0.25)] bg-gray-50"}`}>
                  {badge && Icon ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: badge.color + "20" }}>
                        <Icon className="w-5 h-5" style={{ color: badge.color }} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-600 truncate max-w-[70px]">{badge.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 font-semibold">Slot {slot + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400">Clique sur un badge obtenu ci-dessous pour l&apos;ajouter/retirer.</p>
        </div>

        {/* Badges grid */}
        <div>
          <h2 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] text-lg mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[var(--greek-gold)]" />
            Tous les badges
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {badges.map((badge) => {
              const isEarned = earnedSet.has(badge.id);
              const Icon = ICON_MAP[badge.icon] || Star;
              return (
                <div key={badge.id}
                  onClick={() => isEarned && toggleFeatured(badge.id)}
                  className={`bg-white rounded-2xl border p-4 flex flex-col items-center text-center transition-all ${isEarned ? "border-[rgba(197,161,72,0.25)] shadow-sm hover:shadow-md cursor-pointer" : "border-[rgba(197,161,72,0.25)] opacity-60"} ${featuredBadges.includes(badge.id) ? "ring-2 ring-[var(--greek-blue)] bg-blue-50" : ""}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${isEarned ? "" : "grayscale"}`}
                    style={{ backgroundColor: isEarned ? badge.color + "20" : "#f3f4f6" }}>
                    <Icon className="w-7 h-7" style={{ color: isEarned ? badge.color : "#9ca3af" }} />
                  </div>
                  <p className="font-bold text-sm text-[var(--greek-blue)] mb-0.5">{badge.name}</p>
                  <p className="text-xs text-gray-400 mb-2 line-clamp-2">{badge.description}</p>
                  {isEarned ? (
                    <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Obtenu</span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Verrouillé</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
