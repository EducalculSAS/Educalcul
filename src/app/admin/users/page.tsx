import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminUsersClient from "@/components/admin/AdminUsersClient";
import { selectAllPages } from "@/lib/selectAllPages";

// select(*) exclurait password_hash de toute façon si la colonne n'existait
// pas dans le besoin d'affichage — ici elle existe et n'a rien à faire
// renvoyée au client, donc exclusion explicite.
const USER_COLUMNS =
      "id, auth_id, email, child_username, first_name, last_name, role, parent_id, grade_level, avatar, status, created_at, updated_at, account_type, subscription_plan_id, subscription_expires_at, child_age, last_login_ip, last_login_city, last_login_country, last_active_at, latitude, longitude, avatar_border, name_animation, name_color, equipped_border, featured_badges, login_count, login_streak, last_login_date, ban_reason, ban_until, onboarding_completed, notif_weekly_reports, notif_offers_news, school_zone, two_factor_enabled, needs_grade_choice, graduated_at";

export default async function AdminUsersPage() {
  // Paginé : un simple select plafonne à 1000 lignes — au-delà, les
  // utilisateurs suivants n'apparaissaient tout simplement pas dans l'admin.
  // Les deux lectures sont indépendantes et partent ensemble.
  const [users, { data: plans }] = await Promise.all([
    selectAllPages((from, to) =>
      supabaseAdmin.from("users").select(USER_COLUMNS).order("created_at", { ascending: false }).order("id").range(from, to),
    ),
    // Plans proposables à la création d'un compte (abonnement offert ou non) —
    // voir src/lib/adminGrantSubscription.ts.
    supabaseAdmin
      .from("subscription_plans")
      .select("id, name, price, billing_interval")
      .eq("is_active", true)
      .order("price")
      .order("id"),
  ]);

  return <AdminUsersClient initialUsers={users as any[]} plans={plans || []} />;
}
