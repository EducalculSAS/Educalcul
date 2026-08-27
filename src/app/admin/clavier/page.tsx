import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminKeyboardsClient from "@/components/admin/AdminKeyboardsClient";

export default async function AdminKeyboardsPage() {
  const { data } = await supabaseAdmin.from("math_keyboards").select("*").order("id");
  return <AdminKeyboardsClient initialKeyboards={data || []} />;
}
