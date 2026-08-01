import { fetchAdminStats } from "@/lib/adminStats";
import AdminDashboardClient from "@/components/admin/AdminDashboardClient";

export default async function AdminDashboard() {
  const data = await fetchAdminStats();
  return <AdminDashboardClient initialData={data} />;
}
