import { fetchWaitlistSignups } from "@/lib/waitlistQuery";
import AdminLandingClient from "@/components/admin/AdminLandingClient";

export default async function AdminLandingPage() {
  const { entries, stats } = await fetchWaitlistSignups();
  return <AdminLandingClient initialEntries={entries} initialStats={stats} />;
}
