import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminSecurityClient from "@/components/admin/AdminSecurityClient";

export default async function AdminSecurityPage() {
  const { data } = await supabaseAdmin
    .from("admin_ip_allowlist")
    .select("id, cidr, label, created_at")
    .order("created_at", { ascending: false });

  return <AdminSecurityClient initialEntries={data || []} />;
}
