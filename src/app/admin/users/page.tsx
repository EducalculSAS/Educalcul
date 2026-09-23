import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminUsersClient from "@/components/admin/AdminUsersClient";
import { selectAllPages } from "@/lib/selectAllPages";
import { ADMIN_USER_LIST_COLUMNS } from "@/lib/adminUserColumns";


export default async function AdminUsersPage() {
  // Paginé : un simple select plafonne à 1000 lignes — au-delà, les
  // utilisateurs suivants n'apparaissaient tout simplement pas dans l'admin.
  // Les deux lectures sont indépendantes et partent ensemble.
  const [users, { data: plans }] = await Promise.all([
    selectAllPages((from, to) =>
      supabaseAdmin.from("users").select(ADMIN_USER_LIST_COLUMNS).order("created_at", { ascending: false }).order("id").range(from, to),
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
