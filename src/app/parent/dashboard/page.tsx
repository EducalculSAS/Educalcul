import Emblem3D from "@/components/Emblem3D";
import DashboardTile from "@/components/DashboardTile";
import DashboardHero from "@/components/DashboardHero";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import MiniCalendarWidget from "@/components/calendar/MiniCalendarWidget";
import ChildFamilyCard from "@/components/parent/ChildFamilyCard";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import GlassButton from "@/components/ui/GlassButton";
import { loadFamily } from "@/lib/familyOverview";

// Toute la page est un affichage de données propres au parent connecté (ses
// enfants + leurs stats) : la seule chose qui dépend d'un état vraiment
// interactif est le verrou "rapport détaillé" selon le plan d'abonnement,
// isolé dans ChildReportLink. Le reste (y compris les stats par enfant, avant
// chargées une par une après le montage) se résout entièrement côté serveur.
export default async function ParentDashboard() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "parent") redirect("/dashboard");

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("first_name, role, id, avatar, equipped_border, name_color")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userData) redirect("/dashboard");

  const children = await loadFamily(userData.id);

  const activeToday = children.filter((c) => c.summary.today > 0).length;

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      <DashboardHero
        name={userData.first_name || "Parent"}
        avatar={userData.avatar}
        equippedBorder={userData.equipped_border}
        nameColor={userData.name_color}
        pill="Parent"
        tagline={children.length === 0 ? "Ajoutez votre premier enfant pour commencer." : activeToday > 0 ? `${activeToday} enfant${activeToday > 1 ? "s ont" : " a"} travaillé aujourd'hui.` : "Personne n'a encore travaillé aujourd'hui."}
        profileHref="/parent/profile"
      />

      <div className="container mx-auto max-w-6xl px-4">
        {/* Navigation rapide — même style que child */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-10">
          <DashboardTile href="/parent/children" emblem="family" label="Mes enfants" desc="Gérez les comptes et suivez la progression." action="Gérer" />
          <DashboardTile href="/parent/forum" emblem="chat" label="Le forum" desc="Échangez avec d'autres parents et l'équipe." action="Participer" />
          <DashboardTile href="/parent/subscription" emblem="crown" label="Abonnement" desc="Gérez votre formule et votre parrainage." action="Voir" />
          <DashboardTile href="/parent/profile" emblem="profile" label="Mon profil" desc="Modifiez vos informations et votre photo." action="Modifier" />
        </div>

        {/* Section enfants */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] flex items-center gap-3">
            <Emblem3D kind="stairs" size={32} float={false} />
            Suivi de mes enfants
          </h2>
          <GlassButton href="/parent/add-child" variant="navy" size="sm">
            <Plus className="w-4 h-4" /> Ajouter un enfant
          </GlassButton>
        </div>

        {children.length === 0 ? (
          <div className="bg-white rounded-[20px] p-10 shadow-sm border border-[rgba(197,161,72,0.25)] text-center">
            <div className="mb-4"><Emblem3D kind="family" size={88} /></div>
            <p className="text-xl text-[var(--greek-blue)] font-bold font-[family-name:var(--font-display)] mb-2">Aucun enfant ajouté</p>
            <p className="text-gray-500 mb-6">Ajoutez votre premier enfant pour commencer le suivi.</p>
            <GlassButton href="/parent/add-child" variant="navy">
              Commencer maintenant
            </GlassButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {children.map((entry) => (
              <ChildFamilyCard key={entry.child.id} entry={entry} variant="overview" />
            ))}
          </div>
        )}

        {/* Calendrier */}
        <div className="mt-8">
          <MiniCalendarWidget authId={authUser.authId} ownerId={userData.id} isParent={true} title="Calendrier" fullCalendarHref="/parent/calendar" />
        </div>
      </div>
    </div>
  );
}
