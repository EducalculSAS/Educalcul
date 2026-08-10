import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminUsersClient from "@/components/admin/AdminUsersClient";

export default async function AdminUsersPage() {
  // select(*) exclurait password_hash de toute façon si la colonne n'existait
  // pas dans le besoin d'affichage — ici elle existe et n'a rien à faire
  // renvoyée au client, donc exclusion explicite.
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, auth_id, email, child_username, first_name, last_name, role, parent_id, grade_level, avatar, status, created_at, updated_at, account_type, subscription_plan_id, subscription_expires_at, child_age, last_login_ip, last_login_city, last_login_country, last_active_at, avatar_border, name_animation, name_color, equipped_border, featured_badges, login_count, login_streak, last_login_date, ban_reason, ban_until, onboarding_completed, notif_weekly_reports, notif_offers_news, school_zone, two_factor_enabled, needs_grade_choice, graduated_at")
    .order("created_at", { ascending: false });

  return <AdminUsersClient initialUsers={data || []} />;
}
