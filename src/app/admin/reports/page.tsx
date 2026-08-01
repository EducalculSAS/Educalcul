import { fetchAdminReports } from "@/lib/adminReports";
import AdminReportsClient from "@/components/admin/AdminReportsClient";

export default async function ReportsPage() {
  const data = await fetchAdminReports();
  return <AdminReportsClient initialData={data} />;
}
