import { redirect } from "next/navigation";
import { realEmail } from "@/lib/childEmail";
import PageHero from "@/components/PageHero";
import { User } from "lucide-react";
import { getServerUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { USER_SELECT_COLUMNS } from "@/lib/userColumns";
import ChildProfileSettings from "@/components/child/ChildProfileSettings";

export default async function ChildProfilePage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  // getSession() (pas getUser()) : le middleware vient déjà de vérifier la
  // session sur cette même requête, pas besoin d'un second aller-retour
  // réseau juste pour lire les identités liées (affichage non sensible).
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const au = session?.user;
  const googleLinked = !!au?.identities?.some((id) => id.provider === "google");

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select(USER_SELECT_COLUMNS)
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userData) {
    return <div className="min-h-screen flex items-center justify-center"><p>Profil introuvable</p></div>;
  }
  // Un enfant sans e-mail a une adresse technique côté Auth : elle ne s'affiche jamais.
  if (!userData.email && realEmail(au?.email)) userData.email = realEmail(au?.email);

  const [{ count: coursesCount }, { count: exercisesCount }, { count: badgesCount }, { count: minigamesCount }] = await Promise.all([
    supabaseAdmin.from("user_course_progress").select("*", { count: "exact", head: true }).eq("user_id", authUser.id),
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", authUser.id),
    supabaseAdmin.from("user_badges").select("*", { count: "exact", head: true }).eq("user_id", userData.id),
    supabaseAdmin.from("minigame_sessions").select("*", { count: "exact", head: true }).eq("user_id", authUser.id).eq("status", "completed"),
  ]);

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero */}
      <PageHero icon={User} title="Mon profil" badge="Compte" subtitle="Gère tes informations et suis ta progression." width="4xl" />

      <div className="container mx-auto px-4 pb-16 max-w-5xl" data-tour="profile">
        <ChildProfileSettings
          user={userData}
          googleLinked={googleLinked}
          activityCounts={{ courses: coursesCount ?? 0, exercises: exercisesCount ?? 0, badges: badgesCount ?? 0, minigames: minigamesCount ?? 0 }}
        />
      </div>
    </div>
  );
}
