import StateScreen from "@/components/StateScreen";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { fetchAdminUserDetail } from "@/lib/adminUserDetail";
import AdminUserDetailClient from "@/components/admin/AdminUserDetailClient";

export default async function UserDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) return <div className="p-6 text-red-500">ID manquant.</div>;

  const [detail, { data: plans }] = await Promise.all([
    fetchAdminUserDetail(id),
    supabaseAdmin.from("subscription_plans").select("*").order("sort_order", { ascending: true }).order("id", { ascending: true }),
  ]);

  if (!detail) return <StateScreen fill="block" emblem="profile" title="Utilisateur introuvable" actions={[{ label: "Retour aux utilisateurs", href: "/admin/users" }]}>Ce compte n&apos;existe pas ou a été supprimé.</StateScreen>;

  return <AdminUserDetailClient id={id} initialData={detail} initialPlans={plans || []} />;
}
