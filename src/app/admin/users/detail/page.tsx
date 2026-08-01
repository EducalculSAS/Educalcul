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
    supabaseAdmin.from("subscription_plans").select("*").order("sort_order", { ascending: true }),
  ]);

  if (!detail) return <div className="p-6 text-red-500">Utilisateur introuvable.</div>;

  return <AdminUserDetailClient id={id} initialData={detail} initialPlans={plans || []} />;
}
