import { redirect } from "next/navigation";
import { getLiveSubscription } from "@/lib/subscriptionLive";
import PageHero from "@/components/PageHero";
import { User } from "lucide-react";
import { getServerUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import ParentProfileSettings from "@/components/parent/ParentProfileSettings";
import ParentAlertSettings from "@/components/parent/ParentAlertSettings";
import { getAlertPrefs } from "@/lib/studentStore";

export default async function ParentProfilePage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const au = session?.user;
  const googleLinked = !!au?.identities?.some((id) => id.provider === "google");

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, first_name, last_name, role, email, avatar, equipped_border, notif_weekly_reports, notif_offers_news")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!profile || profile.role !== "parent") redirect("/dashboard");

  const [sub, { count: childrenCount }] = await Promise.all([
    au?.id ? getLiveSubscription<{ cancel_at_period_end: boolean | null }>(au.id, "cancel_at_period_end") : Promise.resolve(null),
    supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", profile.id)
      .eq("role", "child"),
  ]);
  const hasActiveSubscription = !!sub && !sub.cancel_at_period_end;
  const alertPrefs = await getAlertPrefs(profile.id);

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      <PageHero icon={User} title="Mon profil" badge="Compte" subtitle="Gérez vos informations personnelles." width="4xl" />

      <ParentProfileSettings
        initialFormData={{
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          email: profile.email || "",
          phone: "",
          avatar: profile.avatar || "",
        }}
        equippedBorder={profile.equipped_border ?? null}
        initialNotifications={{
          notif_weekly_reports: profile.notif_weekly_reports ?? true,
          notif_offers_news: profile.notif_offers_news ?? false,
        }}
        initialGoogleLinked={googleLinked}
        initialHasActiveSubscription={hasActiveSubscription}
        initialChildrenCount={childrenCount ?? 0}
      >
        <ParentAlertSettings initial={alertPrefs} />
      </ParentProfileSettings>
    </div>
  );
}
