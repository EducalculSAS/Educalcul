import Link from "next/link";
import PageHero from "@/components/PageHero";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { redirect } from "next/navigation";
import { PlusCircle, Users, Edit } from "lucide-react";
import { USER_SELECT_COLUMNS } from "@/lib/userColumns";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import DeleteChildButton from "@/components/parent/DeleteChildButton";
import GlassButton from "@/components/ui/GlassButton";

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  child_username: string;
  avatar?: string;
  equipped_border?: string | null;
}

export default async function ManageChildrenPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "parent") redirect("/dashboard");

  // USER_SELECT_COLUMNS est une chaîne dynamique : voir le même commentaire
  // dans child/dashboard/page.tsx pour le `: any`.
  const { data }: { data: any } = await supabaseAdmin
    .from("users")
    .select(USER_SELECT_COLUMNS)
    .eq("parent_id", authUser.id)
    .eq("role", "child")
    .order("first_name");

  const children = (data || []) as Child[];

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <PageHero
        icon={Users}
        title="Mes enfants"
        badge="Gestion"
        subtitle="Gérez les profils et les accès de vos enfants."
        actions={
          <GlassButton href="/parent/add-child" variant="gold">
            <PlusCircle className="w-5 h-5" />
            Ajouter un enfant
          </GlassButton>
        }
      />
      <div className="container mx-auto px-4 pb-12 max-w-6xl">
        {children.length === 0 ? (
          <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-12 text-center max-w-2xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-[var(--greek-cream)] rounded-full">
                <Users className="w-16 h-16 text-[var(--greek-blue)]" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[var(--greek-blue)] mb-4 font-[family-name:var(--font-display)]">
              Aucun enfant ajouté
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Commencez par ajouter un profil pour votre enfant afin de suivre ses
              progrès et lui donner accès aux cours.
            </p>
            <Link
              href="/parent/add-child"
              className="inline-flex items-center text-[var(--greek-blue)] font-bold hover:text-[var(--greek-gold)] transition-colors"
            >
              Ajouter mon premier enfant
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {children.map((child) => {
              return (
                <div
                  key={child.id}
                  className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <span className="mr-4 group-hover:scale-110 transition-transform">
                          <AvatarWithBorder avatar={child.avatar} equippedBorder={child.equipped_border} name={child.first_name} size="md" label="" />
                        </span>
                        <div>
                          <h3 className="text-lg font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                            {child.first_name} {child.last_name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            @{child.child_username}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] text-xs rounded-md font-medium border border-[var(--greek-blue)]/20">
                        {child.grade_level}
                      </span>
                    </div>

                    <div className="pt-4 border-t border-[rgba(52,73,94,0.1)] flex justify-between items-center">
                      <Link
                        href={`/parent/child/${child.id}`}
                        className="text-sm font-medium text-[var(--greek-blue)] hover:text-[var(--greek-gold)] transition-colors"
                      >
                        Voir le rapport
                      </Link>
                      <div className="flex gap-2">
                        <Link
                          href={`/parent/edit-child/${child.id}`}
                          className="p-2 text-gray-400 hover:text-[var(--greek-blue)] hover:bg-[var(--greek-blue)]/10 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <DeleteChildButton childId={child.id} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
