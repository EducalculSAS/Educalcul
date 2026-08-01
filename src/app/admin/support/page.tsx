import { fetchSupportTickets } from "@/lib/supportTicketsQuery";
import AdminSupportClient from "@/components/admin/AdminSupportClient";

export default async function SupportPage() {
  const tickets = await fetchSupportTickets("active");
  return <AdminSupportClient initialTickets={tickets} />;
}
