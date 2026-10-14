import Link from "next/link";
import PageHero from "@/components/PageHero";
import { redirect } from "next/navigation";
import { PlusCircle, Users } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import ChildFamilyCard from "@/components/parent/ChildFamilyCard";
import { loadFamily } from "@/lib/familyOverview";
import GlassButton from "@/components/ui/GlassButton";
import { getChildLimit } from "@/lib/childLimit";

export default async function ManageChildrenPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "parent") redirect("/dashboard");

  const [children, limit] = await Promise.all([loadFamily(authUser.id), getChildLimit(authUser)]);

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero Header */}
      <PageHero
        icon={Users}
        title="Mes enfants"
        badge="Gestion"
        subtitle="Gérez les profils et les accès de vos enfants."
        actions={
          limit.canAdd ? (
            <GlassButton href="/parent/add-child" variant="gold">
              <PlusCircle className="w-5 h-5" />
              Ajouter un enfant
            </GlassButton>
          ) : (
            <GlassButton href="/parent/subscription" variant="gold">
              Plus d&apos;enfants ? Voir les formules
            </GlassButton>
          )
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
            {children.map((entry) => (
              <ChildFamilyCard key={entry.child.id} entry={entry} variant="manage" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
