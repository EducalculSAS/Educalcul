import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminEmailsClient from "@/components/admin/AdminEmailsClient";
import { selectAllPages } from "@/lib/selectAllPages";

export default async function AdminEmailsPage() {
  const [{ data: templates }, users] = await Promise.all([
    supabaseAdmin.from("email_templates").select("*").order("type").order("created_at"),
    // Paginé : au-delà de 1000 comptes, les suivants manquaient à la liste.
    selectAllPages((from, to) =>
      supabaseAdmin.from("users").select("id, auth_id, email, first_name, last_name, role").order("first_name").order("id").range(from, to),
    ),
  ]);

  return <AdminEmailsClient initialTemplates={templates || []} initialSiteUsers={users as any[]} />;
}
