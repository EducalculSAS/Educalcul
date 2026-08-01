import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminUsersClient from "@/components/admin/AdminUsersClient";

export default async function AdminUsersPage() {
  const { data } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  return <AdminUsersClient initialUsers={data || []} />;
}
