import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { PlusCircle, Users, Edit } from "lucide-react";
import { USER_SELECT_COLUMNS } from "@/lib/userColumns";
import { avatarUrl } from "@/lib/avatarUrl";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import DeleteChildButton from "@/components/parent/DeleteChildButton";

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  child_username: string;
  avatar?: string;
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
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
              <Users className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
              MES ENFANTS
            </h1>
            <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
              <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">GESTION</span>
              <span>Gérez les profils et les accès de vos enfants</span>
            </p>
          </div>
          <Link
            href="/parent/add-child"
            className="flex items-center gap-2 bg-[var(--greek-gold)] hover:bg-yellow-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shrink-0"
          >
            <PlusCircle className="w-5 h-5" />
            Ajouter un enfant
          </Link>
        </div>
      </div>
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
              const avatar = avatarUrl(child.avatar, "/avatars/avatar1.png");
              return (
                <div
                  key={child.id}
                  className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="relative w-12 h-12 bg-white shadow-sm rounded-full flex items-center justify-center text-[var(--greek-blue)] font-bold text-xl mr-4 group-hover:scale-110 transition-transform overflow-hidden border-2 border-[rgba(197,161,72,0.25)]">
                          {child.avatar && avatar ? (
                            <Image src={avatar} alt={child.first_name} fill sizes="48px" className="object-cover" />
                          ) : (
                            child.first_name.charAt(0)
                          )}
                        </div>
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
