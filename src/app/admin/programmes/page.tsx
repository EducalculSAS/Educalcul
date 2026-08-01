import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminProgrammesClient from "@/components/admin/AdminProgrammesClient";

export default async function AdminProgrammesPage() {
  const { data } = await supabaseAdmin.from("programme_pdfs").select("*").order("level");
  return <AdminProgrammesClient initialPdfs={data || []} />;
}
