import { redirect } from "next/navigation";
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

  const { data: userData }: { data: any } = await supabaseAdmin
    .from("users")
    .select(USER_SELECT_COLUMNS)
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userData) {
    return <div className="min-h-screen flex items-center justify-center"><p>Profil introuvable</p></div>;
  }
  if (!userData.email && au?.email) userData.email = au.email;

  const [{ count: coursesCount }, { count: exercisesCount }, { count: badgesCount }] = await Promise.all([
    supabaseAdmin.from("user_course_progress").select("*", { count: "exact", head: true }).eq("user_id", authUser.id),
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", authUser.id),
    supabaseAdmin.from("user_badges").select("*", { count: "exact", head: true }).eq("user_id", userData.id),
  ]);

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      {/* Hero */}
      <div className="bg-[var(--greek-blue)] text-white pt-20 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-2 flex items-center gap-4">
            <User className="w-10 h-10 text-[var(--greek-gold)]" />
            MON PROFIL
          </h1>
          <p className="opacity-70 text-sm">Gérez tes informations et ta progression</p>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 max-w-5xl">
        <ChildProfileSettings
          user={userData}
          googleLinked={googleLinked}
          activityCounts={{ courses: coursesCount ?? 0, exercises: exercisesCount ?? 0, badges: badgesCount ?? 0 }}
        />
      </div>
    </div>
  );
}
