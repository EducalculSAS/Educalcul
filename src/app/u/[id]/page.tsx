import Emblem3D from "@/components/Emblem3D";
import { publicAuthor } from "@/lib/forum";

import BadgeEmblem from "@/components/BadgeEmblem";
import { badgeTiers } from "@/lib/badgeTiers";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { getNameColor } from "@/lib/badgeStyles";
import { ADMIN_COLOR } from "@/lib/cosmetics/catalog";
import Navbar from "@/components/Navbar";
import { getCatalogLevelLabel } from "@/lib/constants";
import StateScreen from "@/components/StateScreen";
import { supabaseAdmin } from "@/lib/supabaseClient";
import ProfileHeaderActions from "@/components/profile/ProfileHeaderActions";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safeRedirect";

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
    return (
      <div className="min-h-screen bg-[var(--greek-cream)]">
        <Navbar />
        <StateScreen title="Profil introuvable" actions={[{ label: "Retour au tableau de bord", href: "/dashboard" }]}>
          Ce profil n&apos;existe pas ou n&apos;est plus visible.
        </StateScreen>
      </div>
    );
  }

  const { data: user } = await supabaseAdmin
    .from("user_public_profiles")
    .select("id, first_name, last_name, child_username, avatar, equipped_border, name_color, featured_badges, role, grade_level")
    .eq("id", id)
    .maybeSingle();

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--greek-cream)]">
        <Navbar />
        <StateScreen title="Profil introuvable" actions={[{ label: "Retour au tableau de bord", href: "/dashboard" }]}>
          Ce profil n&apos;existe pas ou n&apos;est plus visible.
        </StateScreen>
      </div>
    );
  }

  const [{ data: badgeRows }, { data: earnedRows }, { count: exos }, { count: quiz }, { count: cours }] = await Promise.all([
    supabaseAdmin.from("badges").select("id, name, icon, requirement_type, requirement_value").eq("is_active", true).order("display_order"),
    supabaseAdmin.from("user_badges").select("badge_id").eq("user_id", user.id),
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabaseAdmin.from("user_quiz_attempts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabaseAdmin.from("user_course_progress").select("*", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  // Mêmes emblèmes que la page « Mes trophées » : la forme vient de la catégorie, le métal du rang dans la catégorie.
  const catalog = badgeRows || [];
  const tiers = badgeTiers(catalog);
  const earned = new Set((earnedRows || []).map((e) => e.badge_id));
  const allBadges = catalog.filter((b) => earned.has(b.id));
  const featured = new Set((user.featured_badges || []).filter(Boolean));
  const badges = allBadges.filter((b) => featured.has(b.id));
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
            <div className="mt-1 min-w-0">
              <h1 className={`text-3xl font-bold font-[family-name:var(--font-display)] ${nameColor.cls}`}>{displayName}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${user.role === "admin" ? "bg-red-500 text-white" : user.role === "parent" ? "bg-blue-400 text-white" : "bg-green-400 text-white"}`}>
                  {user.role === "admin" ? "Admin" : user.role === "parent" ? "Parent" : "Élève"}
                </span>
                {user.grade_level && <span className="text-white/70 text-sm">{getCatalogLevelLabel(user.grade_level)}</span>}
              </div>
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {badges.map((b) => (
                    <div key={b.id} className="flex items-center gap-1.5 bg-white/10 pl-1 pr-2.5 py-1 rounded-full border border-white/20">
                      <BadgeEmblem badge={{ icon: b.icon, requirement_type: b.requirement_type, tier: tiers[b.id] ?? 0 }} size={26} />
                      <span className="text-xs font-bold text-white/90">{b.name}</span>
                    </div>
                  ))}
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
            <div key={s.label} className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.25)] shadow-sm p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {allBadges.length > 0 && (
          <section className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]">
            <div className="flex items-center gap-3 mb-5">
              <Emblem3D kind="trophy" size={28} float={false} />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Badges obtenus ({allBadges.length})</h2>
            </div>
            <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {allBadges.map((b) => (
                <li key={b.id} className="flex flex-col items-center gap-2 text-center">
                  <BadgeEmblem badge={{ icon: b.icon, requirement_type: b.requirement_type, tier: tiers[b.id] ?? 0 }} size={56} />
                  <span className="text-xs font-bold text-gray-800 line-clamp-2">{b.name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
