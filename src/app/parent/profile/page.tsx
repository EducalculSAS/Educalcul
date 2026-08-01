import { redirect } from "next/navigation";
import { User } from "lucide-react";
import { getServerUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import ParentProfileSettings from "@/components/parent/ParentProfileSettings";

export default async function ParentProfilePage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const au = session?.user;
  const googleLinked = !!au?.identities?.some((id) => id.provider === "google");

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, first_name, last_name, role, email, avatar, notif_weekly_reports, notif_offers_news")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!profile || profile.role !== "parent") redirect("/dashboard");

  const [{ data: sub }, { count: childrenCount }] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select("status, cancel_at_period_end")
      .eq("user_id", au?.id)
      .maybeSingle(),
    supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", profile.id)
      .eq("role", "child"),
  ]);
  const hasActiveSubscription = !!sub && sub.status === "active" && !sub.cancel_at_period_end;

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
            <User className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
            MON PROFIL
          </h1>
          <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
            <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">COMPTE</span>
            <span>Gérez vos informations personnelles</span>
          </p>
        </div>
      </div>

      <ParentProfileSettings
        initialFormData={{
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          email: profile.email || "",
          phone: "",
          avatar: profile.avatar || "/avatars/avatar1.png",
        }}
        initialNotifications={{
          notif_weekly_reports: profile.notif_weekly_reports ?? true,
          notif_offers_news: profile.notif_offers_news ?? false,
        }}
        initialGoogleLinked={googleLinked}
        initialHasActiveSubscription={hasActiveSubscription}
        initialChildrenCount={childrenCount ?? 0}
      />
    </div>
  );
}
