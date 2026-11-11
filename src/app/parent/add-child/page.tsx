import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import AddChildForm from "@/components/parent/AddChildForm";
import PageHero from "@/components/PageHero";
import GlassButton from "@/components/ui/GlassButton";

import { getChildLimit, childLimitMessage } from "@/lib/childLimit";

export default async function AddChildPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "parent") redirect("/dashboard");

  const limit = await getChildLimit(authUser);
  if (!limit.canAdd) {
    return (
      <div className="min-h-screen bg-[var(--greek-cream)]">
        <PageHero emblem="family" title="Ajouter un enfant" badge="Formule" subtitle={childLimitMessage(limit)} />
        <div className="container mx-auto px-4 pb-12 max-w-xl text-center">
          <GlassButton href="/parent/subscription" variant="gold">Voir les formules</GlassButton>
        </div>
      </div>
    );
  }

  return <AddChildForm />;
}
