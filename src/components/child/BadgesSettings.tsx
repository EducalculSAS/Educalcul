"use client";

import PageHero from "@/components/PageHero";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Trophy, Lock, CheckCircle, Star, Zap, BookOpen, Crown, Target, Brain, Sparkles, Flame, Pencil, Map, Loader2 } from "lucide-react";
import { BORDER_STYLES, NAME_COLORS, getNameColor } from "@/lib/badgeStyles";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import GlassButton from "@/components/ui/GlassButton";

const ICON_MAP: Record<string, any> = {
  pencil: Pencil, zap: Zap, flame: Flame, star: Star, crown: Crown,
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
  user: initialUser, badges, earnedIds, unlockedBorders, unlockedColors,
}: {
  user: UserInfo;
  badges: BadgeRow[];
  earnedIds: number[];
  unlockedBorders: string[];
  unlockedColors: string[];
}) {
  const [user, setUser] = useState(initialUser);
  const [equipping, setEquipping] = useState(false);
  const [featuredBadges, setFeaturedBadges] = useState<(number | null)[]>(() => {
    const fb = initialUser.featured_badges;
    return fb?.length ? [...fb, null, null, null].slice(0, 3) : [null, null, null];
  });
  const [savingFeatured, setSavingFeatured] = useState(false);
  const [cosmeticProgress, setCosmeticProgress] = useState<Record<string, any>>({});
  const earnedSet = new Set(earnedIds);

  // Vérifie/attribue les nouveaux badges à chaque visite (mutation ; lecture
  // seule des badges/déblocages déjà obtenus lors du chargement serveur).
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/child/check-badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authId: session.user.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.progress) setCosmeticProgress(data.progress);
      }
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
    const body: any = { authId: session.user.id };
    if (border !== undefined) body.equipped_border = border;
    if (color !== undefined) body.name_color = color;
    await fetch("/api/child/equip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setUser((u) => ({ ...u, ...(border !== undefined ? { equipped_border: border } : {}), ...(color !== undefined ? { name_color: color } : {}) }));
    setEquipping(false);
  };

  const earned = badges.filter((b) => earnedSet.has(b.id));
  const nameColor = getNameColor(user.name_color || "default");

  const COSMETIC_MAP: Record<string, { label: string; color: string; required: string[] }> = {
    bronze: { label: "Bronze", color: "#cd7f32", required: ["Travailleur", "Lecteur", "Combattant"] },
    silver: { label: "Argent", color: "#b0b8c8", required: ["Acharné", "Studieux", "Champion"] },
    gold: { label: "Or", color: "#ffd700", required: ["Guerrier", "Érudit", "Légende des Quiz"] },
    diamond: { label: "Diamant", color: "#22d3ee", required: ["Expert", "Sage", "Intransigeant"] },
    flamme: { label: "Flamme", color: "#f97316", required: ["Assidu", "Inébranlable"] },
    elite: { label: "Elite", color: "#f43f5e", required: ["Dieu des Maths", "Omniscient", "Divin"] },
  };
  const badgeToCosmetic: Record<string, { label: string; color: string; done: number; total: number; unlocked: boolean }> = {};
  const earnedNames = new Set(earned.map((b) => b.name));
  for (const [, def] of Object.entries(COSMETIC_MAP)) {
    const done = def.required.filter((n) => earnedNames.has(n)).length;
    const unlocked = done === def.required.length;
    for (const name of def.required) {
      badgeToCosmetic[name] = { label: def.label, color: def.color, done, total: def.required.length, unlocked };
    }
  }

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
        {/* Personnalisation */}
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
          <h2 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] text-lg mb-5 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--greek-gold)]" />
            Personnalisation
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Contour d'avatar</p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(BORDER_STYLES).map(([key, val]) => {
                  const unlocked = unlockedBorders.includes(key);
                  const active = user.equipped_border === key || (!user.equipped_border && key === "none");
                  return (
                    <button key={key} onClick={() => unlocked && equip(key)} disabled={!unlocked || equipping}
                      className={`relative flex flex-col items-center gap-1 pt-2 pb-2 px-2 rounded-2xl transition-all cursor-pointer min-w-[80px]
                        ${active ? "bg-blue-50 ring-2 ring-[var(--greek-blue)]" : unlocked ? "hover:bg-gray-50" : ""}`}
                    >
                      <AvatarWithBorder avatar={user.avatar} equippedBorder={key} name={user.first_name || "?"} size="md" />
                      <span className={`text-[11px] font-semibold mt-1 ${unlocked ? "text-gray-700" : "text-gray-400"}`}>{val.label}</span>
                      {!unlocked && (
                        <div className="absolute top-1 right-1 bg-gray-700/80 rounded-full p-0.5">
                          <Lock className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      {active && <CheckCircle className="absolute top-1 right-1 w-4 h-4 text-[var(--greek-blue)]" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Couleur du nom</p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(NAME_COLORS).map(([key, val]) => {
                  const unlocked = unlockedColors.includes(key);
                  const active = user.name_color === key || (!user.name_color && key === "default");
                  return (
                    <button key={key} onClick={() => unlocked && equip(undefined, key)} disabled={!unlocked || equipping}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer
                        ${active ? "border-[var(--greek-blue)] bg-blue-50" : unlocked ? "border-[rgba(197,161,72,0.25)] hover:border-[var(--greek-gold)]" : "border-[rgba(197,161,72,0.25)] bg-gray-50"}`}
                    >
                      <span className={`text-sm font-bold px-2 ${val.cls}`}>{user.first_name || "Nom"}</span>
                      <span className={`text-xs font-semibold ${unlocked ? "text-gray-600" : "text-gray-400"}`}>{val.label}</span>
                      {!unlocked && (
                        <div className="absolute top-1 right-1 bg-gray-800/70 rounded-full p-0.5">
                          <Lock className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      {active && <CheckCircle className="absolute top-1 right-1 w-4 h-4 text-[var(--greek-blue)]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

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
          <p className="text-xs text-gray-500 mb-4">Sélectionne jusqu'à 3 badges à afficher sur ton profil dans le forum.</p>
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
          <p className="text-xs text-gray-400">Clique sur un badge obtenu ci-dessous pour l'ajouter/retirer.</p>
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
              const cosm = badgeToCosmetic[badge.name];
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
                  {cosm && !isEarned && !cosm.unlocked && (
                    <div className="flex items-center gap-1.5 mt-2 w-full">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${(cosm.done / cosm.total) * 100}%`, backgroundColor: cosm.color }} />
                      </div>
                      <span className="text-[10px] font-bold shrink-0" style={{ color: cosm.color }}>{cosm.done}/{cosm.total} {cosm.label}</span>
                    </div>
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
