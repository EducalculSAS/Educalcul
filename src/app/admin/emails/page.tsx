import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminEmailsClient from "@/components/admin/AdminEmailsClient";

export default async function AdminEmailsPage() {
  const [{ data: templates }, { data: users }] = await Promise.all([
    supabaseAdmin.from("email_templates").select("*").order("type").order("created_at"),
    supabaseAdmin.from("users").select("id, auth_id, email, first_name, last_name, role").order("first_name"),
  ]);

  return <AdminEmailsClient initialTemplates={templates || []} initialSiteUsers={users || []} />;
}
