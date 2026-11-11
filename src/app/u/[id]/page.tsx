import { relationOne } from "@/lib/validate";
import { publicAuthor } from "@/lib/forum";
import { profileBadgeSchema } from "@/lib/schemas";
import { Star, Trophy, BookOpen, CheckCircle, Zap } from "lucide-react";
import type { Row } from "@/types/db";
import type { LucideIcon } from "lucide-react";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { getNameColor } from "@/lib/badgeStyles";
import { ADMIN_COLOR } from "@/lib/cosmetics/catalog";
import Navbar from "@/components/Navbar";
import { supabaseAdmin } from "@/lib/supabaseClient";
import ProfileHeaderActions from "@/components/profile/ProfileHeaderActions";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safeRedirect";

const ICON_MAP: Record<string, LucideIcon> = {
  pencil: Star, zap: Zap, flame: Star, star: Star, crown: Star,
  check: CheckCircle, trophy: Trophy, brain: Star, sparkles: Star,
  graduation: Star, book: BookOpen, map: Star, library: BookOpen,
  sword: Star, swords: Star, medal: Trophy, gem: Star, crystal: Star,
  divine: Star, shield: CheckCircle, bullseye: Star, bookmark: BookOpen,
  scroll: BookOpen, owl: Star, universe: Star,
};

export default async function PublicProfilePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [{ id }, { returnTo }, viewer] = await Promise.all([params, searchParams, getServerUser()]);

  // Réservé aux utilisateurs connectés (on n'y arrive que depuis le forum) :
  // ouverte à tous, cette page permettait d'énumérer les élèves (identifiants
  // qui se suivent) avec prénom, nom, niveau et avatar.
  if (!viewer) redirect("/auth/connexion");
  if (!/^\d{1,12}$/.test(id)) {
    return <div className="p-8 text-center text-gray-500">Profil introuvable.</div>;
  }

  const { data: user } = await supabaseAdmin
    .from("user_public_profiles")
    .select("id, first_name, last_name, child_username, avatar, equipped_border, name_color, featured_badges, role, grade_level")
    .eq("id", id)
    .maybeSingle();

  if (!user) {
    return <div className="p-8 text-center text-gray-500">Profil introuvable.</div>;
  }

  const [{ data: featuredBadges }, { data: earnedBadgeRows }, { count: exos }, { count: quiz }, { count: cours }] = await Promise.all([
    user.featured_badges?.length
      ? supabaseAdmin.from("badges").select("*").in("id", user.featured_badges.filter(Boolean))
      : Promise.resolve({ data: [] as Row<"badges">[] }),
    supabaseAdmin.from("user_badges").select("badge:badges(id, name, icon, color, category)").eq("user_id", user.id),
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabaseAdmin.from("user_quiz_attempts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabaseAdmin.from("user_course_progress").select("*", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const badges = featuredBadges || [];
  const allBadges = (earnedBadgeRows || []).map((e) => relationOne(profileBadgeSchema, e.badge)).filter((b): b is NonNullable<typeof b> => !!b);
  const stats = { exos: exos ?? 0, quiz: quiz ?? 0, cours: cours ?? 0 };

  const nameColor = getNameColor(user.role === "admin" ? ADMIN_COLOR : user.name_color || "default");
  // Même règle que sur le forum : jamais de nom de famille en entier (pseudo ou prénom pour un élève, prénom + initiale pour un adulte).
  const displayName = publicAuthor(user)?.displayName || "Profil";

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      <Navbar />
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-16 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="container mx-auto max-w-2xl relative z-10">
          <ProfileHeaderActions userId={user.id} userRole={user.role} returnTo={returnTo ? safeRedirectPath(returnTo, "") || null : null} />
          <div className="flex items-center gap-4">
            <AvatarWithBorder avatar={user.avatar} equippedBorder={user.equipped_border} name={displayName} size="xl" />
            <div className="mt-1">
              <h1 className={`text-3xl font-bold font-[family-name:var(--font-display)] ${nameColor.cls}`}>{displayName}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${user.role === "admin" ? "bg-red-500 text-white" : user.role === "parent" ? "bg-blue-400 text-white" : "bg-green-400 text-white"}`}>
                  {user.role === "admin" ? "Admin" : user.role === "parent" ? "Parent" : "Élève"}
                </span>
                {user.grade_level && <span className="text-white/70 text-sm">{user.grade_level}</span>}
              </div>
              {badges.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {badges.map((b) => {
                    const Icon = ICON_MAP[b.icon] || Star;
                    return (
                      <div key={b.id} title={b.name} className="flex items-center gap-1 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/20">
                        <Icon className="w-3.5 h-3.5" style={{ color: b.color }} />
                        <span className="text-xs font-bold text-white/90">{b.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-2xl px-4 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Exercices", value: stats.exos, color: "text-orange-600", bg: "bg-orange-50" },
            { label: "Quiz", value: stats.quiz, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Cours", value: stats.cours, color: "text-blue-600", bg: "bg-blue-50" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {allBadges.length > 0 && (
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
            <h2 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[var(--greek-gold)]" />
              Badges obtenus ({allBadges.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {allBadges.map((b) => {
                const Icon = ICON_MAP[b.icon] || Star;
                return (
                  <div key={b.id} title={b.name} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold"
                    style={{ backgroundColor: b.color + "15", borderColor: b.color + "40", color: b.color }}>
                    <Icon className="w-3 h-3" />
                    {b.name}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
